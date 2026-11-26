"""Telegram group alerts for classes.

One CodeSquare bot (token from @BotFather) posts into each class's connected
Telegram group whenever the teacher shares something new.

Settings (backend/.env):
    TELEGRAM_BOT_TOKEN   bot token from @BotFather            (feature off when empty)
    APP_URL              public site URL used in links, e.g. https://codesquare.app
                         (default http://localhost:5173)

Connecting a group needs no webhook / public URL: the teacher opens
    https://t.me/<bot>?startgroup=<link_token>
which adds the bot to a group and posts "/start <link_token>" there; the API then
reads recent updates with getUpdates and matches the token (see find_link_chat).
Sending never blocks a request: notify() fires a background task and swallows
errors (a broken group must not break the class).
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
from datetime import datetime, timedelta
from typing import Iterable, Optional, Tuple

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("telegram")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
APP_URL = (os.getenv("APP_URL", "") or "http://localhost:5173").rstrip("/")
# Hours from UTC for dates shown in messages (Cambodia = +7).
TZ_HOURS = float(os.getenv("CLASS_TZ_OFFSET", "7"))
_TZ_LABEL = f"UTC{'+' if TZ_HOURS >= 0 else '-'}{abs(TZ_HOURS):g}"
_API = f"https://api.telegram.org/bot{TOKEN}"
_bot_username: Optional[str] = None


def enabled() -> bool:
    return bool(TOKEN)


def esc(s: str) -> str:
    return html.escape(s or "", quote=False)


async def _call(method: str, **params):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{_API}/{method}", json=params)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or f"Telegram {method} failed")
        return data["result"]


async def bot_username() -> Optional[str]:
    global _bot_username
    if not enabled():
        return None
    if _bot_username is None:
        try:
            _bot_username = (await _call("getMe")).get("username")
        except Exception as e:  # wrong token, no network…
            log.warning("telegram getMe failed: %s", e)
            return None
    return _bot_username


def _public_url(url: str) -> bool:
    # Telegram rejects inline-button URLs on localhost / private hosts.
    host = url.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0].lower()
    return url.startswith("https://") and host not in ("localhost", "127.0.0.1") and "." in host


async def send(chat_id: str, text: str, button: Optional[Tuple[str, str]] = None) -> None:
    """Send an HTML message; `button` = (label, url) adds a tappable button."""
    params = dict(chat_id=chat_id, text=text, parse_mode="HTML", disable_web_page_preview=True)
    if button and _public_url(button[1]):
        params["reply_markup"] = {"inline_keyboard": [[{"text": button[0], "url": button[1]}]]}
    await _call("sendMessage", **params)


def local_time(dt: Optional[datetime]) -> str:
    """'Fri 5 Dec 2026 · 17:00' in the class time zone (dt is naive UTC)."""
    if not dt:
        return ""
    t = dt + timedelta(hours=TZ_HOURS)
    return f"{t:%a} {t.day} {t:%b %Y} · {t:%H:%M}"


_RULE = "━━━━━━━━━━━━━━━━━━"


def card(icon: str, label: str, class_title: str, teacher: str, *, title: str = "",
         quote: str = "", facts: Iterable[Tuple[str, str]] = (), url: str = "",
         button: str = "Open in CodeSquare") -> Tuple[str, Optional[Tuple[str, str]]]:
    """Build a consistent, polished class alert. Returns (html_text, button).

        📢 New announcement
        Power BI — Batch 1 · Rin Sokha
        ━━━━━━━━━━━━━━━━━━
        Title
        ┃ quoted text…
        📁 Week 1
        ━━━━━━━━━━━━━━━━━━
        [ Open in CodeSquare ]   (or a text link on localhost)
    """
    lines = [f"{icon} <b>{esc(label)}</b>", f"🎓 <b>{esc(class_title)}</b> · {esc(teacher)}", _RULE]
    if title:
        lines.append(f"<b>{esc(title)}</b>")
    if quote:
        lines.append(f"<blockquote>{esc(quote)}</blockquote>")
    for f_icon, f_text in facts:
        if f_text:
            lines.append(f"{f_icon} {esc(f_text)}")
    lines.append(_RULE)
    btn = (f"📖 {button}", url) if url else None
    if url and not _public_url(url):
        lines.append(f'🔗 <a href="{url}">{esc(button)}</a>')
    lines.append("<i>CodeSquare · Learn. Build. Grow.</i>")
    return "\n".join(lines), btn


async def find_link_chat(link_token: str) -> Optional[dict]:
    """Look through recent bot updates for '/start <link_token>' sent in a group.
    Returns {"id": "<chat id>", "title": "<group name>"} or None."""
    try:
        updates = await _call("getUpdates", timeout=0, limit=100,
                              allowed_updates=["message", "my_chat_member"])
    except Exception as e:
        log.warning("telegram getUpdates failed: %s", e)
        return None
    for u in reversed(updates):
        msg = u.get("message") or {}
        chat = msg.get("chat") or {}
        text = (msg.get("text") or "").strip()
        if chat.get("type") in ("group", "supergroup") and text.startswith("/start") and link_token in text:
            return {"id": str(chat["id"]), "title": chat.get("title") or "Telegram group"}
    return None


def class_url(public_id: str) -> str:
    return f"{APP_URL}/classes/{public_id}"


def notify(chat_id: Optional[str], text: str, button: Optional[Tuple[str, str]] = None) -> None:
    """Fire-and-forget send to a class group; never raises."""
    if not (enabled() and chat_id):
        return

    async def _go():
        try:
            await send(chat_id, text, button)
        except Exception as e:
            log.warning("telegram send to %s failed: %s", chat_id, e)

    try:
        asyncio.get_running_loop().create_task(_go())
    except RuntimeError:
        pass  # no running loop (scripts) — skip
