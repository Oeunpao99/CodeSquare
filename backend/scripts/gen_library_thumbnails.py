"""Generate a thumbnail image for every Library shelf (DocCollection) and topic
(DocTopic) with the configured image model, so learners can tell at a glance what
each item is about.

Output (static files served by the frontend, no DB change needed):

    frontend/public/thumbnails/library/<collection>.webp
    frontend/public/thumbnails/library/<collection>/<topic>.webp

Resumable: an image that already exists is skipped, so re-running only fills
gaps (pass --force to regenerate). Needs these in backend/.env:

    AZURE_OPENAI_IMAGE_ENDPOINT   e.g. https://<res>.services.ai.azure.com/openai/v1/
    AZURE_OPENAI_IMAGE_API_KEY
    AZURE_OPENAI_IMAGE_DEPLOYMENT e.g. gpt-image-2

Usage (from backend/):

    ./.venv/Scripts/python.exe scripts/gen_library_thumbnails.py              # all
    ./.venv/Scripts/python.exe scripts/gen_library_thumbnails.py --only git   # one shelf
    ./.venv/Scripts/python.exe scripts/gen_library_thumbnails.py --collections-only
    ./.venv/Scripts/python.exe scripts/gen_library_thumbnails.py --dry-run    # list prompts

Each thumbnail = the model's illustration + a bottom scrim, an accent-coloured
pill (shelf name) and the English title, drawn locally with Pillow so the text is
always crisp and correctly spelled. Raw illustrations are kept in
scripts/.thumb_raw/ (git-ignored); `--compose-only` re-draws every title from
them without any API calls. Requires Pillow.
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)

import argparse
import asyncio
import base64
import io
import os
import re
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from sqlalchemy import select

from database import async_session
from models.models import DocCollection, DocTopic

BACKEND = Path(__file__).resolve().parent.parent
OUT_DIR = BACKEND.parent / "frontend" / "public" / "thumbnails" / "library"
# Untitled illustrations from the model (not shipped; lets --compose-only re-title for free).
RAW_DIR = BACKEND / "scripts" / ".thumb_raw" / "library"
load_dotenv(BACKEND / ".env")

ENDPOINT = (os.getenv("AZURE_OPENAI_IMAGE_ENDPOINT") or "").rstrip("/")
API_KEY = os.getenv("AZURE_OPENAI_IMAGE_API_KEY") or ""
DEPLOYMENT = os.getenv("AZURE_OPENAI_IMAGE_DEPLOYMENT") or "gpt-image-1"

THUMB_SIZE = (768, 512)  # 3:2, matches the Library cards

STYLE = (
    "Flat minimal vector illustration used as a thumbnail for an online coding course. "
    "One clear central metaphor that a beginner would recognise instantly. "
    "Soft, light background; simple geometric shapes; gentle shadows; generous empty space; "
    "palette built around the accent colour {color} with navy and soft neutrals. "
    "Keep the main subject in the upper two-thirds; the bottom third should be calm, simple "
    "background (a title is overlaid there). "
    "Absolutely no text, letters, numbers, code characters, watermarks or brand logos."
)


def _clean(s: str, n: int = 220) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]


def collection_prompt(c) -> str:
    return (
        f"Subject: a learning shelf titled \"{c.title}\" — {_clean(c.description)}. "
        "Show the overall theme of this subject as a single friendly scene. "
        + STYLE.format(color=c.color or "#2DD4BF")
    )


def topic_prompt(c, t) -> str:
    about = _clean(t.summary) or _clean(t.body, 300)
    return (
        f"Subject: the lesson \"{t.title}\" from the \"{c.title}\" course. "
        f"What it teaches: {about}. "
        "Illustrate the specific idea of this lesson (not the whole course). "
        + STYLE.format(color=c.color or "#2DD4BF")
    )


# --------------------------------------------------------------------------- #
#  Raw illustration (from the model) -> titled thumbnail (composed locally)
# --------------------------------------------------------------------------- #

def _save_raw(b64: str, path: Path) -> None:
    """Keep the model's illustration (resized) so titles can be re-laid out any
    time with --compose-only, without paying for new images."""
    from PIL import Image

    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    img = _cover(img, THUMB_SIZE)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=88, method=6)


def _cover(img, size):
    """Resize + centre-crop to exactly `size` (like CSS object-fit: cover)."""
    from PIL import Image

    tw, th = size
    scale = max(tw / img.width, th / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - tw) // 2, (img.height - th) // 2
    return img.crop((left, top, left + tw, top + th))


_FONT_CANDIDATES = {
    "bold": [BACKEND / "scripts" / "fonts" / "Inter-Bold.ttf", Path("C:/Windows/Fonts/segoeuib.ttf"),
             Path("C:/Windows/Fonts/arialbd.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")],
    "semi": [BACKEND / "scripts" / "fonts" / "Inter-SemiBold.ttf", Path("C:/Windows/Fonts/seguisb.ttf"),
             Path("C:/Windows/Fonts/arialbd.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")],
}


def _font(kind: str, size: int):
    from PIL import ImageFont

    for p in _FONT_CANDIDATES[kind]:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def _hex(c: str, fallback=(45, 212, 191)):
    c = (c or "").lstrip("#")
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) if len(c) == 6 else fallback
    except ValueError:
        return fallback


def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def compose(raw_path: Path, out_path: Path, title: str, eyebrow: str, color: str) -> int:
    """Illustration + bottom scrim + accent pill (eyebrow) + bold English title."""
    from PIL import Image, ImageDraw

    W, H = THUMB_SIZE
    base = _cover(Image.open(raw_path).convert("RGB"), THUMB_SIZE).convert("RGBA")

    # Bottom scrim so white text is readable on any illustration.
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    start = int(H * 0.38)
    for y in range(start, H):
        a = int(225 * ((y - start) / (H - start)) ** 1.35)
        sd.line([(0, y), (W, y)], fill=(9, 14, 28, a))
    img = Image.alpha_composite(base, scrim)
    d = ImageDraw.Draw(img)

    pad = 40
    max_w = W - pad * 2

    # Title: largest size (64 -> 34) that fits in 2 lines.
    for size in range(64, 33, -2):
        f_title = _font("bold", size)
        lines = _wrap(d, title, f_title, max_w)
        if len(lines) <= 2:
            break
    if len(lines) > 2:  # still too long at the smallest size -> ellipsise
        lines = lines[:2]
        while d.textlength(lines[1] + "…", font=f_title) > max_w and " " in lines[1]:
            lines[1] = lines[1].rsplit(" ", 1)[0]
        lines[1] += "…"
    line_h = int(size * 1.12)
    y = H - pad - line_h * len(lines)

    # Eyebrow pill in the shelf's accent colour.
    if eyebrow:
        f_eb = _font("semi", 19)
        label = eyebrow.upper()
        tw = d.textlength(label, font=f_eb)
        ph = 34
        py = y - ph - 14
        acc = _hex(color)
        lum = 0.299 * acc[0] + 0.587 * acc[1] + 0.114 * acc[2]
        fg = (15, 20, 30) if lum > 150 else (255, 255, 255)
        d.rounded_rectangle([pad, py, pad + tw + 28, py + ph], radius=ph // 2, fill=acc + (255,))
        d.text((pad + 14, py + ph / 2), label, font=f_eb, fill=fg, anchor="lm")

    for i, line in enumerate(lines):
        ly = y + i * line_h
        d.text((pad + 1, ly + 2), line, font=f_title, fill=(0, 0, 0, 120))  # soft shadow
        d.text((pad, ly), line, font=f_title, fill=(255, 255, 255, 255))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "WEBP", quality=82, method=6)
    return out_path.stat().st_size


class _Pacer:
    """Start at most `per_min` requests per minute (Azure image deployments are
    often limited to a handful of requests/minute)."""

    def __init__(self, per_min: float):
        self.gap = 60.0 / per_min if per_min > 0 else 0
        self.next_at = 0.0
        self.lock = asyncio.Lock()

    async def wait(self):
        async with self.lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            if now < self.next_at:
                await asyncio.sleep(self.next_at - now)
            self.next_at = max(now, self.next_at) + self.gap


async def _generate(client: httpx.AsyncClient, prompt: str, pacer: "_Pacer") -> str:
    body = {
        "model": DEPLOYMENT,
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "low",
        "output_format": "jpeg",
        "n": 1,
    }
    for attempt in range(8):
        await pacer.wait()
        r = await client.post(f"{ENDPOINT}/images/generations", json=body)
        if r.status_code == 200:
            return r.json()["data"][0]["b64_json"]
        if r.status_code in (429, 500, 502, 503, 504):
            wait = int(r.headers.get("retry-after", 0) or 0) or 15 * (attempt + 1)
            await asyncio.sleep(wait)
            continue
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    raise RuntimeError("gave up after retries")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="collection slug to limit to")
    ap.add_argument("--collections-only", action="store_true")
    ap.add_argument("--force", action="store_true", help="regenerate illustrations that already exist")
    ap.add_argument("--compose-only", action="store_true",
                    help="re-draw titles on existing illustrations; no API calls")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--concurrency", type=int, default=2)
    ap.add_argument("--per-minute", type=float, default=float(os.getenv("IMAGE_RPM", "2")),
                    help="request rate limit of the image deployment (default 2, env IMAGE_RPM)")
    args = ap.parse_args()

    need_api = not (args.dry_run or args.compose_only)
    if need_api and not (ENDPOINT and API_KEY):
        sys.exit("AZURE_OPENAI_IMAGE_ENDPOINT / AZURE_OPENAI_IMAGE_API_KEY are not set in backend/.env")

    async with async_session() as db:
        q = select(DocCollection).order_by(DocCollection.order)
        if args.only:
            q = q.where(DocCollection.slug == args.only)
        collections = (await db.execute(q)).scalars().all()
        jobs = []
        for c in collections:
            jobs.append(dict(rel=f"{c.slug}.webp", prompt=collection_prompt(c), title=c.title,
                             eyebrow="Library", color=c.color, label=c.slug))
            if args.collections_only:
                continue
            topics = (
                await db.execute(
                    select(DocTopic).where(DocTopic.collection_id == c.id).order_by(DocTopic.order)
                )
            ).scalars().all()
            for t in topics:
                jobs.append(dict(rel=f"{c.slug}/{t.slug}.webp", prompt=topic_prompt(c, t), title=t.title,
                                 eyebrow=c.title, color=c.color, label=f"{c.slug}/{t.slug}"))

    # shelves first (one per Library card), then topics
    jobs.sort(key=lambda j: "/" in j["label"])
    for j in jobs:
        j["raw"], j["out"] = RAW_DIR / j["rel"], OUT_DIR / j["rel"]

    # Illustrations made before titles existed sit where the final file goes:
    # adopt them as raw art instead of paying to regenerate.
    for j in jobs:
        if not j["raw"].exists() and j["out"].exists():
            j["raw"].parent.mkdir(parents=True, exist_ok=True)
            j["out"].replace(j["raw"])

    if args.compose_only:
        n = 0
        for j in jobs:
            if j["raw"].exists():
                compose(j["raw"], j["out"], j["title"], j["eyebrow"], j["color"])
                n += 1
        print(f"re-titled {n} thumbnails -> {OUT_DIR}")
        return

    todo = [j for j in jobs if args.force or not j["raw"].exists()]
    # Anything already illustrated but not yet titled: title it now (free).
    for j in jobs:
        if j not in todo and not j["out"].exists():
            compose(j["raw"], j["out"], j["title"], j["eyebrow"], j["color"])
    print(f"{len(jobs)} thumbnails, {len(jobs) - len(todo)} already illustrated, {len(todo)} to generate")
    if args.dry_run:
        for j in todo[:10]:
            print(f"- {j['label']}: {j['prompt']}\n")
        return

    sem = asyncio.Semaphore(args.concurrency)
    pacer = _Pacer(args.per_minute)
    mins = len(todo) / args.per_minute if args.per_minute else 0
    print(f"pacing at {args.per_minute:g}/min -> about {mins:.0f} min", flush=True)
    done = failed = 0

    async with httpx.AsyncClient(headers={"api-key": API_KEY}, timeout=180) as client:
        async def run(j):
            nonlocal done, failed
            async with sem:
                try:
                    _save_raw(await _generate(client, j["prompt"], pacer), j["raw"])
                    size = compose(j["raw"], j["out"], j["title"], j["eyebrow"], j["color"])
                    done += 1
                    print(f"[{done + failed}/{len(todo)}] ok   {j['label']} ({size // 1024} KB)", flush=True)
                except Exception as e:  # keep going; re-run fills the gaps
                    failed += 1
                    print(f"[{done + failed}/{len(todo)}] FAIL {j['label']}: {e}", flush=True)

        await asyncio.gather(*(run(j) for j in todo))

    print(f"done: {done} generated, {failed} failed -> {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
