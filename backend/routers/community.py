"""Community — social surfaces that rank or connect learners.

For now this is just the Leaderboard: every user ranked by total XP (completed
lesson score + distinct solved-challenge XP), matching the maths in
routers/progress.get_progress_summary. Heavier social features (discussions, peer
reviews) are intentionally not here yet.
"""
import json
import re
import base64
import binascii
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai.tutor import AITutor
from common.cambodia import khmer_date, khmer_today
from database import get_db
from models.models import (
    Challenge, ChallengeAttempt, Follow, Notification, Post, PostComment, PostCommentLike, PostReaction, Quiz,
    QuizAttempt, User, UserProgress, UserProject,
)
from routers.auth import get_current_user

router = APIRouter()

_ai = AITutor()


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

KINDS = {"idea", "progress", "question", "showcase", "code"}
FLAG_HIDE_AT = 3
POSTS_PER_HOUR = 8
COMMENTS_PER_HOUR = 30
BODY_MAX = 4000
COMMENT_MAX = 1000
MAX_IMAGES = 6
_IMG_PREFIXES = ("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,", "data:image/gif;base64,")
_MAX_IMG_BYTES = 4 * 1024 * 1024  # 4 MB per image


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
    parent_id: Optional[int] = None
    like_count: int = 0
    liked_by_me: bool = False
    replies: List["CommentOut"] = []


class PostOut(BaseModel):
    id: str          # public_id — opaque, not the row's integer PK
    kind: str
    body: str
    tags: List[str] = []
    images: List[str] = []
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
    quality_score: Optional[int] = None
    quality_note: Optional[str] = None
    quality_ai: bool = False
    can_review_quality: bool = False


class PostDetailOut(PostOut):
    comments: List[CommentOut] = []


class FeedOut(BaseModel):
    posts: List[PostOut]
    has_more: bool = False


class PostCreate(BaseModel):
    kind: str = "idea"
    body: str = Field(min_length=1, max_length=BODY_MAX + 200)
    tags: List[str] = []
    images: List[str] = []
    link_url: Optional[str] = None


class PostUpdate(BaseModel):
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None
    link_url: Optional[str] = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX + 100)
    parent_id: Optional[int] = None


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


async def _notify_post_owner(db: AsyncSession, actor: User, post: Post, kind: str) -> None:
    """Notify a post's owner when another user liked / commented on it."""
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


async def _notify_comment_replied(db: AsyncSession, actor: User, post: Post, target_user_id: int) -> None:
    """Notify the author of a comment when someone replies to it."""
    if not target_user_id or target_user_id == actor.id:
        return
    dup = (
        await db.execute(
            select(Notification.id).where(
                Notification.user_id == target_user_id,
                Notification.actor_id == actor.id,
                Notification.post_id == post.id,
                Notification.kind == "comment",
                Notification.read.is_(False),
            )
        )
    ).first()
    if dup:
        return
    db.add(Notification(user_id=target_user_id, actor_id=actor.id, kind="comment", post_id=post.id))


async def _comment_like_info(db: AsyncSession, rows, me: User):
    """One-shot like stats for a comment list: ({id: count}, {id} for the viewer's likes)."""
    ids = [c.id for c in rows]
    if not ids:
        return {}, set()
    counts = {
        cid: int(n) for cid, n in (
            await db.execute(
                select(PostCommentLike.comment_id, func.count())
                .where(PostCommentLike.comment_id.in_(ids))
                .group_by(PostCommentLike.comment_id)
            )
        ).all()
    }
    liked_ids = set(
        (
            await db.execute(
                select(PostCommentLike.comment_id).where(
                    PostCommentLike.user_id == me.id,
                    PostCommentLike.comment_id.in_(ids),
                )
            )
        ).scalars().all()
    )
    return counts, liked_ids


def _comments_tree(rows, me: User, like_counts=None, liked_ids=None) -> List[CommentOut]:
    """Build a nested reply tree from a flat (chronological) comment list.

    Hidden entries are dropped for everyone except staff / the author, and a
    reply whose parent is hidden is promoted to a top-level child.
    """
    counts = like_counts or {}
    liked = liked_ids or set()
    visible: Dict[int, CommentOut] = {}
    for c in rows:
        if c.hidden and c.user_id != me.id and not me.is_staff:
            continue
        visible[c.id] = CommentOut(
            id=c.id,
            body=c.body,
            created_at=c.created_at,
            author=_author(c.author),
            is_mine=(c.user_id == me.id),
            can_delete=(c.user_id == me.id or bool(me.is_staff)),
            parent_id=c.parent_id,
            like_count=counts.get(c.id, 0),
            liked_by_me=(c.id in liked),
            replies=[],
        )
    tops: List[CommentOut] = []
    for c in rows:
        node = visible.get(c.id)
        if node is None:
            continue
        if node.parent_id and node.parent_id in visible:
            visible[node.parent_id].replies.append(node)
        else:
            tops.append(node)
    return tops


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


