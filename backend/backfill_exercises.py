"""Guarantee every lesson has at least one Practice exercise.

Some seed files ship lessons with prose but no ``Exercise`` row, which means the
lesson (and its mirrored Library article) can never be completed. This pass adds
one small, always-passable exercise to any lesson that lacks one, built from the
lesson's own ``starter_code`` / ``solution`` / ``code_example``.

Design goals:
  * **ID-independent** — finds gaps with a query, never a hard-coded id map, so
    it stays correct across re-seeds and newly added lessons.
  * **Idempotent** — a lesson that already has an exercise is left untouched.
  * **Language-agnostic** — the check is a light "you actually wrote something"
    test on the raw submission, enough to mark the lesson done without being a
    puzzle.

Run standalone, or rely on ``seed_data.py`` which calls it at the end:

    python backfill_exercises.py            # add missing exercises
    python backfill_exercises.py --verify   # report only; exit 1 if any gap
"""
import asyncio
import sys

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from database import async_session
from models.models import Exercise, Language, Lesson, Module


def _default_exercise(lesson: Lesson, lang_slug: str) -> dict:
    """A minimal, always-passable exercise derived from the lesson itself."""
    starter = (lesson.starter_code or lesson.code_example or "").strip()
    if not starter:
        starter = "# Write your code here\n" if lang_slug in {"python", "linux-shell"} else "// Write your code here\n"
    solution = (lesson.solution or lesson.code_example or starter).strip()

    # The runner exposes the raw submission as `code`. Only an explicit False
    # fails a test, so this just asks the learner to write something real.
    tests = [
        {"description": "you wrote some code", "test": "len(code.strip()) >= 8"},
    ]
    return {
        "title": f"Try it: {lesson.title}",
        "description": (
            "Practice what this lesson covered — edit the code below and run it. "
            "Use the lesson example as a guide."
        ),
        "starter_code": starter,
        "solution": solution,
        "test_cases": {"tests": tests},
        "hints": [
            "Re-read the lesson's example and adapt it here.",
            "Click Show solution if you get stuck.",
        ],
        "order": 1,
    }


async def _lessons_without_exercise(db):
    """Every lesson id that has zero Exercise rows, with its language slug."""
    rows = (
        await db.execute(
            select(Lesson, Language.slug)
            .join(Module, Lesson.module_id == Module.id)
            .join(Language, Module.language_id == Language.id)
            .where(~Lesson.id.in_(select(Exercise.lesson_id)))
            .order_by(Language.slug, Lesson.id)
        )
    ).all()
    return rows


async def ensure_every_lesson_has_exercise(verify_only: bool = False) -> int:
    """Add a default exercise to every exercise-less lesson.

    Returns the number of lessons still missing an exercise afterwards (0 on
    success). In ``verify_only`` mode nothing is written.
    """
    async with async_session() as db:
        total = (await db.execute(select(func.count()).select_from(Lesson))).scalar() or 0
        gaps = await _lessons_without_exercise(db)

        if verify_only:
            for lesson, slug in gaps:
                print(f"  MISSING  [{slug}] lesson {lesson.id}: {lesson.title}")
            print(f"\n{total - len(gaps)}/{total} lessons have an exercise; {len(gaps)} missing.")
            return len(gaps)

        for lesson, slug in gaps:
            spec = _default_exercise(lesson, slug)
            db.add(Exercise(lesson_id=lesson.id, **spec))
            print(f"  + [{slug}] lesson {lesson.id:>4}  {lesson.title}")

        await db.commit()

        remaining = len(await _lessons_without_exercise(db))
        print(
            f"\nAdded {len(gaps)} exercise(s); "
            f"{total - remaining}/{total} lessons now covered."
        )
        return remaining


async def _main() -> None:
    verify = "--verify" in sys.argv
    remaining = await ensure_every_lesson_has_exercise(verify_only=verify)
    if remaining:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(_main())
