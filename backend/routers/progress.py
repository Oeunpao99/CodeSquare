from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from database import get_db
from models.models import (
    User, UserProgress, HintUsage, UserProject, Lesson, Exercise,
    Challenge, ChallengeAttempt, Quiz, QuizAttempt, Language, Module,
)
from routers.auth import get_current_user
from common.cambodia import khmer_date, khmer_day_range, khmer_today
from skills import compute_skills
from majors import MAJOR_TRACKS
from datetime import datetime, timedelta

router = APIRouter()

class ProgressSummary(BaseModel):
    total_lessons_completed: int
    total_xp: int
    current_streak: int
    hints_used_total: int
    avg_time_per_lesson: float
    weak_concepts: List[str]
    recommended_action: str
    challenges_solved: int = 0
    quizzes_passed: int = 0


class SkillRow(BaseModel):
    key: str
    label: str
    score: int
    level: str
    lessons_done: int
    lessons_total: int
    challenges_done: int
    challenges_total: int
    projects: int


class SkillsResponse(BaseModel):
    skills: List[SkillRow]
    lessons_completed: int
    challenges_solved: int
    projects: int
    total_xp: int

class ContinueResponse(BaseModel):
    track_slug: str
    track_name: str
    module_id: int
    module_title: str
    lesson_id: int
    lesson_title: str
    completed_in_track: int
    total_in_track: int
    last_activity: Optional[datetime] = None


class LessonProgress(BaseModel):
    lesson_id: int
    lesson_title: str
    module_title: str
    completed: bool
    score: float
    time_spent: int
    attempts: int
    hints_used: int

class WeeklyActivity(BaseModel):
    day: str
    lessons_completed: int
    time_spent: int
    xp_earned: int

class DetailedProgress(BaseModel):
    summary: ProgressSummary
    lessons: List[LessonProgress]
    weekly_activity: List[WeeklyActivity]
    recent_projects: List[Dict[str, Any]]

@router.get("/summary", response_model=ProgressSummary)
async def get_progress_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    progress_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == current_user.id)
        .where(UserProgress.completed == True)
    )
    completed_lessons = progress_result.scalars().all()

    lesson_xp = sum(lesson.score for lesson in completed_lessons) if completed_lessons else 0

    # Fold in solved practice challenges (distinct challenges, first pass counts).
    solved_ids = [
        cid
        for (cid,) in (
            await db.execute(
                select(ChallengeAttempt.challenge_id)
                .where(
                    ChallengeAttempt.user_id == current_user.id,
                    ChallengeAttempt.passed.is_(True),
                )
                .distinct()
            )
        ).all()
    ]
    challenges_solved = len(solved_ids)
    challenge_xp = 0
    if solved_ids:
        challenge_xp = (
            await db.execute(
                select(func.coalesce(func.sum(Challenge.xp_reward), 0)).where(
                    Challenge.id.in_(solved_ids)
                )
            )
        ).scalar() or 0

    # Fold in passed quizzes (distinct quizzes, first pass counts).
    passed_quiz_ids = [
        qid
        for (qid,) in (
            await db.execute(
                select(QuizAttempt.quiz_id)
                .where(
                    QuizAttempt.user_id == current_user.id,
                    QuizAttempt.passed.is_(True),
                )
                .distinct()
            )
        ).all()
    ]
    quizzes_passed = len(passed_quiz_ids)
    quiz_xp = 0
    if passed_quiz_ids:
        quiz_xp = (
            await db.execute(
                select(func.coalesce(func.sum(Quiz.xp_reward), 0)).where(
                    Quiz.id.in_(passed_quiz_ids)
                )
            )
        ).scalar() or 0

    total_xp = lesson_xp + challenge_xp + quiz_xp

    hints_result = await db.execute(
        select(func.count(HintUsage.id))
        .where(HintUsage.user_id == current_user.id)
    )
    hints_total = hints_result.scalar() or 0
    
    avg_time = 0
    if completed_lessons:
        total_time = sum(lesson.time_spent for lesson in completed_lessons)
        avg_time = total_time / len(completed_lessons)
    
    weak_concepts = await identify_weak_concepts(current_user.id, db)
    
    recommended_action = await generate_recommendation(
        current_user.id, 
        len(completed_lessons),
        hints_total,
        weak_concepts,
        db
    )
    
    return ProgressSummary(
        total_lessons_completed=len(completed_lessons),
        total_xp=total_xp,
        current_streak=await calculate_streak(current_user.id, db),
        hints_used_total=hints_total,
        avg_time_per_lesson=avg_time,
        weak_concepts=weak_concepts,
        recommended_action=recommended_action,
        challenges_solved=challenges_solved,
        quizzes_passed=quizzes_passed,
    )


