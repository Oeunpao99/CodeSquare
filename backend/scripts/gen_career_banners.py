"""Generate a wide banner image per career major for the Job Readiness page.

Output: frontend/public/banners/career/<major>.webp  (1536x512, ~40-80 KB)

Reuses the image settings, pacing and retry logic of gen_library_thumbnails.py.
Resumable (existing banners are skipped; --force regenerates).

    ./.venv/Scripts/python.exe scripts/gen_career_banners.py
"""

import _bootstrap  # noqa: F401

import argparse
import asyncio
import base64
import io
import sys

import httpx

from majors import MAJOR_LABELS
from gen_library_thumbnails import API_KEY, BACKEND, ENDPOINT, _Pacer, _generate

OUT_DIR = BACKEND.parent / "frontend" / "public" / "banners" / "career"
SIZE = (1536, 512)  # 3:1 strip

SCENES = {
    "computer-science": "a friendly abstract scene of algorithms: a branching tree structure, sorted bars and a graph of connected nodes",
    "data-science": "a calm data-science scene: scatter plots, a fitted trend curve, a notebook and charts floating on cards",
    "data-analyst": "a business-analytics scene: a clean dashboard with bar and line charts, a database cylinder and a report",
    "ai-engineer": "an AI-engineering scene: a friendly neural network of soft round nodes connected to chat bubbles, documents and a gear",
    "web-developer": "a web-development scene: a browser window with layout blocks, a phone and a tablet showing responsive pages",
    "backend-engineer": "a backend scene: servers, an API connecting services with arrows, a database and a shield for security",
    "automation": "an automation scene: conveyor of tasks passing through gears and robot arms, clock and checklist",
    "network-engineer": "a networking scene: routers and switches linked by cables, a globe and signal waves",
}

STYLE = (
    "Wide panoramic banner, flat minimal vector illustration, soft light pastel background, "
    "main elements spread horizontally across the centre band, generous empty space at top and bottom, "
    "calm blue and teal palette with small warm accents, gentle shadows, modern and friendly, "
    "no glow effects. Absolutely no text, letters, numbers, logos or watermarks."
)


def _save(b64: str, path) -> int:
    from PIL import Image

    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    tw, th = SIZE
    scale = max(tw / img.width, th / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - tw) // 2, (img.height - th) // 2
    img = img.crop((left, top, left + tw, top + th))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=80, method=6)
    return path.stat().st_size


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--per-minute", type=float, default=2)
    args = ap.parse_args()
    if not (ENDPOINT and API_KEY):
        sys.exit("AZURE_OPENAI_IMAGE_* settings missing in backend/.env")

    todo = [(k, OUT_DIR / f"{k}.webp") for k in MAJOR_LABELS if args.force or not (OUT_DIR / f"{k}.webp").exists()]
    print(f"{len(todo)} banners to generate", flush=True)
    pacer = _Pacer(args.per_minute)
    async with httpx.AsyncClient(headers={"api-key": API_KEY}, timeout=180) as client:
        for key, path in todo:
            prompt = f"Subject: {SCENES.get(key, MAJOR_LABELS[key])}, for a '{MAJOR_LABELS[key]}' career page. {STYLE}"
            try:
                size = _save(await _generate(client, prompt, pacer), path)
                print(f"ok   {key} ({size // 1024} KB)", flush=True)
            except Exception as e:
                print(f"FAIL {key}: {e}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
