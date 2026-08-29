"""User project workspace — persistent projects with code, markdown notes,
a task checklist, status/pin, an optional track link, and saved AI reviews.
"""
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import get_db
from models.models import User, UserProject
from routers.auth import get_current_user
from ai.tutor import AITutor

router = APIRouter()
ai_tutor = AITutor()


# ---------- schemas ----------

class ProjectCreate(BaseModel):
    title: str
    language: str = "python"
    description: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None
    track_slug: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    code: Optional[str] = None
    notes: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None
    tasks: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    pinned: Optional[bool] = None
    track_slug: Optional[str] = None


class ProjectCard(BaseModel):
    id: int
    title: str
    language: str
    status: str
    pinned: bool
    track_slug: Optional[str] = None
    snippet: str
    task_total: int
    task_done: int
    has_review: bool
    updated_at: datetime


class ProjectDetail(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    language: str
    code: str
    notes: str
    brief: Optional[Dict[str, Any]] = None
    tasks: List[Dict[str, Any]] = []
    status: str
    pinned: bool
    track_slug: Optional[str] = None
    ai_review: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class PortfolioItem(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    language: str
    track_slug: Optional[str] = None
    task_total: int
    task_done: int
    review_score: Optional[float] = None
    snippet: str
    updated_at: datetime


# ---------- helpers ----------

async def _own(db: AsyncSession, project_id: int, user_id: int) -> UserProject:
    row = await db.execute(
        select(UserProject).where(
            UserProject.id == project_id, UserProject.user_id == user_id
        )
    )
    project = row.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _detail(p: UserProject) -> ProjectDetail:
    return ProjectDetail(
        id=p.id,
        title=p.title,
        description=p.description,
        language=p.language or "python",
        code=p.code or "",
        notes=p.notes or "",
        brief=p.brief,
        tasks=p.tasks or [],
        status=p.status or "active",
        pinned=bool(p.pinned),
        track_slug=p.track_slug,
        ai_review=p.ai_review,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ---------- endpoints ----------

@router.get("", response_model=List[ProjectCard])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(UserProject)
        .where(UserProject.user_id == current_user.id)
        .order_by(UserProject.pinned.desc(), UserProject.updated_at.desc())
    )
    out: List[ProjectCard] = []
    for p in rows.scalars().all():
        tasks = p.tasks or []
        out.append(
            ProjectCard(
                id=p.id,
                title=p.title,
                language=p.language or "python",
                status=p.status or "active",
                pinned=bool(p.pinned),
                track_slug=p.track_slug,
                snippet=(p.code or "").strip()[:160],
                task_total=len(tasks),
                task_done=sum(1 for t in tasks if t.get("done")),
                has_review=p.ai_review is not None,
                updated_at=p.updated_at,
            )
        )
    return out


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    project = UserProject(
        user_id=current_user.id,
        title=body.title.strip() or "Untitled project",
        description=body.description,
        language=body.language,
        code=body.code or "",
        notes=body.notes or "",
        brief=body.brief,
        tasks=[],
        status="active",
        pinned=False,
        track_slug=body.track_slug,
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _detail(project)


@router.get("/portfolio", response_model=List[PortfolioItem])
async def portfolio(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Completed projects only — the auto-generated showcase."""
    rows = await db.execute(
        select(UserProject)
        .where(
            UserProject.user_id == current_user.id,
            UserProject.status == "done",
        )
        .order_by(UserProject.pinned.desc(), UserProject.updated_at.desc())
    )
    out: List[PortfolioItem] = []
    for p in rows.scalars().all():
        tasks = p.tasks or []
        review = p.ai_review if isinstance(p.ai_review, dict) else {}
        score = review.get("score")
        out.append(
            PortfolioItem(
                id=p.id,
                title=p.title,
                description=p.description,
                language=p.language or "python",
                track_slug=p.track_slug,
                task_total=len(tasks),
                task_done=sum(1 for t in tasks if t.get("done")),
                review_score=float(score) if isinstance(score, (int, float)) else None,
                snippet=(p.code or "").strip()[:200],
                updated_at=p.updated_at,
            )
        )
    return out


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _detail(await _own(db, project_id, current_user.id))


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _own(db, project_id, current_user.id)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(project, field, value)
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return _detail(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _own(db, project_id, current_user.id)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/review", response_model=ProjectDetail)
async def review_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _own(db, project_id, current_user.id)
    if not (project.code or "").strip():
        raise HTTPException(status_code=400, detail="Nothing to review yet")

    review = await ai_tutor.review_code(
        project.code,
        project.language or "python",
        project.title,
        project.description or "",
    )
    project.ai_review = review
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return _detail(project)