@router.get("/skills", response_model=SkillsResponse)
async def get_skills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await compute_skills(db, current_user.id)
    summary = await get_progress_summary(db, current_user)
    projects_count = (
        await db.execute(
            select(func.count(UserProject.id)).where(
                UserProject.user_id == current_user.id
            )
        )
    ).scalar() or 0
    return SkillsResponse(
        skills=[SkillRow(**r) for r in rows],
        lessons_completed=summary.total_lessons_completed,
        challenges_solved=summary.challenges_solved,
        projects=projects_count,
        total_xp=summary.total_xp,
    )

@router.get("/continue", response_model=Optional[ContinueResponse])
async def continue_learning(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The single next lesson to resume — the first unfinished lesson in the
    track the user most recently worked on. Falls back to the next track in their
    major's path, then any track with an unfinished lesson. Returns null (200)
    when the user hasn't completed anything yet or has finished every seeded
    lesson.
    """
    prog_rows = (
        await db.execute(
            select(UserProgress.lesson_id, UserProgress.completed, UserProgress.completed_at)
            .where(UserProgress.user_id == current_user.id)
        )
    ).all()
    done_ids = {lid for lid, completed, _ in prog_rows if completed}
    if not done_ids:
        return None

    langs = (
        await db.execute(
            select(Language).options(
                selectinload(Language.modules).selectinload(Module.lessons)
            )
        )
    ).scalars().all()
    by_slug = {lang.slug: lang for lang in langs}

    # Track of the most recently completed lesson → resume there first.
    last_completed_at: Optional[datetime] = None
    recent_slug: Optional[str] = None
    lesson_to_slug: Dict[int, str] = {}
    for lang in langs:
        for m in lang.modules:
            for les in m.lessons:
                lesson_to_slug[les.id] = lang.slug
    for lid, completed, at in prog_rows:
        if completed and at and (last_completed_at is None or at > last_completed_at):
            last_completed_at = at
            recent_slug = lesson_to_slug.get(lid)

    major_path = MAJOR_TRACKS.get(current_user.major or "", [])

    def first_unfinished(lang: Language):
        modules = sorted(lang.modules, key=lambda m: (m.order or 0))
        total = sum(len(m.lessons) for m in modules)
        completed = sum(1 for m in modules for les in m.lessons if les.id in done_ids)
        if total == 0:
            return None
        for m in modules:
            for les in sorted(m.lessons, key=lambda x: (x.order or 0)):
                if les.id not in done_ids:
                    return ContinueResponse(
                        track_slug=lang.slug,
                        track_name=lang.name,
                        module_id=m.id,
                        module_title=m.title,
                        lesson_id=les.id,
                        lesson_title=les.title,
                        completed_in_track=completed,
                        total_in_track=total,
                        last_activity=last_completed_at,
                    ), completed
        return None

    # Pass 1: resume a track that's started but not finished (recent track first,
    # then the major path, then anything else).
    seen: set = set()
    ordered = [recent_slug] + major_path + list(by_slug) if recent_slug else major_path + list(by_slug)
    for slug in ordered:
        if not slug or slug in seen:
            continue
        seen.add(slug)
        lang = by_slug.get(slug)
        if not lang:
            continue
        hit = first_unfinished(lang)
        if hit and hit[1] > 0:
            return hit[0]

    # Pass 2: nothing mid-flight — point at the start of the next track in the
    # major's path that still has unfinished lessons.
    for slug in major_path:
        lang = by_slug.get(slug)
        if not lang:
            continue
        hit = first_unfinished(lang)
        if hit:
            return hit[0]

    return None


async def identify_weak_concepts(user_id: int, db: AsyncSession) -> List[str]:
    hint_result = await db.execute(
        select(HintUsage.exercise_id, func.count(HintUsage.id).label("hint_count"))
        .where(HintUsage.user_id == user_id)
        .group_by(HintUsage.exercise_id)
        .order_by(func.count(HintUsage.id).desc())
        .limit(3)
    )
    frequent_hints = hint_result.all()
    
    weak_concepts = []
    for exercise_id, _ in frequent_hints:
        exercise_result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
        exercise = exercise_result.scalar_one_or_none()
        if exercise:
            weak_concepts.append(exercise.title)
    
    return weak_concepts

async def generate_recommendation(
    user_id: int, 
    lessons_completed: int, 
    hints_used: int,
    weak_concepts: List[str],
    db: AsyncSession
) -> str:
    if lessons_completed == 0:
        return "Start with your first lesson to begin your coding journey!"
    
    if hints_used > lessons_completed * 3:
        return "Consider reviewing previous lessons before moving forward. You've been using many hints."
    
    if weak_concepts:
        return f"Focus on practicing: {', '.join(weak_concepts[:2])}. These areas need more attention."
    
    lesson_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == user_id)
        .where(UserProgress.completed == False)
        .order_by(UserProgress.id)
        .limit(1)
    )
    next_lesson = lesson_result.scalar_one_or_none()
    
    if next_lesson:
        lesson_info = await db.execute(select(Lesson).where(Lesson.id == next_lesson.lesson_id))
        lesson = lesson_info.scalar_one_or_none()
        if lesson:
            return f"Continue with: {lesson.title}"
    
    return "Great progress! Try building a project with your new skills."

async def calculate_streak(user_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(UserProgress.completed_at)
        .where(UserProgress.user_id == user_id)
        .where(UserProgress.completed == True)
        .order_by(UserProgress.completed_at.desc())
    )
    completion_dates = result.scalars().all()
    
    if not completion_dates:
        return 0
    
    streak = 0
    today = khmer_today()
    
    for item in completion_dates:
        cday = khmer_date(item)
        if cday == today:
            streak += 1
            today -= timedelta(days=1)
        elif cday == today - timedelta(days=1):
            today = cday
            streak += 1
        else:
            break
    
    return streak

@router.get("/detailed", response_model=DetailedProgress)
async def get_detailed_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = await get_progress_summary(db, current_user)
    
    lessons_result = await db.execute(
        select(UserProgress, Lesson, Lesson.module_id)
        .join(Lesson, UserProgress.lesson_id == Lesson.id)
        .where(UserProgress.user_id == current_user.id)
    )
    lesson_progresses = lessons_result.all()
    
    lessons = []
    for progress, lesson, module_id in lesson_progresses:
        hints_result = await db.execute(
            select(func.count(HintUsage.id))
            .join(Exercise, HintUsage.exercise_id == Exercise.id)
            .where(Exercise.lesson_id == lesson.id)
            .where(HintUsage.user_id == current_user.id)
        )
        hints = hints_result.scalar() or 0
        
        lessons.append(LessonProgress(
            lesson_id=lesson.id,
            lesson_title=lesson.title,
            module_title=f"Module {module_id}",
            completed=progress.completed,
            score=progress.score,
            time_spent=progress.time_spent,
            attempts=progress.attempts,
            hints_used=hints
        ))
    
    weekly_activity = await get_weekly_activity(current_user.id, db)
    
    projects_result = await db.execute(
        select(UserProject)
        .where(UserProject.user_id == current_user.id)
        .order_by(UserProject.created_at.desc())
        .limit(5)
    )
    recent_projects = [
        {
            "id": p.id,
            "title": p.title,
            "language": p.language,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in projects_result.scalars().all()
    ]
    
    return DetailedProgress(
        summary=summary,
        lessons=lessons,
        weekly_activity=weekly_activity,
        recent_projects=recent_projects
    )

async def get_weekly_activity(user_id: int, db: AsyncSession) -> List[WeeklyActivity]:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    today = khmer_today()
    start_of_week = today - timedelta(days=today.weekday())
    
    weekly = []
    for i, day in enumerate(days):
        day_date = start_of_week + timedelta(days=i)
        day_start, day_end = khmer_day_range(day_date)
        
        result = await db.execute(
            select(func.count(UserProgress.id), func.sum(UserProgress.time_spent))
            .where(UserProgress.user_id == user_id)
            .where(UserProgress.completed_at.between(day_start, day_end))
        )
        row = result.one()
        
        weekly.append(WeeklyActivity(
            day=day,
            lessons_completed=row[0] or 0,
            time_spent=row[1] or 0,
            xp_earned=row[0] * 10 if row[0] else 0
        ))
    
    return weekly