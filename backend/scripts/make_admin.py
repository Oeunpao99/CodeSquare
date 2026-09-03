"""Grant or revoke /admin-portal access for a user, by email.

    python make_admin.py someone@example.com          # grant
    python make_admin.py someone@example.com --off    # revoke

Runs against the same DATABASE_URL the app uses. In Docker:
    docker compose --env-file .env.prod -f docker/docker-compose.prod.yml \
        run --rm --no-deps backend python make_admin.py someone@example.com
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
import sys

from sqlalchemy import select

from database import async_session
from models.models import User


async def main() -> int:
    args = [a for a in sys.argv[1:] if a]
    off = "--off" in args
    emails = [a for a in args if not a.startswith("-")]
    if len(emails) != 1:
        print(__doc__)
        return 2

    email = emails[0]
    async with async_session() as db:
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if not user:
            print(f"No user with email {email!r}.")
            return 1
        user.is_admin = not off
        await db.commit()
        state = "revoked" if off else "granted"
        print(f"admin {state} for {user.email} (@{user.username}, id={user.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
