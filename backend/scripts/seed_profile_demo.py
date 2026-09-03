"""Seed one fully-fleshed learner so the Profile page (/profile, /u/<username>)
and the Job Readiness card (/career -> GET /api/career/readiness) have real data
to render.

What it creates / refreshes (idempotent - matched by email, progress is wiped
and rebuilt on every run):

  * a User with every profile field filled in + a chosen `major`
  * completed UserProgress rows across that major's lesson tracks
  * passed ChallengeAttempt rows across the practice challenges
  * a few UserProject rows (they feed both the profile and the readiness score)

    ./.venv/Scripts/python.exe seed_profile_demo.py

Login for the seeded account:  demo.ready@example.com  /  codesquare123
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select

from database import async_session
from majors import MAJOR_SKILLS, MAJOR_TRACKS
from models.models import (
    Challenge,
    ChallengeAttempt,
    Language,
    Lesson,
    Module,
    User,
    UserProgress,
    UserProject,
)
from routers.auth import get_password_hash

# --------------------------------------------------------------------------- #
#  Tunables                                                                    #
# --------------------------------------------------------------------------- #
EMAIL = "demo.ready@example.com"
USERNAME = "demoready"
PASSWORD = "codesquare123"
MAJOR = "ai-engineer"          # any key of majors.MAJOR_TRACKS / MAJOR_SKILLS

LESSON_COMPLETION = 0.82       # fraction of in-major lessons marked done
CHALLENGE_COMPLETION = 0.80    # fraction of challenges marked passed
DAYS_BACK = 45                 # spread completion dates over this many days

PROFILE = dict(
    display_name="Rin Sokha",
    headline="Career switcher -> AI Engineer. Building in public, day 90.",
    bio=(
        "Ex-data analyst learning to ship. Comfortable in Python and SQL, now "
        "wiring up FastAPI services and small RAG apps. Looking for a junior "
        "AI/backend role in 2026."
    ),
    github_url="https://github.com/rin-sokha",
    linkedin_url="https://www.linkedin.com/in/rin-sokha",
    website_url="https://rinsokha.dev",
    verified=True,
)

PROJECTS = [
    dict(
        title="RAG notes assistant",
        description="FastAPI + pgvector service that answers questions over my "
        "study notes. Chunking, embeddings, and a /ask endpoint with streaming.",
        language="python",
        track_slug="backend-foundations",
        status="done",
        pinned=True,
    ),
    dict(
        title="CSV -> insights CLI",
        description="Command-line tool that profiles a CSV (types, nulls, "
        "outliers) and prints a summary. Pandas + argparse, packaged with uv.",
        language="python",
        track_slug="python-intermediate",
        status="done",
    ),
    dict(
        title="Job board scraper",
        description="Scheduled scraper that collects junior AI/backend postings "
        "into Postgres and emails a daily digest.",
        language="python",
        track_slug="python",
        status="active",
    ),
]


async def main() -> None:
    random.seed(42)
    async with async_session() as db:
        # ---- user -------------------------------------------------------- #
        user = (
            await db.execute(select(User).where(User.email == EMAIL))
        ).scalar_one_or_none()
        if user is None:
            user = User(
                email=EMAIL,
                username=USERNAME,
                hashed_password=get_password_hash(PASSWORD),
                created_at=datetime.utcnow() - timedelta(days=DAYS_BACK + 5),
            )
            db.add(user)
            print(f"[user] created {EMAIL} (@{USERNAME})  password: {PASSWORD}")
        else:
            print(f"[user] reusing {EMAIL} (@{user.username}) id={user.id}")

        user.major = MAJOR
        user.onboarded_at = user.onboarded_at or datetime.utcnow()
        for k, v in PROFILE.items():
            setattr(user, k, v)
        await db.flush()

        # ---- wipe this user's prior demo progress ---------------------- #
        for model in (UserProgress, ChallengeAttempt, UserProject):
            await db.execute(delete(model).where(model.user_id == user.id))
        await db.flush()

        # ---- lessons in the major's tracks --------------------------- #
        tracks = MAJOR_TRACKS[MAJOR]
        lesson_rows = (
            await db.execute(
                select(Lesson.id, Lesson.xp_reward, Language.slug)
                .join(Module, Module.id == Lesson.module_id)
                .join(Language, Language.id == Module.language_id)
                .where(Language.slug.in_(tracks))
                .order_by(Language.slug, Lesson.order, Lesson.id)
            )
        ).all()

        take = int(len(lesson_rows) * LESSON_COMPLETION)
        chosen = lesson_rows[:take]
        now = datetime.utcnow()
        for i, (lid, xp, _slug) in enumerate(chosen):
            # oldest lessons finished first, newest most recently
            frac = i / max(len(chosen) - 1, 1)
            done_at = now - timedelta(
                days=DAYS_BACK * (1 - frac),
                hours=random.randint(0, 10),
                minutes=random.randint(0, 59),
            )
            db.add(
                UserProgress(
                    user_id=user.id,
                    lesson_id=lid,
                    completed=True,
                    score=float(xp or 10),
                    time_spent=random.randint(240, 1500),
                    attempts=random.randint(1, 3),
                    completed_at=done_at,
                )
            )
        print(f"[lessons] {len(chosen)}/{len(lesson_rows)} completed across {tracks}")

        # ---- challenges --------------------------------------------- #
        challenges = (
            await db.execute(
                select(Challenge.id, Challenge.xp_reward)
                .order_by(Challenge.order, Challenge.id)
            )
        ).all()
        take = int(len(challenges) * CHALLENGE_COMPLETION)
        for i, (cid, xp) in enumerate(challenges[:take]):
            frac = i / max(take - 1, 1)
            done_at = now - timedelta(
                days=DAYS_BACK * 0.7 * (1 - frac), hours=random.randint(0, 12)
            )
            db.add(
                ChallengeAttempt(
                    user_id=user.id,
                    challenge_id=cid,
                    code="# solved in seed_profile_demo\n",
                    passed=True,
                    tests_passed=5,
                    tests_total=5,
                    created_at=done_at,
                )
            )
        print(f"[challenges] {take}/{len(challenges)} passed")

        # ---- projects --------------------------------------------- #
        for j, p in enumerate(PROJECTS):
            db.add(
                UserProject(
                    user_id=user.id,
                    code="",
                    notes="",
                    tasks=[],
                    created_at=now - timedelta(days=30 - j * 10),
                    updated_at=now - timedelta(days=2 * j),
                    **p,
                )
            )
        print(f"[projects] {len(PROJECTS)} added")

        await db.commit()

        # ---- report the readiness inputs -------------------------- #
        prog = (
            await db.execute(
                select(func.count()).select_from(UserProgress).where(
                    UserProgress.user_id == user.id, UserProgress.completed.is_(True)
                )
            )
        ).scalar()
        print(
            f"\nDone. user id={user.id}, major={MAJOR} "
            f"(target skills: {', '.join(MAJOR_SKILLS[MAJOR])})\n"
            f"  completed lessons: {prog}\n"
            f"  -> sign in as {EMAIL} / {PASSWORD}\n"
            f"  -> Profile:  /profile   (public: /u/{user.username})\n"
            f"  -> Job Readiness:  /career"
        )


if __name__ == "__main__":
    asyncio.run(main())
