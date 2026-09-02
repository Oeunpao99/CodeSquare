"""Admin portal — a SEPARATE console at /admin-portal with its own email+password
login. Tokens carry `scope: "admin"` and every route also checks `User.is_admin`,
so a normal learner session can never reach these endpoints.

Bootstrap an admin by setting ADMIN_EMAIL (+ ADMIN_PASSWORD) in the env — see
`ensure_admin_from_env()` — or run `python make_admin.py <email>` /
`python set_admin_password.py <email> <password>`.
"""
import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from jwt import PyJWTError
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session, get_db
from models.models import (
    AiUsage,
    ChallengeAttempt,
    QuizAttempt,
    User,
    UserProgress,
    UserProject,
)
from plans import PLANS
from routers.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    get_password_hash,
    verify_password,
)

router = APIRouter()

_TRUTHY = {"1", "true", "yes", "on"}


async def ensure_admin_from_env() -> None:
    """Called once on startup. If ADMIN_EMAIL is set:
      * account missing  -> create it (ADMIN_PASSWORD required), is_admin=True
      * account exists    -> grant is_admin; password left alone unless
                             ADMIN_RESET_PASSWORD is truthy
    Never raises — a bootstrap problem must not stop the server.
    """
    email = (os.getenv("ADMIN_EMAIL") or "").strip()
    if not email:
        return
    password = os.getenv("ADMIN_PASSWORD") or ""
    want_reset = (os.getenv("ADMIN_RESET_PASSWORD") or "").strip().lower() in _TRUTHY
    base_name = (os.getenv("ADMIN_USERNAME") or email.split("@")[0] or "admin").strip()[:30]

    try:
        async with async_session() as db:
            user = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()

            if user is None:
                if not password:
                    print(f"[admin] ADMIN_EMAIL={email!r} set but ADMIN_PASSWORD missing — skipping")
                    return
                username, n = base_name or "admin", 1
                while (
                    await db.execute(select(User.id).where(User.username == username))
                ).scalar_one_or_none() is not None:
                    n += 1
                    username = f"{base_name}{n}"
                db.add(
                    User(
                        email=email,
                        username=username,
                        hashed_password=get_password_hash(password),
                        is_admin=True,
                    )
                )
                await db.commit()
                print(f"[admin] created admin {email} (@{username})")
                return

            changed = False
            if not user.is_admin:
                user.is_admin = True
                changed = True
            if want_reset and password:
                user.hashed_password = get_password_hash(password)
                changed = True
                print(f"[admin] reset password for {email}")
            if changed:
                await db.commit()
                print(f"[admin] ensured admin {email}")
    except Exception as exc:  # noqa: BLE001 — startup must survive this
        print(f"[admin] env bootstrap skipped: {exc}")

admin_oauth2 = OAuth2PasswordBearer(tokenUrl="api/admin/auth/login")
ADMIN_TOKEN_MINUTES = 60 * 8  # 8-hour admin session


async def require_admin(
    token: str = Depends(admin_oauth2),
    db: AsyncSession = Depends(get_db),
) -> User:
    unauth = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Admin authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "admin":
            raise unauth
        uid = int(payload["sub"])
    except (PyJWTError, KeyError, ValueError, TypeError):
        raise unauth
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None or not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not an admin")
    return user


def _tok_sum():
    return func.coalesce(func.sum(AiUsage.input_tokens + AiUsage.output_tokens), 0)


def _avatar(u: User) -> Optional[str]:
    return u.avatar_data or u.avatar_url


# --------------------------------------------------------------------------- #
#  Schemas                                                                     #
# --------------------------------------------------------------------------- #
class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    username: str
    display_name: Optional[str] = None


class AdminLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


class UserRow(BaseModel):
    id: int
    email: str
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    plan: str
    major: Optional[str] = None
    is_staff: bool
    is_admin: bool
    verified: bool
    onboarded: bool
    created_at: datetime
    tokens_7d: int
    tokens_total: int


class UsersPage(BaseModel):
    total: int
    page: int
    page_size: int
    users: List[UserRow]


class Stats(BaseModel):
    total_users: int
    plan_free: int
    plan_pro: int
    plan_other: int
    new_7d: int
    new_30d: int
    active_7d: int
    tokens_7d: int


class UsageKind(BaseModel):
    kind: str
    tokens: int


class UserDetail(UserRow):
    headline: Optional[str] = None
    last_active: Optional[datetime] = None
    lessons_completed: int
    projects: int
    challenges_passed: int
    quizzes_passed: int
    usage_7d_by_kind: List[UsageKind]


class UserPatch(BaseModel):
    plan: Optional[str] = None
    is_staff: Optional[bool] = None
    is_admin: Optional[bool] = None


# --------------------------------------------------------------------------- #
#  Auth                                                                        #
# --------------------------------------------------------------------------- #
@router.post("/auth/login", response_model=AdminLoginOut)
async def admin_login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = (
        await db.execute(select(User).where(User.email == form.username))
    ).scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not an admin")
    token = create_access_token(
        {"sub": str(user.id), "scope": "admin"},
        expires_delta=timedelta(minutes=ADMIN_TOKEN_MINUTES),
    )
    return AdminLoginOut(access_token=token, admin=AdminOut.model_validate(user))


@router.get("/auth/me", response_model=AdminOut)
async def admin_me(admin: User = Depends(require_admin)):
    return AdminOut.model_validate(admin)


# --------------------------------------------------------------------------- #
#  Users                                                                       #
# --------------------------------------------------------------------------- #
_SORTS = {
    "created_at": User.created_at,
    "email": User.email,
    "username": User.username,
    "plan": User.plan,
}


@router.get("/stats", response_model=Stats)
async def stats(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    now = datetime.utcnow()
    d7, d30 = now - timedelta(days=7), now - timedelta(days=30)

    total = (await db.execute(select(func.count(User.id)))).scalar() or 0
    by_plan = dict(
        (await db.execute(select(User.plan, func.count(User.id)).group_by(User.plan))).all()
    )
    free = int(by_plan.get("free", 0))
    pro = int(by_plan.get("pro", 0))

    new7 = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= d7))
    ).scalar() or 0
    new30 = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= d30))
    ).scalar() or 0
    active7 = (
        await db.execute(
            select(func.count(func.distinct(AiUsage.user_id))).where(AiUsage.created_at >= d7)
        )
    ).scalar() or 0
    tok7 = (
        await db.execute(select(_tok_sum()).where(AiUsage.created_at >= d7))
    ).scalar() or 0

    return Stats(
        total_users=total,
        plan_free=free,
        plan_pro=pro,
        plan_other=total - free - pro,
        new_7d=new7,
        new_30d=new30,
        active_7d=active7,
        tokens_7d=int(tok7),
    )


