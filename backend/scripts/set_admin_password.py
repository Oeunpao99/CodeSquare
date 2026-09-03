"""Set (or reset) a user's password AND grant /admin-portal access, by email.

    python set_admin_password.py someone@example.com "new-password"

If no user has that email, one is created (username = the email's local part,
plus a number if taken). Safe to re-run.

In Docker:
    docker compose --env-file .env.prod -f docker/docker-compose.prod.yml \
        run --rm --no-deps backend python set_admin_password.py you@example.com "new-password"
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
import sys

from sqlalchemy import select

from database import async_session
from models.models import User
from routers.auth import get_password_hash


async def main() -> int:
    args = [a for a in sys.argv[1:] if a]
    if len(args) != 2:
        print(__doc__)
        return 2
    email, password = args[0].strip(), args[1]
    if len(password) < 6:
        print("Password must be at least 6 characters.")
        return 2

    async with async_session() as db:
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if user is None:
            base = (email.split("@")[0] or "admin")[:30]
            username = base
            n = 1
            while (
                await db.execute(select(User.id).where(User.username == username))
            ).scalar_one_or_none() is not None:
                n += 1
                username = f"{base}{n}"
            user = User(email=email, username=username)
            db.add(user)
            created = True
        else:
            created = False

        user.hashed_password = get_password_hash(password)
        user.is_admin = True
        await db.commit()
        await db.refresh(user)

    verb = "created" if created else "updated"
    print(f"{verb} {user.email} (@{user.username}, id={user.id}) — password set, is_admin=True")
    print("Sign in at /admin-portal with that email and password.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
