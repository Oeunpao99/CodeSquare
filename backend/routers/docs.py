"""Knowledge Library — read-only reference articles, grouped into collections.

Two kinds of collection feed the same tree:
  * source="mirror"      — generated from a lesson track by seed_docs.py
  * source="standalone"  — hand-written reference (Git, CI/CD, deployment, ...)

The client can't tell them apart, and doesn't need to.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Dict, List, Optional

from database import get_db
from models.models import (
    DocCollection, DocTopic, Lesson, Module, Language, User, UserProgress,
    UserDocProgress, DocRating,
)
from routers.auth import get_current_user

router = APIRouter()


async def _doc_progress_map(
    db: AsyncSession, user_id: int, topic_ids: List[int]
) -> Dict[int, UserDocProgress]:
    """(topic_id -> UserDocProgress) for the given topics, for this user."""
    if not topic_ids:
        return {}
    rows = await db.execute(
        select(UserDocProgress).where(
            UserDocProgress.user_id == user_id,
            UserDocProgress.topic_id.in_(topic_ids),
        )
    )
    return {r.topic_id: r for r in rows.scalars().all()}


async def _upsert_doc_progress(
    db: AsyncSession, user_id: int, topic_id: int
) -> UserDocProgress:
    row = (
        await db.execute(
            select(UserDocProgress).where(
                UserDocProgress.user_id == user_id,
                UserDocProgress.topic_id == topic_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = UserDocProgress(user_id=user_id, topic_id=topic_id)
        db.add(row)
    return row


# ---------- response models ----------

class ShelfStats(BaseModel):
    learners: int = 0              # distinct users with any reading activity here
    finished: int = 0             # distinct users who've read every topic
    rating_avg: float = 0.0
    rating_count: int = 0
    my_rating: Optional[int] = None


class CollectionCard(BaseModel):
    slug: str
    title: str
    description: str
    icon: str
    color: str
    order: int
    source: str
    category: Optional[str] = None
    topic_count: int
    trackable: int = 0              # topics linked to a lesson (0 for standalone)
    completed: int = 0             # of those, how many the user has finished
    majors: List[str] = []          # union of every topic's major_slugs
    learners: int = 0
    finished: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    my_rating: Optional[int] = None


class TopicListItem(BaseModel):
    slug: str
    title: str
    summary: str
    reading_minutes: int
    order: int
    tags: List[str] = []
    major_slugs: List[str] = []
    has_lesson: bool = False
    completed: bool = False         # user finished the linked lesson
    read: bool = False              # user marked this article read
    bookmarked: bool = False
    group_level: int = 1
    group_difficulty: Optional[str] = None


class PathStep(BaseModel):
    level: int
    label: str
    difficulty: Optional[str] = None
    total: int = 0
    done: int = 0


class CollectionDetail(BaseModel):
    slug: str
    title: str
    description: str
    icon: str
    color: str
    source: str
    category: Optional[str] = None
    trackable: int = 0
    completed: int = 0
    read_count: int = 0             # articles the user has marked read on this shelf
    majors: List[str] = []
    steps: List[PathStep] = []      # beginner -> advanced ladder
    topics: List[TopicListItem] = []
    learners: int = 0
    finished: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    my_rating: Optional[int] = None


class RelatedLesson(BaseModel):
    slug: str                       # language slug
    module_id: int
    lesson_id: int
    title: str


class TopicNav(BaseModel):
    slug: str
    title: str
    group: Optional[str] = None      # module title — the sidebar groups by this
    completed: bool = False          # user finished the linked lesson


class ArticleResponse(BaseModel):
    collection_slug: str
    collection_title: str
    collection_color: str
    slug: str
    title: str
    summary: str
    body: str
    reading_minutes: int
    position: int = 1                # 1-based index within the collection
    total: int = 1
    tags: List[str] = []
    major_slugs: List[str] = []
    code_sample: Optional[str] = None   # raw snippet for the mini playground
    read: bool = False
    bookmarked: bool = False
    related_lesson: Optional[RelatedLesson] = None
    prev: Optional[TopicNav] = None
    next: Optional[TopicNav] = None
    siblings: List[TopicNav] = []


# ---------- helpers ----------

def _majors_for(topics: List[DocTopic]) -> List[str]:
    seen: List[str] = []
    for t in topics:
        for m in (t.major_slugs or []):
            if m not in seen:
                seen.append(m)
    return seen


async def _completed_lesson_ids(db: AsyncSession, user_id: int) -> set:
    """Lesson ids this user has finished — the basis for Library progress."""
    rows = await db.execute(
        select(UserProgress.lesson_id)
        .where(UserProgress.user_id == user_id)
        .where(UserProgress.completed == True)  # noqa: E712
    )
    return set(rows.scalars().all())


async def _shelf_stats(
    db: AsyncSession, collections: List[DocCollection], user_id: int
) -> dict:
    """{collection_id: ShelfStats} — learners, finishers, and rating aggregate.

    A "learner" is anyone who has either opened a topic here *or* completed a
    lesson that a topic on this shelf mirrors — finishing the lesson is the same
    material, so it counts. "finished" means every topic read, or every mirrored
    lesson completed.
    """
    coll_topics = {c.id: {t.id for t in c.topics} for c in collections}
    topic_to_coll = {tid: cid for cid, tids in coll_topics.items() for tid in tids}

    # topics that mirror a lesson: lesson_id -> collection_id, and the set of
    # mirrored lesson ids per collection (the bar for "finished via lessons").
    lesson_to_coll: dict = {}
    coll_lessons: dict = {}
    for c in collections:
        for t in c.topics:
            if t.related_lesson_id is not None:
                lesson_to_coll[t.related_lesson_id] = c.id
                coll_lessons.setdefault(c.id, set()).add(t.related_lesson_id)

    any_users: dict = {}   # cid -> set(user_id)
    read_pairs: dict = {}  # cid -> set((user_id, topic_id)) where read

    # reading activity in the Library itself
    rows = (
        await db.execute(
            select(
                UserDocProgress.topic_id, UserDocProgress.user_id, UserDocProgress.read
            )
        )
    ).all()
    for tid, uid, is_read in rows:
        cid = topic_to_coll.get(tid)
        if cid is None:
            continue
        any_users.setdefault(cid, set()).add(uid)
        if is_read:
            read_pairs.setdefault(cid, set()).add((uid, tid))

    # completed lessons that a shelf mirrors count as activity on that shelf
    lessons_done: dict = {}  # cid -> {user_id -> set(lesson_id)}
    if lesson_to_coll:
        lrows = (
            await db.execute(
                select(UserProgress.user_id, UserProgress.lesson_id)
                .where(UserProgress.completed == True)  # noqa: E712
                .where(UserProgress.lesson_id.in_(list(lesson_to_coll.keys())))
            )
        ).all()
        for uid, lid in lrows:
            cid = lesson_to_coll.get(lid)
            if cid is None:
                continue
            any_users.setdefault(cid, set()).add(uid)
            lessons_done.setdefault(cid, {}).setdefault(uid, set()).add(lid)

    # ratings
    rating_rows = (
        await db.execute(
            select(
                DocRating.collection_id,
                func.avg(DocRating.stars),
                func.count(DocRating.id),
            ).group_by(DocRating.collection_id)
        )
    ).all()
    rating_map = {cid: (float(avg or 0), int(cnt or 0)) for cid, avg, cnt in rating_rows}
    mine = dict(
        (
            await db.execute(
                select(DocRating.collection_id, DocRating.stars).where(
                    DocRating.user_id == user_id
                )
            )
        ).all()
    )

    out = {}
    for cid, tids in coll_topics.items():
        per_user: dict = {}
        for uid, tid in read_pairs.get(cid, ()):
            per_user.setdefault(uid, set()).add(tid)

        needed_lessons = coll_lessons.get(cid) or set()
        finishers = set()
        for uid in any_users.get(cid, ()):
            read_all = bool(tids) and tids <= per_user.get(uid, set())
            lessons_all = bool(needed_lessons) and needed_lessons <= lessons_done.get(cid, {}).get(uid, set())
            if read_all or lessons_all:
                finishers.add(uid)
        finished = len(finishers)
        avg, cnt = rating_map.get(cid, (0.0, 0))
        out[cid] = ShelfStats(
            learners=len(any_users.get(cid, ())),
            finished=finished,
            rating_avg=round(avg, 1),
            rating_count=cnt,
            my_rating=mine.get(cid),
        )
    return out


def _progress(topics: List[DocTopic], done: set) -> tuple:
    """(trackable, completed) — topics linked to a lesson, and how many are done."""
    linked = [t for t in topics if t.related_lesson_id is not None]
    return len(linked), sum(1 for t in linked if t.related_lesson_id in done)


# ---------- endpoints ----------

@router.get("/collections", response_model=List[CollectionCard])
async def list_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocCollection)
        .options(selectinload(DocCollection.topics))
        .order_by(DocCollection.order, DocCollection.title)
    )
    collections = result.scalars().all()
    done = await _completed_lesson_ids(db, current_user.id)
    stats = await _shelf_stats(db, collections, current_user.id)

    cards = []
    for c in collections:
        trackable, completed = _progress(c.topics, done)
        s = stats.get(c.id) or ShelfStats()
        cards.append(
            CollectionCard(
                slug=c.slug,
                title=c.title,
                description=c.description or "",
                icon=c.icon or "📚",
                color=c.color or "#2DD4BF",
                order=c.order or 0,
                source=c.source or "standalone",
                category=c.category,
                topic_count=len(c.topics),
                trackable=trackable,
                completed=completed,
                majors=_majors_for(c.topics),
                learners=s.learners,
                finished=s.finished,
                rating_avg=s.rating_avg,
                rating_count=s.rating_count,
                my_rating=s.my_rating,
            )
        )
    return cards


class SearchHit(BaseModel):
    collection_slug: str
    collection_title: str
    collection_icon: str
    topic_slug: str
    title: str
    summary: str
    reading_minutes: int


@router.get("/search", response_model=List[SearchHit])
async def search_docs(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Match a term against topic title / summary / tags across every shelf."""
    term = (q or "").strip()
    if len(term) < 2:
        return []
    like = f"%{term}%"
    rows = await db.execute(
        select(DocTopic, DocCollection)
        .join(DocCollection, DocCollection.id == DocTopic.collection_id)
        .where(
            or_(
                DocTopic.title.ilike(like),
                DocTopic.summary.ilike(like),
                cast(DocTopic.tags, String).ilike(like),
            )
        )
    )
    pairs = rows.all()

    low = term.lower()

    def rank(topic: DocTopic) -> int:
        t = (topic.title or "").lower()
        if t == low:
            return 0
        if t.startswith(low):
            return 1
        if low in t:
            return 2
        return 3

    pairs.sort(key=lambda p: (rank(p[0]), p[1].order or 0, p[0].order or 0))

    return [
        SearchHit(
            collection_slug=c.slug,
            collection_title=c.title,
            collection_icon=c.icon or "📚",
            topic_slug=t.slug,
            title=t.title,
            summary=t.summary or "",
            reading_minutes=t.reading_minutes or 4,
        )
        for t, c in pairs[:24]
    ]


