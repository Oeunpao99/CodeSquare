"""Connect GitHub and import a repository as a project.

Two ways in:
  * Connect GitHub (OAuth). Lists the user's own repos. Needs GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET and NOTE_SECRET_KEY (the access token is stored
    encrypted with the same Fernet key as the notes vault).
  * Paste a public repo URL. Works without any setup; uses GITHUB_TOKEN when set
    (raises GitHub's anonymous 60 requests/hour limit).

Importing creates a UserProject: description, language, README (Ship step),
repo + homepage links, and the repo's main source file as the project's code.
"""
import io
import os
import re
import zipfile
import secrets
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.models import User, UserProject
from routers.auth import get_current_user, SECRET_KEY, ALGORITHM
from routers.notes import _fernet, vault_configured

router = APIRouter()

API = "https://api.github.com"
APP_URL = (os.getenv("APP_URL", "") or "http://localhost:5173").rstrip("/")
MAX_CODE = 100_000
MAX_README = 20_000


def _client_id() -> str:
    return os.getenv("GITHUB_CLIENT_ID", "").strip()


def _client_secret() -> str:
    return os.getenv("GITHUB_CLIENT_SECRET", "").strip()


def _oauth_enabled() -> bool:
    return bool(_client_id() and _client_secret() and vault_configured())


def _redirect_uri() -> str:
    return os.getenv("GITHUB_REDIRECT_URI", "").strip() or f"{APP_URL}/api/github/callback"


def _headers(token: Optional[str] = None, raw: bool = False) -> dict:
    h = {
        "Accept": "application/vnd.github.raw+json" if raw else "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "codesquare-app",
    }
    token = token or os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _user_token(user: User) -> Optional[str]:
    if not user.github_token:
        return None
    try:
        return _fernet().decrypt(user.github_token.encode()).decode()
    except Exception:
        return None


async def _gh(client: httpx.AsyncClient, path: str, token: Optional[str], raw: bool = False):
    r = await client.get(f"{API}{path}", headers=_headers(token, raw))
    if r.status_code == 404:
        raise HTTPException(404, "Repository not found. Check the name, or connect GitHub for private repos.")
    if r.status_code in (403, 429) and r.headers.get("x-ratelimit-remaining") == "0":
        raise HTTPException(429, "GitHub rate limit reached. Connect GitHub or try again in a while.")
    if r.status_code == 401:
        raise HTTPException(401, "GitHub connection expired. Connect GitHub again.")
    if r.status_code >= 400:
        raise HTTPException(502, "GitHub didn't answer. Try again.")
    return r.text if raw else r.json()


# ---------- connection ----------

class GithubStatus(BaseModel):
    oauth_enabled: bool
    connected: bool
    username: Optional[str] = None


@router.get("/status", response_model=GithubStatus)
async def status(current_user: User = Depends(get_current_user)):
    return GithubStatus(
        oauth_enabled=_oauth_enabled(),
        connected=bool(current_user.github_token),
        username=current_user.github_username,
    )


