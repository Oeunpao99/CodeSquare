# backend/scripts

One-shot **seed** and **maintenance** scripts. Not imported by the app — run by
hand (or by the `seed` service in `docker/docker-compose.prod.yml`).

Run them from the **`backend/`** directory so the app modules resolve:

```bash
cd backend
./.venv/Scripts/python.exe scripts/seed_data.py        # Windows
# or
uv run python scripts/seed_data.py
```

Each script imports `_bootstrap` first, which puts `backend/` on `sys.path` so
`from database import ...` / `from models.models import ...` work no matter where
the script is launched from.

## Content-seed order (matches the prod `seed` service)

```
seed_data → seed_bases → seed_python_adv → seed_react → seed_linux → seed_tracks
→ seed_fullstack → seed_sql_data → seed_dsa → seed_ai_llm
→ retag_curriculum → backfill_exercises → seed_docs
→ seed_challenges → seed_debug_challenges → seed_quizzes
```

Then optionally: `seed_community`, `seed_profile_demo` (demo users), `make_admin`
/ `set_admin_password` (admin bootstrap), `verify_roadmap` (smoke-check, needs a
running server).

All seeds are idempotent — safe to re-run.
