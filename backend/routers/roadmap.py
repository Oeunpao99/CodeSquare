from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
from database import get_db
from models.models import User, Language, Module, Lesson, UserProgress
from routers.auth import get_current_user
from majors import MAJOR_TRACKS

router = APIRouter()


class TrackModule(BaseModel):
    id: int
    title: str
    order: int
    level: int = 1
    difficulty: str
    total_lessons: int
    completed_lessons: int


class Track(BaseModel):
    slug: str
    name: str
    icon: str
    color: str
    description: str
    total_lessons: int
    completed_lessons: int
    percent: float
    status: str  # "not-started" | "in-progress" | "completed"
    modules: List[TrackModule] = []


class MajorRoadmap(BaseModel):
    major: str
    total_lessons: int
    completed_lessons: int
    percent: float
    tracks: List[Track] = []


def status_of(total: int, completed: int) -> str:
    if total == 0:
        return "not-started"
    if completed == 0:
        return "not-started"
    if completed >= total:
        return "completed"
    return "in-progress"


@router.get("/{major}", response_model=MajorRoadmap)
async def get_roadmap(
    major: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slugs = MAJOR_TRACKS.get(major)
    if not slugs:
        raise HTTPException(status_code=404, detail="Unknown major")

    # Lessons the user has completed, keyed by lesson id.
    prog = await db.execute(
        select(UserProgress.lesson_id)
        .where(UserProgress.user_id == current_user.id)
        .where(UserProgress.completed == True)
    )
    completed_lesson_ids = set(prog.scalars().all())

    tracks: List[Track] = []
    for slug in slugs:
        lang = await db.execute(select(Language).where(Language.slug == slug))
        language = lang.scalar_one_or_none()
        if not language:
            continue

        mods_result = await db.execute(
            select(Module).where(Module.language_id == language.id).order_by(Module.order)
        )
        modules = mods_result.scalars().all()

        track_modules: List[TrackModule] = []
        track_total = 0
        track_completed = 0

        for module in modules:
            lessons_result = await db.execute(
                select(Lesson).where(Lesson.module_id == module.id).order_by(Lesson.order)
            )
            lessons = lessons_result.scalars().all()

            module_total = len(lessons)
            module_completed = sum(1 for l in lessons if l.id in completed_lesson_ids)
            track_total += module_total
            track_completed += module_completed

            track_modules.append(
                TrackModule(
                    id=module.id,
                    title=module.title,
                    order=module.order,
                    level=module.level or module.order or 1,
                    difficulty=module.difficulty,
                    total_lessons=module_total,
                    completed_lessons=module_completed,
                )
            )

        tracks.append(
            Track(
                slug=language.slug,
                name=language.name,
                icon=language.icon,
                color=language.color,
                description=language.description,
                total_lessons=track_total,
                completed_lessons=track_completed,
                percent=round((track_completed / track_total) * 100, 1) if track_total else 0,
                status=status_of(track_total, track_completed),
                modules=track_modules,
            )
        )

    major_total = sum(t.total_lessons for t in tracks)
    major_completed = sum(t.completed_lessons for t in tracks)

    return MajorRoadmap(
        major=major,
        total_lessons=major_total,
        completed_lessons=major_completed,
        percent=round((major_completed / major_total) * 100, 1) if major_total else 0,
        tracks=tracks,
    )
