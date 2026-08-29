"""Give every exercise-less lesson one small, checkable exercise.

Whole modules (all of Backend Foundations, JS module 3-4, HTML module 3, parts
of Python) shipped with lesson prose but no Exercise, so those lessons — and
their Library articles — could never be completed. This adds one exercise each,
reusing the lesson's own starter_code / solution.

Checks are deliberately light: the runner exposes the raw submission as `code`,
so most tests are "did you use X" token checks; Python lessons that leave a
variable behind get a real assertion. Enough to mark the lesson done without
being a puzzle.

Idempotent — skips any lesson that already has an exercise.

    python backfill_exercises.py
"""
import asyncio

from sqlalchemy import select, func

from database import async_session
from models.models import Lesson, Exercise


def C(*subs):
    """Token checks against the raw source (case-insensitive)."""
    return [
        {"description": f"uses `{s}`", "test": f"{s.lower()!r} in code.lower()"}
        for s in subs
    ]


def A(desc, expr):
    """A Python assertion evaluated after the submission runs."""
    return {"description": desc, "test": f"assert {expr}"}


NOSPACE = "code.replace(' ', '').lower()"

SPECS = {
    # ---- python ----
    60: dict(
        title="Both positive?",
        description="Set `both_positive` to True only when both `a` and `b` are greater than 0.",
        tests=[A("both_positive matches a>0 and b>0", "both_positive == (a > 0 and b > 0)")],
        hints=["Combine two comparisons with `and`", "`both_positive = a > 0 and b > 0`"],
    ),
    61: dict(
        title="Count to five",
        description="Use a `while` loop to print the numbers 1 through 5.",
        tests=C("while", "print")
        + [{"description": "advances the counter", "test": f"'+=1' in {NOSPACE} or 'i=i+1' in {NOSPACE}"}],
        hints=["Start with `i = 1`", "Increase `i` inside the loop or it runs forever"],
    ),
    63: dict(
        title="First three",
        description="Print the first three items of `nums` using a slice.",
        tests=[A("prints nums[:3]", "nums[:3] == [4, 8, 15]")],
        hints=["Slicing looks like `nums[:3]`"],
    ),
    66: dict(
        title="Word count",
        description="Print how many words are in `sentence` (split on spaces, then count).",
        tests=C(".split()", "len("),
        hints=["`sentence.split()` gives a list of words", "`len(...)` counts them"],
    ),
    67: dict(
        title="Define banner()",
        description="Define a function `banner()` that prints a header, then call it.",
        tests=C("def banner", "banner()"),
        hints=["`def banner():` then an indented `print(...)`", "Call it on its own line: `banner()`"],
    ),
    69: dict(
        title="Join with a separator",
        description="Write `join(parts, sep='-')` that returns the parts joined by `sep`.",
        tests=[
            A("default separator works", "join(['a', 'b', 'c']) == 'a-b-c'"),
            A("custom separator works", "join(['a', 'b'], '/') == 'a/b'"),
        ],
        hints=["Give `sep` a default in the signature: `sep='-'`", "`return sep.join(parts)`"],
    ),
    65: dict(
        title="Restock the pens",
        description="Add 2 to the `'pen'` count in `inventory`, then print the dict.",
        tests=[A("pen count increased by 2", "inventory['pen'] == 5")],
        hints=["`inventory['pen'] += 2`"],
    ),
    # ---- javascript ----
    72: dict(
        title="Template literal",
        description="Use a backtick template literal to log `Area: <w*h>`.",
        tests=C("${") + [{"description": "uses backticks", "test": "'`' in code"}],
        hints=["Wrap the string in backticks: `` `...` ``", "Embed with `${ w * h }`"],
    ),
    73: dict(
        title="In range?",
        description="Log whether `score` is between 70 and 100 (inclusive) using `&&`.",
        tests=C("&&", ">="),
        hints=["`score >= 70 && score <= 100`"],
    ),
    74: dict(
        title="Coerce then add",
        description="Convert the string `raw` to a number and log it plus 8.",
        tests=C("number("),
        hints=["`Number(raw)` turns '42' into 42"],
    ),
    75: dict(
        title="Loop 1..5",
        description="Use a `for` loop to log the numbers 1 through 5.",
        tests=C("for (", "console.log"),
        hints=["`for (let i = 1; i <= 5; i++)`"],
    ),
    76: dict(
        title="Last item",
        description="Log the last element of the `names` array using `.length`.",
        tests=C(".length"),
        hints=["`names[names.length - 1]`"],
    ),
    77: dict(
        title="Filter the big ones",
        description="Log the items of `prices` greater than 20 using `.filter()`.",
        tests=C(".filter("),
        hints=["`prices.filter(p => p > 20)`"],
    ),
    78: dict(
        title="Object fields",
        description="Given `p = { x, y }`, log `p.x + p.y`.",
        tests=C("p.x", "p.y"),
        hints=["Access fields with a dot: `p.x`"],
    ),
    79: dict(
        title="Arrow function",
        description="Write `toCents` as an arrow function that rounds dollars to whole cents.",
        tests=C("=>", "math.round"),
        hints=["`const toCents = d => Math.round(d * 100)`"],
    ),
    80: dict(
        title="forEach callback",
        description="Use `.forEach()` to log each number in `nums` doubled.",
        tests=C(".foreach("),
        hints=["`nums.forEach(n => console.log(n * 2))`"],
    ),
    81: dict(
        title="Set text content",
        description="Select `#status` and set its `textContent` to `'ready'`.",
        tests=C("queryselector", "textcontent"),
        hints=["`document.querySelector('#status')`", "`.textContent = 'ready'`"],
    ),
    82: dict(
        title="Wire a click",
        description="Add a click listener to the button with `addEventListener`.",
        tests=C("addeventlistener"),
        hints=["`btn.addEventListener('click', () => { ... })`"],
    ),
    # ---- html-css ----
    84: dict(
        title="A link",
        description="Write an anchor tag linking to a URL.",
        tests=C("<a ", "href="),
        hints=["`<a href=\"https://...\">text</a>`"],
    ),
    86: dict(
        title="A tiny form",
        description="Write a `<form>` with a text `<input>` and a `<button>`.",
        tests=C("<form", "<input", "<button"),
        hints=["Inputs need a `type`: `<input type=\"text\">`"],
    ),
    88: dict(
        title="Style a heading",
        description="Give `h1` a `font-size` and center it with `text-align`.",
        tests=C("font-size", "text-align"),
        hints=["`h1 { font-size: 32px; text-align: center; }`"],
    ),
    89: dict(
        title="Flex row",
        description="Make `.row` a flex container with a `gap`.",
        tests=C("display", "flex", "gap"),
        hints=["`.row { display: flex; gap: 8px; }`"],
    ),
    90: dict(
        title="Profile card markup",
        description="Write an `<article>` with a class, a name and a role.",
        tests=C("<article", "class="),
        hints=["`<article class=\"card\"> ... </article>`"],
    ),
    87: dict(
        title="Box model padding",
        description="Give `.note` some `padding`.",
        tests=C(".note", "padding"),
        hints=["`.note { padding: 20px; }`"],
    ),
    # ---- backend-foundations ----
    30: dict(
        title="Create a table",
        description="Write a `CREATE TABLE posts` statement with an id, title and body.",
        tests=C("create table", "posts"),
        hints=["`CREATE TABLE posts ( id ..., title ..., body ... );`"],
    ),
    31: dict(
        title="A SELECT with a filter",
        description="Write a `SELECT ... FROM ... WHERE ...` query.",
        tests=C("select", "from", "where"),
        hints=["`SELECT col FROM table WHERE condition;`"],
    ),
    32: dict(
        title="Apply migrations",
        description="Give the command that applies all pending migrations.",
        tests=C("alembic", "upgrade", "head"),
        hints=["`alembic upgrade head`"],
    ),
    33: dict(
        title="Add a column",
        description="In `upgrade()`, add a nullable `summary` TEXT column to `posts`.",
        tests=C("add_column", "summary"),
        hints=["`op.add_column('posts', sa.Column('summary', sa.Text(), nullable=True))`"],
    ),
    34: dict(
        title="A health route",
        description="Add a `GET /health` route that returns `{\"status\": \"ok\"}`.",
        tests=C("@app.get", "/health"),
        hints=["`@app.get('/health')` above a function that returns the dict"],
    ),
    35: dict(
        title="A request model",
        description="Model `UserIn` with `email: str` and `age: int`.",
        tests=C("basemodel", "email", "age"),
        hints=["`class UserIn(BaseModel):` then the two typed fields"],
    ),
    36: dict(
        title="Where are the docs?",
        description="Give the path FastAPI serves interactive Swagger docs on.",
        tests=C("/docs"),
        hints=["It's `/docs` (ReDoc is `/redoc`)"],
    ),
    37: dict(
        title="curl method flag",
        description="Give the `curl` flag that sets the HTTP method.",
        tests=C("-x"),
        hints=["`curl -X POST ...`"],
    ),
    38: dict(
        title="Compose up",
        description="Give the command that builds and starts everything in the background.",
        tests=C("docker compose up", "--build"),
        hints=["`docker compose up --build -d`"],
    ),
    39: dict(
        title="When does CI run?",
        description="One word: the git event that typically triggers a CI pipeline.",
        tests=C("push"),
        hints=["Every `git push`"],
    ),
    40: dict(
        title="New branch",
        description="Create and switch to a new branch called `fix/typo`.",
        tests=C("git switch", "-c"),
        hints=["`git switch -c fix/typo`"],
    ),
    41: dict(
        title="Generate an SSH key",
        description="Give the command that generates a modern ed25519 SSH key.",
        tests=C("ssh-keygen", "ed25519"),
        hints=["`ssh-keygen -t ed25519 -C \"you@example.com\"`"],
    ),
}


async def backfill() -> None:
    async with async_session() as db:
        added = skipped = missing = 0
        for lesson_id, spec in SPECS.items():
            lesson = (
                await db.execute(select(Lesson).where(Lesson.id == lesson_id))
            ).scalar_one_or_none()
            if not lesson:
                missing += 1
                print(f"  lesson {lesson_id}: not found, skipped")
                continue

            has = (
                await db.execute(
                    select(func.count()).select_from(Exercise).where(Exercise.lesson_id == lesson_id)
                )
            ).scalar()
            if has:
                skipped += 1
                continue

            db.add(
                Exercise(
                    lesson_id=lesson_id,
                    title=spec["title"],
                    description=spec["description"],
                    starter_code=lesson.starter_code or "",
                    solution=lesson.solution or "",
                    test_cases={"tests": spec["tests"]},
                    hints=spec.get("hints", []),
                    order=1,
                )
            )
            added += 1
            print(f"  + lesson {lesson_id:>3}  {spec['title']}")

        await db.commit()
        print(f"\nAdded {added}, already had one {skipped}, missing {missing}.")


if __name__ == "__main__":
    asyncio.run(backfill())
