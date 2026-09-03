@echo off
echo ======================================================
echo   CodeSphere AI Learning Platform
echo ======================================================
echo.

echo [0/4] Checking dev services (PostgreSQL/Redis/pgAdmin)...
where docker >nul 2>nul
if errorlevel 1 (
    echo   ERROR: Docker not found. Please install Docker Desktop.
    pause
    exit /b 1
)
echo   Starting docker compose dev services...
docker compose -f "%CD%\docker\docker-compose.dev.yml" up -d
echo.

echo [1/4] Running database migrations (Alembic)...
pushd "%CD%\backend"
uv run alembic upgrade head
popd
echo.

echo [2/4] Starting backend (FastAPI) on port 8000...
start "CodeSphere Backend" cmd /k "cd /d %~dp0backend && uv run uvicorn main:app --reload --port 8000"

echo [3/4] Starting frontend (React + Tailwind) on port 5173...
start "CodeSphere Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ======================================================
echo   CodeSphere is starting!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000  (docs at /docs)
echo   pgAdmin  : http://localhost:5050
echo ======================================================
echo.
echo   NOTE: First time? Make sure you've done:
echo     - uv sync          (in backend, installs all Python deps)
echo     - npm install      (in frontend)
echo     - Seeded data: uv run python scripts\seed_data.py   (from the backend folder)
pause