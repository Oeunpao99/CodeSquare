"""Community — social surfaces that rank or connect learners.

For now this is just the Leaderboard: every user ranked by total XP (completed
lesson score + distinct solved-challenge XP), matching the maths in
routers/progress.get_progress_summary. Heavier social features (discussions, peer
reviews) are intentionally not here yet.
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.models import (
    Challenge, ChallengeAttempt, Quiz, QuizAttempt, User, UserProgress,
)
from routers.auth import get_current_user

router = APIRouter()


class LeaderboardRow(BaseModel):
    rank: int
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    major: Optional[str] = None
    xp: int
    lessons_completed: int
    challenges_solved: int
    quizzes_passed: int = 0
    is_me: bool = False


class LeaderboardResponse(BaseModel):
    top: List[LeaderboardRow]
    me: Optional[LeaderboardRow] = None   # set only when the caller is outside `top`
    total_ranked: int


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))

    # --- completed-lesson XP + count, per user ---
    lesson_rows = (
        await db.execute(
            select(
                UserProgress.user_id,
                func.coalesce(func.sum(UserProgress.score), 0),
                func.count(UserProgress.id),
            )
            .where(UserProgress.completed.is_(True))
            .group_by(UserProgress.user_id)
        )
    ).all()
    lesson_xp: Dict[int, float] = {uid: xp for uid, xp, _ in lesson_rows}
    lessons_done: Dict[int, int] = {uid: n for uid, _, n in lesson_rows}

    # --- distinct solved challenges, per user ---
    solved_rows = (
        await db.execute(
            select(ChallengeAttempt.user_id, ChallengeAttempt.challenge_id)
            .where(ChallengeAttempt.passed.is_(True))
            .distinct()
        )
    ).all()
    challenge_ids = {cid for _, cid in solved_rows}
    xp_by_challenge: Dict[int, int] = {}
    if challenge_ids:
        xp_by_challenge = {
            cid: (xp or 0)
            for cid, xp in (
                await db.execute(
                    select(Challenge.id, Challenge.xp_reward).where(
                        Challenge.id.in_(challenge_ids)
                    )
                )
            ).all()
        }
    challenge_xp: Dict[int, int] = {}
    challenges_solved: Dict[int, int] = {}
    for uid, cid in solved_rows:
        challenge_xp[uid] = challenge_xp.get(uid, 0) + xp_by_challenge.get(cid, 0)
        challenges_solved[uid] = challenges_solved.get(uid, 0) + 1

    # --- distinct passed quizzes, per user ---
    passed_quiz_rows = (
        await db.execute(
            select(QuizAttempt.user_id, QuizAttempt.quiz_id)
            .where(QuizAttempt.passed.is_(True))
            .distinct()
        )
    ).all()
    quiz_ids = {qid for _, qid in passed_quiz_rows}
    xp_by_quiz: Dict[int, int] = {}
    if quiz_ids:
        xp_by_quiz = {
            qid: (xp or 0)
            for qid, xp in (
                await db.execute(
                    select(Quiz.id, Quiz.xp_reward).where(Quiz.id.in_(quiz_ids))
                )
            ).all()
        }
    quiz_xp: Dict[int, int] = {}
    quizzes_passed: Dict[int, int] = {}
    for uid, qid in passed_quiz_rows:
        quiz_xp[uid] = quiz_xp.get(uid, 0) + xp_by_quiz.get(qid, 0)
        quizzes_passed[uid] = quizzes_passed.get(uid, 0) + 1

    users = (await db.execute(select(User))).scalars().all()

    ranked: List[LeaderboardRow] = []
    for u in users:
        xp = (
            int(round(lesson_xp.get(u.id, 0)))
            + int(challenge_xp.get(u.id, 0))
            + int(quiz_xp.get(u.id, 0))
        )
        lc = lessons_done.get(u.id, 0)
        cs = challenges_solved.get(u.id, 0)
        qp = quizzes_passed.get(u.id, 0)
        if xp == 0 and lc == 0 and cs == 0 and qp == 0:
            continue  # keep the board to people who've actually started
        ranked.append(
            LeaderboardRow(
                rank=0,
                user_id=u.id,
                username=u.username or f"user{u.id}",
                avatar_url=u.avatar_url,
                major=u.major,
                xp=xp,
                lessons_completed=lc,
                challenges_solved=cs,
                quizzes_passed=qp,
                is_me=(u.id == current_user.id),
            )
        )

    ranked.sort(key=lambda r: (-r.xp, -r.lessons_completed, r.username.lower()))
    for i, row in enumerate(ranked, start=1):
        row.rank = i

    top = ranked[:limit]
    me = next((r for r in ranked if r.is_me), None)
    me_outside = me if (me and me.rank > limit) else None

    return LeaderboardResponse(top=top, me=me_outside, total_ranked=len(ranked))
