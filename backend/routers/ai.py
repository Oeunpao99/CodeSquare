import json
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
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
    code: str = Field(default="", max_length=20_000)
    error_message: Optional[str] = Field(default=None, max_length=8_000)
    current_hint_level: int = Field(default=1, ge=1, le=10)

class CodeReviewRequest(BaseModel):
    code: str = Field(default="", max_length=20_000)
    language: str = Field(default="", max_length=40)
    lesson_context: str = Field(default="", max_length=8_000)
    exercise_description: str = Field(default="", max_length=8_000)

class ProjectRequest(BaseModel):
    language: str = Field(default="", max_length=40)
    skills_learned: List[str] = Field(default_factory=list, max_length=200)
    difficulty: str = Field(default="", max_length=40)
    focus: Optional[str] = Field(default=None, max_length=2_000)

class ChatMessage(BaseModel):
    role: str          # "user" | "assistant"
    content: str = Field(default="", max_length=24_000)


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=16_000)
    context: Optional[str] = Field(default=None, max_length=16_000)
    language: Optional[str] = Field(default=None, max_length=40)
    history: List[ChatMessage] = Field(default_factory=list, max_length=40)
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
        await _enforce_quota(db, current_user)
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
    await _enforce_quota(db, current_user)
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
    await _enforce_quota(db, current_user)
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
    await _enforce_quota(db, current_user)
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

    await _enforce_quota(db, current_user)
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events version of /chat. Frames: `data: {json}\\n\\n` where
    `kind` is "token" ({token}), "reply" (canned, terminal) or "done"
    ({response, suggestions}, terminal). Falls back to /chat on the client if
    this stream can't be opened.
    """
    await _enforce_quota(db, current_user)
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


async def _enforce_quota(db: AsyncSession, user: User) -> None:
    """Reject the call with 429 when the user is already over their plan's
    rolling token budget. Runs BEFORE the model call, so it actually caps spend
    (the old `_log_usage` only recorded usage after the fact)."""
    plan = plans_cfg.effective_plan(user.plan, getattr(user, "plan_expires_at", None))
    now = datetime.utcnow()
    sess_used, _ = await _window_stats(
        db, user.id, now - timedelta(hours=plans_cfg.SESSION_WINDOW_HOURS)
    )
    if sess_used >= plan["session_tokens"]:
        raise HTTPException(
            status_code=429,
            detail=(
                f"You've hit your {plans_cfg.SESSION_WINDOW_HOURS}-hour AI limit. "
                "It refills gradually — try again later, or upgrade for more."
            ),
        )
    week_used, _ = await _window_stats(
        db, user.id, now - timedelta(days=plans_cfg.WEEKLY_WINDOW_DAYS)
    )
    if week_used >= plan["weekly_tokens"]:
        raise HTTPException(
            status_code=429,
            detail="You've used this week's AI limit. It resets in a few days, or upgrade for more.",
        )


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


# ---------------------------------------------------------------------------
#  VS Code extension — chat with file-tool support
# ---------------------------------------------------------------------------

class VscodeChatRequest(BaseModel):
    message: str = Field(default="", max_length=64_000)
    language: Optional[str] = Field(default=None, max_length=40)
    active_file: Optional[str] = Field(default=None, max_length=500)
    active_file_content: Optional[str] = Field(default=None, max_length=32_000)
    workspace_path: Optional[str] = Field(default=None, max_length=500)
    workspace_tree: Optional[str] = Field(default=None, max_length=20_000)
    # Wide enough for a long build's explore/write loop (plan + many task turns +
    # read_file results). The server still keeps only the most recent turns.
    history: List[ChatMessage] = Field(default_factory=list, max_length=160)
    mode: str = Field(default="build", max_length=10)  # "plan" | "build"


# How much history / per-turn text the agent path keeps — much larger than the
# web tutor so a big scaffold doesn't lose earlier files or the plan.
_VS_HISTORY_TURNS = int(os.getenv("VSCODE_AGENT_HISTORY_TURNS", "24"))
_VS_TURN_CHARS = int(os.getenv("VSCODE_AGENT_TURN_CHARS", "24000"))
_VS_MAX_TOKENS = int(os.getenv("VSCODE_AGENT_MAX_TOKENS", "6000"))
_VS_REASONING = os.getenv("VSCODE_AGENT_REASONING_EFFORT", "medium")


def _vscode_system_prompt(mode: str = "build") -> str:
    base = """You are CodeSquareAgent, a coding assistant that lives inside VS Code.

You can help the user by:
- Answering coding questions
- Writing code examples
- Debugging errors
- Reading their project to understand it
- Creating and editing files in their project

## Tools