@router.get("/connect")
async def connect(current_user: User = Depends(get_current_user)):
    """URL to send the browser to. `state` is a short-lived signed token naming the user."""
    if not _oauth_enabled():
        raise HTTPException(503, "Connect GitHub isn't set up on this server yet. Paste a public repo URL instead.")
    state = jwt.encode(
        {"sub": str(current_user.id), "purpose": "github", "nonce": secrets.token_urlsafe(8),
         "exp": datetime.utcnow() + timedelta(minutes=10)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    q = urlencode({
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "scope": "read:user",       # public repos only; no write access
        "state": state,
        "allow_signup": "true",
    })
    return {"url": f"https://github.com/login/oauth/authorize?{q}"}


@router.get("/callback")
async def callback(code: str = "", state: str = "", db: AsyncSession = Depends(get_db)):
    back = f"{APP_URL}/projects"
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "github":
            raise ValueError
        user_id = int(payload["sub"])
    except Exception:
        return RedirectResponse(f"{back}?github=error")
    if not code or not _oauth_enabled():
        return RedirectResponse(f"{back}?github=error")

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={"client_id": _client_id(), "client_secret": _client_secret(),
                  "code": code, "redirect_uri": _redirect_uri()},
        )
        token = (r.json() if r.status_code == 200 else {}).get("access_token")
        if not token:
            return RedirectResponse(f"{back}?github=error")
        me = await client.get(f"{API}/user", headers=_headers(token))
        login = me.json().get("login") if me.status_code == 200 else None

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        return RedirectResponse(f"{back}?github=error")
    user.github_token = _fernet().encrypt(token.encode()).decode()
    user.github_username = login
    await db.commit()
    return RedirectResponse(f"{back}?github=connected")


@router.delete("/connection", status_code=204)
async def disconnect(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.github_token = None
    current_user.github_username = None
    await db.commit()


# ---------- repos ----------

class Repo(BaseModel):
    full_name: str
    name: str
    description: Optional[str] = None
    language: Optional[str] = None
    html_url: str
    homepage: Optional[str] = None
    stars: int = 0
    updated_at: Optional[str] = None
    imported_project_id: Optional[int] = None


async def _imported(db: AsyncSession, user_id: int) -> dict:
    rows = await db.execute(select(UserProject.id, UserProject.ship).where(UserProject.user_id == user_id))
    out = {}
    for pid, ship in rows.all():
        url = ((ship or {}).get("repo_url") or "").rstrip("/").lower()
        if url:
            out[url] = pid
    return out


@router.get("/repos", response_model=List[Repo])
async def repos(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = _user_token(current_user)
    if not token:
        raise HTTPException(400, "Connect GitHub first.")
    async with httpx.AsyncClient(timeout=15) as client:
        data = await _gh(client, "/user/repos?sort=updated&per_page=100&affiliation=owner", token)
    done = await _imported(db, current_user.id)
    return [
        Repo(full_name=r["full_name"], name=r["name"], description=r.get("description"),
             language=r.get("language"), html_url=r["html_url"], homepage=r.get("homepage") or None,
             stars=r.get("stargazers_count") or 0, updated_at=r.get("pushed_at") or r.get("updated_at"),
             imported_project_id=done.get(r["html_url"].rstrip("/").lower()))
        for r in data if not r.get("fork")
    ]


# ---------- import ----------

class ImportBody(BaseModel):
    repo: str   # "owner/name" or a github.com URL


_LANG = {
    "python": "python", "jupyter notebook": "python",
    "javascript": "javascript", "typescript": "javascript", "vue": "javascript",
    "html": "html", "css": "html", "scss": "html",
    "shell": "bash", "powershell": "bash",
}
_ENTRY = {
    "python": ["main.py", "app.py", "src/main.py", "app/main.py", "manage.py", "run.py", "bot.py"],
    "javascript": ["src/App.jsx", "src/App.tsx", "src/App.js", "index.js", "src/index.js", "src/main.jsx",
                   "src/main.ts", "server.js", "app.js", "src/index.ts", "index.ts"],
    "html": ["index.html", "public/index.html", "src/index.html"],
    "bash": ["install.sh", "main.sh", "run.sh"],
}
_SRC_EXT = (".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".sh", ".java", ".go", ".rb", ".php", ".cs", ".cpp", ".c", ".sql")


def _parse_repo(text: str) -> str:
    t = text.strip().removesuffix(".git").rstrip("/")
    m = re.match(r"^(?:https?://)?(?:www\.)?github\.com/([\w.-]+)/([\w.-]+)", t, re.I)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    if re.fullmatch(r"[\w.-]+/[\w.-]+", t):
        return t
    raise HTTPException(400, "Use a GitHub link like https://github.com/owner/repo")


def _pick_entry(paths: List[str], lang: str) -> Optional[str]:
    lower = {p.lower(): p for p in paths}
    for cand in _ENTRY.get(lang, []):
        if cand.lower() in lower:
            return lower[cand.lower()]
    skip = ("node_modules/", "dist/", "build/", ".venv/", "venv/", "test", "migrations/", ".github/",
            "docs/", "doc/", "example", "scripts/", "setup.py", "conftest", "conf.py", "config", "__init__.py")
    src = [p for p in paths if p.endswith(_SRC_EXT) and not any(s in p.lower() for s in skip)]
    # prefer real source folders, then shallow, then short names
    src.sort(key=lambda p: (not p.lower().startswith(("src/", "app/", "lib/")), p.count("/"), len(p)))
    return src[0] if src else None


# Which files to bring in from a repo: source + config text, nothing generated.
_TEXT_EXT = {
    "py", "ipynb", "js", "jsx", "mjs", "cjs", "ts", "tsx", "vue", "svelte", "html", "htm", "css", "scss",
    "sass", "less", "json", "md", "txt", "yml", "yaml", "toml", "ini", "cfg", "env.example", "sql", "sh",
    "bat", "ps1", "java", "kt", "go", "rs", "rb", "php", "c", "h", "cpp", "hpp", "cs", "swift", "xml",
    "svg", "csv", "dax", "pq", "m", "r", "dockerfile", "gitignore", "editorconfig", "prettierrc",
    "eslintrc", "babelrc", "npmrc", "lock",
}
_TEXT_NAMES = {"dockerfile", "makefile", "procfile", "license", ".gitignore", ".env.example", ".dockerignore",
               "requirements.txt", "pipfile", "gemfile"}
_SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".nuxt", "out", "coverage", "__pycache__",
              ".venv", "venv", "env", ".idea", ".vscode", "vendor", "target", ".pytest_cache", ".mypy_cache"}
_SKIP_NAMES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock"}
MAX_ZIP = 40 * 1024 * 1024
MAX_FILES = 300
MAX_ONE = 200_000
MAX_TOTAL = 3_500_000


def _wanted(path: str) -> bool:
    parts = path.split("/")
    if any(x in _SKIP_DIRS for x in parts[:-1]):
        return False
    name = parts[-1].lower()
    if name in _SKIP_NAMES or name.endswith((".min.js", ".min.css", ".map")):
        return False
    if name in _TEXT_NAMES:
        return True
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    return ext in _TEXT_EXT or name.startswith(".") and name.lstrip(".") in _TEXT_EXT


async def _repo_files(client: httpx.AsyncClient, full: str, branch: str, token: Optional[str]):
    """Download the repo as one zip (a single API request) and keep its text files."""
    r = await client.get(f"{API}/repos/{full}/zipball/{branch}", headers=_headers(token), follow_redirects=True)
    if r.status_code >= 400:
        raise HTTPException(502, "GitHub didn't send the repository files. Try again.")
    if len(r.content) > MAX_ZIP:
        raise HTTPException(413, "This repository is too large to import (40 MB limit).")
    files, skipped, total = [], 0, 0
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        for info in sorted(zf.infolist(), key=lambda i: (i.filename.count("/"), i.filename)):
            if info.is_dir():
                continue
            path = info.filename.split("/", 1)[1] if "/" in info.filename else info.filename  # drop "owner-repo-sha/"
            if not path or not _wanted(path):
                skipped += 1
                continue
            if info.file_size > MAX_ONE or len(files) >= MAX_FILES or total + info.file_size > MAX_TOTAL:
                skipped += 1
                continue
            try:
                text = zf.read(info).decode("utf-8")
            except (UnicodeDecodeError, KeyError):
                skipped += 1
                continue
            if "\x00" in text:
                skipped += 1
                continue
            total += len(text)
            files.append({"path": path, "content": text})
    files.sort(key=lambda f: f["path"].lower())
    return files, skipped


@router.post("/import", status_code=201)
async def import_repo(body: ImportBody, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    full = _parse_repo(body.repo)
    token = _user_token(current_user)

    async with httpx.AsyncClient(timeout=20) as client:
        meta = await _gh(client, f"/repos/{full}", token)
        url = meta["html_url"]
        existing = (await _imported(db, current_user.id)).get(url.rstrip("/").lower())
        if existing:
            raise HTTPException(409, detail={"message": "Already imported.", "project_id": existing})

        gh_lang = (meta.get("language") or "").lower()
        lang = _LANG.get(gh_lang, gh_lang or "python")

        try:
            readme = (await _gh(client, f"/repos/{full}/readme", token, raw=True))[:MAX_README]
        except HTTPException:
            readme = ""

        files, skipped = await _repo_files(client, full, meta.get("default_branch") or "main", token)
        entry = _pick_entry([f["path"] for f in files], lang) or (files[0]["path"] if files else None)
        code = next((f["content"] for f in files if f["path"] == entry), "")
        if entry and entry.endswith((".jsx", ".tsx")) and lang == "javascript":
            lang = "react"

    title = re.sub(r"[-_]+", " ", meta["name"]).strip()
    title = title[:1].upper() + title[1:]
    notes = (f"Imported from [{full}]({url}): {len(files)} files"
             + (f", main file `{entry}`" if entry else "") + ".\n")
    project = UserProject(
        user_id=current_user.id,
        title=title,
        description=(meta.get("description") or "")[:500] or None,
        language=lang,
        code=code,
        files=files,
        entry=entry,
        notes=notes,
        tasks=[],
        status="active",
        pinned=False,
        ship={k: v for k, v in {"repo_url": url, "demo_url": (meta.get("homepage") or "") if (meta.get("homepage") or "").startswith(("http://", "https://")) else None, "readme": readme or None}.items() if v},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {"id": project.id, "title": project.title, "entry": entry, "files": len(files), "skipped": skipped}