@router.get("/collections/{slug}", response_model=CollectionDetail)
async def get_collection(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocCollection)
        .where(DocCollection.slug == slug)
        .options(selectinload(DocCollection.topics))
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    topics = sorted(collection.topics, key=lambda t: (t.order or 0))
    done = await _completed_lesson_ids(db, current_user.id)
    dprog = await _doc_progress_map(db, current_user.id, [t.id for t in topics])
    trackable, completed = _progress(topics, done)
    read_count = sum(1 for p in dprog.values() if p.read)
    stat = (await _shelf_stats(db, [collection], current_user.id)).get(collection.id) or ShelfStats()
    is_mirror = (collection.source or "") == "mirror"

    # Build the beginner -> advanced ladder: one step per group_level (skipping
    # the level-0 "Overview" primer). For mirror shelves a step is a module; for
    # standalone shelves each topic is its own step.
    step_by_level: dict = {}
    steps: List[PathStep] = []
    for t in topics:
        lvl = t.group_level or 0
        if lvl <= 0:
            continue
        if lvl not in step_by_level:
            label = (t.tags[0] if (is_mirror and t.tags) else t.title)
            step_by_level[lvl] = PathStep(level=lvl, label=label, difficulty=t.group_difficulty)
            steps.append(step_by_level[lvl])
        s = step_by_level[lvl]
        s.total += 1
        if t.related_lesson_id is not None and t.related_lesson_id in done:
            s.done += 1
    steps.sort(key=lambda s: s.level)

    return CollectionDetail(
        slug=collection.slug,
        title=collection.title,
        description=collection.description or "",
        icon=collection.icon or "📚",
        color=collection.color or "#2DD4BF",
        source=collection.source or "standalone",
        category=collection.category,
        trackable=trackable,
        completed=completed,
        read_count=read_count,
        learners=stat.learners,
        finished=stat.finished,
        rating_avg=stat.rating_avg,
        rating_count=stat.rating_count,
        my_rating=stat.my_rating,
        majors=_majors_for(topics),
        steps=steps,
        topics=[
            TopicListItem(
                slug=t.slug,
                title=t.title,
                summary=t.summary or "",
                reading_minutes=t.reading_minutes or 4,
                order=t.order or 0,
                tags=t.tags or [],
                major_slugs=t.major_slugs or [],
                has_lesson=t.related_lesson_id is not None,
                completed=(t.related_lesson_id is not None and t.related_lesson_id in done),
                read=bool(t.id in dprog and dprog[t.id].read),
                bookmarked=bool(t.id in dprog and dprog[t.id].bookmarked),
                group_level=t.group_level if t.group_level is not None else 1,
                group_difficulty=t.group_difficulty,
            )
            for t in topics
        ],
    )


