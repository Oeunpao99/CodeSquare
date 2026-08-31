"""Community — social surfaces that rank or connect learners.

For now this is just the Leaderboard: every user ranked by total XP (completed
lesson score + distinct solved-challenge XP), matching the maths in
routers/progress.get_progress_summary. Heavier social features (discussions, peer
reviews) are intentionally not here yet.
"""
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.models import (
    Challenge, ChallengeAttempt, Notification, Post, PostComment, PostReaction, Quiz,
    QuizAttempt, User, UserProgress, UserProject,
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
    verified: bool = False


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
                verified=bool(u.verified),
            )
        )

    ranked.sort(key=lambda r: (-r.xp, -r.lessons_completed, r.username.lower()))
    for i, row in enumerate(ranked, start=1):
        row.rank = i

    top = ranked[:limit]
    me = next((r for r in ranked if r.is_me), None)
    me_outside = me if (me and me.rank > limit) else None

    return LeaderboardResponse(top=top, me=me_outside, total_ranked=len(ranked))


# --------------------------------------------------------------------------- #
#  Community feed — learners post ideas / progress / questions / showcases.    #
# --------------------------------------------------------------------------- #

KINDS = {"idea", "progress", "question", "showcase"}
FLAG_HIDE_AT = 3
POSTS_PER_HOUR = 8
COMMENTS_PER_HOUR = 30
BODY_MAX = 4000
COMMENT_MAX = 1000


