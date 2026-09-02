import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from routers import (
    auth, lessons, ai, progress, roadmap, docs, projects, challenges,
    quizzes, career, community, notes, notifications, admin, billing,
)

# --------------------------------------------------------------------------- #
#  Environment
# --------------------------------------------------------------------------- #
ENV = os.getenv("ENV", "production").strip().lower()
IS_DEV = ENV in {"dev", "development", "local", "test"}
TRUST_PROXY = os.getenv("TRUST_PROXY", "").strip().lower() in {"1", "true", "yes", "on"}

# Comma-separated list of allowed browser origins. In production set this to the
# site's public URL(s), e.g. CORS_ORIGINS="https://app.example.com".
_CORS_DEFAULT = "http://localhost:5173,http://localhost:3000"
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _CORS_DEFAULT).split(",") if o.strip()]

# Host header allow-list (defence against Host-header injection / cache poisoning).
_allowed_hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h.strip()] or ["*"]

# Reject obviously-oversized request bodies up front (bytes).
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(6 * 1024 * 1024)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are managed by Alembic migrations. Run `alembic upgrade head` first.
    from routers.admin import ensure_admin_from_env

    await ensure_admin_from_env()  # bootstraps an admin from ADMIN_EMAIL/ADMIN_PASSWORD (no-op if unset)
    yield


app = FastAPI(
    title="CodeSphere AI Learning Platform",
    lifespan=lifespan,
    # Don't publish the full API surface / interactive console in production.
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    openapi_url="/openapi.json" if IS_DEV else None,
)

if _allowed_hosts != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)


# --------------------------------------------------------------------------- #
#  Lightweight in-process IP rate limiter
#
#  A stop-gap so unauthenticated endpoints (login / register / admin) aren't a
#  free brute-force / flood target. It is PER PROCESS — with multiple workers or
#  instances the real limits must come from a shared store (Redis + slowapi) or
#  the edge (nginx / Cloudflare / API gateway). Volumetric L3/L4 DDoS still
#  needs a WAF/CDN in front.
# --------------------------------------------------------------------------- #
_BUCKETS: dict[str, list[float]] = defaultdict(list)
_LAST_PRUNE = [time.monotonic()]

# (path prefix, max requests, window seconds) — first match wins.
_RULES = [
    ("/api/auth/login", 10, 60),
    ("/api/auth/register", 5, 300),
    ("/api/auth/google", 20, 60),
    ("/api/admin/login", 5, 300),
    ("/api/auth", 30, 60),
    ("/api/admin", 60, 60),
    ("/api/ai", 60, 60),
    ("/api", 300, 60),  # global backstop
]


def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rule_for(path: str):
    for prefix, limit, window in _RULES:
        if path.startswith(prefix):
            return prefix, limit, window
    return None


@app.middleware("http")
async def guard(request: Request, call_next):
    # 1) body-size backstop (Content-Length is enough for the common case)
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request body too large."}, status_code=413)

    # 2) rate limit
    rule = _rule_for(request.url.path)
    if rule and request.method != "OPTIONS":
        prefix, limit, window = rule
        now = time.monotonic()
        key = f"{prefix}|{_client_ip(request)}"
        hits = [t for t in _BUCKETS[key] if now - t < window]
        if len(hits) >= limit:
            retry = max(1, int(window - (now - hits[0])))
            return JSONResponse(
                {"detail": "Too many requests — slow down and try again."},
                status_code=429,
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)
        _BUCKETS[key] = hits

        # occasional GC so the dict can't grow without bound
        if now - _LAST_PRUNE[0] > 300:
            _LAST_PRUNE[0] = now
            for k in [k for k, v in _BUCKETS.items() if not v or now - v[-1] > 3600]:
                _BUCKETS.pop(k, None)

    resp = await call_next(request)

    # 3) security headers
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    resp.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if not IS_DEV:
        resp.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return resp


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(lessons.router, prefix="/api/lessons", tags=["Lessons"])
app.include_router(ai.router, prefix="/api/ai", tags=["CodeSquareAgent"])
app.include_router(progress.router, prefix="/api/progress", tags=["Progress"])
app.include_router(roadmap.router, prefix="/api/roadmap", tags=["Roadmap"])
app.include_router(docs.router, prefix="/api/docs", tags=["Library"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(challenges.router, prefix="/api/challenges", tags=["Challenges"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["Quizzes"])
app.include_router(career.router, prefix="/api/career", tags=["Career"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(notes.router, prefix="/api/notes", tags=["CodeSquareNote"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])


@app.get("/")
async def root():
    return {"message": "CodeSphere AI Learning Platform API", "version": "1.0.0"}


@app.get("/healthz")
async def healthz():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