class RateRequest(BaseModel):
    stars: int


class RateResponse(BaseModel):
    rating_avg: float
    rating_count: int
    my_rating: int


@router.post("/collections/{slug}/rate", response_model=RateResponse)
async def rate_collection(
    slug: str,
    body: RateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stars = max(1, min(5, int(body.stars)))
    coll = (
        await db.execute(select(DocCollection).where(DocCollection.slug == slug))
    ).scalar_one_or_none()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    row = (
        await db.execute(
            select(DocRating).where(
                DocRating.user_id == current_user.id,
                DocRating.collection_id == coll.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = DocRating(user_id=current_user.id, collection_id=coll.id)
        db.add(row)
    row.stars = stars
    row.updated_at = datetime.utcnow()
    await db.commit()

    avg, cnt = (
        await db.execute(
            select(func.avg(DocRating.stars), func.count(DocRating.id)).where(
                DocRating.collection_id == coll.id
            )
        )
    ).one()
    return RateResponse(rating_avg=round(float(avg or 0), 1), rating_count=int(cnt or 0), my_rating=stars)


@router.get("/topics/{collection_slug}/{topic_slug}", response_model=ArticleResponse)
async def get_topic(
    collection_slug: str,
    topic_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocCollection)
        .where(DocCollection.slug == collection_slug)
        .options(selectinload(DocCollection.topics))
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    topics = sorted(collection.topics, key=lambda t: (t.order or 0))
    idx = next((i for i, t in enumerate(topics) if t.slug == topic_slug), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic = topics[idx]

    # Which linked lessons has this user completed? Drives the sidebar dots.
    done_lessons = await _completed_lesson_ids(db, current_user.id)
    my_progress = (
        await db.execute(
            select(UserDocProgress).where(
                UserDocProgress.user_id == current_user.id,
                UserDocProgress.topic_id == topic.id,
            )
        )
    ).scalar_one_or_none()

    related: Optional[RelatedLesson] = None
    code_sample: Optional[str] = None
    if topic.related_lesson_id is not None:
        lrow = await db.execute(
            select(Lesson.title, Module.id, Language.slug, Lesson.code_example)
            .join(Module, Module.id == Lesson.module_id)
            .join(Language, Language.id == Module.language_id)
            .where(Lesson.id == topic.related_lesson_id)
        )
        hit = lrow.first()
        if hit:
            title, module_id, lang_slug, code_example = hit
            related = RelatedLesson(
                slug=lang_slug,
                module_id=module_id,
                lesson_id=topic.related_lesson_id,
                title=title,
            )
            code_sample = code_example or None

    def nav(t: DocTopic) -> TopicNav:
        return TopicNav(
            slug=t.slug,
            title=t.title,
            group=(t.tags[0] if t.tags else None),
            completed=t.related_lesson_id in done_lessons,
        )

    return ArticleResponse(
        collection_slug=collection.slug,
        collection_title=collection.title,
        collection_color=collection.color or "#2DD4BF",
        slug=topic.slug,
        title=topic.title,
        summary=topic.summary or "",
        body=topic.body or "",
        reading_minutes=topic.reading_minutes or 4,
        position=idx + 1,
        total=len(topics),
        tags=topic.tags or [],
        major_slugs=topic.major_slugs or [],
        code_sample=code_sample,
        read=bool(my_progress and my_progress.read),
        bookmarked=bool(my_progress and my_progress.bookmarked),
        related_lesson=related,
        prev=nav(topics[idx - 1]) if idx > 0 else None,
        next=nav(topics[idx + 1]) if idx < len(topics) - 1 else None,
        siblings=[nav(t) for t in topics],
    )


# ---------- reading state (read / bookmark / continue) ----------

class DocProgressState(BaseModel):
    read: bool = False
    bookmarked: bool = False


class ReadUpdate(BaseModel):
    read: bool = True


class BookmarkUpdate(BaseModel):
    bookmarked: bool = True


class ContinueReading(BaseModel):
    collection_slug: str
    collection_title: str
    collection_icon: str
    topic_slug: str
    title: str
    summary: str
    reading_minutes: int
    position: int
    total: int
    resuming: bool          # True = picking up an unread topic after earlier progress


class BookmarkItem(BaseModel):
    collection_slug: str
    collection_title: str
    collection_icon: str
    topic_slug: str
    title: str
    reading_minutes: int


async def _resolve_topic(db: AsyncSession, collection_slug: str, topic_slug: str) -> DocTopic:
    row = await db.execute(
        select(DocTopic)
        .join(DocCollection, DocCollection.id == DocTopic.collection_id)
        .where(DocCollection.slug == collection_slug, DocTopic.slug == topic_slug)
    )
    topic = row.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.post(
    "/topics/{collection_slug}/{topic_slug}/read", response_model=DocProgressState
)
async def set_read(
    collection_slug: str,
    topic_slug: str,
    body: ReadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = await _resolve_topic(db, collection_slug, topic_slug)
    row = await _upsert_doc_progress(db, current_user.id, topic.id)
    row.read = body.read
    row.read_at = datetime.utcnow() if body.read else None
    row.updated_at = datetime.utcnow()
    await db.commit()
    return DocProgressState(read=row.read, bookmarked=row.bookmarked)


@router.post(
    "/topics/{collection_slug}/{topic_slug}/bookmark", response_model=DocProgressState
)
async def set_bookmark(
    collection_slug: str,
    topic_slug: str,
    body: BookmarkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = await _resolve_topic(db, collection_slug, topic_slug)
    row = await _upsert_doc_progress(db, current_user.id, topic.id)
    row.bookmarked = body.bookmarked
    row.updated_at = datetime.utcnow()
    await db.commit()
    return DocProgressState(read=row.read, bookmarked=row.bookmarked)


@router.get("/reading/continue", response_model=Optional[ContinueReading])
async def continue_reading(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The next article to read: the earliest unread topic in the collection the
    user most recently touched. Falls back to that last-touched article itself if
    its whole shelf is read. Null (200) when the user has no reading history.
    """
    last = (
        await db.execute(
            select(UserDocProgress)
            .where(UserDocProgress.user_id == current_user.id)
            .order_by(UserDocProgress.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last is None:
        return None

    anchor = (
        await db.execute(
            select(DocTopic)
            .where(DocTopic.id == last.topic_id)
            .options(selectinload(DocTopic.collection).selectinload(DocCollection.topics))
        )
    ).scalar_one_or_none()
    if anchor is None or anchor.collection is None:
        return None

    collection = anchor.collection
    topics = sorted(collection.topics, key=lambda t: (t.order or 0))
    dprog = await _doc_progress_map(db, current_user.id, [t.id for t in topics])

    target = next((t for t in topics if not (t.id in dprog and dprog[t.id].read)), None)
    resuming = target is not None
    if target is None:
        target = anchor
        resuming = False

    pos = next((i for i, t in enumerate(topics) if t.id == target.id), 0) + 1
    return ContinueReading(
        collection_slug=collection.slug,
        collection_title=collection.title,
        collection_icon=collection.icon or "📚",
        topic_slug=target.slug,
        title=target.title,
        summary=target.summary or "",
        reading_minutes=target.reading_minutes or 4,
        position=pos,
        total=len(topics),
        resuming=resuming,
    )


@router.get("/bookmarks", response_model=List[BookmarkItem])
async def list_bookmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(DocTopic, DocCollection)
        .join(UserDocProgress, UserDocProgress.topic_id == DocTopic.id)
        .join(DocCollection, DocCollection.id == DocTopic.collection_id)
        .where(
            UserDocProgress.user_id == current_user.id,
            UserDocProgress.bookmarked.is_(True),
        )
        .order_by(UserDocProgress.updated_at.desc())
    )
    return [
        BookmarkItem(
            collection_slug=c.slug,
            collection_title=c.title,
            collection_icon=c.icon or "📚",
            topic_slug=t.slug,
            title=t.title,
            reading_minutes=t.reading_minutes or 4,
        )
        for t, c in rows.all()
    ]
