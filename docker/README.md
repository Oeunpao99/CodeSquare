# Deploying CodeSquare with Docker

Two compose files live here:

| File | Purpose |
| --- | --- |
| `docker-compose.dev.yml` | Local dev dependencies only (Postgres, Redis, pgAdmin). App runs on the host. |
| `docker-compose.prod.yml` | Full production stack: Postgres + FastAPI + nginx-served frontend. |

## Production stack

```
┌────────────┐   :HTTP_PORT   ┌─────────────────────┐      ┌──────────────┐
│  internet  │ ─────────────▶ │ frontend (nginx)    │      │              │
└────────────┘                │  • serves Vite build│      │              │
                              │  • proxies /api ────┼────▶ │ backend      │
                              └─────────────────────┘ :8000│ (uvicorn x2) │
                                                           │              │
                                          ┌────────────────┤              │
                                          │  migrate (one-shot: alembic)  │
                                          ▼                └──────┬───────┘
                                     ┌─────────┐                  │
                                     │   db    │ ◀────────────────┘
                                     │ postgres│  volume: pgdata
                                     └─────────┘
```

Only `frontend` publishes a port. Everything else talks over the private compose
network. Run a TLS terminator (Caddy, Traefik, or a cloud load balancer) in front
of `HTTP_PORT` for HTTPS.

## First deploy

```bash
# from the repo root
cp .env.prod.example .env.prod
# edit .env.prod — set POSTGRES_PASSWORD, SECRET_KEY, NOTE_SECRET_KEY,
# CORS_ORIGINS, and your AI provider keys

docker compose --env-file .env.prod -f docker/docker-compose.prod.yml up -d --build
```

Startup order is enforced by healthchecks: `db` becomes healthy → `migrate`
runs `alembic upgrade head` and exits → `backend` starts → `frontend` starts.

The app is then on `http://<host>:${HTTP_PORT}` (default `8080`).

### Seed content (optional, first run only)

The migrations create the schema but no lessons/quizzes/docs. To load the
starter content, run the seed scripts inside a one-off backend container:

```bash
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml \
  run --rm backend python seed_data.py

# and any others you want, e.g.
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml \
  run --rm backend python seed_quizzes.py
```

Each track seeder (`seed_data.py`, `seed_tracks.py`, `seed_linux.py`, …) runs
`backfill_exercises.py` at the end, so every lesson always gets at least one
Practice exercise. Check coverage any time with
`python backfill_exercises.py --verify` (exits non-zero if a lesson lacks one).

## Updates / redeploy

```bash
git pull
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml up -d --build
```

`migrate` re-runs on every `up` and is a no-op when the DB is already at head.

## Operations

```bash
# logs
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml logs -f backend

# status / healthchecks
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml ps

# stop (keeps the pgdata volume)
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml down

# nuke everything incl. the database volume
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml down -v
```

### Database backup / restore

```bash
# backup
docker compose --env-file .env.prod -f docker/docker-compose.prod.yml \
  exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup_$(date +%F).sql.gz

# restore
gunzip -c backup_YYYY-MM-DD.sql.gz | docker compose --env-file .env.prod \
  -f docker/docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## Notes

- **`DATABASE_URL`** is derived automatically from `POSTGRES_*` and points at the
  `db` service. To use a managed Postgres instead, set `DATABASE_URL` in
  `.env.prod` and drop/ignore the `db` service.
- **`VITE_GOOGLE_CLIENT_ID`** is baked into the frontend bundle at build time —
  change it and you must rebuild `frontend`.
- **Workers:** the backend runs `uvicorn --workers 2`. Adjust in
  `backend/Dockerfile` (`CMD`) or override per-service with `command:`.
- **Redis** is in the dev compose but the application code does not use it, so it
  is intentionally absent from the production stack.