Respond with a JSON tool call on its own line, wrapped in ```tool fences, to act.
Only ONE tool call per message — the first ```tool block is the one that runs.

### list_files
Lists workspace files matching a glob — use it to explore an unfamiliar area
before reading. Results come back in the next message.

```tool
{"tool": "list_files", "glob": "backend/routers/*.py"}
```

### search_code
Greps the workspace for a string (or a regex when `"regex": true`), optionally
narrowed by a glob. Use it to locate where a symbol / route / setting is defined
or used before you read or edit. Results come back as `path:line: text`.

```tool
{"tool": "search_code", "query": "create_access_token", "glob": "backend/**/*.py"}
```

### read_file
Reads one or more existing files so you can see them before editing. Reads apply
automatically (no user confirmation) and the contents come back in the next
message. Use this whenever you need to see a file that isn't already in context.

```tool
{"tool": "read_file", "paths": ["relative/path/one.py", "relative/path/two.py"]}
```

### run_command
Runs a shell command in the workspace and returns its output (exit code +
stdout/stderr). Use it to install dependencies, run the test suite, start and
`curl` a server to check an endpoint, run `git`, etc. `cwd` is optional
(relative to the workspace root). Commands are killed after 60s, so never start
a long-running server without a timeout — use `timeout 8 uvicorn …` or run the
check with `python -c` / a test client instead.

```tool
{"tool": "run_command", "command": "python -m pytest -q", "cwd": "notesapp"}
```

If command execution is turned off, you'll be told — then just print the exact
command for the user to run and carry on; do NOT keep calling run_command.

### create_file
Creates ONE new file in the user's workspace. The user reviews it before it's written.

```tool
{"tool": "create_file", "path": "relative/path/to/file.py", "content": "file content here"}
```

### plan_tasks
When a request touches MORE THAN 2 files (scaffold a project, a feature across
backend + frontend, a multi-file refactor), send a task list FIRST — one line
per step, each naming the file(s) and the change. The user gets a checklist and
you then implement the steps ONE AT A TIME (one create_file / edit_file per
turn, in order), so nothing is truncated and the user can check each step.

```tool
{"tool": "plan_tasks", "tasks": [
  "linkshort/db.py — SQLAlchemy engine, Base, get_db()",
  "linkshort/models.py — Link model (slug, target_url, clicks)",
  "linkshort/main.py — FastAPI app, mount the router"
]}
```

### create_files
Scaffolds MULTIPLE new files in ONE call. Use this only for a SMALL batch (≈2-4
short files); for anything bigger use plan_tasks and build file by file so a
long response can't be cut off mid-file. Parent folders are created
automatically from each path.

```tool
{"tool": "create_files", "files": [
  {"path": "backend/routers/feedback.py", "content": "..."},
  {"path": "backend/models/feedback.py", "content": "..."},
  {"path": "frontend/src/components/FeedbackForm.jsx", "content": "..."}
]}
```

### edit_file
Edits an existing file — provide the EXACT old text to replace and the new text.
The user reviews a diff before it's applied.

```tool
{"tool": "edit_file", "path": "relative/path/to/file.py", "old_text": "exact text to find", "new_text": "replacement text"}
```

## How to work a change
1. Explore only if you need to: `list_files` to see an area, `search_code` to
   find where something lives.
2. `read_file` the file(s) you'll touch (and their close neighbours) so you have
   the exact current text.
3. Big job (>2 files)? Send `plan_tasks` first, then implement ONE task per turn.
   Small job? Go straight to `edit_file` / `create_file` / small `create_files`.
4. When it matters, verify with `run_command` — run the tests, or `curl` / a
   TestClient call against the thing you changed — and fix what's broken.
You may chain several explore/run steps (about 8) before you must act — one tool
call per message, results come back in the next one. Don't re-read a file already
in context, and stop as soon as you know enough.