@router.get("/users", response_model=UsersPage)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
    q: Optional[str] = None,
    plan: Optional[str] = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    where = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        where.append(
            or_(
                User.email.ilike(like),
                User.username.ilike(like),
                User.display_name.ilike(like),
            )
        )
    if plan in ("free", "pro"):
        where.append(User.plan == plan)

    base = select(User)
    if where:
        base = base.where(and_(*where))

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    col = _SORTS.get(sort, User.created_at)
    col = col.asc() if order == "asc" else col.desc()
    rows = (
        await db.execute(
            base.order_by(col, User.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    ids = [u.id for u in rows]
    tok7_map: dict = {}
    toktot_map: dict = {}
    if ids:
        d7 = datetime.utcnow() - timedelta(days=7)
        for uid, s in (
            await db.execute(
                select(AiUsage.user_id, _tok_sum())
                .where(AiUsage.user_id.in_(ids), AiUsage.created_at >= d7)
                .group_by(AiUsage.user_id)
            )
        ).all():
            tok7_map[uid] = int(s or 0)
        for uid, s in (
            await db.execute(
                select(AiUsage.user_id, _tok_sum())
                .where(AiUsage.user_id.in_(ids))
                .group_by(AiUsage.user_id)
            )
        ).all():
            toktot_map[uid] = int(s or 0)

    return UsersPage(
        total=total,
        page=page,
        page_size=page_size,
        users=[
            UserRow(
                id=u.id,
                email=u.email,
                username=u.username,
                display_name=u.display_name,
                avatar=_avatar(u),
                plan=u.plan or "free",
                major=u.major,
                is_staff=bool(u.is_staff),
                is_admin=bool(u.is_admin),
                verified=bool(u.verified),
                onboarded=u.onboarded_at is not None,
                created_at=u.created_at,
                tokens_7d=tok7_map.get(u.id, 0),
                tokens_total=toktot_map.get(u.id, 0),
            )
            for u in rows
        ],
    )


@router.get("/users/{user_id}", response_model=UserDetail)
async def user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    d7 = datetime.utcnow() - timedelta(days=7)
    kinds = (
        await db.execute(
            select(AiUsage.kind, _tok_sum())
            .where(AiUsage.user_id == user_id, AiUsage.created_at >= d7)
            .group_by(AiUsage.kind)
            .order_by(_tok_sum().desc())
        )
    ).all()
    last_active = (
        await db.execute(
            select(func.max(AiUsage.created_at)).where(AiUsage.user_id == user_id)
        )
    ).scalar()
    tok7 = (
        await db.execute(
            select(_tok_sum()).where(AiUsage.user_id == user_id, AiUsage.created_at >= d7)
        )
    ).scalar() or 0
    toktot = (
        await db.execute(select(_tok_sum()).where(AiUsage.user_id == user_id))
    ).scalar() or 0
    lessons = (
        await db.execute(
            select(func.count())
            .select_from(UserProgress)
            .where(UserProgress.user_id == user_id, UserProgress.completed.is_(True))
        )
    ).scalar() or 0
    projects = (
        await db.execute(
            select(func.count())
            .select_from(UserProject)
            .where(UserProject.user_id == user_id)
        )
    ).scalar() or 0
    ch = (
        await db.execute(
            select(func.count(func.distinct(ChallengeAttempt.challenge_id))).where(
                ChallengeAttempt.user_id == user_id, ChallengeAttempt.passed.is_(True)
            )
        )
    ).scalar() or 0
    qz = (
        await db.execute(
            select(func.count(func.distinct(QuizAttempt.quiz_id))).where(
                QuizAttempt.user_id == user_id, QuizAttempt.passed.is_(True)
            )
        )
    ).scalar() or 0

    return UserDetail(
        id=u.id,
        email=u.email,
        username=u.username,
        display_name=u.display_name,
        headline=u.headline,
        avatar=_avatar(u),
        plan=u.plan or "free",
        major=u.major,
        is_staff=bool(u.is_staff),
        is_admin=bool(u.is_admin),
        verified=bool(u.verified),
        onboarded=u.onboarded_at is not None,
        created_at=u.created_at,
        tokens_7d=int(tok7),
        tokens_total=int(toktot),
        last_active=last_active,
        lessons_completed=int(lessons),
        projects=int(projects),
        challenges_passed=int(ch),
        quizzes_passed=int(qz),
        usage_7d_by_kind=[
            UsageKind(kind=k or "other", tokens=int(t or 0)) for k, t in kinds
        ],
    )


@router.patch("/users/{user_id}", response_model=UserRow)
async def update_user(
    user_id: int,
    patch: UserPatch,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if patch.plan is not None:
        if patch.plan not in PLANS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown plan {patch.plan!r}")
        u.plan = patch.plan
    if patch.is_staff is not None:
        u.is_staff = patch.is_staff
    if patch.is_admin is not None:
        if u.id == admin.id and not patch.is_admin:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "You can't remove your own admin access"
            )
        u.is_admin = patch.is_admin

    await db.commit()
    await db.refresh(u)

    d7 = datetime.utcnow() - timedelta(days=7)
    t7 = (
        await db.execute(
            select(_tok_sum()).where(AiUsage.user_id == u.id, AiUsage.created_at >= d7)
        )
    ).scalar() or 0
    tt = (
        await db.execute(select(_tok_sum()).where(AiUsage.user_id == u.id))
    ).scalar() or 0

    return UserRow(
        id=u.id,
        email=u.email,
        username=u.username,
        display_name=u.display_name,
        avatar=_avatar(u),
        plan=u.plan or "free",
        major=u.major,
        is_staff=bool(u.is_staff),
        is_admin=bool(u.is_admin),
        verified=bool(u.verified),
        onboarded=u.onboarded_at is not None,
        created_at=u.created_at,
        tokens_7d=int(t7),
        tokens_total=int(tt),
    )
