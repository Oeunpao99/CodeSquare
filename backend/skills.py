"""Per-skill progress aggregation, shared by the Progress skills view and the
Career readiness score.

A "skill" (see SKILL_DEFS in majors.py) blends three signals:
  - lesson completion within its tracks,
  - solved challenges matching its languages/topics,
  - a small bonus for projects built in the area.
"""
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from majors import SKILL_DEFS
from models.models import (
    Challenge, ChallengeAttempt, Language, Lesson, Module, UserProgress, UserProject,
)


def _level(score: int) -> str:
    if score < 20:
        return "Novice"
    if score < 50:
        return "Learning"
    if score < 80:
        return "Proficient"
    return "Strong"


async def compute_skills(db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """Return one row per skill that has any learnable content, ordered as in
    SKILL_DEFS. Skills with no lessons and no challenges available are omitted.
    """
    # lesson id -> track slug
    lesson_rows = (
        await db.execute(
            select(Lesson.id, Language.slug)
            .join(Module, Module.id == Lesson.module_id)
            .join(Language, Language.id == Module.language_id)
        )
    ).all()
    track_of_lesson = {lid: slug for lid, slug in lesson_rows}

    completed_lessons = {
        lid
        for (lid,) in (
            await db.execute(
                select(UserProgress.lesson_id).where(
                    UserProgress.user_id == user_id,
                    UserProgress.completed.is_(True),
                )
            )
        ).all()
    }

    challenge_rows = (
        await db.execute(select(Challenge.id, Challenge.language, Challenge.topic))
    ).all()

    solved_challenges = {
        cid
        for (cid,) in (
            await db.execute(
                select(ChallengeAttempt.challenge_id).where(
                    ChallengeAttempt.user_id == user_id,
                    ChallengeAttempt.passed.is_(True),
                )
            )
        ).all()
    }

    project_rows = (
        await db.execute(
            select(UserProject.track_slug, UserProject.language).where(
                UserProject.user_id == user_id
            )
        )
    ).all()

    out: List[Dict[str, Any]] = []
    for sd in SKILL_DEFS:
        tracks = set(sd["tracks"])
        langs = set(sd["challenge_langs"])
        topics = set(sd["challenge_topics"])

        lessons_total = sum(1 for lid, slug in track_of_lesson.items() if slug in tracks)
        lessons_done = sum(
            1
            for lid in completed_lessons
            if track_of_lesson.get(lid) in tracks
        )

        matched_challenges = [
            cid for cid, lang, topic in challenge_rows
            if (lang in langs) or (topic in topics)
        ]
        challenges_total = len(matched_challenges)
        challenges_done = sum(1 for cid in matched_challenges if cid in solved_challenges)

        projects = sum(
            1
            for ts, lang in project_rows
            if (ts in tracks) or (lang in langs) or (lang in tracks)
        )

        if lessons_total == 0 and challenges_total == 0:
            continue

        parts: List[float] = []
        weights: List[float] = []
        if lessons_total:
            parts.append(lessons_done / lessons_total)
            weights.append(0.6)
        if challenges_total:
            parts.append(challenges_done / challenges_total)
            weights.append(0.4 if lessons_total else 1.0)
        blend = sum(p * w for p, w in zip(parts, weights)) / sum(weights)

        score = round(blend * 100) + min(projects, 3) * 5
        score = max(0, min(100, score))

        out.append(
            {
                "key": sd["key"],
                "label": sd["label"],
                "score": score,
                "level": _level(score),
                "lessons_done": lessons_done,
                "lessons_total": lessons_total,
                "challenges_done": challenges_done,
                "challenges_total": challenges_total,
                "projects": projects,
            }
        )

    return out