## Rules
- Use the "Project files" list to find paths. Paths are relative to the workspace root.
- Before you edit or reference a file you have NOT already seen, request it with read_file first.
- For edit_file, old_text must be an EXACT substring of the current file content, and unique enough to match once.
- >2 files → plan_tasks first, then one write per turn. 2-4 tiny files → create_files. One file → create_file.
  Never emit more than one ```tool block to work around the one-call limit.
- After a plan_tasks list, each turn does the NEXT task with exactly one write tool call.
- You can include both a tool call AND explanatory text in the same response.
- Keep prose tight. Lead with the answer, then a short explanation.

## Formatting
- Use GitHub-flavoured Markdown.
- Every code snippet goes in a fenced block with a language tag.
- Use `inline code` for file paths, function names, and commands.
- For a short, direct answer, skip headings — 1-3 sentences is best."""

    if mode == "plan":
        return base + """

## YOU ARE IN PLAN MODE
In this mode you investigate and propose — you do NOT make changes.
- You may use list_files, search_code and read_file freely to understand the project.
- You must NOT use create_file, create_files, or edit_file in this mode, even if asked directly.
  If the user asks you to build/apply something, still only produce a plan, and
  say the plan is ready to build — don't write the files.
- EVERY response (not just build requests — plain questions too, where it fits)
  must end with a "## Plan" section: a numbered list of concrete steps. Each
  step names the exact file(s) it touches and the change in one line, e.g.:
  1. `backend/models.py` — add a `Feedback` model (user_id, message, rating, created_at).
  2. `backend/routers/feedback.py` — new router: POST /feedback, GET /feedback/me.
  3. `backend/main.py` — register the new router.
- Keep steps concrete enough that they could be executed one-for-one in Build
  mode without re-deciding anything. Note open questions as a step's caveat
  rather than blocking the whole plan on them.
- End with one line: "Switch to Build mode to have me implement this.\""""

    return base + """

## YOU ARE IN BUILD MODE
Take action — don't just describe a change, make it with create_file/edit_file.
Read what you need first, then implement. Prefer the smallest correct change.

## Big-scope requests (a project, a feature across several files, a refactor)
1. First send `plan_tasks` — one task per file, ordered so each builds on the
   last (config/db → models → schemas → crud → routes → app wiring → docs). A
   file that imports X comes after X. Name the exact file in each task.
2. Then you get one message per task: "Implement task N of M: …". Do EXACTLY that
   task — ONE write tool call for the file it names — and nothing from other tasks.
3. For a file YOU created earlier in this same build, do NOT edit_file it — just
   `create_file` it again with the full corrected content (overwrite). Only use
   edit_file on pre-existing project files.
4. Stay consistent with what you already built: same import paths, names, base
   classes, style. `read_file` an earlier file if you're unsure what it looks like.
5. Every file COMPLETE and runnable — no "# ... rest unchanged", no TODO stubs,
   no placeholder bodies. Write the whole file; never split it across turns.
6. Make the SECOND-TO-LAST task a real test file (e.g. `tests/test_api.py` with a
   TestClient hitting each endpoint) whenever the project can be tested — you
   will be asked to run it, and a build that proves itself is worth far more
   than one that merely looks right.
7. If `run_command` is available, after the last file: install deps and run that
   test. If it fails, fix the offending file (one more create_file) and re-run.
8. Finish with one short line ("All N files created — run with `…`.") and stop;
   don't re-list the plan."""


def _build_vscode_context(req: VscodeChatRequest) -> str:
    parts: list[str] = []
    if req.active_file:
        parts.append(f"Active file: {req.active_file}")
    if req.workspace_path:
        parts.append(f"Workspace: {req.workspace_path}")
    if req.active_file_content:
        # Truncate to keep context manageable
        content = req.active_file_content[:8000]
        parts.append(f"Active file content:\n```\n{content}\n```")
    if req.workspace_tree:
        parts.append(
            "Project files (relative paths — request any with the read_file tool):\n"
            f"```\n{req.workspace_tree[:16000]}\n```"
        )
    return "\n\n".join(parts)


class VscodeChatResponse(BaseModel):
    response: str
    tool_call: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []


def _scan_balanced_object(text: str, start: int) -> Optional[tuple[int, int]]:
    """From `start`, find the first top-level {...} object, honouring strings and
    escapes so nested braces / braces-in-strings (create_files!) don't break it.
    Returns (obj_start, obj_end) or None."""
    i, depth, obj_start = start, 0, None
    in_str = esc = False
    while i < len(text):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            if depth == 0:
                obj_start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and obj_start is not None:
                return obj_start, i + 1
        i += 1
    return None


def _parse_tool_call(text: str) -> tuple[Optional[Dict[str, Any]], str]:
    """Extract a ```tool JSON block from the response, returning (tool, clean_text)."""
    import re
    open_fence = re.search(r"```tool[ \t]*\r?\n", text)
    if not open_fence:
        return None, text

    found = _scan_balanced_object(text, open_fence.end())
    if not found:
        # Malformed tool block — drop everything from the fence on so the raw
        # JSON never reaches the user.
        return None, text[: open_fence.start()].rstrip()

    obj_start, obj_end = found
    try:
        tool = json.loads(text[obj_start:obj_end])
    except json.JSONDecodeError:
        return None, text[: open_fence.start()].rstrip()

    close = re.match(r"[ \t]*\r?\n?```", text[obj_end:])
    fence_end = obj_end + (close.end() if close else 0)
    clean = (text[: open_fence.start()].rstrip() + "\n\n" + text[fence_end:].lstrip()).strip()
    return tool, clean


_BUILD_ONLY_TOOLS = {"create_file", "create_files", "edit_file", "run_command"}


def _gate_tool_for_mode(
    tool: Optional[Dict[str, Any]], mode: str
) -> Optional[Dict[str, Any]]:
    """Plan mode may only read — never write. Enforced here, not just by
    prompt, in case the model ignores the instruction."""
    if tool and mode == "plan" and tool.get("tool") in _BUILD_ONLY_TOOLS:
        return None
    return tool


@router.post("/vscode/chat", response_model=VscodeChatResponse)
async def vscode_chat(
    request: VscodeChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _enforce_quota(db, current_user)

    # Build context from workspace / active file
    ctx = _build_vscode_context(request)
    mode = "plan" if request.mode == "plan" else "build"

    # Build messages
    system = _vscode_system_prompt(mode)
    if ctx:
        system += f"\n\n## Current VS Code Context\n{ctx}"

    msgs: list[dict[str, str]] = [{"role": "system", "content": system}]
    for turn in (request.history or [])[-_VS_HISTORY_TURNS:]:
        role = "assistant" if turn.role in ("assistant", "ai") else "user"
        content = (turn.content or "").strip()
        if content:
            msgs.append({"role": role, "content": content[:_VS_TURN_CHARS]})
    msgs.append({"role": "user", "content": request.message})

    if not ai_tutor.client:
        fallback = ai_tutor.chat_fallback(request.message)
        return VscodeChatResponse(response=fallback["response"], suggestions=fallback.get("suggestions", []))

    try:
        full_text = await ai_tutor._complete(
            msgs,
            max_tokens=_VS_MAX_TOKENS,
            temperature=0.4,
            reasoning_effort=_VS_REASONING,
        )
        await _log_usage(db, current_user.id, "chat")

        tool_call, clean_text = _parse_tool_call(full_text or "")
        tool_call = _gate_tool_for_mode(tool_call, mode)

        # If a tool call was found, the cleaned text is authoritative even when
        # empty — never fall back to `full_text` (that re-exposes the raw block).
        response_text = clean_text if tool_call else (clean_text or full_text or "")

        return VscodeChatResponse(
            response=response_text,
            tool_call=tool_call,
            suggestions=ai_tutor._generate_suggestions(request.message, full_text or ""),
        )
    except Exception:
        fallback = ai_tutor.chat_fallback(request.message)
        return VscodeChatResponse(response=fallback["response"])


@router.post("/vscode/chat/stream")
async def vscode_chat_stream(
    request: VscodeChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming version of /vscode/chat for the VS Code extension."""
    await _enforce_quota(db, current_user)
    ctx = _build_vscode_context(request)
    user_id = current_user.id
    mode = "plan" if request.mode == "plan" else "build"

    system = _vscode_system_prompt(mode)
    if ctx:
        system += f"\n\n## Current VS Code Context\n{ctx}"

    async def gen():
        acc: list[str] = []
        started = False
        try:
            async for token in ai_tutor.chat_stream(
                request.message, None, request.language,
                [m.model_dump() for m in request.history],
                system=system,
                max_tokens=_VS_MAX_TOKENS,
                history_turns=_VS_HISTORY_TURNS,
                max_turn_chars=_VS_TURN_CHARS,
                reasoning_effort=_VS_REASONING,
            ):
                started = True
                acc.append(token)
                yield f"data: {json.dumps({'kind': 'token', 'token': token})}\n\n"
        except Exception:
            if not started:
                canned = ai_tutor.chat_fallback(request.message)
                try:
                    async with async_session() as s:
                        await _log_usage(s, user_id, "chat")
                except Exception:
                    pass
                yield f"data: {json.dumps({'kind': 'reply', **canned})}\n\n"
                return

        full = "".join(acc).strip()
        if not full:
            canned = ai_tutor.chat_fallback(request.message)
            try:
                async with async_session() as s:
                    await _log_usage(s, user_id, "chat")
            except Exception:
                pass
            yield f"data: {json.dumps({'kind': 'reply', **canned})}\n\n"
            return

        try:
            async with async_session() as s:
                await _log_usage(s, user_id, "chat")
        except Exception:
            pass

        tool_call, clean_text = _parse_tool_call(full)
        tool_call = _gate_tool_for_mode(tool_call, mode)
        payload: dict[str, Any] = {
            "kind": "done",
            # With a tool call, the cleaned text wins even if empty — falling back
            # to `full` would leak the raw ```tool block into the chat.
            "response": clean_text if tool_call else (clean_text or full),
            "suggestions": ai_tutor._generate_suggestions(request.message, full),
        }
        if tool_call:
            payload["tool_call"] = tool_call
        yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )