"""Per-day learning activity for contribution heatmaps.

A day's count = lessons completed + challenge runs + quiz attempts that day,
using Phnom Penh days (UTC+7), the same day boundary as streaks.
"""
from collections import Counter
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.cambodia import UTC_OFFSET
from models.models import ChallengeAttempt, QuizAttempt, UserProgress


async def daily_activity(db: AsyncSession, user_id: int, year: int) -> dict:
    # Year window in UTC that covers the whole local (UTC+7) year.
    start = datetime(year, 1, 1) - UTC_OFFSET
    end = datetime(year + 1, 1, 1) - UTC_OFFSET
    sources = [
        (UserProgress.completed_at, [UserProgress.user_id == user_id, UserProgress.completed.is_(True)]),
        (ChallengeAttempt.created_at, [ChallengeAttempt.user_id == user_id]),
        (QuizAttempt.created_at, [QuizAttempt.user_id == user_id]),
    ]
    days = Counter()
    for col, where in sources:
        rows = await db.execute(select(col).where(*where, col >= start, col < end))
        for (ts,) in rows:
            if ts is not None:
                days[(ts + UTC_OFFSET).date().isoformat()] += 1
    return {"year": year, "days": dict(days), "total": sum(days.values())}
