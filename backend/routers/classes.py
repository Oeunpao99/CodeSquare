"""Classes — private classrooms run by approved teachers.

* Any user can apply to teach (`/api/teachers/apply`); an admin approves it
  (`/api/admin/teachers/...`, admin-console token).
* Approved teachers create classes, organise them into sections (weeks) and add
  materials: a note, a link, or an uploaded file (see storage.py).
* Students join with the class's join code. Members see the class; students see
  only sections that are published and past their `release_at`.

Every class endpoint resolves the class by its opaque `public_id` and checks
membership; every write endpoint checks the caller teaches that class.
"""
from __future__ import annotations

from common.avatars import effective_avatar

import secrets
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import storage
import telegram_bot as tg
from database import get_db
from models.models import (
    Assignment, ClassMaterial, ClassMember, ClassPost, ClassSection, ClassTelegramGroup, Classroom, Notification, Quiz,
    QuizAttempt, Submission, TeacherProfile, User,
)
from routers.admin import require_admin
from routers.auth import get_current_user

router = APIRouter()          # mounted at /api
admin_router = APIRouter()    # mounted at /api/admin/teachers

_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I/L


def _new_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def _norm_code(code: str) -> str:
    return "".join(ch for ch in (code or "").upper() if ch.isalnum())


def _released(s: ClassSection, now: datetime) -> bool:
    return bool(s.published) and (s.release_at is None or s.release_at <= now)


async def _notify_students(db: AsyncSession, c: "Classroom", actor_id: int, kind: str) -> None:
    """Drop a bell notification for every student in the class (caller commits)."""
    ids = (await db.execute(
        select(ClassMember.user_id).where(ClassMember.class_id == c.id, ClassMember.role == "student")
    )).scalars().all()
    for uid in ids:
        db.add(Notification(user_id=uid, actor_id=actor_id, kind=kind, class_id=c.id))


async def _group_chat_ids(db: AsyncSession, c: "Classroom") -> list:
    return (await db.execute(
        select(ClassTelegramGroup.chat_id).where(ClassTelegramGroup.class_id == c.id)
    )).scalars().all()


async def _tg(db: AsyncSession, c: "Classroom", by: User, icon: str, label: str, *, tab: str = "stream",
              title: str = "", quote: str = "", facts=(), button: str = "Open in CodeSquare",
              only_chat: Optional[str] = None) -> None:
    """Post a polished alert card to every Telegram group connected to the class."""
    chat_ids = [only_chat] if only_chat else await _group_chat_ids(db, c)
    if not chat_ids or not tg.enabled():
        return
    text, btn = tg.card(
        icon, label, c.title, by.display_name or by.username,
        title=title, quote=quote, facts=facts,
        url=f"{tg.class_url(c.public_id)}?tab={tab}", button=button,
    )
    for chat_id in chat_ids:
        tg.notify(chat_id, text, btn)


def _size(n) -> str:
    n = n or 0
    return f"{n / 1048576:.1f} MB" if n >= 1048576 else f"{max(1, round(n / 1024))} KB"


def _short(text: str, n: int = 600) -> str:
    text = (text or "").strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


# =========================================================================== #
#  Schemas
# =========================================================================== #

class TeacherApply(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    organization: str = Field(default="", max_length=160)
    subject: str = Field(default="", max_length=160)
    bio: str = Field(default="", max_length=1500)


class TeacherOut(BaseModel):
    id: int
    user_id: int
    username: str
    email: Optional[str] = None
    full_name: str
    organization: str
    subject: str
    bio: str
    status: str
    review_note: Optional[str] = None
    created_at: datetime


class ReviewIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class ClassCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    subject: str = Field(default="", max_length=120)
    color: str = Field(default="#3B82F6", max_length=9)


class ClassUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    subject: Optional[str] = Field(default=None, max_length=120)
    color: Optional[str] = Field(default=None, max_length=9)
    code_enabled: Optional[bool] = None
    archived: Optional[bool] = None


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class SectionIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    published: bool = False
    release_at: Optional[datetime] = None
    order: Optional[int] = None


class SectionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)
    published: Optional[bool] = None
    release_at: Optional[datetime] = None
    clear_release_at: bool = False
    order: Optional[int] = None


class MaterialIn(BaseModel):
    kind: str = Field(pattern="^(note|link)$")
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=50_000)
    url: Optional[str] = Field(default=None, max_length=2000)


class MaterialUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, max_length=50_000)
    url: Optional[str] = Field(default=None, max_length=2000)
    order: Optional[int] = None


# =========================================================================== #
#  Helpers
# =========================================================================== #

def _teacher_out(p: TeacherProfile, u: User) -> TeacherOut:
    return TeacherOut(
        id=p.id, user_id=p.user_id, username=u.username, email=u.email,
        full_name=p.full_name or "", organization=p.organization or "",
        subject=p.subject or "", bio=p.bio or "", status=p.status or "pending",
        review_note=p.review_note, created_at=p.created_at,
    )


async def _approved_teacher(db: AsyncSession, user: User) -> TeacherProfile:
    p = (await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user.id))).scalar_one_or_none()
    if not p or p.status != "approved":
        raise HTTPException(403, "Only approved instructors can do this. Apply to be an instructor first.")
    return p


