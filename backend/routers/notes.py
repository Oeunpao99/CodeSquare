"""CodeSquareNote — one-tap scratchpad for project ideas, requirements and
reminders. Stores free-form markdown notes, optionally converts them into a real
project structure via AI (stack + structure + steps), and keeps credentials
(DB passwords, portal logins) encrypted at rest.

Credential-vault rules:
  * The encryption key comes ONLY from NOTE_SECRET_KEY — never SECRET_KEY (the JWT
    key) and never a built-in fallback. If it's missing / too short / a known
    default, the vault is "not configured": no encrypt, no decrypt, a clear 503.
  * Revealing a stored secret requires re-entering the account password and is
    rate-limited; each reveal stamps `revealed_at`.
"""
import time
from collections import defaultdict
from datetime import datetime
from typing import List, Optional, Any, Dict
import base64
import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from cryptography.fernet import Fernet

from database import get_db
from models.models import User, UserNote, AiUsage
from routers.auth import get_current_user, verify_password
from ai.tutor import AITutor
from skills import compute_skills

router = APIRouter()
ai_tutor = AITutor()

# Values that must NOT be accepted as a real vault key (repo defaults / stubs).
_WEAK_KEYS = {
    "",
    "change-me",
    "your-secret-key",
    "your-note-secret-key",
    "codesphere-secret-key-change-in-production-2024",
}
_MIN_KEY_LEN = 32


def _vault_key() -> Optional[str]:
    """The configured vault key, or None when the vault isn't set up."""
    key = (os.getenv("NOTE_SECRET_KEY") or "").strip()
    if len(key) < _MIN_KEY_LEN or key in _WEAK_KEYS:
        return None
    return key


def vault_configured() -> bool:
    return _vault_key() is not None


class VaultNotConfigured(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=503,
            detail=(
                "Credential vault is not configured. Set NOTE_SECRET_KEY in the "
                "backend environment to a unique random string (>= 32 chars) and "
                "restart. Notes and project ideas still work without it."
            ),
        )


def _fernet() -> Fernet:
    key = _vault_key()
    if key is None:
        raise VaultNotConfigured()
    digest = hashlib.sha256(key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def _decrypt(cipher: str) -> str:
    try:
        return _fernet().decrypt(cipher.encode()).decode()
    except VaultNotConfigured:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not decrypt — the vault key has changed since this secret was saved. Re-enter it.",
        )


# --- reveal rate limit: at most N reveals / window, per user, in-process ---
_REVEAL_MAX = 10
_REVEAL_WINDOW = 60.0
_reveal_hits: Dict[int, list] = defaultdict(list)


def _check_reveal_rate(user_id: int) -> None:
    now = time.monotonic()
    hits = [t for t in _reveal_hits[user_id] if now - t < _REVEAL_WINDOW]
    if len(hits) >= _REVEAL_MAX:
        raise HTTPException(
            status_code=429,
            detail="Too many reveal attempts — wait a minute and try again.",
        )
    hits.append(now)
    _reveal_hits[user_id] = hits


# ---------- schemas ----------

class NoteCreate(BaseModel):
    kind: str = "note"                 # note | project | credential
    title: str = ""
    content: str = ""                  # markdown (or credential meta)
    secret: Optional[str] = None       # credential value — encrypted server-side


class NoteUpdate(BaseModel):
    kind: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    secret: Optional[str] = None
    clear_secret: Optional[bool] = False


class NoteCard(BaseModel):
    id: int
    kind: str
    title: str
    snippet: str
    has_secret: bool
    has_suggestion: bool
    updated_at: datetime


class NoteDetail(BaseModel):
    id: int
    kind: str
    title: str
    content: str
    ai_suggestion: Optional[Dict[str, Any]] = None
    has_secret: bool
    revealed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SecretView(BaseModel):
    secret: str


class RevealRequest(BaseModel):
    password: str


class VaultStatus(BaseModel):
    configured: bool


class ConvertResult(BaseModel):
    stack: List[str]
    structure: str
    steps: List[str]


# ---------- helpers ----------

async def _own(db: AsyncSession, note_id: int, user_id: int) -> UserNote:
    row = await db.execute(
        select(UserNote).where(UserNote.id == note_id, UserNote.user_id == user_id)
    )
    note = row.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


def _card(n: UserNote) -> NoteCard:
    return NoteCard(
        id=n.id,
        kind=n.kind or "note",
        title=n.title or "Untitled",
        snippet=(n.content or "").strip()[:120],
        has_secret=bool(n.secret),
        has_suggestion=n.ai_suggestion is not None,
        updated_at=n.updated_at,
    )


