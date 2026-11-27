"""Illustrated default avatars: GET /api/avatars/{style}/{seed}.svg (public, cacheable)."""
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from common.avatars import STYLES, render

router = APIRouter()


@router.get("/{style}/{seed}.svg")
async def avatar_svg(style: str, seed: str):
    if style not in STYLES or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", seed):
        raise HTTPException(status_code=404)
    return Response(
        render(style, seed),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
