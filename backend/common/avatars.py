"""Illustrated default avatars (original flat-style SVG portraits).

A user without a photo gets `/api/avatars/<style>/<seed>.svg`. The picture is
drawn here from a hash of the seed (the user id), so it is stable for a user
and varied across users: background, skin tone, hair colour and cut, shirt,
glasses. `style` is the look the user picked at onboarding:
woman | man | neutral (default neutral).
"""
import hashlib
from typing import Optional

STYLES = ("woman", "man", "neutral")

_BG = ["#c084fc", "#fb923c", "#60a5fa", "#34d399", "#2dd4bf", "#f472b6", "#f87171", "#a3e635", "#facc15", "#818cf8"]
_SKIN = ["#f8d9c0", "#f1c7a3", "#e0ac83", "#c68b62", "#a5694a", "#7d4b33"]
_HAIR = ["#1f1b1a", "#3b2a20", "#5b3a24", "#8a5a33", "#b07d48", "#2b2b3a", "#6b2f2f"]
_SHIRT = ["#1e3a8a", "#0f766e", "#7c2d12", "#4c1d95", "#9f1239", "#334155", "#166534", "#b45309"]


def avatar_url(style: Optional[str], seed) -> str:
    st = style if style in STYLES else "neutral"
    return f"/api/avatars/{st}/{seed}.svg"


def effective_avatar(u) -> str:
    """Uploaded photo, else OAuth picture, else the illustrated default."""
    return u.avatar_data or u.avatar_url or avatar_url(getattr(u, "avatar_style", None), u.id)


def _pick(h: bytes, i: int, options):
    return options[h[i] % len(options)]


def render(style: str, seed: str) -> str:
    st = style if style in STYLES else "neutral"
    h = hashlib.sha256(f"{st}:{seed}".encode()).digest()
    bg, skin, hair, shirt = _pick(h, 0, _BG), _pick(h, 1, _SKIN), _pick(h, 2, _HAIR), _pick(h, 3, _SHIRT)
    cut = h[4] % 3
    glasses = h[5] % 5 == 0
    beard = st == "man" and h[6] % 4 == 0
    earrings = st == "woman" and h[7] % 2 == 0

    back, front = "", ""
    if st == "woman":
        if cut == 0:    # long hair
            back = f'<path d="M33 54C30 27 47 20 60 20s30 7 27 34l3 34c-8 5-16 3-19-3H52c-3 6-11 8-19 3z" fill="{hair}"/>'
            front = f'<path d="M37 50c0-15 10-24 23-24s23 9 23 24c-6-8-14-12-22-12-7 0-17 4-24 12z" fill="{hair}"/>'
        elif cut == 1:  # bob
            back = f'<path d="M34 54C31 28 47 21 60 21s29 7 26 33l2 20c-6 4-12 3-15 0V58H47v16c-3 3-9 4-15 0z" fill="{hair}"/>'
            front = f'<path d="M37 52c-1-16 10-26 23-26s24 10 23 26c-3-9-12-14-23-14S40 43 37 52z" fill="{hair}"/>'
        else:           # bun
            back = f'<circle cx="60" cy="20" r="10" fill="{hair}"/>'
            front = f'<path d="M37 52c-1-17 10-26 23-26s24 9 23 26c-4-10-13-15-23-15S41 42 37 52z" fill="{hair}"/>'
    elif st == "man":
        if cut == 0:    # short crop
            front = f'<path d="M37 50c-2-17 10-26 23-26 14 0 25 9 23 26-3-8-11-13-23-13S40 42 37 50z" fill="{hair}"/>'
        elif cut == 1:  # quiff
            front = f'<path d="M37 51c-3-18 8-29 25-28 9 0 15 3 18 9 3 5 4 11 3 19-4-8-10-12-18-12-3 3-8 4-14 3-6 2-11 5-14 9z" fill="{hair}"/>'
        else:           # buzz
            front = f'<path d="M38 49c-1-15 9-23 22-23s23 8 22 23c-4-7-12-11-22-11s-18 4-22 11z" fill="{hair}" opacity=".85"/>'
    else:  # neutral
        if cut == 0:    # beanie
            front = (f'<path d="M36 47c0-15 11-24 24-24s24 9 24 24z" fill="{shirt}"/>'
                     f'<rect x="34" y="44" width="52" height="8" rx="4" fill="{bg}" opacity=".9"/>')
        elif cut == 1:  # medium, side-swept
            back = f'<path d="M35 56C32 30 47 21 60 21s29 9 26 35l-2 8-6-2V50H42v12l-6 2z" fill="{hair}"/>'
            front = f'<path d="M37 51c0-16 11-25 23-25s23 9 23 25c-9-2-18-7-24-13-4 6-12 11-22 13z" fill="{hair}"/>'
        else:           # curly
            front = "".join(f'<circle cx="{x}" cy="{y}" r="8" fill="{hair}"/>' for x, y in
                            ((41, 42), (49, 32), (60, 28), (71, 32), (79, 42), (55, 36), (66, 36)))

    eyes = ('<circle cx="51.5" cy="55" r="2.4" fill="#1f2937"/>'
            '<circle cx="68.5" cy="55" r="2.4" fill="#1f2937"/>')
    lashes = ('<path d="M48 52.5l-2-1.5M71.5 52.5l2-1.5" stroke="#1f2937" stroke-width="1.3" stroke-linecap="round"/>'
              if st == "woman" else "")
    specs = ('<g fill="none" stroke="#111827" stroke-width="1.8"><circle cx="51.5" cy="55" r="6"/>'
             '<circle cx="68.5" cy="55" r="6"/><path d="M57.5 55h5"/></g>') if glasses else ""
    whiskers = (f'<path d="M44 60c2 12 9 17 16 17s14-5 16-17c-3 5-9 7-16 7s-13-2-16-7z" fill="{hair}" opacity=".9"/>'
                if beard else "")
    rings = ('<circle cx="38" cy="64" r="2" fill="#fbbf24"/><circle cx="82" cy="64" r="2" fill="#fbbf24"/>'
             if earrings else "")

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><clipPath id="c"><circle cx="60" cy="60" r="60"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="120" height="120" fill="{bg}"/>
<g transform="translate(-11 -3) scale(1.18)">
{back}
<path d="M22 124c0-24 17-38 38-38s38 14 38 38z" fill="{shirt}"/>
<path d="M51 86l9 10 9-10z" fill="{skin}"/>
<rect x="52" y="70" width="16" height="17" rx="6" fill="{skin}"/>
<circle cx="38" cy="57" r="5" fill="{skin}"/><circle cx="82" cy="57" r="5" fill="{skin}"/>
<ellipse cx="60" cy="55" rx="22" ry="24" fill="{skin}"/>
{whiskers}
<circle cx="46" cy="63" r="3.6" fill="#f43f5e" opacity=".18"/><circle cx="74" cy="63" r="3.6" fill="#f43f5e" opacity=".18"/>
{eyes}{lashes}
<path d="M47 48.5q4.5-2.5 9 0M64 48.5q4.5-2.5 9 0" stroke="{hair}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M53.5 66q6.5 5 13 0" stroke="#7c2d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>
{specs}{rings}
{front}
</g>
</g>
</svg>"""