def _detail(n: UserNote) -> NoteDetail:
    return NoteDetail(
        id=n.id,
        kind=n.kind or "note",
        title=n.title or "Untitled",
        content=n.content or "",
        ai_suggestion=n.ai_suggestion,
        has_secret=bool(n.secret),
        revealed_at=getattr(n, "revealed_at", None),
        created_at=n.created_at,
        updated_at=n.updated_at,
    )


# ---------- endpoints ----------

@router.get("/vault/status", response_model=VaultStatus)
async def vault_status(current_user: User = Depends(get_current_user)):
    """Whether the server has a real NOTE_SECRET_KEY. The UI uses this to disable
    credential entry / reveal with a clear message instead of a raw 503."""
    return VaultStatus(configured=vault_configured())


@router.get("", response_model=List[NoteCard])
async def list_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(UserNote)
        .where(UserNote.user_id == current_user.id)
        .order_by(UserNote.updated_at.desc())
    )
    return [_card(n) for n in rows.scalars().all()]


@router.post("", response_model=NoteDetail, status_code=201)
async def create_note(
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    kind = body.kind or "note"
    # A secret only makes sense on a credential note, and only encrypts when the
    # vault key is configured (_encrypt raises 503 otherwise).
    secret = _encrypt(body.secret) if (body.secret and kind == "credential") else None
    note = UserNote(
        user_id=current_user.id,
        kind=kind,
        title=body.title.strip() or "Untitled",
        content=body.content or "",
        secret=secret,
        ai_suggestion=None,
        created_at=now,
        updated_at=now,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _detail(note)


@router.get("/{note_id}", response_model=NoteDetail)
async def get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _detail(await _own(db, note_id, current_user.id))


@router.patch("/{note_id}", response_model=NoteDetail)
async def update_note(
    note_id: int,
    body: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await _own(db, note_id, current_user.id)
    data = body.model_dump(exclude_unset=True)
    if data.pop("clear_secret", False):
        note.secret = None
        note.revealed_at = None
    if "secret" in data:
        val = data.pop("secret")
        target_kind = data.get("kind", note.kind) or "note"
        if val and target_kind != "credential":
            raise HTTPException(
                status_code=400,
                detail="Only credential notes can hold a secret.",
            )
        note.secret = _encrypt(val) if val else None
        note.revealed_at = None
    for field, value in data.items():
        setattr(note, field, value)
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return _detail(note)


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await _own(db, note_id, current_user.id)
    await db.delete(note)
    await db.commit()


# The secret is never in list/detail. Revealing it needs the account password
# (not just a valid token), is rate-limited, and is stamped on the note — so a
# leaked/rested token can't quietly dump stored secrets.
@router.post("/{note_id}/secret", response_model=SecretView)
async def reveal_secret(
    note_id: int,
    body: RevealRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_reveal_rate(current_user.id)
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Wrong account password")
    note = await _own(db, note_id, current_user.id)
    if not note.secret:
        raise HTTPException(status_code=404, detail="No secret stored for this note")
    plain = _decrypt(note.secret)
    note.revealed_at = datetime.utcnow()
    await db.commit()
    return SecretView(secret=plain)


# AI: turn a note into a real project plan (stack + structure + steps), grounded
# in the user's actual learned skills on the platform.
@router.post("/{note_id}/convert", response_model=NoteDetail)
async def convert_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await _own(db, note_id, current_user.id)
    if not (note.content or "").strip():
        raise HTTPException(status_code=400, detail="Add some notes first — nothing to convert yet")
    if (note.kind or "note") == "credential":
        raise HTTPException(status_code=400, detail="Credentials can't be converted to a project")

    skills = await compute_skills(db, current_user.id)
    suggestion = await ai_tutor.generate_project_from_notes(note.content or "", skills)
    note.ai_suggestion = suggestion
    note.kind = "project"
    note.updated_at = datetime.utcnow()

    # Meter the AI call for the Account & Usage view.
    u = ai_tutor.pop_usage()
    if u:
        db.add(
            AiUsage(
                user_id=current_user.id,
                kind="notes",
                input_tokens=u.get("input_tokens", 0),
                output_tokens=u.get("output_tokens", 0),
                model=u.get("model"),
            )
        )

    await db.commit()
    await db.refresh(note)
    return _detail(note)