async def _load_class(db: AsyncSession, public_id: str) -> Classroom:
    c = (await db.execute(select(Classroom).where(Classroom.public_id == public_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Class not found")
    return c


async def _membership(db: AsyncSession, c: Classroom, user: User) -> Optional[ClassMember]:
    return (
        await db.execute(
            select(ClassMember).where(ClassMember.class_id == c.id, ClassMember.user_id == user.id)
        )
    ).scalar_one_or_none()


async def _member_or_404(db: AsyncSession, public_id: str, user: User):
    c = await _load_class(db, public_id)
    m = await _membership(db, c, user)
    if not m:
        raise HTTPException(404, "Class not found")  # don't reveal private classes
    return c, m


async def _teacher_or_403(db: AsyncSession, public_id: str, user: User) -> Classroom:
    c, m = await _member_or_404(db, public_id, user)
    if m.role != "teacher":
        raise HTTPException(403, "Only the class instructor can do this")
    return c


async def _section_of(db: AsyncSession, c: Classroom, section_id: int) -> ClassSection:
    s = (
        await db.execute(select(ClassSection).where(ClassSection.id == section_id, ClassSection.class_id == c.id))
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Section not found")
    return s


async def _material_of(db: AsyncSession, c: Classroom, material_id: int) -> ClassMaterial:
    m = (
        await db.execute(
            select(ClassMaterial)
            .join(ClassSection, ClassSection.id == ClassMaterial.section_id)
            .where(ClassMaterial.id == material_id, ClassSection.class_id == c.id)
        )
    ).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Material not found")
    return m


def _material_dict(m: ClassMaterial) -> dict:
    return {
        "id": m.id, "kind": m.kind, "title": m.title, "body": m.body or "",
        "url": m.url, "file_name": m.file_name, "file_size": m.file_size,
        "content_type": m.content_type, "order": m.order or 0,
        "created_at": m.created_at,
    }


async def _class_summary(db: AsyncSession, c: Classroom, role: str) -> dict:
    owner = await db.get(User, c.owner_id)
    members = (
        await db.execute(
            select(func.count(ClassMember.id)).where(ClassMember.class_id == c.id, ClassMember.role == "student")
        )
    ).scalar() or 0
    return {
        "id": c.public_id,
        "title": c.title,
        "description": c.description or "",
        "subject": c.subject or "",
        "color": c.color or "#3B82F6",
        "archived": bool(c.archived),
        "role": role,
        "student_count": members,
        "teacher": {
            "username": owner.username if owner else "",
            "display_name": (owner.display_name or owner.username) if owner else "",
        },
        # Only the teacher ever sees the join code.
        "join_code": c.join_code if role == "teacher" else None,
        "code_enabled": bool(c.code_enabled) if role == "teacher" else None,
    }


# =========================================================================== #
#  Teacher application
# =========================================================================== #

@router.get("/teachers/me")
async def my_teacher_profile(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = (await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user.id))).scalar_one_or_none()
    return _teacher_out(p, user) if p else None


@router.post("/teachers/apply", response_model=TeacherOut)
async def apply_to_teach(
    body: TeacherApply, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    p = (await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == user.id))).scalar_one_or_none()
    if p and p.status == "approved":
        raise HTTPException(400, "You're already an approved instructor.")
    if not p:
        p = TeacherProfile(user_id=user.id)
        db.add(p)
    p.full_name = body.full_name.strip()
    p.organization = body.organization.strip()
    p.subject = body.subject.strip()
    p.bio = body.bio.strip()
    p.status = "pending"          # (re-)applying always goes back to review
    p.review_note = None
    p.created_at = datetime.utcnow()
    await db.commit()
    await db.refresh(p)
    return _teacher_out(p, user)


# =========================================================================== #
#  Admin review (admin-console token)
# =========================================================================== #

@admin_router.get("", response_model=List[TeacherOut])
async def list_teacher_applications(
    status: Optional[str] = None, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin),
):
    q = select(TeacherProfile, User).join(User, User.id == TeacherProfile.user_id)
    if status:
        q = q.where(TeacherProfile.status == status)
    rows = (await db.execute(q.order_by(TeacherProfile.created_at.desc()))).all()
    return [_teacher_out(p, u) for p, u in rows]


async def _review(db: AsyncSession, pid: int, status: str, note: Optional[str]):
    row = (
        await db.execute(
            select(TeacherProfile, User).join(User, User.id == TeacherProfile.user_id).where(TeacherProfile.id == pid)
        )
    ).first()
    if not row:
        raise HTTPException(404, "Application not found")
    p, u = row
    p.status = status
    p.review_note = note
    p.reviewed_at = datetime.utcnow()
    await db.commit()
    return _teacher_out(p, u)


@admin_router.post("/{pid}/approve", response_model=TeacherOut)
async def approve_teacher(pid: int, body: ReviewIn = ReviewIn(), db: AsyncSession = Depends(get_db),
                          _: User = Depends(require_admin)):
    return await _review(db, pid, "approved", body.note)


@admin_router.post("/{pid}/reject", response_model=TeacherOut)
async def reject_teacher(pid: int, body: ReviewIn = ReviewIn(), db: AsyncSession = Depends(get_db),
                         _: User = Depends(require_admin)):
    return await _review(db, pid, "rejected", body.note)


# =========================================================================== #
#  Classes
# =========================================================================== #

@router.get("/classes/mine")
async def my_classes(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        await db.execute(
            select(Classroom, ClassMember.role)
            .join(ClassMember, ClassMember.class_id == Classroom.id)
            .where(ClassMember.user_id == user.id)
            .order_by(Classroom.created_at.desc())
        )
    ).all()
    out = {"teaching": [], "enrolled": []}
    for c, role in rows:
        out["teaching" if role == "teacher" else "enrolled"].append(await _class_summary(db, c, role))
    return out


@router.post("/classes")
async def create_class(body: ClassCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _approved_teacher(db, user)
    code = _new_code()
    while (await db.execute(select(Classroom.id).where(Classroom.join_code == code))).first():
        code = _new_code()
    c = Classroom(
        owner_id=user.id, title=body.title.strip(), description=body.description.strip(),
        subject=body.subject.strip(), color=body.color, join_code=code,
    )
    db.add(c)
    await db.flush()
    db.add(ClassMember(class_id=c.id, user_id=user.id, role="teacher"))
    await db.commit()
    return await _class_summary(db, c, "teacher")


@router.post("/classes/join")
async def join_class(body: JoinIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = (
        await db.execute(select(Classroom).where(Classroom.join_code == _norm_code(body.code)))
    ).scalar_one_or_none()
    if not c or not c.code_enabled or c.archived:
        raise HTTPException(404, "No open class with that code. Check it with your instructor.")
    m = await _membership(db, c, user)
    if not m:
        db.add(ClassMember(class_id=c.id, user_id=user.id, role="student"))
        await db.commit()
    return await _class_summary(db, c, m.role if m else "student")


@router.get("/classes/{public_id}")
async def get_class(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, m = await _member_or_404(db, public_id, user)
    is_teacher = m.role == "teacher"
    now = datetime.utcnow()
    sections = (
        await db.execute(
            select(ClassSection)
            .where(ClassSection.class_id == c.id)
            .options(selectinload(ClassSection.materials))
            .order_by(ClassSection.order, ClassSection.id)
        )
    ).scalars().all()
    data = await _class_summary(db, c, m.role)
    data["sections"] = [
        {
            "id": s.id,
            "title": s.title,
            "description": s.description or "",
            "order": s.order or 0,
            "published": bool(s.published),
            "release_at": s.release_at,
            "visible": _released(s, now),
            "materials": [
                _material_dict(x) for x in sorted(s.materials, key=lambda x: ((x.order or 0), x.id))
            ],
        }
        for s in sections
        if is_teacher or _released(s, now)
    ]
    return data


@router.patch("/classes/{public_id}")
async def update_class(public_id: str, body: ClassUpdate, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(c, field, value.strip() if isinstance(value, str) else value)
    c.updated_at = datetime.utcnow()
    await db.commit()
    return await _class_summary(db, c, "teacher")


@router.post("/classes/{public_id}/rotate-code")
async def rotate_code(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    code = _new_code()
    while (await db.execute(select(Classroom.id).where(Classroom.join_code == code))).first():
        code = _new_code()
    c.join_code = code
    await db.commit()
    return {"join_code": code}


@router.post("/classes/{public_id}/leave")
async def leave_class(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, m = await _member_or_404(db, public_id, user)
    if m.role == "teacher":
        raise HTTPException(400, "The instructor can't leave their own class. Archive it instead.")
    await db.delete(m)
    await db.commit()
    return {"ok": True}


@router.get("/classes/{public_id}/members")
async def class_members(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    rows = (
        await db.execute(
            select(ClassMember, User).join(User, User.id == ClassMember.user_id)
            .where(ClassMember.class_id == c.id)
            .order_by(ClassMember.role.desc(), ClassMember.joined_at)
        )
    ).all()
    return [
        {
            "user_id": u.id, "username": u.username, "display_name": u.display_name or u.username,
            "email": u.email, "role": m.role, "joined_at": m.joined_at,
        }
        for m, u in rows
    ]


class AddMemberIn(BaseModel):
    user_id: int


@router.get("/classes/{public_id}/candidates")
async def search_candidates(public_id: str, q: str = "", db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    """People the teacher can add: the same users as the Dev Directory, minus current members."""
    c = await _teacher_or_403(db, public_id, user)
    term = q.strip().lstrip("@")
    if len(term) < 2:
        return []
    like = f"%{term}%"
    member_ids = select(ClassMember.user_id).where(ClassMember.class_id == c.id)
    rows = (await db.execute(
        select(User)
        .where(
            or_(User.username.ilike(like), User.display_name.ilike(like), User.email.ilike(like)),
            User.id.not_in(member_ids),
        )
        .order_by(User.username)
        .limit(15)
    )).scalars().all()
    return [
        {
            "user_id": u.id, "username": u.username, "display_name": u.display_name or u.username,
            "headline": u.headline or "", "major": u.major, "avatar": effective_avatar(u),
        }
        for u in rows
    ]


@router.post("/classes/{public_id}/members")
async def add_member(public_id: str, body: AddMemberIn, db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    target = await db.get(User, body.user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if await _membership(db, c, target):
        raise HTTPException(400, f"{target.display_name or target.username} is already in this class")
    db.add(ClassMember(class_id=c.id, user_id=target.id, role="student"))
    db.add(Notification(user_id=target.id, actor_id=user.id, kind="class_added", class_id=c.id))
    await db.commit()
    return {
        "user_id": target.id, "username": target.username,
        "display_name": target.display_name or target.username, "email": target.email,
        "role": "student", "joined_at": datetime.utcnow(),
    }


@router.delete("/classes/{public_id}/members/{user_id}")
async def remove_member(public_id: str, user_id: int, db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    m = (
        await db.execute(select(ClassMember).where(ClassMember.class_id == c.id, ClassMember.user_id == user_id))
    ).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Not a member")
    if m.role == "teacher":
        raise HTTPException(400, "Can't remove the instructor")
    await db.delete(m)
    await db.commit()
    return {"ok": True}


# --------------------------------------------------------------- sections
@router.post("/classes/{public_id}/sections")
async def add_section(public_id: str, body: SectionIn, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    order = body.order
    if order is None:
        order = ((await db.execute(select(func.max(ClassSection.order)).where(ClassSection.class_id == c.id))).scalar() or 0) + 1
    s = ClassSection(class_id=c.id, title=body.title.strip(), description=body.description.strip(),
                     published=body.published, release_at=body.release_at, order=order)
    db.add(s)
    await db.commit()
    if _released(s, datetime.utcnow()):
        await _tg(db, c, user, "📂", "New week opened", tab="materials", title=s.title, facts=[("🗓", "Available now")], button="Open materials")
    return {"id": s.id}


@router.patch("/classes/{public_id}/sections/{section_id}")
async def update_section(public_id: str, section_id: int, body: SectionUpdate, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    s = await _section_of(db, c, section_id)
    was_open = _released(s, datetime.utcnow())
    for field in ("title", "description", "published", "order", "release_at"):
        value = getattr(body, field)
        if value is not None:
            setattr(s, field, value.strip() if isinstance(value, str) else value)
    if body.clear_release_at:
        s.release_at = None
    await db.commit()
    if not was_open and _released(s, datetime.utcnow()):
        n = (await db.execute(select(func.count(ClassMaterial.id)).where(ClassMaterial.section_id == s.id))).scalar() or 0
        await _tg(db, c, user, "📂", "Week now open", tab="materials", title=s.title, facts=[("📚", f"{n} item{'s' if n != 1 else ''} to study")], button="Open materials")
    return {"ok": True}


@router.delete("/classes/{public_id}/sections/{section_id}")
async def delete_section(public_id: str, section_id: int, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    s = await _section_of(db, c, section_id)
    keys = (await db.execute(select(ClassMaterial.file_key).where(ClassMaterial.section_id == s.id))).scalars().all()
    await db.delete(s)
    await db.commit()
    for k in keys:
        if k:
            storage.delete(k)
    return {"ok": True}


# -------------------------------------------------------------- materials
async def _next_material_order(db: AsyncSession, section_id: int) -> int:
    return ((await db.execute(
        select(func.max(ClassMaterial.order)).where(ClassMaterial.section_id == section_id)
    )).scalar() or 0) + 1


@router.post("/classes/{public_id}/sections/{section_id}/materials")
async def add_material(public_id: str, section_id: int, body: MaterialIn, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    s = await _section_of(db, c, section_id)
    if body.kind == "link":
        url = (body.url or "").strip()
        if not url.lower().startswith(("http://", "https://")):
            raise HTTPException(422, "A link must start with http:// or https://")
    else:
        url = None
    m = ClassMaterial(section_id=s.id, kind=body.kind, title=body.title.strip(), body=body.body,
                      url=url, order=await _next_material_order(db, s.id))
    db.add(m)
    await db.commit()
    if _released(s, datetime.utcnow()):
        icon = "🔗" if m.kind == "link" else "📝"
        await _tg(db, c, user, icon, "New link" if m.kind == "link" else "New note", tab="materials", title=m.title, quote=_short(m.body, 300) if m.kind == "note" else "", facts=[("📁", s.title)], button="Open materials")
    return _material_dict(m)


@router.post("/classes/{public_id}/sections/{section_id}/files")
async def upload_material(
    public_id: str,
    section_id: int,
    file: UploadFile = File(...),
    title: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = await _teacher_or_403(db, public_id, user)
    s = await _section_of(db, c, section_id)
    data = await file.read(storage.MAX_UPLOAD_BYTES + 1)
    if len(data) > storage.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File is larger than {storage.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(422, "The file is empty")
    key = storage.make_key(f"classes/{c.public_id}", file.filename or "file")
    storage.save(key, data, file.content_type)
    m = ClassMaterial(
        section_id=s.id, kind="file", title=(title or file.filename or "File").strip()[:200],
        file_key=key, file_name=(file.filename or "file")[:200], file_size=len(data),
        content_type=file.content_type or "application/octet-stream",
        order=await _next_material_order(db, s.id),
    )
    db.add(m)
    await db.commit()
    if _released(s, datetime.utcnow()):
        await _tg(db, c, user, "📎", "New file", tab="materials", title=m.title, facts=[("📁", s.title), ("📄", f"{m.file_name} · {_size(m.file_size)}")], button="Open materials")
    return _material_dict(m)


@router.patch("/classes/{public_id}/materials/{material_id}")
async def update_material(public_id: str, material_id: int, body: MaterialUpdate, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    m = await _material_of(db, c, material_id)
    if body.url is not None and m.kind == "link":
        if not body.url.strip().lower().startswith(("http://", "https://")):
            raise HTTPException(422, "A link must start with http:// or https://")
        m.url = body.url.strip()
    if body.title is not None:
        m.title = body.title.strip()
    if body.body is not None:
        m.body = body.body
    if body.order is not None:
        m.order = body.order
    await db.commit()
    return _material_dict(m)


@router.delete("/classes/{public_id}/materials/{material_id}")
async def delete_material(public_id: str, material_id: int, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    m = await _material_of(db, c, material_id)
    key = m.file_key
    await db.delete(m)
    await db.commit()
    if key:
        storage.delete(key)
    return {"ok": True}


_INLINE_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"}


@router.get("/classes/{public_id}/materials/{material_id}/file")
async def download_material(public_id: str, material_id: int, inline: bool = False,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, member = await _member_or_404(db, public_id, user)
    m = await _material_of(db, c, material_id)
    if m.kind != "file" or not m.file_key:
        raise HTTPException(404, "No file for this material")
    if member.role != "teacher":
        s = await db.get(ClassSection, m.section_id)
        if not s or not _released(s, datetime.utcnow()):
            raise HTTPException(404, "Material not found")
    try:
        data = storage.read(m.file_key)
    except Exception:
        raise HTTPException(404, "File is missing from storage")
    ctype = m.content_type or "application/octet-stream"
    disposition = "inline" if inline and ctype in _INLINE_TYPES else "attachment"
    return Response(
        content=data,
        media_type=ctype if disposition == "inline" else "application/octet-stream",
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(m.file_name or 'file')}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


# =========================================================================== #
#  Phase 2 — Announcements (Stream)
# =========================================================================== #

class PostIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.get("/classes/{public_id}/posts")
async def list_posts(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, _ = await _member_or_404(db, public_id, user)
    rows = (
        await db.execute(
            select(ClassPost, User).join(User, User.id == ClassPost.author_id)
            .where(ClassPost.class_id == c.id).order_by(ClassPost.created_at.desc()).limit(100)
        )
    ).all()
    return [
        {"id": p.id, "body": p.body, "created_at": p.created_at,
         "author": {"username": u.username, "display_name": u.display_name or u.username}}
        for p, u in rows
    ]


@router.post("/classes/{public_id}/posts")
async def create_post(public_id: str, body: PostIn, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    p = ClassPost(class_id=c.id, author_id=user.id, body=body.body.strip())
    db.add(p)
    await _notify_students(db, c, user.id, "class_post")
    await db.commit()
    await _tg(db, c, user, "📢", "New announcement", tab="stream", quote=_short(p.body), button="Open in CodeSquare")
    return {"id": p.id}


@router.delete("/classes/{public_id}/posts/{post_id}")
async def delete_post(public_id: str, post_id: int, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    p = (await db.execute(select(ClassPost).where(ClassPost.id == post_id, ClassPost.class_id == c.id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Post not found")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


# =========================================================================== #
#  Phase 2 — Class quizzes (reuse the Quiz engine; taken at /quizzes/<slug>)
# =========================================================================== #

class QuizQuestionIn(BaseModel):
    q: str = Field(min_length=1, max_length=1000)
    options: List[str] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0)
    explain: str = Field(default="", max_length=1000)


class ClassQuizIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2000)
    pass_score: int = Field(default=70, ge=0, le=100)
    published: bool = True
    questions: List[QuizQuestionIn] = Field(min_length=1, max_length=100)


def _check_questions(questions: List[QuizQuestionIn]) -> list:
    out = []
    for i, q in enumerate(questions, 1):
        opts = [o.strip() for o in q.options]
        if any(not o for o in opts):
            raise HTTPException(422, f"Question {i} has an empty option")
        if q.answer >= len(opts):
            raise HTTPException(422, f"Question {i}: pick which option is correct")
        out.append({"q": q.q.strip(), "options": opts, "answer": q.answer, "explain": q.explain.strip()})
    return out


async def _class_quiz(db: AsyncSession, c: Classroom, quiz_id: int) -> Quiz:
    z = (await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.class_id == c.id))).scalar_one_or_none()
    if not z:
        raise HTTPException(404, "Quiz not found")
    return z


@router.get("/classes/{public_id}/quizzes")
async def list_class_quizzes(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, m = await _member_or_404(db, public_id, user)
    is_teacher = m.role == "teacher"
    q = select(Quiz).where(Quiz.class_id == c.id)
    if not is_teacher:
        q = q.where(Quiz.published.is_(True))
    quizzes = (await db.execute(q.order_by(Quiz.created_at))).scalars().all()
    ids = [z.id for z in quizzes]
    mine, taken = {}, {}
    if ids:
        for qid, best, passed in (await db.execute(
            select(QuizAttempt.quiz_id, func.max(QuizAttempt.score), func.bool_or(QuizAttempt.passed))
            .where(QuizAttempt.user_id == user.id, QuizAttempt.quiz_id.in_(ids)).group_by(QuizAttempt.quiz_id)
        )).all():
            mine[qid] = {"best_score": float(best or 0), "passed": bool(passed)}
        if is_teacher:
            for qid, n in (await db.execute(
                select(QuizAttempt.quiz_id, func.count(func.distinct(QuizAttempt.user_id)))
                .where(QuizAttempt.quiz_id.in_(ids)).group_by(QuizAttempt.quiz_id)
            )).all():
                taken[qid] = n
    return [
        {
            "id": z.id, "slug": z.slug, "title": z.title, "description": z.description or "",
            "question_count": len(z.questions or []), "pass_score": z.pass_score or 70,
            "published": bool(z.published), "created_at": z.created_at,
            "best_score": mine.get(z.id, {}).get("best_score"), "passed": mine.get(z.id, {}).get("passed", False),
            "students_taken": taken.get(z.id, 0) if is_teacher else None,
        }
        for z in quizzes
    ]


@router.post("/classes/{public_id}/quizzes")
async def create_class_quiz(public_id: str, body: ClassQuizIn, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = Quiz(
        slug=f"c-{secrets.token_urlsafe(8)}", title=body.title.strip(), description=body.description.strip(),
        class_id=c.id, published=body.published, pass_score=body.pass_score,
        xp_reward=0,  # class quizzes never feed public XP / leaderboard
        difficulty="beginner", questions=_check_questions(body.questions), major_slugs=[],
    )
    db.add(z)
    await db.commit()
    if z.published:
        await _tg(db, c, user, "❓", "New quiz", tab="quizzes", title=z.title, facts=[("🧩", f"{len(z.questions or [])} questions"), ("🎯", f"Pass mark {z.pass_score}%")], button="Take the quiz")
    return {"id": z.id, "slug": z.slug}


@router.get("/classes/{public_id}/quizzes/{quiz_id}")
async def get_class_quiz_for_edit(public_id: str, quiz_id: int, db: AsyncSession = Depends(get_db),
                                  user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = await _class_quiz(db, c, quiz_id)
    return {
        "id": z.id, "slug": z.slug, "title": z.title, "description": z.description or "",
        "pass_score": z.pass_score or 70, "published": bool(z.published), "questions": z.questions or [],
    }


@router.put("/classes/{public_id}/quizzes/{quiz_id}")
async def update_class_quiz(public_id: str, quiz_id: int, body: ClassQuizIn, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = await _class_quiz(db, c, quiz_id)
    z.title, z.description = body.title.strip(), body.description.strip()
    z.pass_score, z.published = body.pass_score, body.published
    z.questions = _check_questions(body.questions)
    await db.commit()
    return {"id": z.id, "slug": z.slug}


@router.patch("/classes/{public_id}/quizzes/{quiz_id}")
async def toggle_class_quiz(public_id: str, quiz_id: int, published: bool, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = await _class_quiz(db, c, quiz_id)
    newly = published and not z.published
    z.published = published
    await db.commit()
    if newly:
        await _tg(db, c, user, "❓", "New quiz", tab="quizzes", title=z.title, facts=[("🧩", f"{len(z.questions or [])} questions"), ("🎯", f"Pass mark {z.pass_score}%")], button="Take the quiz")
    return {"ok": True}


@router.delete("/classes/{public_id}/quizzes/{quiz_id}")
async def delete_class_quiz(public_id: str, quiz_id: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = await _class_quiz(db, c, quiz_id)
    await db.delete(z)  # attempts cascade
    await db.commit()
    return {"ok": True}


@router.get("/classes/{public_id}/quizzes/{quiz_id}/results")
async def class_quiz_results(public_id: str, quiz_id: int, db: AsyncSession = Depends(get_db),
                             user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    z = await _class_quiz(db, c, quiz_id)
    students = (
        await db.execute(
            select(User).join(ClassMember, ClassMember.user_id == User.id)
            .where(ClassMember.class_id == c.id, ClassMember.role == "student")
            .order_by(User.username)
        )
    ).scalars().all()
    stats = {
        uid: (best, passed, n)
        for uid, best, passed, n in (await db.execute(
            select(QuizAttempt.user_id, func.max(QuizAttempt.score), func.bool_or(QuizAttempt.passed),
                   func.count(QuizAttempt.id))
            .where(QuizAttempt.quiz_id == z.id).group_by(QuizAttempt.user_id)
        )).all()
    }
    return {
        "quiz": {"id": z.id, "title": z.title, "pass_score": z.pass_score or 70},
        "students": [
            {
                "user_id": u.id, "username": u.username, "display_name": u.display_name or u.username,
                "best_score": float(stats[u.id][0]) if u.id in stats else None,
                "passed": bool(stats[u.id][1]) if u.id in stats else False,
                "attempts": stats[u.id][2] if u.id in stats else 0,
            }
            for u in students
        ],
    }


# =========================================================================== #
#  Phase 3 — Assignments, submissions, grading, gradebook
# =========================================================================== #

class AssignmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    instructions: str = Field(default="", max_length=20_000)
    due_at: Optional[datetime] = None
    max_points: int = Field(default=100, ge=1, le=1000)
    published: bool = True


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    instructions: Optional[str] = Field(default=None, max_length=20_000)
    due_at: Optional[datetime] = None
    clear_due_at: bool = False
    max_points: Optional[int] = Field(default=None, ge=1, le=1000)
    published: Optional[bool] = None


class GradeIn(BaseModel):
    grade: float = Field(ge=0)
    feedback: str = Field(default="", max_length=5000)


def _submission_dict(s: Optional[Submission]) -> Optional[dict]:
    if not s:
        return None
    return {
        "id": s.id, "text": s.text or "", "file_name": s.file_name, "file_size": s.file_size,
        "content_type": s.content_type, "submitted_at": s.submitted_at,
        "grade": s.grade, "feedback": s.feedback, "graded_at": s.graded_at,
    }


def _assignment_dict(a: Assignment) -> dict:
    return {
        "id": a.id, "title": a.title, "instructions": a.instructions or "", "due_at": a.due_at,
        "max_points": a.max_points or 100, "published": bool(a.published), "created_at": a.created_at,
    }


async def _assignment_of(db: AsyncSession, c: Classroom, aid: int, include_drafts: bool) -> Assignment:
    a = (await db.execute(select(Assignment).where(Assignment.id == aid, Assignment.class_id == c.id))).scalar_one_or_none()
    if not a or (not include_drafts and not a.published):
        raise HTTPException(404, "Assignment not found")
    return a


async def _students(db: AsyncSession, c: Classroom):
    return (await db.execute(
        select(User).join(ClassMember, ClassMember.user_id == User.id)
        .where(ClassMember.class_id == c.id, ClassMember.role == "student").order_by(User.username)
    )).scalars().all()


@router.get("/classes/{public_id}/assignments")
async def list_assignments(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c, m = await _member_or_404(db, public_id, user)
    is_teacher = m.role == "teacher"
    q = select(Assignment).where(Assignment.class_id == c.id)
    if not is_teacher:
        q = q.where(Assignment.published.is_(True))
    items = (await db.execute(q.order_by(Assignment.due_at.is_(None), Assignment.due_at, Assignment.id))).scalars().all()
    ids = [a.id for a in items]
    mine, counts = {}, {}
    if ids:
        if is_teacher:
            for aid, n, graded in (await db.execute(
                select(Submission.assignment_id, func.count(Submission.id), func.count(Submission.grade))
                .where(Submission.assignment_id.in_(ids)).group_by(Submission.assignment_id)
            )).all():
                counts[aid] = (n, graded)
        else:
            for s in (await db.execute(
                select(Submission).where(Submission.user_id == user.id, Submission.assignment_id.in_(ids))
            )).scalars().all():
                mine[s.assignment_id] = s
    out = []
    for a in items:
        d = _assignment_dict(a)
        if is_teacher:
            d["submitted"], d["graded"] = counts.get(a.id, (0, 0))
        else:
            d["submission"] = _submission_dict(mine.get(a.id))
        out.append(d)
    return out


@router.post("/classes/{public_id}/assignments")
async def create_assignment(public_id: str, body: AssignmentIn, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    a = Assignment(class_id=c.id, title=body.title.strip(), instructions=body.instructions,
                   due_at=body.due_at, max_points=body.max_points, published=body.published)
    db.add(a)
    if body.published:
        await _notify_students(db, c, user.id, "class_assignment")
    await db.commit()
    if a.published:
        await _tg(db, c, user, "📝", "New assignment", tab="assignments", title=a.title, quote=_short(a.instructions, 300), facts=[("⏰", "Due " + tg.local_time(a.due_at) + " (" + tg._TZ_LABEL + ")" if a.due_at else "No due date"), ("⭐", f"{a.max_points} points")], button="View assignment")
    return _assignment_dict(a)


@router.patch("/classes/{public_id}/assignments/{aid}")
async def update_assignment(public_id: str, aid: int, body: AssignmentUpdate, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    a = await _assignment_of(db, c, aid, True)
    was_published = bool(a.published)
    for f in ("title", "instructions", "due_at", "max_points", "published"):
        v = getattr(body, f)
        if v is not None:
            setattr(a, f, v.strip() if f == "title" else v)
    if body.clear_due_at:
        a.due_at = None
    if a.published and not was_published:
        await _notify_students(db, c, user.id, "class_assignment")
    await db.commit()
    if a.published and not was_published:
        await _tg(db, c, user, "📝", "New assignment", tab="assignments", title=a.title, quote=_short(a.instructions, 300), facts=[("⏰", "Due " + tg.local_time(a.due_at) + " (" + tg._TZ_LABEL + ")" if a.due_at else "No due date"), ("⭐", f"{a.max_points} points")], button="View assignment")
    return _assignment_dict(a)


@router.delete("/classes/{public_id}/assignments/{aid}")
async def delete_assignment(public_id: str, aid: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    a = await _assignment_of(db, c, aid, True)
    keys = (await db.execute(select(Submission.file_key).where(Submission.assignment_id == a.id))).scalars().all()
    await db.delete(a)
    await db.commit()
    for k in keys:
        if k:
            storage.delete(k)
    return {"ok": True}


@router.post("/classes/{public_id}/assignments/{aid}/submit")
async def submit_assignment(
    public_id: str,
    aid: int,
    text: str = Form(default=""),
    file: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c, m = await _member_or_404(db, public_id, user)
    if m.role != "student":
        raise HTTPException(400, "Only students hand in work")
    a = await _assignment_of(db, c, aid, False)
    if len(text) > 10_000:
        raise HTTPException(422, "The text is too long")
    data = None
    if file is not None and file.filename:
        data = await file.read(storage.MAX_UPLOAD_BYTES + 1)
        if len(data) > storage.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File is larger than {storage.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    s = (await db.execute(
        select(Submission).where(Submission.assignment_id == a.id, Submission.user_id == user.id)
    )).scalar_one_or_none()
    if not data and not text.strip() and not (s and s.file_key):
        raise HTTPException(422, "Attach a file or write an answer")
    if s and s.grade is not None:
        raise HTTPException(400, "This work is already graded. Ask your instructor if you need to resubmit.")
    old_key = None
    if not s:
        s = Submission(assignment_id=a.id, user_id=user.id)
        db.add(s)
    s.text = text.strip()
    if data:
        old_key = s.file_key
        key = storage.make_key(f"classes/{c.public_id}/submissions", file.filename)
        storage.save(key, data, file.content_type)
        s.file_key, s.file_name, s.file_size = key, file.filename[:200], len(data)
        s.content_type = file.content_type or "application/octet-stream"
    s.submitted_at = datetime.utcnow()
    await db.commit()
    if old_key:
        storage.delete(old_key)
    return _submission_dict(s)


@router.get("/classes/{public_id}/assignments/{aid}/submissions")
async def list_submissions(public_id: str, aid: int, db: AsyncSession = Depends(get_db),
                           user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    a = await _assignment_of(db, c, aid, True)
    subs = {s.user_id: s for s in (await db.execute(
        select(Submission).where(Submission.assignment_id == a.id)
    )).scalars().all()}
    return {
        "assignment": _assignment_dict(a),
        "students": [
            {"user_id": u.id, "username": u.username, "display_name": u.display_name or u.username,
             "submission": _submission_dict(subs.get(u.id))}
            for u in await _students(db, c)
        ],
    }


async def _class_submission(db: AsyncSession, c: Classroom, sid: int):
    return (await db.execute(
        select(Submission, Assignment).join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Submission.id == sid, Assignment.class_id == c.id)
    )).first()


@router.post("/classes/{public_id}/submissions/{sid}/grade")
async def grade_submission(public_id: str, sid: int, body: GradeIn, db: AsyncSession = Depends(get_db),
                           user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    row = await _class_submission(db, c, sid)
    if not row:
        raise HTTPException(404, "Submission not found")
    s, a = row
    if body.grade > (a.max_points or 100):
        raise HTTPException(422, f"Grade can't be more than {a.max_points}")
    s.grade, s.feedback, s.graded_at = body.grade, body.feedback.strip(), datetime.utcnow()
    await db.commit()
    return _submission_dict(s)


@router.post("/classes/{public_id}/submissions/{sid}/return")
async def return_submission(public_id: str, sid: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    """Clear the grade so the student can hand in again."""
    c = await _teacher_or_403(db, public_id, user)
    row = await _class_submission(db, c, sid)
    if not row:
        raise HTTPException(404, "Submission not found")
    s, _ = row
    s.grade = None
    s.graded_at = None
    await db.commit()
    return {"ok": True}


@router.get("/classes/{public_id}/submissions/{sid}/file")
async def download_submission(public_id: str, sid: int, db: AsyncSession = Depends(get_db),
                              user: User = Depends(get_current_user)):
    c, m = await _member_or_404(db, public_id, user)
    row = await _class_submission(db, c, sid)
    s = row[0] if row else None
    # Only the teacher, or the student who handed it in.
    if not s or (m.role != "teacher" and s.user_id != user.id) or not s.file_key:
        raise HTTPException(404, "File not found")
    try:
        data = storage.read(s.file_key)
    except Exception:
        raise HTTPException(404, "File is missing from storage")
    return Response(
        content=data, media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(s.file_name or 'file')}",
            "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
        },
    )


@router.get("/classes/{public_id}/grades")
async def gradebook(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    assignments = (await db.execute(
        select(Assignment).where(Assignment.class_id == c.id)
        .order_by(Assignment.due_at.is_(None), Assignment.due_at, Assignment.id)
    )).scalars().all()
    quizzes = (await db.execute(select(Quiz).where(Quiz.class_id == c.id).order_by(Quiz.created_at))).scalars().all()
    students = await _students(db, c)
    subs = {}
    if assignments:
        for s in (await db.execute(
            select(Submission).where(Submission.assignment_id.in_([a.id for a in assignments]))
        )).scalars().all():
            subs[(s.user_id, s.assignment_id)] = s
    best = {}
    if quizzes:
        for uid, qid, sc in (await db.execute(
            select(QuizAttempt.user_id, QuizAttempt.quiz_id, func.max(QuizAttempt.score))
            .where(QuizAttempt.quiz_id.in_([z.id for z in quizzes]))
            .group_by(QuizAttempt.user_id, QuizAttempt.quiz_id)
        )).all():
            best[(uid, qid)] = float(sc or 0)
    now = datetime.utcnow()

    def cell(u, a):
        s = subs.get((u.id, a.id))
        if s and s.grade is not None:
            return {"status": "graded", "grade": s.grade}
        if s:
            return {"status": "submitted", "late": bool(a.due_at and s.submitted_at and s.submitted_at > a.due_at)}
        return {"status": "missing" if (a.due_at and a.due_at < now) else "not_submitted"}

    return {
        "assignments": [{"id": a.id, "title": a.title, "max_points": a.max_points or 100, "due_at": a.due_at}
                        for a in assignments],
        "quizzes": [{"id": z.id, "title": z.title, "pass_score": z.pass_score or 70} for z in quizzes],
        "students": [
            {
                "user_id": u.id, "username": u.username, "display_name": u.display_name or u.username,
                "assignments": {str(a.id): cell(u, a) for a in assignments},
                "quizzes": {str(z.id): best.get((u.id, z.id)) for z in quizzes},
            }
            for u in students
        ],
    }


# =========================================================================== #
#  Telegram group link (teacher)
# =========================================================================== #

async def _tg_state(db: AsyncSession, c: Classroom) -> dict:
    groups = (await db.execute(
        select(ClassTelegramGroup).where(ClassTelegramGroup.class_id == c.id).order_by(ClassTelegramGroup.created_at)
    )).scalars().all()
    return {
        "available": tg.enabled(),
        "bot_username": await tg.bot_username(),
        "connected": bool(groups),
        "groups": [{"id": g.id, "title": g.title, "connected_at": g.created_at} for g in groups],
        "pending": bool(c.telegram_link_token),
    }


async def _group_of(db: AsyncSession, c: Classroom, gid: int) -> ClassTelegramGroup:
    g = (await db.execute(
        select(ClassTelegramGroup).where(ClassTelegramGroup.id == gid, ClassTelegramGroup.class_id == c.id)
    )).scalar_one_or_none()
    if not g:
        raise HTTPException(404, "Group not found")
    return g


@router.get("/classes/{public_id}/telegram")
async def telegram_status(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    return await _tg_state(db, c)


@router.post("/classes/{public_id}/telegram/link")
async def telegram_link(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Start connecting a (another) group: returns the t.me link that adds the bot to a group."""
    c = await _teacher_or_403(db, public_id, user)
    bot = await tg.bot_username()
    if not bot:
        raise HTTPException(503, "Telegram isn't set up on this server yet (TELEGRAM_BOT_TOKEN).")
    c.telegram_link_token = secrets.token_urlsafe(12).replace("-", "").replace("_", "")[:16]
    await db.commit()
    return {"url": f"https://t.me/{bot}?startgroup={c.telegram_link_token}", "bot_username": bot}


@router.post("/classes/{public_id}/telegram/verify")
async def telegram_verify(public_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """After adding the bot to a group, look for its /start message and add that group."""
    c = await _teacher_or_403(db, public_id, user)
    if not c.telegram_link_token:
        raise HTTPException(400, "Click Connect first.")
    chat = await tg.find_link_chat(c.telegram_link_token)
    if not chat:
        raise HTTPException(404, "Not found yet. Add the bot to your group from the link, then try again.")
    existing = (await db.execute(
        select(ClassTelegramGroup).where(ClassTelegramGroup.class_id == c.id, ClassTelegramGroup.chat_id == chat["id"])
    )).scalar_one_or_none()
    c.telegram_link_token = None
    added = existing is None
    if added:
        db.add(ClassTelegramGroup(class_id=c.id, chat_id=chat["id"], title=chat["title"]))
    else:
        existing.title = chat["title"]  # group may have been renamed
    await db.commit()
    if added:
        await _tg(db, c, user, "✅", "Group connected", tab="stream", only_chat=chat["id"],
                  quote="New announcements, materials, assignments and quizzes from this class will be posted here.",
                  button="Open the class")
    state = await _tg_state(db, c)
    state["just_added"] = chat["title"]
    state["already_connected"] = not added
    return state


@router.post("/classes/{public_id}/telegram/{gid}/test")
async def telegram_test(public_id: str, gid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    g = await _group_of(db, c, gid)
    try:
        text, btn = tg.card("🔔", "Test message", c.title, user.display_name or user.username,
                            quote="If you can read this, class alerts are working.",
                            url=f"{tg.class_url(c.public_id)}?tab=stream", button="Open the class")
        await tg.send(g.chat_id, text, btn)
    except Exception as e:
        raise HTTPException(502, f"Telegram said: {e}. Is the bot still in “{g.title}”?")
    return {"ok": True}


@router.delete("/classes/{public_id}/telegram/{gid}")
async def telegram_remove_group(public_id: str, gid: int, db: AsyncSession = Depends(get_db),
                                user: User = Depends(get_current_user)):
    c = await _teacher_or_403(db, public_id, user)
    g = await _group_of(db, c, gid)
    await db.delete(g)
    await db.commit()
    return await _tg_state(db, c)
