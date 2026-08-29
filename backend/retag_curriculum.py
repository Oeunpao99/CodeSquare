"""Normalise every track's module ladder.

Fixes the two problems the seeds left behind:
  * difficulty was non-monotonic (a track could go intermediate -> beginner)
  * a couple of modules sat in the wrong teaching order (Git last in the
    Backend track; JSON after Async in Python Intermediate)

For each language it re-writes `Module.order`, `Module.level` (1..N) and
`Module.difficulty` from the curated plan below, so difficulty is
non-decreasing and the level is an explicit rung the UI can show.

Authoritative + idempotent. Run after the seeds:

    alembic upgrade head
    python seed_data.py ...        # and the other seed_*.py
    python retag_curriculum.py
"""
import asyncio

from sqlalchemy import select

from database import async_session
from models.models import Language, Module

RANK = {"beginner": 0, "intermediate": 1, "advanced": 2}

# language slug -> [(title contains, difficulty, level), ...] in teaching order
CURRICULUM = {
    "python": [
        ("Python Basics", "beginner", 1),
        ("Control Flow", "beginner", 2),
        ("Collections", "beginner", 3),
        ("Functions", "beginner", 4),
    ],
    "javascript": [
        ("JavaScript Fundamentals", "beginner", 1),
        ("Values & Operators", "beginner", 2),
        ("Control Flow & Data", "beginner", 3),
        ("Functions & the DOM", "intermediate", 4),
    ],
    "html-css": [
        ("HTML Basics", "beginner", 1),
        ("Structuring Content", "beginner", 2),
        ("Styling with CSS", "beginner", 3),
    ],
    "full-stack": [
        ("Frontend: HTML & CSS", "beginner", 1),
        ("Frontend: JavaScript", "beginner", 2),
        ("Backend: APIs & HTTP", "intermediate", 3),
        ("Databases", "intermediate", 4),
        ("Migrations", "intermediate", 5),
        ("Using AI in Development", "intermediate", 6),
    ],
    # Git first — you need version control before touching anything else.
    "backend-foundations": [
        ("Git & GitHub", "beginner", 1),
        ("Databases & SQL", "beginner", 2),
        ("Schema Migrations", "intermediate", 3),
        ("Building REST APIs", "intermediate", 4),
        ("API Docs & Tooling", "intermediate", 5),
        ("DevOps Foundations", "intermediate", 6),
    ],
    "react-typescript": [
        ("Components & JSX", "beginner", 1),
        ("State & Hooks", "intermediate", 2),
        ("TypeScript", "advanced", 3),
    ],
    # JSON is more basic than async — swap it ahead.
    "python-intermediate": [
        ("Functions & Clean Code", "beginner", 1),
        ("Working with JSON", "beginner", 2),
        ("Async & Pydantic", "intermediate", 3),
    ],
    "linux-shell": [
        ("Navigating & Files", "beginner", 1),
        ("Environment & Permissions", "intermediate", 2),
        ("Processes & Scripting", "advanced", 3),
    ],
}


async def retag() -> None:
    async with async_session() as db:
        for slug, plan in CURRICULUM.items():
            lang = (
                await db.execute(select(Language).where(Language.slug == slug))
            ).scalar_one_or_none()
            if not lang:
                print(f"  {slug}: no such language, skipped")
                continue

            mods = (
                await db.execute(select(Module).where(Module.language_id == lang.id))
            ).scalars().all()

            assigned: set[int] = set()
            for needle, diff, lvl in plan:
                m = next(
                    (
                        mm
                        for mm in mods
                        if needle.lower() in (mm.title or "").lower()
                        and mm.id not in assigned
                    ),
                    None,
                )
                if not m:
                    print(f"  {slug}: !! no module matching '{needle}'")
                    continue
                m.order = m.level = lvl
                m.difficulty = diff
                assigned.add(m.id)

            # Any module the plan didn't mention: append it, keeping difficulty
            # non-decreasing so the ladder never dips.
            leftover = [mm for mm in mods if mm.id not in assigned]
            last_diff = plan[-1][1] if plan else "beginner"
            nxt = len(plan) + 1
            for m in sorted(leftover, key=lambda x: x.order or 0):
                m.order = m.level = nxt
                if RANK.get(m.difficulty, 0) < RANK[last_diff]:
                    m.difficulty = last_diff
                last_diff = m.difficulty
                nxt += 1

            tail = f" (+{len(leftover)} unplanned)" if leftover else ""
            print(f"  {slug}: {len(assigned)}/{len(plan)} modules retagged{tail}")

        await db.commit()
    print("Curriculum ladders normalised.")


if __name__ == "__main__":
    asyncio.run(retag())