def _clean_images(images) -> List[str]:
    """Validate a list of post images (data-URI or https URL). Up to MAX_IMAGES."""
    out: List[str] = []
    for raw in (images or [])[:MAX_IMAGES]:
        src = str(raw or "").strip()
        if not src:
            continue
        if src.startswith(_IMG_PREFIXES):
            try:
                raw_bytes = base64.b64decode(src.split(",", 1)[1], validate=True)
            except (binascii.Error, IndexError, ValueError):
                raise HTTPException(status_code=400, detail="Post image data is not valid base64.")
            if len(raw_bytes) > _MAX_IMG_BYTES:
                raise HTTPException(status_code=400, detail="Post image is too large (max 4 MB per image).")
        elif not re.match(r"^https?://", src, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Post images must be images or https:// URLs.")
        out.append(src)
    return out


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


# --- Contribution credits -----------------------------------------------------
# Community reputation, computed live from contribution rows (no denormalised
# column to drift). A posting + the engagement it draws both count, so helping
# others and writing quality content is rewarded roughly equally.

CREDITS_POST = 15          # per visible post created
CREDITS_LIKE = 2           # per like received on your posts
CREDITS_COMMENT_IN = 4     # per comment received on your posts
CREDITS_COMMENT_OUT = 3    # per comment you leave on someone else's post


def add_credits(
    posts: int,
    likes_received: int,
    comments_received: int,
    comments_made: int,
) -> int:
    return (
        posts * CREDITS_POST
        + likes_received * CREDITS_LIKE
        + comments_received * CREDITS_COMMENT_IN
        + comments_made * CREDITS_COMMENT_OUT
    )


async def _credits_for_user(db: AsyncSession, user_id: int) -> int:
    """Credits for one user: own visible posts, engagement on those posts, and
    comments they've left on other people's posts."""
    posts = (
        await db.execute(
            select(func.count()).select_from(Post).where(
                Post.user_id == user_id, Post.hidden.is_(False)
            )
        )
    ).scalar() or 0

    own_ids = [
        pid
        for (pid,) in (
            await db.execute(select(Post.id).where(Post.user_id == user_id))
        ).all()
    ]
    likes_recv = 0
    comments_recv = 0
    if own_ids:
        likes_recv = (
            await db.execute(
                select(func.count()).select_from(PostReaction).where(
                    PostReaction.post_id.in_(own_ids)
                )
            )
        ).scalar() or 0
        comments_recv = (
            await db.execute(
                select(func.count()).select_from(PostComment).where(
                    PostComment.post_id.in_(own_ids), PostComment.hidden.is_(False)
                )
            )
        ).scalar() or 0

    comments_made = (
        await db.execute(
            select(func.count()).select_from(PostComment).where(PostComment.user_id == user_id)
        )
    ).scalar() or 0
    return add_credits(int(posts or 0), int(likes_recv or 0), int(comments_recv or 0), int(comments_made or 0))


async def _credits_for_many(db: AsyncSession, user_ids: List[int]) -> Dict[int, int]:
    """Batch credits for a set of users (dev directory / leaderboard listings)."""
    out: Dict[int, int] = {uid: 0 for uid in user_ids}
    if not user_ids:
        return out

    for uid, n in (
        await db.execute(
            select(Post.user_id, func.count())
            .where(Post.user_id.in_(user_ids), Post.hidden.is_(False))
            .group_by(Post.user_id)
        )
    ).all():
        out[uid] += int(n or 0) * CREDITS_POST

    # likes & comments received: group engagement by post owner via Post.user_id
    owners = dict(
        (
            await db.execute(
                select(Post.id, Post.user_id).where(Post.user_id.in_(user_ids))
            )
        ).all()
    )
    if owners:
        for pid, n in (
            await db.execute(
                select(PostReaction.post_id, func.count()).group_by(PostReaction.post_id)
            )
        ).all():
            owner = owners.get(pid)
            if owner is not None:
                out[owner] += int(n or 0) * CREDITS_LIKE
        for pid, n in (
            await db.execute(
                select(PostComment.post_id, func.count())
                .where(PostComment.hidden.is_(False))
                .group_by(PostComment.post_id)
            )
        ).all():
            owner = owners.get(pid)
            if owner is not None:
                out[owner] += int(n or 0) * CREDITS_COMMENT_IN

    for uid, n in (
        await db.execute(
            select(PostComment.user_id, func.count())
            .where(PostComment.user_id.in_(user_ids))
            .group_by(PostComment.user_id)
        )
    ).all():
        out[uid] += int(n or 0) * CREDITS_COMMENT_OUT

    return out


# --- Post quality --------------------------------------------------------------
# Every post gets a score. Cheap heuristic on create (instant, offline-safe);
# authors/staff can ask the AI for a proper review which upgrades the note.

_FENCE = re.compile(r"```[\s\S]*```")


def has_code_block(body: str) -> bool:
    return bool(_FENCE.search(body or ""))


def _heuristic_quality(kind: str, body: str, tags: List[str], images: List[str], link_url: Optional[str]) -> int:
    """Fast, rule-of-thumb score so posts always carry a number without an AI
    call. Range 10..96. AI review (/_quality) replaces this when requested."""
    text = (body or "").strip()
    length = len(text)
    if length == 0:
        return 10
    score = 48
    score += min(length // 15, 22)                       # substance
    if length >= 60:
        score += 3
    if _FENCE.search(text):
        score += 10 if kind == "code" else 4            # code snippets
    if text.count("\n") >= 2:
        score += 3
    if "?" in text or "why" in text.lower():
        score += 4
    if tags:
        score += min(len(tags) * 3, 9)
    if images:
        score += 4
    if link_url:
        score += 3
    # loud / spammy / link-dump penalties
    caps = sum(1 for w in text.split() if w.isupper() and len(w) > 2)
    if caps >= 3:
        score -= 12
    if text.count("!") >= 4:
        score -= 8
    if text.lower().strip().split()[:3] and all(w in text.lower() for w in ("check", "my", "profile")):
        score -= 15
    # tiny "me too" posts
    if length < 25 and not images:
        score -= 20
    return max(10, min(96, score))


def _fallback_note(score: int, kind: str) -> str:
    if score >= 80:
        return "Clear, complete post — nice substance and formatting."
    if score >= 55:
        return "Good start. A little more detail would make it genuinely useful."
    return "A bit thin — add specifics, context, or an example so others can build on it."


async def _ai_quality(p: Post) -> Optional[Dict[str, object]]:
    """Ask the tutor LLM to grade a post. Returns None when AI is unavailable so
    the caller can fall back to the heuristic."""
    if _ai.client is None:
        return None
    try:
        raw = await _ai._complete(
            [
                {
                    "role": "system",
                    "content": (
                        "You grade short developer-community posts. Reply with ONLY a JSON object: "
                        '{"score": <integer 0-100>, "note": "<1-2 sentences: verdict + one concrete '
                        'way to make it more useful>"}. Be encouraging but honest. Score 0 for spam '
                        "or abuse."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Post kind: {p.kind}\nTags: {', '.join(p.tags or [])}\n\n"
                        f"{p.body}\n\n"
                        f"{('Link: ' + p.link_url) if p.link_url else ''}"
                    ),
                },
            ],
            max_tokens=180,
            temperature=0.3,
        )
        data = json.loads(re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip())
        score = int(data.get("score", 0))
        note = str(data.get("note", "")).strip() or _fallback_note(score, p.kind)
        return {"score": max(0, min(100, score)), "note": note}
    except Exception:
        return None


def _post_out(p: Post, like_count: int, comment_count: int, liked: bool, me: User) -> PostOut:
    is_mine = p.user_id == me.id
    return PostOut(
        id=p.public_id,
        kind=p.kind,
        body=p.body,
        tags=p.tags or [],
        images=p.images or [],
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
        quality_score=p.quality_score,
        quality_note=p.quality_note if is_mine or bool(me.is_staff) else None,
        quality_ai=bool(p.quality_ai),
        can_review_quality=is_mine or bool(me.is_staff),
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
    kind: Optional[str] = None,
    search: Optional[str] = None,
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
    if kind and kind in KINDS:
        q = q.where(Post.kind == kind)
    search_clean = (search or "").strip()
    if search_clean:
        q = q.where(Post.body.ilike(f"%{search_clean}%"))
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

    body_clean = _clean_body(body.body, 2, BODY_MAX, "Post")
    q_score = _heuristic_quality(body.kind, body_clean, _clean_tags(body.tags), _clean_images(body.images), _clean_link(body.link_url))
    p = Post(
        user_id=current_user.id,
        kind=body.kind,
        body=body_clean,
        tags=_clean_tags(body.tags),
        images=_clean_images(body.images),
        link_url=_clean_link(body.link_url),
        quality_score=q_score,
        quality_note=_fallback_note(q_score, body.kind),
        quality_ai=False,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    p = await _load_post(db, p.public_id, current_user)
    return _post_out(p, 0, 0, False, current_user)


@router.post("/posts/{public_id}/quality")
async def review_post_quality(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade a post's quality. Authors/staff trigger the AI review; it upgrades
    the stored score + note (falling back to the heuristic if the LLM is off)."""
    p = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found.")
    if p.user_id != current_user.id and not current_user.is_staff:
        raise HTTPException(status_code=403, detail="Only the author or staff can review quality.")

    reviewed = await _ai_quality(p)
    if reviewed:
        p.quality_score = reviewed["score"]
        p.quality_note = reviewed["note"]
        p.quality_ai = True
    else:
        p.quality_score = _heuristic_quality(
            p.kind, p.body or "", p.tags or [], p.images or [], p.link_url
        )
        p.quality_note = _fallback_note(p.quality_score, p.kind)
        p.quality_ai = False
    await db.commit()

    return {
        "score": p.quality_score,
        "note": p.quality_note,
        "ai": p.quality_ai,
        "ai_unavailable": reviewed is None,
    }


@router.post("/posts/{public_id}/explain")
async def explain_post_code(
    public_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI explainer for a code-kind post (or any post with a fenced snippet).

    Pulls the first code block(s) out of the markdown body and returns a
    learner-friendly walkthrough. No persistence — a pure on-demand helper."""
    p = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Post not found.")
    if p.hidden:
        if p.user_id != current_user.id and not current_user.is_staff:
            raise HTTPException(status_code=404, detail="Post not found.")

    blocks = re.findall(r"```(\w+)?\n([\s\S]*?)```", p.body or "")
    if not blocks:
        raise HTTPException(status_code=400, detail="This post has no code block to explain.")

    chunks = []
    total = 0
    for lang, code in blocks:
        chunk = f'Language: {lang or "unknown"}\n```\n{code[:800]}\n```'
        if total + len(chunk) > 1600:
            break
        chunks.append(chunk)
        total += len(chunk)
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable code found.")

    if _ai.client is None:
        raise HTTPException(status_code=503, detail="AI explainer is offline right now.")

    try:
        explanation = await _ai._complete(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a mentor explaining a code snippet posted by a learner. "
                        "Answer in friendly markdown with three short parts: (1) what it does, "
                        "(2) the two or three pieces worth zooming into, (3) one way to extend it. "
                        "Keep it under ~220 words. No generic filler."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Post kind: {p.kind}\n\nPosts code:\n" + "\n\n".join(chunks)
                    ),
                },
            ],
            max_tokens=600,
            temperature=0.3,
        )
    except Exception:
        raise HTTPException(status_code=503, detail="The explainer couldn't respond — try again in a bit.")

    return {"explanation": explanation}


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
    total_comments = len([
        c for c in p.comments
        if not c.hidden or current_user.is_staff or c.user_id == current_user.id
    ])
    like_counts, liked_ids = await _comment_like_info(db, p.comments, current_user)
    comments = _comments_tree(p.comments, current_user, like_counts, liked_ids)
    base = _post_out(p, like_count, total_comments, liked, current_user)
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
    if body.images is not None:
        p.images = _clean_images(body.images)
    if body.link_url is not None:
        p.link_url = _clean_link(body.link_url)
    p.updated_at = datetime.utcnow()
    p.quality_score = _heuristic_quality(p.kind, p.body or "", p.tags or [], p.images or [], p.link_url)
    p.quality_note = _fallback_note(p.quality_score, p.kind)
    p.quality_ai = False
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
        await _notify_post_owner(db, current_user, post, "like")
    await db.commit()
    like_count = (
        await db.execute(select(func.count()).select_from(PostReaction).where(PostReaction.post_id == post_id))
    ).scalar() or 0
    return {"liked": liked, "like_count": int(like_count)}


@router.post("/posts/{public_id}/comments/{comment_id}/like")
async def toggle_comment_like(
    public_id: str,
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = (await db.execute(select(Post).where(Post.public_id == public_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    c = (
        await db.execute(
            select(PostComment).where(
                PostComment.id == comment_id, PostComment.post_id == post.id
            )
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found.")
    row = (
        await db.execute(
            select(PostCommentLike).where(
                PostCommentLike.comment_id == c.id,
                PostCommentLike.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        liked = False
    else:
        db.add(PostCommentLike(comment_id=c.id, user_id=current_user.id))
        liked = True
    await db.commit()
    like_count = (
        await db.execute(
            select(func.count()).select_from(PostCommentLike).where(PostCommentLike.comment_id == c.id)
        )
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
    parent = None
    if body.parent_id is not None:
        parent = (
            await db.execute(
                select(PostComment).where(
                    PostComment.id == body.parent_id, PostComment.post_id == p.id
                )
            )
        ).scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="The comment you replied to no longer exists.")
    c = PostComment(
        post_id=p.id,
        user_id=current_user.id,
        parent_id=body.parent_id,
        body=_clean_body(body.body, 1, COMMENT_MAX, "Comment"),
    )
    db.add(c)
    await db.commit()
    await _notify_post_owner(db, current_user, p, "comment")
    if parent is not None:
        await _notify_comment_replied(db, current_user, p, parent.user_id)
    await db.commit()
    c = (
        await db.execute(
            select(PostComment).where(PostComment.id == c.id).options(selectinload(PostComment.author))
        )
    ).scalar_one()
    return CommentOut(
        id=c.id, body=c.body, created_at=c.created_at, author=_author(c.author),
        is_mine=True, can_delete=True, parent_id=c.parent_id, replies=[],
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
    children = (
        await db.execute(select(PostComment).where(PostComment.parent_id == comment_id))
    ).scalars().all()
    for child in children:
        await db.delete(child)
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
    credits: int = 0
    recent_projects: List[PublicProject] = []
    is_me: bool = False
    follower_count: int = 0
    following_count: int = 0
    is_following: bool = False


class UserPostOut(BaseModel):
    post: PostOut
    is_mine: bool = False


class DevRow(BaseModel):
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    headline: Optional[str] = None
    major: Optional[str] = None
    verified: bool = False
    is_staff: bool = False
    xp: int = 0
    lessons_completed: int = 0
    challenges_solved: int = 0
    quizzes_passed: int = 0
    follower_count: int = 0
    post_count: int = 0
    credits: int = 0
    rank: Optional[int] = None
    is_me: bool = False


class DevListResponse(BaseModel):
    devs: List[DevRow]
    total: int


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

    is_me = (u.id == current_user.id)
    follower_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.following_id == u.id))
    ).scalar() or 0
    following_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.follower_id == u.id))
    ).scalar() or 0
    is_following = False
    if not is_me:
        is_following = (
            await db.execute(
                select(Follow.id).where(
                    Follow.follower_id == current_user.id, Follow.following_id == u.id
                )
            )
        ).first() is not None

    credits = await _credits_for_user(db, u.id)

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
        credits=credits,
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
        is_me=is_me,
        follower_count=int(follower_count or 0),
        following_count=int(following_count or 0),
        is_following=is_following,
    )


async def _streak_for_user(user_id: int, db: AsyncSession) -> int:
    """Count consecutive days with at least one completed lesson, ending today
    (Cambodia local day — lesson count, not server UTC day)."""
    rows = (
        await db.execute(
            select(UserProgress.completed_at)
            .where(UserProgress.user_id == user_id, UserProgress.completed.is_(True))
        )
    ).scalars().all()
    days = {khmer_date(d) for d in rows if d}
    if not days:
        return 0
    today = khmer_today()
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


# --------------------------------------------------------------------------- #
#  Developer directory — searchable roster of learners & mentors.              #
# --------------------------------------------------------------------------- #

@router.get("/devs", response_model=DevListResponse)
async def dev_directory(
    q: Optional[str] = None,
    major: Optional[str] = None,
    limit: int = 60,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Searchable directory of developers. Filters by free-text query (name /
    handle / headline) and optional career-track major. Sorted by XP desc."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    # Lesson XP + count per user
    lesson_rows = (
        await db.execute(
            select(UserProgress.user_id, func.coalesce(func.sum(UserProgress.score), 0), func.count(UserProgress.id))
            .where(UserProgress.completed.is_(True))
            .group_by(UserProgress.user_id)
        )
    ).all()
    lesson_xp: Dict[int, float] = {uid: xp for uid, xp, _ in lesson_rows}
    lessons_done: Dict[int, int] = {uid: n for uid, _, n in lesson_rows}

    # Distinct solved challenges
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
    challenges_solved: Dict[int, int] = {}
    for uid, cid in solved_rows:
        challenge_xp[uid] = challenge_xp.get(uid, 0) + xp_by_challenge.get(cid, 0)
        challenges_solved[uid] = challenges_solved.get(uid, 0) + 1

    # Distinct passed quizzes
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
    quizzes_passed: Dict[int, int] = {}
    for uid, qid in quiz_rows:
        quiz_xp[uid] = quiz_xp.get(uid, 0) + xp_by_quiz.get(qid, 0)
        quizzes_passed[uid] = quizzes_passed.get(uid, 0) + 1

    # Follower counts
    follower_rows = (
        await db.execute(
            select(Follow.following_id, func.count()).group_by(Follow.following_id)
        )
    ).all()
    followers: Dict[int, int] = dict(follower_rows)

    # Post counts (visible public posts only)
    post_rows = (
        await db.execute(
            select(Post.user_id, func.count())
            .where(Post.hidden.is_(False))
            .group_by(Post.user_id)
        )
    ).all()
    post_counts: Dict[int, int] = dict(post_rows)

    # Build the user query with filters
    uq = select(User)
    q_clean = (q or "").strip().lower()
    if q_clean:
        like = f"%{q_clean}%"
        uq = uq.where(
            User.username.ilike(like)
            | User.display_name.ilike(like)
            | User.headline.ilike(like)
        )
    if major:
        uq = uq.where(User.major == major)
    users = (await db.execute(uq)).scalars().all()

    def _xp(u: User) -> int:
        return (
            int(round(lesson_xp.get(u.id, 0)))
            + int(challenge_xp.get(u.id, 0))
            + int(quiz_xp.get(u.id, 0))
        )

    credits_map = await _credits_for_many(db, [u.id for u in users])

    rows = []
    for u in users:
        rows.append(
            DevRow(
                username=u.username or f"user{u.id}",
                display_name=u.display_name,
                avatar=(u.avatar_data or u.avatar_url),
                headline=u.headline,
                major=u.major,
                verified=bool(u.verified),
                is_staff=bool(u.is_staff),
                xp=_xp(u),
                lessons_completed=lessons_done.get(u.id, 0),
                challenges_solved=challenges_solved.get(u.id, 0),
                quizzes_passed=quizzes_passed.get(u.id, 0),
                follower_count=int(followers.get(u.id, 0)),
                post_count=int(post_counts.get(u.id, 0)),
                credits=credits_map.get(u.id, 0),
                rank=None,
                is_me=(u.id == current_user.id),
            )
        )

    rows.sort(key=lambda r: (-r.xp, r.username.lower()))

    # Assign ranks based on the sorted order (XP leaderboard style)
    for i, r in enumerate(rows, start=1):
        r.rank = i

    total = len(rows)
    devs = rows[offset : offset + limit]
    return DevListResponse(devs=devs, total=total)


# --------------------------------------------------------------------------- #
#  Follow / unfollow + a user's own posts.                                      #
# --------------------------------------------------------------------------- #

class FollowOut(BaseModel):
    username: str
    following: bool
    follower_count: int


async def _resolve_user(db: AsyncSession, username: str) -> User:
    u = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    return u


@router.post("/users/{username}/follow", response_model=FollowOut)
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _resolve_user(db, username)
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't follow yourself.")
    existing = (
        await db.execute(
            select(Follow.id).where(
                Follow.follower_id == current_user.id, Follow.following_id == target.id
            )
        )
    ).first()
    if not existing:
        db.add(Follow(follower_id=current_user.id, following_id=target.id))
        await db.commit()
    follower_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.following_id == target.id))
    ).scalar() or 0
    return FollowOut(username=target.username or f"user{target.id}", following=True, follower_count=int(follower_count or 0))


@router.delete("/users/{username}/follow", response_model=FollowOut)
async def unfollow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _resolve_user(db, username)
    row = (
        await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id, Follow.following_id == target.id
            )
        )
    ).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    follower_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.following_id == target.id))
    ).scalar() or 0
    return FollowOut(username=target.username or f"user{target.id}", following=False, follower_count=int(follower_count or 0))


@router.get("/users/{username}/posts", response_model=FeedOut)
async def user_posts(
    username: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = await _resolve_user(db, username)
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
        .where(Post.user_id == target.id)
    )
    if not current_user.is_staff:
        q = q.where(Post.hidden.is_(False))
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
