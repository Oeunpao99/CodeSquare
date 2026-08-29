"""Standalone quizzes — multiple-choice knowledge checks for the Practice
section, independent of the lesson tree. Browse/filter, take a quiz, and submit
answers for server-side grading. First pass awards the quiz's XP once; that XP is
folded into the same totals as lessons and challenges (see routers/progress and
routers/community).
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.models import Quiz, QuizAttempt, User
from routers.auth import get_current_user

router = APIRouter()

DIFFICULTY_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}


# ---------- grading ----------

def _grade(questions: List[Dict[str, Any]], answers: List[int]) -> Dict[str, Any]:
    """Compare submitted option indices against each question's `answer`."""
    total = len(questions)
    per_question: List[Dict[str, Any]] = []
    correct = 0
    for i, q in enumerate(questions):
        given = answers[i] if i < len(answers) else -1
        right = q.get("answer")
        ok = given == right
        if ok:
            correct += 1
        per_question.append(
            {
                "q": q.get("q", ""),
                "options": q.get("options", []),
                "your_answer": given,
                "correct_answer": right,
                "is_correct": ok,
                "explain": q.get("explain", ""),
            }
        )
    score = round(100 * correct / total, 1) if total else 0.0
    return {"score": score, "correct": correct, "total": total, "results": per_question}


# ---------- schemas ----------

class QuizCard(BaseModel):
    slug: str
    title: str
    language: Optional[str] = None
    difficulty: str
    topic: Optional[str] = None
    question_count: int
    pass_score: int
    xp_reward: int
    best_score: float = 0.0
    passed: bool = False


class QuizQuestionOut(BaseModel):
    q: str
    options: List[str]


class QuizDetail(BaseModel):
    slug: str
    title: str
    description: str
    language: Optional[str] = None
    difficulty: str
    topic: Optional[str] = None
    pass_score: int
    xp_reward: int
    questions: List[QuizQuestionOut]
    best_score: float = 0.0
    passed: bool = False


class SubmitRequest(BaseModel):
    answers: List[int]


class SubmitResponse(BaseModel):
    score: float
    correct: int
    total: int
    passed: bool
    pass_score: int
    first_pass: bool
    xp_awarded: int
    best_score: float
    results: List[Dict[str, Any]]


class QuizStats(BaseModel):
    total: int
    passed: int
    avg_score: float


# ---------- helpers ----------

async def _attempts_by_quiz(db: AsyncSession, user_id: int) -> Dict[int, Dict[str, Any]]:
    """Per-quiz {best_score, passed} for the given user."""
    rows = (
        await db.execute(
            select(
                QuizAttempt.quiz_id,
                func.max(QuizAttempt.score),
                func.bool_or(QuizAttempt.passed),
            )
            .where(QuizAttempt.user_id == user_id)
            .group_by(QuizAttempt.quiz_id)
        )
    ).all()
    return {
        qid: {"best_score": float(best or 0), "passed": bool(passed)}
        for qid, best, passed in rows
    }


async def _get_by_slug(db: AsyncSession, slug: str) -> Quiz:
    row = await db.execute(select(Quiz).where(Quiz.slug == slug))
    quiz = row.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


# ---------- fixed routes (declared before /{slug}) ----------

@router.get("", response_model=List[QuizCard])
async def list_quizzes(
    language: Optional[str] = None,
    difficulty: Optional[str] = None,
    topic: Optional[str] = None,
    passed: Optional[bool] = None,
    limit: int = 60,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    q = select(Quiz)
    if language:
        q = q.where(Quiz.language == language)
    if difficulty:
        q = q.where(Quiz.difficulty == difficulty)
    if topic:
        q = q.where(Quiz.topic == topic)
    q = q.order_by(Quiz.order, Quiz.id)
    rows = (await db.execute(q)).scalars().all()

    mine = await _attempts_by_quiz(db, current_user.id)
    cards = [
        QuizCard(
            slug=z.slug,
            title=z.title,
            language=z.language,
            difficulty=z.difficulty or "beginner",
            topic=z.topic,
            question_count=len(z.questions or []),
            pass_score=z.pass_score or 70,
            xp_reward=z.xp_reward or 0,
            best_score=mine.get(z.id, {}).get("best_score", 0.0),
            passed=mine.get(z.id, {}).get("passed", False),
        )
        for z in rows
    ]
    if passed is not None:
        cards = [c for c in cards if c.passed == passed]
    cards.sort(key=lambda c: (DIFFICULTY_ORDER.get(c.difficulty, 9), c.title.lower()))
    return cards[offset : offset + limit]


@router.get("/topics", response_model=List[str])
async def list_topics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(Quiz.topic).where(Quiz.topic.is_not(None)).distinct()
    )
    return sorted({t for (t,) in rows.all() if t})


@router.get("/stats/me", response_model=QuizStats)
async def my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = (await db.execute(select(func.count(Quiz.id)))).scalar() or 0
    mine = await _attempts_by_quiz(db, current_user.id)
    passed = sum(1 for v in mine.values() if v["passed"])
    avg = (
        round(sum(v["best_score"] for v in mine.values()) / len(mine), 1)
        if mine
        else 0.0
    )
    return QuizStats(total=total, passed=passed, avg_score=avg)


# ---------- /{slug} ----------

async def _detail(db: AsyncSession, z: Quiz, user_id: int) -> QuizDetail:
    mine = await _attempts_by_quiz(db, user_id)
    state = mine.get(z.id, {})
    return QuizDetail(
        slug=z.slug,
        title=z.title,
        description=z.description or "",
        language=z.language,
        difficulty=z.difficulty or "beginner",
        topic=z.topic,
        pass_score=z.pass_score or 70,
        xp_reward=z.xp_reward or 0,
        questions=[
            QuizQuestionOut(q=q.get("q", ""), options=q.get("options", []))
            for q in (z.questions or [])
        ],
        best_score=state.get("best_score", 0.0),
        passed=state.get("passed", False),
    )


@router.get("/{slug}", response_model=QuizDetail)
async def get_quiz(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await _get_by_slug(db, slug)
    return await _detail(db, quiz, current_user.id)


@router.post("/{slug}/submit", response_model=SubmitResponse)
async def submit_quiz(
    slug: str,
    body: SubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await _get_by_slug(db, slug)
    questions = quiz.questions or []
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    graded = _grade(questions, body.answers)
    pass_score = quiz.pass_score or 70
    is_pass = graded["score"] >= pass_score

    prior = (
        await db.execute(
            select(
                func.coalesce(func.max(QuizAttempt.score), 0.0),
                func.coalesce(func.bool_or(QuizAttempt.passed), False),
            ).where(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.quiz_id == quiz.id,
            )
        )
    ).one()
    prior_best, prior_passed = prior
    already_passed = bool(prior_passed)

    db.add(
        QuizAttempt(
            user_id=current_user.id,
            quiz_id=quiz.id,
            answers=body.answers,
            score=graded["score"],
            correct=graded["correct"],
            total=graded["total"],
            passed=is_pass,
            created_at=datetime.utcnow(),
        )
    )
    await db.commit()

    first_pass = is_pass and not already_passed
    return SubmitResponse(
        score=graded["score"],
        correct=graded["correct"],
        total=graded["total"],
        passed=is_pass,
        pass_score=pass_score,
        first_pass=first_pass,
        xp_awarded=(quiz.xp_reward or 0) if first_pass else 0,
        best_score=max(float(prior_best or 0), graded["score"]),
        results=graded["results"],
    )