class PostAuthor(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    major: Optional[str] = None
    headline: Optional[str] = None
    verified: bool = False


class CommentOut(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: PostAuthor
    is_mine: bool = False
    can_delete: bool = False


class PostOut(BaseModel):
    id: str          # public_id — opaque, not the row's integer PK
    kind: str
    body: str
    tags: List[str] = []
    link_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    author: PostAuthor
    like_count: int = 0
    comment_count: int = 0
    liked_by_me: bool = False
    is_mine: bool = False
    can_delete: bool = False
    hidden: bool = False


class PostDetailOut(PostOut):
    comments: List[CommentOut] = []


class FeedOut(BaseModel):
    posts: List[PostOut]
    has_more: bool = False


class PostCreate(BaseModel):
    kind: str = "idea"
    body: str = Field(min_length=1, max_length=BODY_MAX + 200)
    tags: List[str] = []
    link_url: Optional[str] = None


class PostUpdate(BaseModel):
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    link_url: Optional[str] = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX + 100)


def _author(u: User) -> PostAuthor:
    return PostAuthor(
        id=u.id,
        username=u.username or f"user{u.id}",
        display_name=u.display_name,
        avatar=(u.avatar_data or u.avatar_url),
        major=u.major,
        headline=u.headline,
        verified=bool(u.verified),
    )


async def _notify_staff_activity(db: AsyncSession, actor: User, post: Post, kind: str) -> None:
    """Notify a post's owner when a dev team member liked / commented on it."""
    if not actor.is_staff:
        return
    owner_id = post.user_id
    if not owner_id or owner_id == actor.id:
        return
    dup = (
        await db.execute(
            select(Notification.id).where(
                Notification.user_id == owner_id,
                Notification.actor_id == actor.id,
                Notification.post_id == post.id,
                Notification.kind == kind,
                Notification.read.is_(False),
            )
        )
    ).first()
    if dup:
        return
    db.add(Notification(user_id=owner_id, actor_id=actor.id, kind=kind, post_id=post.id))


def _clean_body(text: Optional[str], lo: int, hi: int, what: str) -> str:
    t = (text or "").strip()
    if len(t) < lo:
        raise HTTPException(status_code=400, detail=f"{what} can't be empty.")
    if len(t) > hi:
        raise HTTPException(status_code=400, detail=f"{what} is too long (max {hi} characters).")
    return t


def _clean_tags(tags) -> List[str]:
    out: List[str] = []
    for raw in (tags or [])[:5]:
        s = re.sub(r"[^a-z0-9+#.\-]", "", str(raw).strip().lower())[:24]
        if s and s not in out:
            out.append(s)
    return out


def _clean_link(url: Optional[str]) -> Optional[str]:
    u = (url or "").strip()
    if not u:
        return None
    if not re.match(r"^https?://", u, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Link must start with http:// or https://")
    return u[:300]


async def _within_rate(db: AsyncSession, user_id: int, model, per_hour: int) -> bool:
    since = datetime.utcnow() - timedelta(hours=1)
    n = (
        await db.execute(
            select(func.count()).select_from(model).where(
                model.user_id == user_id, model.created_at >= since
            )
        )
    ).scalar() or 0
    return n < per_hour


def _post_out(p: Post, like_count: int, comment_count: int, liked: bool, me: User) -> PostOut:
    is_mine = p.user_id == me.id
    return PostOut(
        id=p.public_id,
        kind=p.kind,
        body=p.body,
        tags=p.tags or [],
        link_url=p.link_url,
        created_at=p.created_at,
        updated_at=p.updated_at,
        author=_author(p.author),
        like_count=int(like_count or 0),
        comment_count=int(comment_count or 0),
        liked_by_me=liked,
        is_mine=is_mine,
        can_delete=is_mine or bool(me.is_staff),
        hidden=bool(p.hidden),
    )


async def _load_post(db: AsyncSession, public_id: str, me: User, with_comments: bool = False) -> Post:
    opts = [selectinload(Post.author)]
    if with_comments:
        opts.append(selectinload(Post.comments).selectinload(PostComment.author))
    p = (
        await db.execute(select(Post).where(Post.public_id == public_id).options(*opts))
    ).scalar_one_or_none()
    visible = p and (not p.hidden or me.is_staff or p.user_id == me.id)
    if not visible:
        raise HTTPException(status_code=404, detail="Post not found.")
    return p


@router.get("/posts", response_model=FeedOut)
async def list_posts(
    sort: str = "new",
    tag: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    like_ct = (
        select(PostReaction.post_id, func.count().label("c"))
        .group_by(PostReaction.post_id)
        .subquery()
    )
    q = (
        select(Post, func.coalesce(like_ct.c.c, 0))
        .outerjoin(like_ct, like_ct.c.post_id == Post.id)
        .options(selectinload(Post.author))
    )
    if not current_user.is_staff:
        q = q.where(Post.hidden.is_(False))
    tag_clean = re.sub(r"[^a-z0-9+#.\-]", "", (tag or "").strip().lower())[:24]
    if tag_clean:
        q = q.where(cast(Post.tags, String).ilike(f'%"{tag_clean}"%'))
    if sort == "top":
        q = q.order_by(func.coalesce(like_ct.c.c, 0).desc(), Post.created_at.desc())
    else:
        q = q.order_by(Post.created_at.desc())

    rows = (await db.execute(q.limit(limit + 1).offset(offset))).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    ids = [p.id for p, _ in rows]

    comment_ct: Dict[int, int] = {}
    liked_ids: set = set()
    if ids:
        comment_ct = dict(
            (
                await db.execute(
                    select(PostComment.post_id, func.count())
                    .where(PostComment.post_id.in_(ids), PostComment.hidden.is_(False))
                    .group_by(PostComment.post_id)
                )
            ).all()
        )
        liked_ids = set(
            (
                await db.execute(
                    select(PostReaction.post_id).where(
                        PostReaction.post_id.in_(ids),
                        PostReaction.user_id == current_user.id,
                    )
                )
            ).scalars().all()
        )

    posts = [
        _post_out(p, lc, comment_ct.get(p.id, 0), p.id in liked_ids, current_user)
        for p, lc in rows
    ]
    return FeedOut(posts=posts, has_more=has_more)


@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    body: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail="Unknown post kind.")
    if not await _within_rate(db, current_user.id, Post, POSTS_PER_HOUR):
        raise HTTPException(status_code=429, detail="You're posting a lot — take a short break and try again.")

    p = Post(
        user_id=current_user.id,
        kind=body.kind,
        body=_clean_body(body.body, 2, BODY_MAX, "Post"),
        tags=_clean_tags(body.tags),
        link_url=_clean_link(body.link_url),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    p = await _load_post(db, p.public_id, current_user)
    return _post_out(p, 0, 0, False, current_user)


@router.get("/posts/{public_id}", response_model=PostDetailOut)
async def get_post(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = await _load_post(db, public_id, current_user, with_comments=True)
    like_count = (
        await db.execute(
            select(func.count()).select_from(PostReaction).where(PostReaction.post_id == p.id)
        )
    ).scalar() or 0
    liked = (
        await db.execute(
            select(PostReaction.id).where(
                PostReaction.post_id == p.id, PostReaction.user_id == current_user.id
            )
        )
    ).scalar() is not None
    comments = [
        CommentOut(
            id=c.id,
            body=c.body,
            created_at=c.created_at,
            author=_author(c.author),
            is_mine=(c.user_id == current_user.id),
            can_delete=(c.user_id == current_user.id or bool(current_user.is_staff)),
        )
        for c in p.comments
        if not c.hidden or current_user.is_staff or c.user_id == current_user.id
    ]
    base = _post_out(p, like_count, len(comments), liked, current_user)
    return PostDetailOut(**base.model_dump(), comments=comments)


@router.patch("/posts/{public_id}", response_model=PostOut)
async def update_post(
    public_id: str,
    body: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = await _load_post(db, public_id, current_user)
    if p.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="That's not your post.")
    if body.body is not None:
        p.body = _clean_body(body.body, 2, BODY_MAX, "Post")
    if body.tags is not None:
        p.tags = _clean_tags(body.tags)
    if body.link_url is not None:
        p.link_url = _clean_link(body.link_url)
    p.updated_at = datetime.utcnow()
    await db.commit()

    like_count = (
        await db.execute(select(func.count()).select_from(PostReaction).where(PostReaction.post_id == p.id))
    ).scalar() or 0
    comment_count = (
        await db.execute(
            select(func.count()).select_from(PostComment).where(
                PostComment.post_id == p.id, PostComment.hidden.is_(False)
            )
        )
    ).scalar() or 0
    liked = (
        await db.execute(
            select(PostReaction.id).where(
                PostReaction.post_id == p.id, PostReaction.user_id == current_user.id
            )
        )
    ).scalar() is not None
    return _post_out(p, like_count, comment_count, liked, current_user)


@router.delete("/posts/{public_id}", status_code=204)
async def delete_post(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found.")
    if p.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=403, detail="Not allowed.")
    await db.delete(p)
    await db.commit()


@router.post("/posts/{public_id}/like")
async def toggle_like(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    post_id = post.id
    row = (
        await db.execute(
            select(PostReaction).where(
                PostReaction.post_id == post_id, PostReaction.user_id == current_user.id
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        liked = False
    else:
        db.add(PostReaction(post_id=post_id, user_id=current_user.id))
        liked = True
        await _notify_staff_activity(db, current_user, post, "like")
    await db.commit()
    like_count = (
        await db.execute(select(func.count()).select_from(PostReaction).where(PostReaction.post_id == post_id))
    ).scalar() or 0
    return {"liked": liked, "like_count": int(like_count)}


@router.post("/posts/{public_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    public_id: str,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = await _load_post(db, public_id, current_user)  # 404s if missing/hidden
    if not await _within_rate(db, current_user.id, PostComment, COMMENTS_PER_HOUR):
        raise HTTPException(status_code=429, detail="Slow down a moment, then try again.")
    c = PostComment(
        post_id=p.id,
        user_id=current_user.id,
        body=_clean_body(body.body, 1, COMMENT_MAX, "Comment"),
    )
    db.add(c)
    await db.commit()
    await _notify_staff_activity(db, current_user, p, "comment")
    await db.commit()
    c = (
        await db.execute(
            select(PostComment).where(PostComment.id == c.id).options(selectinload(PostComment.author))
        )
    ).scalar_one()
    return CommentOut(
        id=c.id, body=c.body, created_at=c.created_at, author=_author(c.author),
        is_mine=True, can_delete=True,
    )


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = (await db.execute(select(PostComment).where(PostComment.id == comment_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if c.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=403, detail="Not allowed.")
    await db.delete(c)
    await db.commit()


@router.post("/posts/{public_id}/flag")
async def flag_post(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found.")
    if p.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't flag your own post.")
    p.flagged_count = (p.flagged_count or 0) + 1
    if p.flagged_count >= FLAG_HIDE_AT:
        p.hidden = True
    await db.commit()
    return {"flagged": True, "hidden": bool(p.hidden)}


# --------------------------------------------------------------------------- #
#  Public user profiles — a clean, read-only view of a learner's stats.        #
# --------------------------------------------------------------------------- #

class PublicProject(BaseModel):
    id: int
    title: str
    language: Optional[str] = None
    status: Optional[str] = None
    updated_at: Optional[datetime] = None


class PublicProfile(BaseModel):
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    major: Optional[str] = None
    verified: bool = False
    is_staff: bool = False
    joined: Optional[datetime] = None
    xp: int = 0
    lessons_completed: int = 0
    challenges_solved: int = 0
    quizzes_passed: int = 0
    current_streak: int = 0
    rank: Optional[int] = None
    recent_projects: List[PublicProject] = []
    is_me: bool = False


@router.get("/users/{username}", response_model=PublicProfile)
async def public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    u = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    # Lesson XP + count
    lesson_rows = (
        await db.execute(
            select(func.coalesce(func.sum(UserProgress.score), 0), func.count(UserProgress.id))
            .where(UserProgress.user_id == u.id, UserProgress.completed.is_(True))
        )
    ).one()
    lesson_xp = int(round(lesson_rows[0] or 0))
    lessons_done = int(lesson_rows[1] or 0)

    # Solved challenges (XP + count)
    solved = [
        cid
        for (cid,) in (
            await db.execute(
                select(ChallengeAttempt.challenge_id)
                .where(ChallengeAttempt.user_id == u.id, ChallengeAttempt.passed.is_(True))
                .distinct()
            )
        ).all()
    ]
    challenge_xp = 0
    if solved:
        challenge_xp = int(
            (await db.execute(
                select(func.coalesce(func.sum(Challenge.xp_reward), 0)).where(Challenge.id.in_(solved))
            )).scalar() or 0
        )

    # Passed quizzes (XP + count)
    passed_quizzes = [
        qid
        for (qid,) in (
            await db.execute(
                select(QuizAttempt.quiz_id)
                .where(QuizAttempt.user_id == u.id, QuizAttempt.passed.is_(True))
                .distinct()
            )
        ).all()
    ]
    quiz_xp = 0
    if passed_quizzes:
        quiz_xp = int(
            (await db.execute(
                select(func.coalesce(func.sum(Quiz.xp_reward), 0)).where(Quiz.id.in_(passed_quizzes))
            )).scalar() or 0
        )

    total_xp = lesson_xp + challenge_xp + quiz_xp

    # Rank within the overall board (same XP formula used by /leaderboard)
    rank = await _rank_for_user(db, u.id)
    if rank is None and total_xp == 0 and lessons_done == 0:
        rank = None

    # Recent public projects
    projects = (
        await db.execute(
            select(UserProject)
            .where(UserProject.user_id == u.id)
            .order_by(UserProject.updated_at.desc())
            .limit(6)
        )
    ).scalars().all()

    return PublicProfile(
        username=u.username or f"user{u.id}",
        display_name=u.display_name,
        avatar=(u.avatar_data or u.avatar_url),
        headline=u.headline,
        bio=u.bio,
        major=u.major,
        verified=bool(u.verified),
        is_staff=bool(u.is_staff),
        joined=u.created_at,
        xp=total_xp,
        lessons_completed=lessons_done,
        challenges_solved=len(solved),
        quizzes_passed=len(passed_quizzes),
        current_streak=await _streak_for_user(u.id, db),
        rank=rank,
        recent_projects=[
            PublicProject(
                id=p.id,
                title=p.title,
                language=p.language,
                status=p.status,
                updated_at=p.updated_at,
            )
            for p in projects
        ],
        is_me=(u.id == current_user.id),
    )


async def _streak_for_user(user_id: int, db: AsyncSession) -> int:
    """Count consecutive days with at least one completed lesson, ending today."""
    from datetime import datetime

    rows = (
        await db.execute(
            select(UserProgress.completed_at)
            .where(UserProgress.user_id == user_id, UserProgress.completed.is_(True))
        )
    ).scalars().all()
    days = {d.date() for d in rows if d}
    if not days:
        return 0
    today = datetime.utcnow().date()
    streak = 0
    cursor = today
    while cursor in days or (streak == 0):
        if cursor not in days:
            break
        streak += 1
        cursor -= timedelta(days=1)
    return streak


async def _rank_for_user(db: AsyncSession, user_id: int) -> Optional[int]:
    """Overall XP rank of a user on the leaderboard (1-based, None if unranked)."""
    # Aggregate XP per user for lessons, challenges and quizzes.
    lesson_xp_rows = (
        await db.execute(
            select(UserProgress.user_id, func.coalesce(func.sum(UserProgress.score), 0))
            .where(UserProgress.completed.is_(True))
            .group_by(UserProgress.user_id)
        )
    ).all()
    lesson_xp = {uid: int(round(xp)) for uid, xp in lesson_xp_rows}

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
                    select(Challenge.id, Challenge.xp_reward).where(Challenge.id.in_(challenge_ids))
                )
            ).all()
        }
    challenge_xp: Dict[int, int] = {}
    for uid, cid in solved_rows:
        challenge_xp[uid] = challenge_xp.get(uid, 0) + xp_by_challenge.get(cid, 0)

    quiz_rows = (
        await db.execute(
            select(QuizAttempt.user_id, QuizAttempt.quiz_id)
            .where(QuizAttempt.passed.is_(True))
            .distinct()
        )
    ).all()
    quiz_ids = {qid for _, qid in quiz_rows}
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
    for uid, qid in quiz_rows:
        quiz_xp[uid] = quiz_xp.get(uid, 0) + xp_by_quiz.get(qid, 0)

    totals = {
        uid: lesson_xp.get(uid, 0) + challenge_xp.get(uid, 0) + quiz_xp.get(uid, 0)
        for uid in set(lesson_xp) | set(challenge_xp) | set(quiz_xp)
    }
    if user_id not in totals:
        return None

    ordered = sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))
    for i, (uid, _) in enumerate(ordered, start=1):
        if uid == user_id:
            return i
    return None
