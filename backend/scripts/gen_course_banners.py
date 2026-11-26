"""Generate a wide banner image per course (Language/track) for the course page
(/learn/<slug>).

Output: frontend/public/banners/course/<slug>.webp  (1536x512)

Courses are read from the DB, so new tracks are picked up automatically; the
scene comes from SCENES when present, otherwise from the course description.
Resumable (existing banners are skipped; --force regenerates; --only <slug>).

    ./.venv/Scripts/python.exe scripts/gen_course_banners.py
"""

import _bootstrap  # noqa: F401

import argparse
import asyncio
import sys

import httpx
from sqlalchemy import select

from database import async_session
from models.models import Language
from gen_library_thumbnails import API_KEY, BACKEND, ENDPOINT, _Pacer, _clean, _generate
from gen_career_banners import _save

OUT_DIR = BACKEND.parent / "frontend" / "public" / "banners" / "course"

SCENES = {
    "python": "a friendly blue-and-yellow snake curled beside a laptop, books and simple building blocks",
    "python-intermediate": "an open toolbox with gears, puzzle pieces and connected cloud, database and web icons",
    "javascript": "a lively web page being assembled from interactive blocks, buttons and sliders, yellow accents",
    "html-css": "a web page layout being built from coloured blocks and a paint palette styling it",
    "full-stack": "a layered stack: browser on top, server in the middle, database at the bottom, connected by arrows",
    "backend-foundations": "servers and an API hub connecting a database, a document and a shield",
    "react-typescript": "reusable UI components snapping together like building blocks around an atom-like orbit",
    "linux-shell": "a friendly penguin beside a simple terminal window, folders and a gear",
    "ai-llm": "a friendly network of round nodes linked to chat bubbles, documents and a magnifying glass",
    "sql-data": "database cylinders feeding neat tables that join together into a bar chart",
    "dsa": "a binary tree, a sorted bar chart and a graph of connected nodes, tidy and geometric",
    "power-bi": "an interactive business dashboard with yellow and navy bar, line and donut charts, a funnel cleaning data and a database",
}

STYLE = (
    "Wide panoramic banner for an online course, flat minimal vector illustration, soft light pastel "
    "background, main elements spread horizontally across the centre band, generous empty space at the "
    "top and bottom, palette built around the accent colour {color} with navy and soft neutrals, gentle "
    "shadows, modern and friendly, no glow effects. Absolutely no text, letters, numbers, logos or watermarks."
)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="+")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--per-minute", type=float, default=2)
    args = ap.parse_args()
    if not (ENDPOINT and API_KEY):
        sys.exit("AZURE_OPENAI_IMAGE_* settings missing in backend/.env")

    async with async_session() as db:
        langs = (await db.execute(select(Language).order_by(Language.id))).scalars().all()
    if args.only:
        langs = [l for l in langs if l.slug in args.only]
    todo = [l for l in langs if args.force or not (OUT_DIR / f"{l.slug}.webp").exists()]
    print(f"{len(todo)} course banners to generate", flush=True)

    pacer = _Pacer(args.per_minute)
    async with httpx.AsyncClient(headers={"api-key": API_KEY}, timeout=180) as client:
        for l in todo:
            scene = SCENES.get(l.slug) or f"the theme of a course about {l.name}: {_clean(l.description)}"
            prompt = f"Subject: {scene}, for a '{l.name}' course page. " + STYLE.format(color=l.color or "#3B82F6")
            try:
                size = _save(await _generate(client, prompt, pacer), OUT_DIR / f"{l.slug}.webp")
                print(f"ok   {l.slug} ({size // 1024} KB)", flush=True)
            except Exception as e:
                print(f"FAIL {l.slug}: {e}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
