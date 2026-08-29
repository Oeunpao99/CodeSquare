"""Practice challenges — standalone graded problems, independent of the lesson
tree. Browse/filter, a deterministic daily pick, and a submit endpoint that runs
the same exec/eval test harness as lesson exercises, then adds an AI review on a
passing run.
"""
import hashlib
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.tutor import AITutor
from database import get_db
from models.models import Challenge, ChallengeAttempt, User
from routers.auth import get_current_user

router = APIRouter()
ai_tutor = AITutor()

DIFFICULTY_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}


# ---------- test harness (mirrors routers/lessons.submit_exercise) ----------

def _run_tests(code: str, test_cases: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Execute the user's code, then evaluate each test. Tests may reference
    names the code defines OR the raw submission string via `code`.
    """
    tests = (test_cases or {}).get("tests", []) if isinstance(test_cases, dict) else []
    results: List[Dict[str, Any]] = []
    passed = True

    for test_case in tests:
        try:
            exec_globals = {"code": code, "__code__": code}
            try:
                compile(code, "<user_code>", "exec")
                exec(code, exec_globals)  # noqa: S102 - sandboxed dev harness
            except Exception:
                # Non-Python submissions (SQL, HTML, JS) still run string tests.
                pass

            test_code = test_case.get("test", "")
            try:
                outcome = eval(test_code, exec_globals)  # noqa: S307
            except SyntaxError:
                exec(test_code, exec_globals)  # noqa: S102
                outcome = True
            if not outcome:
                raise AssertionError(test_case.get("description", "test failed"))
            results.append({"passed": True, "description": test_case.get("description", "")})
        except Exception as exc:  # noqa: BLE001
            passed = False
            results.append(
                {
                    "passed": False,
                    "description": test_case.get("description", ""),
                    "error": str(exc),
                }
            )

    tests_total = len(results)
    tests_passed = sum(1 for r in results if r["passed"])
    return {
        "passed": passed and tests_total > 0,
        "results": results,
        "tests_passed": tests_passed,
        "tests_total": tests_total,
    }


# ---------- schemas ----------

class ChallengeCard(BaseModel):
    slug: str
    title: str
    language: str
    difficulty: str
    kind: str = "solve"
    topic: Optional[str] = None
    xp_reward: int
    solved: bool = False


class ChallengeDetail(BaseModel):
    slug: str
    title: str
    prompt: str
    language: str
    difficulty: str
    kind: str = "solve"
    topic: Optional[str] = None
    starter_code: str
    hints: List[str] = []
    xp_reward: int
    solved: bool = False
    last_code: Optional[str] = None


class SubmitRequest(BaseModel):
    code: str


class SubmitResponse(BaseModel):
    passed: bool
    results: List[Dict[str, Any]]
    tests_passed: int
    tests_total: int
    first_solve: bool
    xp_awarded: int
    review: Optional[Dict[str, Any]] = None


class ChallengeStats(BaseModel):
    total: int
    solved: int
    by_difficulty: Dict[str, Dict[str, int]]   # {difficulty: {solved, total}}
    daily_streak: int


# ---------- helpers ----------

async def _solved_slugs(db: AsyncSession, user_id: int) -> set[str]:
    rows = await db.execute(
        select(Challenge.slug)
        .join(ChallengeAttempt, ChallengeAttempt.challenge_id == Challenge.id)
        .where(ChallengeAttempt.user_id == user_id, ChallengeAttempt.passed.is_(True))
    )
    return {s for (s,) in rows.all()}


# ---------- fixed routes (declared before /{slug}) ----------

@router.get("", response_model=List[ChallengeCard])
async def list_challenges(
    language: Optional[str] = None,
    difficulty: Optional[str] = None,
    topic: Optional[str] = None,
    kind: Optional[str] = None,
    solved: Optional[bool] = None,
    limit: int = 60,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    q = select(Challenge)
    if language:
        q = q.where(Challenge.language == language)
    if difficulty:
        q = q.where(Challenge.difficulty == difficulty)
    if topic:
        q = q.where(Challenge.topic == topic)
    if kind:
        q = q.where(Challenge.kind == kind)
    q = q.order_by(Challenge.order, Challenge.id)
    rows = (await db.execute(q)).scalars().all()

    done = await _solved_slugs(db, current_user.id)
    cards = [
        ChallengeCard(
            slug=c.slug,
            title=c.title,
            language=c.language,
            difficulty=c.difficulty,
            kind=c.kind or "solve",
            topic=c.topic,
            xp_reward=c.xp_reward or 0,
            solved=c.slug in done,
        )
        for c in rows
    ]
    if solved is not None:
        cards = [c for c in cards if c.solved == solved]
    cards.sort(key=lambda c: (DIFFICULTY_ORDER.get(c.difficulty, 9), c.title.lower()))
    return cards[offset : offset + limit]


@router.get("/topics", response_model=List[str])
async def list_topics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(Challenge.topic).where(Challenge.topic.is_not(None)).distinct()
    )
    return sorted({t for (t,) in rows.all() if t})


@router.get("/stats/me", response_model=ChallengeStats)
async def my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_rows = (await db.execute(select(Challenge))).scalars().all()
    done = await _solved_slugs(db, current_user.id)

    by_difficulty: Dict[str, Dict[str, int]] = {}
    for c in all_rows:
        bucket = by_difficulty.setdefault(c.difficulty, {"solved": 0, "total": 0})
        bucket["total"] += 1
        if c.slug in done:
            bucket["solved"] += 1

    # Daily streak: consecutive calendar days (ending today or yesterday) with at
    # least one passing attempt.
    passed_dates = (
        await db.execute(
            select(ChallengeAttempt.created_at)
            .where(
                ChallengeAttempt.user_id == current_user.id,
                ChallengeAttempt.passed.is_(True),
            )
            .order_by(ChallengeAttempt.created_at.desc())
        )
    ).scalars().all()
    day_set = {d.date() for d in passed_dates if d}
    streak = 0
    cursor = date.today()
    if cursor not in day_set and (cursor - timedelta(days=1)) in day_set:
        cursor -= timedelta(days=1)
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)

    return ChallengeStats(
        total=len(all_rows),
        solved=len(done),
        by_difficulty=by_difficulty,
        daily_streak=streak,
    )


@router.get("/daily", response_model=ChallengeDetail)
async def daily_challenge(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(select(Challenge).order_by(Challenge.id))
    ).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No challenges available yet")

    solve_only = [c for c in rows if (c.kind or "solve") == "solve"] or rows
    pool = [
        c for c in solve_only
        if not c.major_slugs or (current_user.major and current_user.major in c.major_slugs)
    ] or solve_only

    seed = f"{current_user.id}:{date.today().isoformat()}"
    idx = int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(pool)
    return await _detail(db, pool[idx], current_user.id)


# ---------- /{slug} ----------

async def _get_by_slug(db: AsyncSession, slug: str) -> Challenge:
    row = await db.execute(select(Challenge).where(Challenge.slug == slug))
    challenge = row.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge


async def _detail(db: AsyncSession, c: Challenge, user_id: int) -> ChallengeDetail:
    last = await db.execute(
        select(ChallengeAttempt)
        .where(
            ChallengeAttempt.user_id == user_id,
            ChallengeAttempt.challenge_id == c.id,
        )
        .order_by(ChallengeAttempt.created_at.desc())
        .limit(1)
    )
    last_attempt = last.scalar_one_or_none()
    done = await _solved_slugs(db, user_id)
    return ChallengeDetail(
        slug=c.slug,
        title=c.title,
        prompt=c.prompt or "",
        language=c.language,
        difficulty=c.difficulty,
        kind=c.kind or "solve",
        topic=c.topic,
        starter_code=c.starter_code or "",
        hints=c.hints if isinstance(c.hints, list) else [],
        xp_reward=c.xp_reward or 0,
        solved=c.slug in done,
        last_code=last_attempt.code if last_attempt else None,
    )


@router.get("/{slug}", response_model=ChallengeDetail)
async def get_challenge(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = await _get_by_slug(db, slug)
    return await _detail(db, challenge, current_user.id)


@router.post("/{slug}/submit", response_model=SubmitResponse)
async def submit_challenge(
    slug: str,
    body: SubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = await _get_by_slug(db, slug)

    run = _run_tests(body.code, challenge.test_cases)

    prior_pass = await db.execute(
        select(func.count(ChallengeAttempt.id)).where(
            ChallengeAttempt.user_id == current_user.id,
            ChallengeAttempt.challenge_id == challenge.id,
            ChallengeAttempt.passed.is_(True),
        )
    )
    already_solved = (prior_pass.scalar() or 0) > 0

    review: Optional[Dict[str, Any]] = None
    if run["passed"]:
        review = await ai_tutor.review_code(
            body.code,
            challenge.language or "python",
            f"Practice challenge: {challenge.title}",
            challenge.prompt or "",
        )

    attempt = ChallengeAttempt(
        user_id=current_user.id,
        challenge_id=challenge.id,
        code=body.code,
        passed=run["passed"],
        tests_passed=run["tests_passed"],
        tests_total=run["tests_total"],
        ai_review=review,
        created_at=datetime.utcnow(),
    )
    db.add(attempt)
    await db.commit()

    first_solve = run["passed"] and not already_solved
    return SubmitResponse(
        passed=run["passed"],
        results=run["results"],
        tests_passed=run["tests_passed"],
        tests_total=run["tests_total"],
        first_solve=first_solve,
        xp_awarded=(challenge.xp_reward or 0) if first_solve else 0,
        review=review,
    )
