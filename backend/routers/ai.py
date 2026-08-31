import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from database import get_db, async_session
from routers.auth import get_current_user
from models.models import (
    User, HintUsage, Exercise, AiUsage, AiChatSession, AiChatTurn,
)
from ai.tutor import AITutor
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import plans as plans_cfg

router = APIRouter()


async def _persist_exchange(
    db: AsyncSession, user_id: int, session_id: int, user_msg: str, assistant_msg: str
) -> None:
    """Append a user+assistant turn to a saved chat session (if it's the user's)."""
    sess = (
        await db.execute(
            select(AiChatSession).where(
                AiChatSession.id == session_id, AiChatSession.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not sess:
        return
    now = datetime.utcnow()
    db.add(AiChatTurn(session_id=sess.id, role="user", content=(user_msg or "")[:8000], created_at=now))
    db.add(
        AiChatTurn(
            session_id=sess.id,
            role="assistant",
            content=(assistant_msg or "")[:16000],
            created_at=now,
        )
    )
    if (sess.title or "").strip() in ("", "New chat"):
        first_line = (user_msg or "").strip().splitlines()[0] if (user_msg or "").strip() else ""
        sess.title = (first_line or "New chat")[:70]
    sess.updated_at = now
    await db.commit()


async def _log_usage(db: AsyncSession, user_id: int, kind: str) -> None:
    """Persist the token usage of the AI call that just ran (ai_tutor.pop_usage)."""
    u = ai_tutor.pop_usage()
    if not u:
        return
    db.add(
        AiUsage(
            user_id=user_id,
            kind=kind,
            input_tokens=u.get("input_tokens", 0),
            output_tokens=u.get("output_tokens", 0),
            model=u.get("model"),
            created_at=datetime.utcnow(),
        )
    )
    await db.commit()

class HintRequest(BaseModel):
    exercise_id: int
    code: str
    error_message: Optional[str] = None
    current_hint_level: int = 1

class CodeReviewRequest(BaseModel):
    code: str
    language: str
    lesson_context: str
    exercise_description: str

class ProjectRequest(BaseModel):
    language: str
    skills_learned: List[str]
    difficulty: str
    focus: Optional[str] = None  # career-major descriptor, e.g. "AI engineering — ..."

class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    language: Optional[str] = None
    history: List[ChatMessage] = []   # prior turns, oldest first
    session_id: Optional[int] = None  # persist this exchange into a saved chat

class HintResponse(BaseModel):
    hint: str
    hint_level: int
    max_level: int
    should_escalate: bool

class CodeReviewResponse(BaseModel):
    score: float
    feedback: str
    suggestions: List[str]
    improvements: List[str]
    passed: bool

class ProjectResponse(BaseModel):
    title: str
    description: str
    requirements: List[str]
    starter_code: str
    hints: List[str]
    estimated_time: str

class ChatResponse(BaseModel):
    response: str
    suggestions: List[str] = []
    follow_up: Optional[str] = None

ai_tutor = AITutor()

@router.post("/hint", response_model=HintResponse)
async def get_hint(
    request: HintRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exercise_result = await db.execute(select(Exercise).where(Exercise.id == request.exercise_id))
    exercise = exercise_result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    hint_usage = HintUsage(
        user_id=current_user.id,
        exercise_id=request.exercise_id,
        hint_level=request.current_hint_level
    )
    db.add(hint_usage)
    await db.commit()
    
    hints = exercise.hints if isinstance(exercise.hints, list) else []
    
    hint_index = min(request.current_hint_level - 1, len(hints) - 1) if hints else 0
    hint = hints[hint_index] if hints else "Try breaking down the problem into smaller steps."
    
    if request.current_hint_level >= 3 or not hints:
        ai_hint = await ai_tutor.generate_hint(
            exercise.description,
            request.code,
            request.error_message,
            request.current_hint_level
        )
        hint = ai_hint
        await _log_usage(db, current_user.id, "hint")

    return HintResponse(
        hint=hint,
        hint_level=request.current_hint_level,
        max_level=5,
        should_escalate=request.current_hint_level >= 3
    )

@router.post("/review", response_model=CodeReviewResponse)
async def review_code(
    request: CodeReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    review = await ai_tutor.review_code(
        request.code,
        request.language,
        request.lesson_context,
        request.exercise_description
    )
    await _log_usage(db, current_user.id, "review")
    return review

@router.post("/generate-project", response_model=ProjectResponse)
async def generate_project(
    request: ProjectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = await ai_tutor.generate_project(
        request.language,
        request.skills_learned,
        request.difficulty,
        request.focus
    )
    await _log_usage(db, current_user.id, "project")
    return project

@router.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    response = await ai_tutor.chat(
        request.message,
        request.context,
        request.language,
        [m.model_dump() for m in request.history],
    )
    await _log_usage(db, current_user.id, "chat")
    if request.session_id:
        await _persist_exchange(
            db, current_user.id, request.session_id,
            request.message, response.get("response", ""),
        )
    return response


class CompactRequest(BaseModel):
    turns: List[ChatMessage]          # the OLDER turns to fold into a summary
    session_id: Optional[int] = None
    keep: int = 4                     # recent turns to leave untouched in the saved session


class CompactResponse(BaseModel):
    summary: str


@router.post("/chat/compact", response_model=CompactResponse)
async def compact_chat(
    request: CompactRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summarise older turns so the live context window stays small (auto-compact).
    If `session_id` is given, the saved session's older turns are replaced by one
    summary turn."""
    turns = [t for t in request.turns if (t.content or "").strip()]
    if len(turns) < 2:
        return CompactResponse(summary="")

    transcript = "\n\n".join(f"{t.role.upper()}: {t.content}" for t in turns)
    summary = (await ai_tutor.summarize_chat(transcript)).strip()
    await _log_usage(db, current_user.id, "chat")

    if request.session_id and summary:
        sess = (
            await db.execute(
                select(AiChatSession)
                .where(
                    AiChatSession.id == request.session_id,
                    AiChatSession.user_id == current_user.id,
                )
                .options(selectinload(AiChatSession.turns))
            )
        ).scalar_one_or_none()
        if sess and sess.turns:
            keep = max(0, request.keep)
            kept = sess.turns[-keep:] if keep else []
            base_time = kept[0].created_at if kept else datetime.utcnow()
            for t in sess.turns:
                if t not in kept:
                    await db.delete(t)
            db.add(
                AiChatTurn(
                    session_id=sess.id,
                    role="assistant",
                    content=f"**Summary of earlier conversation:**\n\n{summary}",
                    created_at=base_time - timedelta(seconds=1),
                )
            )
            sess.updated_at = datetime.utcnow()
            await db.commit()

    return CompactResponse(summary=summary)


@router.post("/chat/stream")
async def chat_with_tutor_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events version of /chat. Frames: `data: {json}\\n\\n` where
    `kind` is "token" ({token}), "reply" (canned, terminal) or "done"
    ({response, suggestions}, terminal). Falls back to /chat on the client if
    this stream can't be opened.
    """
    history = [m.model_dump() for m in request.history]
    user_id = current_user.id

    async def finalize(full_text: str) -> None:
        """After the stream: log usage + save the exchange to its session. Own DB
        session since the request's dependency may be tearing down."""
        try:
            async with async_session() as s:
                await _log_usage(s, user_id, "chat")
                if request.session_id:
                    await _persist_exchange(
                        s, user_id, request.session_id, request.message, full_text
                    )
        except Exception:
            pass

    async def gen():
        acc: List[str] = []
        started = False
        try:
            async for token in ai_tutor.chat_stream(
                request.message, request.context, request.language, history
            ):
                started = True
                acc.append(token)
                yield f"data: {json.dumps({'kind': 'token', 'token': token})}\n\n"
        except Exception:
            if not started:
                canned = ai_tutor.chat_fallback(request.message)
                await finalize(canned["response"])
                yield f"data: {json.dumps({'kind': 'reply', **canned})}\n\n"
                return
            # mid-stream failure: fall through and finish with what we have

        full = "".join(acc).strip()
        if not full:
            canned = ai_tutor.chat_fallback(request.message)
            await finalize(canned["response"])
            yield f"data: {json.dumps({'kind': 'reply', **canned})}\n\n"
            return

        await finalize(full)

        # The client already has the full text from the token frames; the "done"
        # frame just closes the stream (and carries follow-up suggestions).
        payload = {
            "kind": "done",
            "suggestions": ai_tutor._generate_suggestions(request.message, full),
        }
        yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --------------------------- Account & Usage ---------------------------------

class UsageWindow(BaseModel):
    label: str
    used: int
    limit: int
    percent: int
    resets_at: datetime
    resets_in_seconds: int


class UsageResponse(BaseModel):
    plan: str
    plan_label: str
    plan_expires_at: Optional[datetime] = None   # set while on a paid plan
    session: UsageWindow
    weekly: UsageWindow
    by_kind: Dict[str, int]          # tokens per surface, this week
    calls_this_week: int


class PlanCard(BaseModel):
    key: str
    label: str
    blurb: str
    price: str
    features: List[str]
    session_tokens: int
    weekly_tokens: int
    current: bool = False


class PlanUpdate(BaseModel):
    plan: str


async def _window_stats(db: AsyncSession, user_id: int, since: datetime):
    """(tokens, oldest_created_at_in_window) for a rolling window."""
    row = (
        await db.execute(
            select(
                func.coalesce(
                    func.sum(AiUsage.input_tokens + AiUsage.output_tokens), 0
                ),
                func.min(AiUsage.created_at),
            ).where(AiUsage.user_id == user_id, AiUsage.created_at >= since)
        )
    ).one()
    return int(row[0] or 0), row[1]


def _window(label: str, used: int, limit: int, oldest, span: timedelta) -> UsageWindow:
    # Rolling window: it "frees up" when the oldest call in it ages past `span`.
    now = datetime.utcnow()
    resets_at = (oldest + span) if oldest else now
    remaining = (resets_at - now).total_seconds()
    return UsageWindow(
        label=label,
        used=used,
        limit=limit,
        percent=min(100, round(used / limit * 100)) if limit else 0,
        resets_at=resets_at,
        resets_in_seconds=max(0, int(remaining)),
    )


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = plans_cfg.effective_plan(current_user.plan, current_user.plan_expires_at)
    # Self-heal a Pro pass that has lapsed, so the meters, the admin portal and
    # billing all agree on the same plan.
    if current_user.plan and current_user.plan != plan["key"]:
        current_user.plan = plan["key"]
        current_user.plan_expires_at = None
        db.add(current_user)
        await db.commit()
    now = datetime.utcnow()
    session_since = now - timedelta(hours=plans_cfg.SESSION_WINDOW_HOURS)
    weekly_since = now - timedelta(days=plans_cfg.WEEKLY_WINDOW_DAYS)

    session_used, session_oldest = await _window_stats(db, current_user.id, session_since)
    weekly_used, weekly_oldest = await _window_stats(db, current_user.id, weekly_since)

    rows = (
        await db.execute(
            select(
                AiUsage.kind,
                func.coalesce(func.sum(AiUsage.input_tokens + AiUsage.output_tokens), 0),
                func.count(AiUsage.id),
            )
            .where(AiUsage.user_id == current_user.id, AiUsage.created_at >= weekly_since)
            .group_by(AiUsage.kind)
        )
    ).all()
    by_kind = {k: int(tok) for k, tok, _ in rows}
    calls = sum(int(c) for _, _, c in rows)

    return UsageResponse(
        plan=plan["key"],
        plan_label=plan["label"],
        plan_expires_at=current_user.plan_expires_at if plan["key"] != plans_cfg.DEFAULT_PLAN else None,
        session=_window(
            f"{plans_cfg.SESSION_WINDOW_HOURS}-hour session",
            session_used,
            plan["session_tokens"],
            session_oldest,
            timedelta(hours=plans_cfg.SESSION_WINDOW_HOURS),
        ),
        weekly=_window(
            "This week",
            weekly_used,
            plan["weekly_tokens"],
            weekly_oldest,
            timedelta(days=plans_cfg.WEEKLY_WINDOW_DAYS),
        ),
        by_kind=by_kind,
        calls_this_week=calls,
    )


@router.get("/plans", response_model=List[PlanCard])
async def list_plans(current_user: User = Depends(get_current_user)):
    current = plans_cfg.effective_plan(current_user.plan, current_user.plan_expires_at)["key"]
    return [
        PlanCard(**{k: p[k] for k in (
            "key", "label", "blurb", "price", "features",
            "session_tokens", "weekly_tokens",
        )}, current=(p["key"] == current))
        for p in plans_cfg.PLANS.values()
    ]


@router.post("/plan", response_model=UsageResponse)
async def set_plan(
    body: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.plan not in plans_cfg.PLANS:
        raise HTTPException(status_code=400, detail="Unknown plan")
    if body.plan != plans_cfg.DEFAULT_PLAN:
        eff = plans_cfg.effective_plan(current_user.plan, current_user.plan_expires_at)
        if eff["key"] != body.plan:
            raise HTTPException(
                status_code=402,
                detail="This plan requires payment — use the Upgrade flow.",
            )
    current_user.plan = body.plan
    if body.plan == plans_cfg.DEFAULT_PLAN:
        current_user.plan_expires_at = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return await get_usage(db, current_user)


# ----------------------- AI-Tutor chat sessions ----------------------------

class TurnOut(BaseModel):
    role: str
    content: str


class SessionCard(BaseModel):
    id: int
    title: str
    preview: str
    turns: int
    updated_at: datetime


class SessionDetail(BaseModel):
    id: int
    title: str
    turns: List[TurnOut]


@router.get("/sessions", response_model=List[SessionCard])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(AiChatSession)
            .where(AiChatSession.user_id == current_user.id)
            .options(selectinload(AiChatSession.turns))
            .order_by(AiChatSession.updated_at.desc())
            .limit(50)
        )
    ).scalars().all()
    out: List[SessionCard] = []
    for s in rows:
        if not s.turns:
            continue  # skip sessions that never got a message
        last = s.turns[-1]
        out.append(
            SessionCard(
                id=s.id,
                title=s.title or "New chat",
                preview=(last.content or "").strip().replace("\n", " ")[:100],
                turns=len(s.turns),
                updated_at=s.updated_at,
            )
        )
    return out


@router.post("/sessions", response_model=SessionDetail)
async def create_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    s = AiChatSession(user_id=current_user.id, title="New chat", created_at=now, updated_at=now)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return SessionDetail(id=s.id, title=s.title, turns=[])


@router.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = (
        await db.execute(
            select(AiChatSession)
            .where(AiChatSession.id == session_id, AiChatSession.user_id == current_user.id)
            .options(selectinload(AiChatSession.turns))
        )
    ).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail(
        id=s.id,
        title=s.title or "New chat",
        turns=[TurnOut(role=t.role, content=t.content or "") for t in s.turns],
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = (
        await db.execute(
            select(AiChatSession)
            .where(
                AiChatSession.id == session_id, AiChatSession.user_id == current_user.id
            )
            .options(selectinload(AiChatSession.turns))  # so the ORM cascade removes turns
        )
    ).scalar_one_or_none()
    if s:
        await db.delete(s)
        await db.commit()