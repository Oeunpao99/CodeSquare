"""Usage plans for the Account & Usage view.

Two rolling windows are metered against every AI call's token count:
  * session — a 5-hour window (like an editor "session")
  * weekly  — a 7-day window

Limits are soft today (the UI shows the bars; nothing is blocked yet) so tune
them freely.
"""
from datetime import datetime
from typing import Any, Dict, Optional

SESSION_WINDOW_HOURS = 5
WEEKLY_WINDOW_DAYS = 7

# One paid Pro purchase buys this many days (prepaid — KHQR/Bakong can't
# auto-charge, so Pro is a renewable pass, not a subscription).
PRO_PERIOD_DAYS = 30

PLANS: Dict[str, Dict[str, Any]] = {
    "free": {
        "key": "free",
        "label": "Free",
        "blurb": "Everything you need to learn — with generous AI limits.",
        "price": "$0",
        "session_tokens": 120_000,
        "weekly_tokens": 600_000,
        "features": [
            "CodeSquareAgent chat & debugging",
            "Code review on every solve",
            "AI project briefs",
            "~120K tokens / 5h · 600K / week",
        ],
    },
    "pro": {
        "key": "pro",
        "label": "Pro",
        "blurb": "For daily use — roughly 8× the AI headroom.",
        "price": "$12 / mo",
        "session_tokens": 1_000_000,
        "weekly_tokens": 8_000_000,
        "features": [
            "Everything in Free",
            "~1M tokens / 5h · 8M / week",
            "Priority model access",
            "Longer chat history in context",
        ],
    },
}

DEFAULT_PLAN = "free"


def get_plan(key: str | None) -> Dict[str, Any]:
    return PLANS.get((key or "").strip() or DEFAULT_PLAN, PLANS[DEFAULT_PLAN])


def effective_plan(key: str | None, expires_at: Optional[datetime] = None) -> Dict[str, Any]:
    """The plan a user actually has right now. A paid plan whose `expires_at` has
    passed reads as the default (free) plan — callers should also lazily reset
    the stored key so admin views stay consistent."""
    k = (key or "").strip() or DEFAULT_PLAN
    if k != DEFAULT_PLAN and expires_at is not None and datetime.utcnow() >= expires_at:
        k = DEFAULT_PLAN
    return PLANS.get(k, PLANS[DEFAULT_PLAN])
