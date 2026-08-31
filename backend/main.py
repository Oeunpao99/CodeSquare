import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import auth, lessons, ai, progress, roadmap, docs, projects, challenges, quizzes, career, community, notes, notifications, admin, billing

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are managed by Alembic migrations.
    # Run `alembic upgrade head` before starting the app.
    from routers.admin import ensure_admin_from_env

    await ensure_admin_from_env()  # bootstraps an admin from ADMIN_EMAIL/ADMIN_PASSWORD (no-op if unset)
    yield

app = FastAPI(title="CodeSphere AI Learning Platform", lifespan=lifespan)

# Comma-separated list of allowed browser origins. In production set this to the
# site's public URL(s), e.g. CORS_ORIGINS="https://app.example.com".
_CORS_DEFAULT = "http://localhost:5173,http://localhost:3000"
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _CORS_DEFAULT).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)