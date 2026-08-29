from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from models.models import Language, Module, Lesson, Exercise, UserProgress
from routers.auth import get_current_user
from models.models import User
from datetime import datetime

router = APIRouter()

class LessonCompleteRequest(BaseModel):
    lesson_id: int
    score: float = 100
    time_spent: int = 0
    attempts: int = 1

class LanguageResponse(BaseModel):
    id: int
    name: str
    slug: str
    icon: str
    description: str
    color: str
    
    class Config:
        from_attributes = True

class ExerciseResponse(BaseModel):
    id: int
    title: str
    description: str
    starter_code: str
    test_cases: dict
    hints: list
    order: int
    
    class Config:
        from_attributes = True

class LessonResponse(BaseModel):
    id: int
    title: str
    content: str
    code_example: str
    starter_code: str
    solution: str
    order: int
    xp_reward: int
    exercises: List[ExerciseResponse] = []
    completed: bool = False
    score: float = 0
    
    class Config:
        from_attributes = True

class ModuleResponse(BaseModel):
    id: int
    title: str
    description: str
    order: int
    level: int = 1
    difficulty: str
    lessons: List[LessonResponse] = []
    
    class Config:
        from_attributes = True

class LanguageDetailResponse(LanguageResponse):
    modules: List[ModuleResponse] = []

@router.get("/languages", response_model=List[LanguageResponse])
async def get_languages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Language))
    languages = result.scalars().all()
    return [LanguageResponse.model_validate(lang) for lang in languages]


class PracticeItem(BaseModel):
    exercise_id: int
    title: str
    description: str
    starter_code: str
    hints: list
    language: str          # Language.slug — drives the editor mode
    language_name: str
    lesson_title: str


@router.get("/practice", response_model=List[PracticeItem])
async def get_practice(
    limit: int = 10,
    slugs: Optional[str] = None,   # comma-separated Language slugs to draw from
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A shuffled batch of exercises for quick-fire practice."""
    limit = max(1, min(limit, 30))
    q = (
        select(Exercise, Lesson.title, Language.slug, Language.name)
        .join(Lesson, Lesson.id == Exercise.lesson_id)
        .join(Module, Module.id == Lesson.module_id)
        .join(Language, Language.id == Module.language_id)
    )
    if slugs:
        wanted = [s.strip() for s in slugs.split(",") if s.strip()]
        if wanted:
            q = q.where(Language.slug.in_(wanted))
    q = q.order_by(func.random()).limit(limit)

    rows = (await db.execute(q)).all()
    return [
        PracticeItem(
            exercise_id=ex.id,
            title=ex.title,
            description=ex.description,
            starter_code=ex.starter_code or "",
            hints=ex.hints if isinstance(ex.hints, list) else [],
            language=slug,
            language_name=lang_name,
            lesson_title=lesson_title,
        )
        for ex, lesson_title, slug, lang_name in rows
    ]

@router.get("/languages/{slug}", response_model=LanguageDetailResponse)
async def get_language_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Language)
        .where(Language.slug == slug)
        .options(
            selectinload(Language.modules)
            .selectinload(Module.lessons)
            .selectinload(Lesson.exercises)
        )
    )
    language = result.scalar_one_or_none()
    
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    # Mark lessons completed for this user so the track view reflects progress.
    progress_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == current_user.id)
    )
    progress_map = {p.lesson_id: p for p in progress_result.scalars().all()}

    language_data = LanguageDetailResponse.model_validate(language)
    # DB returns relationships in insertion order — present the ladder by order.
    language_data.modules.sort(key=lambda m: (m.order or 0))
    for module in language_data.modules:
        module.lessons.sort(key=lambda x: (x.order or 0))
        for lesson in module.lessons:
            p = progress_map.get(lesson.id)
            if p:
                lesson.completed = p.completed
                lesson.score = p.score

    return language_data

@router.get("/languages/{slug}/modules/{module_id}/lessons/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    slug: str, 
    module_id: int, 
    lesson_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Lesson)
        .join(Module)
        .join(Language)
        .where(Language.slug == slug)
        .where(Module.id == module_id)
        .where(Lesson.id == lesson_id)
        .options(selectinload(Lesson.exercises))
    )
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    progress_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == current_user.id)
        .where(UserProgress.lesson_id == lesson_id)
    )
    progress = progress_result.scalar_one_or_none()
    
    lesson_data = LessonResponse.model_validate(lesson)
    if progress:
        lesson_data.completed = progress.completed
        lesson_data.score = progress.score
    
    return lesson_data

@router.post("/submit-exercise")
async def submit_exercise(
    exercise_id: int,
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercise_result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = exercise_result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    passed = True
    results = []

    for test_case in exercise.test_cases.get("tests", []):
        try:
            exec_globals = {"code": code, "__code__": code}
            # The user's code may not be Python (e.g. HTML, SQL, JS, shell, or
            # placeholder text). Try to exec it so variable-based tests get
            # their namespace, but swallow any compile/runtime errors so
            # string-content tests (which reference `code`) still run.
            try:
                compile(code, "<user_code>", "exec")
                exec(code, exec_globals)
            except Exception:
                pass

            test_code = test_case.get("test", "")
            # Tests can be Python `assert` statements (which raise on failure)
            # OR plain boolean expressions (e.g. "'CREATE TABLE' in code"). We
            # eval the expression when possible so a False result fails the
            # test; otherwise fall back to exec for statement-style tests.
            try:
                result = eval(test_code, exec_globals)
            except SyntaxError:
                exec(test_code, exec_globals)
                result = True
            # Only an explicit False fails the test. Statement-style checks that
            # are still valid expressions (e.g. `print(...)`) eval to None — they
            # pass as long as they ran without raising.
            if result is False:
                raise AssertionError(test_case.get("description", "test failed"))
            results.append({"passed": True, "description": test_case.get("description", "")})
        except Exception as e:
            passed = False
            results.append({
                "passed": False, 
                "description": test_case.get("description", ""),
                "error": str(e)
            })
    
    return {
        "passed": passed,
        "results": results,
        "message": "All tests passed!" if passed else "Some tests failed. Keep trying!"
    }

@router.post("/complete-lesson")
async def complete_lesson(
    request: LessonCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == current_user.id)
        .where(UserProgress.lesson_id == request.lesson_id)
    )
    progress = result.scalar_one_or_none()
    
    if not progress:
        progress = UserProgress(
            user_id=current_user.id,
            lesson_id=request.lesson_id
        )
        db.add(progress)
    
    progress.completed = True
    progress.score = request.score
    progress.time_spent = request.time_spent
    progress.attempts = request.attempts
    progress.completed_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "completed": True,
        "score": progress.score,
        "message": "Lesson completed! Great job!"
    }