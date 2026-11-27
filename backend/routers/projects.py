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
    ship: Optional[Dict[str, Any]] = None
    files: Optional[List[Dict[str, Any]]] = None
    entry: Optional[str] = None


class ReviewBody(BaseModel):
    path: Optional[str] = None   # review this file; default = the main file


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
    shipped: bool = False
    stage: str = "plan"                 # plan | build | review | shipped (first unfinished step)
    description: Optional[str] = None   # description, else the brief's problem
    repo_url: Optional[str] = None
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
    ship: Optional[Dict[str, Any]] = None
    files: Optional[List[Dict[str, Any]]] = None
    entry: Optional[str] = None
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
    repo_url: Optional[str] = None
    demo_url: Optional[str] = None
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
        ship=p.ship,
        files=p.files,
        entry=p.entry,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


MAX_FILES = 400
MAX_FILE_CHARS = 300_000
MAX_TOTAL_CHARS = 4_000_000


def clean_path(path: str) -> str:
    p = str(path or "").replace("\\", "/").strip().lstrip("/")
    parts = [x for x in p.split("/") if x not in ("", ".")]
    if not parts or any(x == ".." for x in parts) or len(p) > 240:
        raise HTTPException(status_code=400, detail=f"Invalid file path: {path!r}")
    return "/".join(parts)


def clean_files(files: Optional[List[Dict[str, Any]]]) -> Optional[List[Dict[str, str]]]:
    if files is None:
        return None
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"A project can hold up to {MAX_FILES} files.")
    out, seen, total = [], set(), 0
    for f in files:
        path = clean_path(f.get("path"))
        content = f.get("content") or ""
        if not isinstance(content, str):
            raise HTTPException(status_code=400, detail=f"{path}: content must be text")
        if len(content) > MAX_FILE_CHARS:
            raise HTTPException(status_code=400, detail=f"{path} is too large (max {MAX_FILE_CHARS // 1000}k characters).")
        total += len(content)
        if path in seen:
            continue
        seen.add(path)
        out.append({"path": path, "content": content})
    if total > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=400, detail="The project is too large to save (4 MB of text max).")
    return out


LANG_BY_EXT = {
    "py": "python", "js": "javascript", "mjs": "javascript", "cjs": "javascript", "jsx": "javascript",
    "ts": "typescript", "tsx": "typescript", "html": "html", "css": "css", "sql": "sql", "sh": "bash",
}


_SHIP_KEYS = {"repo_url", "demo_url", "readme", "reflection", "shipped_at"}


def _clean_ship(ship: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not ship:
        return None
    out: Dict[str, Any] = {}
    for k in _SHIP_KEYS:
        v = ship.get(k)
        if isinstance(v, str):
            v = v.strip()[:20000]
            if k in ("repo_url", "demo_url") and v:
                if not v.lower().startswith(("http://", "https://")):
                    raise HTTPException(status_code=400, detail=f"{k.replace('_', ' ')} must start with https://")
                v = v[:500]
            if v:
                out[k] = v
    return out or None


def _stage(p: UserProject) -> str:
    """Same rules as the workspace's progress bar (ProjectFlow.stageState)."""
    brief = p.brief if isinstance(p.brief, dict) else {}
    tasks = p.tasks or []
    ship = p.ship or {}
    if p.status == "done" and ship.get("repo_url"):
        return "shipped"
    planned = bool(brief.get("requirements")) or (bool((brief.get("problem") or "").strip()) and bool(brief.get("done_when")))
    if not planned:
        return "plan"
    if not ((p.code or "").strip() and tasks and all(t.get("done") for t in tasks)):
        return "build"
    if not p.ai_review:
        return "review"
    return "ship"


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
                shipped=(p.status == "done") and bool((p.ship or {}).get("repo_url")),
                stage=_stage(p),
                description=p.description or ((p.brief or {}).get("problem") if isinstance(p.brief, dict) else None),
                repo_url=(p.ship or {}).get("repo_url"),
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
                repo_url=(p.ship or {}).get("repo_url") or None,
                demo_url=(p.ship or {}).get("demo_url") or None,
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
    if "files" in data:
        data["files"] = clean_files(data["files"])
    if "entry" in data and data["entry"]:
        data["entry"] = clean_path(data["entry"])
    # Keep `code` in step with the main file.
    files_now = data.get("files", project.files) or []
    entry_now = data.get("entry", project.entry)
    if files_now and entry_now:
        main = next((f for f in files_now if f["path"] == entry_now), None)
        if main is not None:
            data["code"] = main["content"]
    if "ship" in data:
        data["ship"] = _clean_ship(data["ship"])
    # "Done" means shipped: it needs a repository link.
    if data.get("status") == "done" and project.status != "done":
        ship = data.get("ship", project.ship) or {}
        if not ship.get("repo_url"):
            raise HTTPException(status_code=400, detail="Add a repository link on the Ship step before marking the project done.")
        ship = dict(ship)
        ship.setdefault("shipped_at", datetime.utcnow().isoformat())
        data["ship"] = ship
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
    body: Optional[ReviewBody] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _own(db, project_id, current_user.id)
    source, language = project.code or "", project.language or "python"
    if body and body.path and project.files:
        f = next((x for x in project.files if x.get("path") == body.path), None)
        if f is None:
            raise HTTPException(status_code=404, detail="That file isn't in this project.")
        source = f.get("content") or ""
        language = LANG_BY_EXT.get(body.path.rsplit(".", 1)[-1].lower(), language)
    if not source.strip():
        raise HTTPException(status_code=400, detail="Nothing to review yet")

    review = await ai_tutor.review_code(
        source,
        language,
        project.title,
        project.description or "",
    )
    project.ai_review = review
    project.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(project)
    return _detail(project)
