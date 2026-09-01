"""Cambodia (Asia/Phnom Penh, UTC+7) day-boundary helpers.

Server-side timestamps are stored as naive UTC. Attach UTC before converting so
that "day" always means the learner's local day — a lesson finished at 00:30
Phnom Penh time should count towards the same Cambodian day, not the UTC day.
Phnom Penh observes no DST, so the UTC offset is always +7h.
"""

from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo

PHNOM_PENH = ZoneInfo("Asia/Phnom_Penh")
UTC_OFFSET = timedelta(hours=7)


def khmer_now() -> datetime:
    """Current date/time in Phnom Penh."""
    return datetime.now(PHNOM_PENH)


def khmer_today() -> date:
    """Today's date in Phnom Penh."""
    return khmer_now().date()


def as_khmer(dt) -> datetime | None:
    """Convert a naive-UTC timestamp into Phnom Penh local time."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(PHNOM_PENH)


def khmer_date(dt) -> date | None:
    """Date (in Phnom Penh) of a naive-UTC timestamp."""
    kh = as_khmer(dt)
    return kh.date() if kh is not None else None


def khmer_day_range(day: date) -> tuple[datetime, datetime]:
    """Naive-UTC range covering a whole Phnom Penh calendar day."""
    start = datetime.combine(day, datetime.min.time()) - UTC_OFFSET
    end = datetime.combine(day, datetime.max.time()) - UTC_OFFSET
    return start, end