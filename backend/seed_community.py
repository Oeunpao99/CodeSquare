"""Seed the Dev Community feed with a few sample learners + posts, so the
/community page has real-looking content to look at.

Idempotent-ish: users are matched by email and reused; posts are only added if
that user has none yet.

    python seed_community.py
"""
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import func, select

from database import async_session
from models.models import Post, PostComment, PostReaction, User
from routers.auth import get_password_hash

PASSWORD = "codesquare123"

LEARNERS = [
    dict(
        email="mara.dev@example.com", username="maradev", display_name="Mara O.",
        major="backend-engineer", headline="Learning backend in public · ex-teacher",
        github_url="https://github.com/maradev",
    ),
    dict(
        email="kai.builds@example.com", username="kaibuilds", display_name="Kai N.",
        major="web-developer", headline="Frontend + design. Building small apps to learn.",
        website_url="https://kai.dev",
    ),
    dict(
        email="sol.learns@example.com", username="sollearns", display_name="Sol R.",
        major="ai-engineer", headline="Career switcher → AI engineer. Day 40.",
    ),
    dict(
        email="devi.codes@example.com", username="devicodes", display_name="Devi P.",
        major="data-science", headline="SQL, pandas, and a lot of coffee.",
    ),
]

# (author_index, kind, body, tags, link_url)
POSTS = [
    (2, "progress",
     "Day 40 — finally *got* recursion. The trick that unlocked it for me: stop "
     "trying to trace every call in your head. Trust that `factorial(n-1)` returns "
     "the right thing, and just define the one step + the base case.\n\n"
     "```python\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n```\n\n"
     "Base case first, always.",
     ["python", "recursion"], None),

    (0, "idea",
     "How I finally understood **database indexes**:\n\n"
     "- A table with no index = the DB reads every row to find matches (a *full scan*).\n"
     "- An index is a sorted copy of one/few columns + a pointer back to the row.\n"
     "- So `WHERE email = ?` on an indexed `email` goes straight there instead of scanning.\n"
     "- The cost: every `INSERT`/`UPDATE` also has to update the index.\n\n"
     "Rule of thumb: index the columns you filter or join on, not the ones you only ever `SELECT`.",
     ["sql", "databases", "performance"], None),

    (1, "showcase",
     "Built a tiny **habit tracker** this weekend — plain HTML/CSS/JS, no framework, "
     "state in `localStorage`. First thing I've made that I actually use every day.\n\n"
     "Would love feedback on the JS structure — it's one big file right now and I "
     "know that won't scale.",
     ["javascript", "html-css", "project"], "https://github.com/kaibuilds/habit-tracker"),

    (3, "question",
     "Stuck on a JOIN. I want every customer **and** their order count, including "
     "customers with zero orders. My inner join drops the zero-order ones:\n\n"
     "```sql\nSELECT c.name, COUNT(o.id)\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;\n```\n\n"
     "What am I missing?",
     ["sql", "help"], None),

    (0, "progress",
     "Shipped my first real **FastAPI** endpoint today — `POST /tasks` with a Pydantic "
     "model, writing to Postgres through SQLAlchemy. Seeing the row show up in the DB "
     "after the request felt like magic.\n\n"
     "Next: auth, then Docker.",
     ["python", "fastapi", "backend"], None),

    (2, "idea",
     "Reminder to past-me: `git commit` early and often. Small commits with clear "
     "messages have saved me from three separate rabbit holes this week — I just "
     "`git reset` back to the last good one instead of debugging my own mess.",
     ["git", "workflow"], None),

    (1, "question",
     "CSS flexbox: my three cards won't wrap onto a new line on small screens, they "
     "just squish. `display: flex` on the container, cards have a fixed width. "
     "What's the missing property?",
     ["css", "flexbox", "help"], None),
]

# (post_index, commenter_index, text)
COMMENTS = [
    (3, 0, "You need a LEFT JOIN instead of JOIN — that keeps every customer row even "
           "when there's no matching order. Also `COUNT(o.id)` (not `COUNT(*)`) so the "
           "zero-order rows count as 0."),
    (3, 2, "^ this. And GROUP BY c.id, c.name is safer than grouping by name alone."),
    (6, 3, "Add `flex-wrap: wrap;` to the flex container. Without it flex defaults to "
           "`nowrap` and shrinks the items instead."),
    (2, 0, "Nice! For the 'one big file' problem — pull the localStorage read/write "
           "into two functions first, that's usually the cleanest first split."),
    (1, 3, "This is a great explanation. The 'sorted copy + pointer' framing finally made it click for me too."),
    (4, 2, "Congrats — that first DB write is such a good feeling. Docker next is the right call."),
]

# (post_index, [liker_indexes])
LIKES = [
    (0, [0, 1, 3]),
    (1, [1, 2, 3]),
    (2, [0, 2, 3]),
    (3, [0, 2]),
    (4, [1, 2, 3]),
    (5, [0, 1]),
    (6, [3]),
]


async def _get_or_make_user(db, spec):
    u = (await db.execute(select(User).where(User.email == spec["email"]))).scalar_one_or_none()
    if u:
        return u, False
    u = User(
        email=spec["email"],
        username=spec["username"],
        hashed_password=get_password_hash(PASSWORD),
        display_name=spec.get("display_name"),
        headline=spec.get("headline"),
        github_url=spec.get("github_url"),
        website_url=spec.get("website_url"),
        major=spec.get("major"),
        onboarded_at=datetime.utcnow(),
    )
    db.add(u)
    await db.flush()
    return u, True


async def seed_community():
    async with async_session() as db:
        users = []
        made = 0
        for spec in LEARNERS:
            u, created = await _get_or_make_user(db, spec)
            users.append(u)
            made += int(created)
        await db.flush()
        print(f"users: {made} created, {len(users) - made} reused")

        # skip if these learners already have posts
        existing = (
            await db.execute(
                select(func.count()).select_from(Post).where(
                    Post.user_id.in_([u.id for u in users])
                )
            )
        ).scalar() or 0
        if existing:
            print(f"already {existing} post(s) from these learners — nothing added.")
            await db.commit()
            return

        now = datetime.utcnow()
        posts = []
        for i, (ai, kind, body, tags, link) in enumerate(POSTS):
            p = Post(
                user_id=users[ai].id,
                kind=kind,
                body=body,
                tags=tags,
                link_url=link,
                created_at=now - timedelta(hours=(len(POSTS) - i) * 7 + 1),
            )
            db.add(p)
            posts.append(p)
        await db.flush()

        for pi, cri, text in COMMENTS:
            db.add(
                PostComment(
                    post_id=posts[pi].id,
                    user_id=users[cri].id,
                    body=text,
                    created_at=posts[pi].created_at + timedelta(hours=2),
                )
            )

        for pi, likers in LIKES:
            for li in likers:
                db.add(PostReaction(post_id=posts[pi].id, user_id=users[li].id))

        await db.commit()
        print(f"posts: {len(posts)} · comments: {len(COMMENTS)} · likes: {sum(len(l) for _, l in LIKES)}")
        print(f"\nsample logins (password '{PASSWORD}'):")
        for u in users:
            print(f"  {u.email}  ({u.display_name})")


if __name__ == "__main__":
    asyncio.run(seed_community())
