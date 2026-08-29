"""Populate the standalone quiz bank (quizzes table).

Plain run is idempotent: inserts a quiz only if its slug is missing, so edits
made in the DB are preserved. Pass ``--refresh`` to also overwrite the authored
content (title, description, questions, xp, ...) of quizzes that already exist —
use it after editing the definitions below.

Run directly for local/dev (after `alembic upgrade head`):

    python seed_quizzes.py            # insert missing quizzes only
    python seed_quizzes.py --refresh  # + push edited content to existing ones
"""
import asyncio
import sys
from datetime import datetime

from sqlalchemy import select

from database import async_session
from models.models import Quiz

ALGO_MAJORS = ["computer-science", "ai-engineer", "backend-engineer"]
SQL_MAJORS = ["data-science", "ai-engineer", "backend-engineer", "automation"]
WEB_MAJORS = ["web-developer", "computer-science"]


def q(question: str, options: list[str], answer: int, explain: str = "") -> dict:
    return {"q": question, "options": options, "answer": answer, "explain": explain}


QUIZZES = [
    {
        "slug": "python-basics-check",
        "title": "Python Basics",
        "language": "python",
        "difficulty": "beginner",
        "topic": "python",
        "pass_score": 70,
        "xp": 15,
        "description": "A quick check on variables, types, and printing in Python.",
        "questions": [
            q(
                "Which line correctly creates an integer variable named `age`?",
                ["age = '30'", "age = 30", "int age = 30", "age := 30"],
                1,
                "No type keyword, and no quotes — quotes would make it a string.",
            ),
            q(
                "What does `type(3.0)` return?",
                ["<class 'int'>", "<class 'float'>", "<class 'number'>", "<class 'str'>"],
                1,
                "A literal with a decimal point is a float.",
            ),
            q(
                "What is printed by `print('a' + 'b')`?",
                ["a b", "ab", "'a' 'b'", "a+b"],
                1,
                "`+` concatenates two strings with nothing between them.",
            ),
            q(
                "Which value is 'falsy' in Python?",
                ["'0'", "[0]", "0", "'False'"],
                2,
                "The integer 0 is falsy; a non-empty string or list is truthy.",
            ),
            q(
                "How do you write a comment in Python?",
                ["// comment", "/* comment */", "# comment", "<!-- comment -->"],
                2,
                "Python uses `#` for single-line comments.",
            ),
        ],
    },
    {
        "slug": "control-flow-check",
        "title": "Control Flow & Loops",
        "language": "python",
        "difficulty": "beginner",
        "topic": "control-flow",
        "pass_score": 70,
        "xp": 20,
        "description": "if / elif / else, for and while loops, range(), break / continue / pass, and loop-else.",
        "questions": [
            q(
                "What does `range(1, 5)` produce?",
                ["1 2 3 4 5", "1 2 3 4", "0 1 2 3 4", "1 5"],
                1,
                "`range(start, stop)` includes the start and stops just before stop.",
            ),
            q(
                "What does `range(0, 10, 2)` produce?",
                ["0 2 4 6 8 10", "0 2 4 6 8", "2 4 6 8 10", "0 1 2 3 4"],
                1,
                "The third argument is the step; it yields 0, 2, 4, 6, 8 and stops before 10.",
            ),
            q(
                "How many times does `for i in range(0):` run its body?",
                ["0", "1", "Infinite", "Error"],
                0,
                "`range(0)` is empty, so the loop body never runs.",
            ),
            q(
                "What does this print?\n\n    for i in range(3):\n        print(i)",
                ["1 2 3", "0 1 2", "0 1 2 3", "3"],
                1,
                "`range(3)` is 0, 1, 2 — the stop value itself is not included.",
            ),
            q(
                "Which keyword stops a loop immediately?",
                ["continue", "pass", "break", "return"],
                2,
                "`break` exits the nearest enclosing loop right away.",
            ),
            q(
                "Which keyword skips the rest of the current iteration and moves to the next one?",
                ["break", "continue", "pass", "skip"],
                1,
                "`continue` jumps straight to the loop's next iteration.",
            ),
            q(
                "What does the `pass` statement do?",
                [
                    "Ends the loop",
                    "Nothing — it's a placeholder where a statement is required",
                    "Skips one iteration",
                    "Returns from the function",
                ],
                1,
                "`pass` is a no-op used when syntax needs a body but you have nothing to run.",
            ),
            q(
                "What runs when every `if` / `elif` condition is False?",
                ["The first elif", "The else block", "Nothing, always", "The loop again"],
                1,
                "`else` is the fallback branch taken when no earlier condition matched.",
            ),
            q(
                "What is `x` after this runs?\n\n    x = 5\n    if x > 3:\n        x = 10\n    elif x > 1:\n        x = 20",
                ["5", "10", "20", "30"],
                1,
                "The first branch matches, so `x = 10`; once one branch runs, the `elif` is skipped.",
            ),
            q(
                "A `while` loop keeps running as long as its condition is...",
                ["False", "True", "None", "zero"],
                1,
                "A `while` loop repeats while the condition is truthy; it must eventually become False to end.",
            ),
            q(
                "When does a loop's `else` block run?",
                [
                    "Every time the loop ends",
                    "Only when the loop body never runs",
                    "When the loop finishes without hitting `break`",
                    "When `continue` is called",
                ],
                2,
                "`for`/`while` `else` runs only if the loop completed normally (no `break`).",
            ),
            q(
                "How do you loop over a list `items` getting both the index and the value?",
                [
                    "for i in items:",
                    "for i, v in enumerate(items):",
                    "for i in range(items):",
                    "for i, v in items:",
                ],
                1,
                "`enumerate(items)` yields `(index, value)` pairs each iteration.",
            ),
        ],
    },
    {
        "slug": "python-collections-check",
        "title": "Lists, Dicts & Sets",
        "language": "python",
        "difficulty": "intermediate",
        "topic": "collections",
        "pass_score": 70,
        "xp": 25,
        "description": "Core operations on Python's built-in collections.",
        "questions": [
            q(
                "What does `[1, 2, 3][-1]` evaluate to?",
                ["1", "3", "IndexError", "-1"],
                1,
                "Negative indexing counts from the end; -1 is the last item.",
            ),
            q(
                "Which expression safely reads a missing key without raising?",
                ["d['x']", "d.get('x')", "d.x", "d->get('x')"],
                1,
                "`dict.get` returns None (or a default) instead of KeyError.",
            ),
            q(
                "What is `len({1, 1, 2, 3})`?",
                ["4", "3", "2", "1"],
                1,
                "A set removes duplicates, leaving {1, 2, 3}.",
            ),
            q(
                "Which method adds a single item to the end of a list?",
                ["list.add(x)", "list.push(x)", "list.append(x)", "list.extend(x)"],
                2,
                "`append` adds one element; `extend` adds each item of an iterable.",
            ),
            q(
                "What does `'a,b,c'.split(',')` return?",
                ["'abc'", "['a', 'b', 'c']", "('a', 'b', 'c')", "['a,b,c']"],
                1,
                "`str.split` returns a list of substrings.",
            ),
        ],
    },
    {
        "slug": "functions-check",
        "title": "Functions",
        "language": "python",
        "difficulty": "intermediate",
        "topic": "functions",
        "pass_score": 70,
        "xp": 25,
        "description": "Defining functions, arguments, return values, and scope.",
        "questions": [
            q(
                "What does a function return if it has no `return` statement?",
                ["0", "''", "None", "It raises an error"],
                2,
                "A function with no explicit return yields `None`.",
            ),
            q(
                "In `def f(a, b=2):`, what is `b` called?",
                ["A positional argument", "A default (keyword) argument", "A global", "A constant"],
                1,
                "`b=2` gives the parameter a default used when the caller omits it.",
            ),
            q(
                "What does `*args` collect in a function signature?",
                [
                    "Extra positional arguments as a tuple",
                    "Extra keyword arguments as a dict",
                    "Only the first argument",
                    "Nothing — it's a syntax error",
                ],
                0,
                "`*args` gathers surplus positional args; `**kwargs` gathers keyword args.",
            ),
            q(
                "A variable assigned inside a function is, by default:",
                ["Global", "Local to that function", "Shared with the caller", "Read-only"],
                1,
                "Assignment inside a function creates a local name unless declared `global`/`nonlocal`.",
            ),
        ],
    },
    {
        "slug": "js-fundamentals-check",
        "title": "JavaScript Fundamentals",
        "language": "javascript",
        "difficulty": "beginner",
        "topic": "javascript",
        "pass_score": 70,
        "xp": 15,
        "majors": WEB_MAJORS,
        "description": "let/const, equality, and array basics in modern JavaScript.",
        "questions": [
            q(
                "Which declaration prevents reassignment of the binding?",
                ["var", "let", "const", "function"],
                2,
                "`const` forbids reassigning the variable (object contents can still change).",
            ),
            q(
                "What does `2 == '2'` evaluate to in JavaScript?",
                ["true", "false", "TypeError", "undefined"],
                0,
                "`==` coerces types before comparing; `===` would be `false`.",
            ),
            q(
                "Which method creates a new array of transformed items?",
                ["forEach", "map", "filter", "reduce"],
                1,
                "`map` returns a new array with the callback applied to each element.",
            ),
            q(
                "What is `typeof null` in JavaScript?",
                ["'null'", "'object'", "'undefined'", "'number'"],
                1,
                "A long-standing quirk of the language: `typeof null === 'object'`.",
            ),
        ],
    },
    {
        "slug": "sql-basics-check",
        "title": "SQL Basics",
        "language": "sql",
        "difficulty": "beginner",
        "topic": "sql",
        "pass_score": 70,
        "xp": 15,
        "majors": SQL_MAJORS,
        "description": "SELECT, WHERE, ORDER BY, and JOIN essentials.",
        "questions": [
            q(
                "Which clause filters rows before grouping?",
                ["HAVING", "WHERE", "ORDER BY", "LIMIT"],
                1,
                "`WHERE` filters rows; `HAVING` filters groups after aggregation.",
            ),
            q(
                "What does `SELECT COUNT(*) FROM users` return?",
                [
                    "Every row in users",
                    "The number of rows in users",
                    "The first user",
                    "The column names",
                ],
                1,
                "`COUNT(*)` returns the row count as a single value.",
            ),
            q(
                "Which JOIN keeps rows from the left table even with no match?",
                ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "FULL JOIN"],
                1,
                "`LEFT JOIN` returns all left rows, filling unmatched right columns with NULL.",
            ),
            q(
                "How do you sort results from highest to lowest `score`?",
                [
                    "ORDER BY score",
                    "ORDER BY score DESC",
                    "SORT score DESC",
                    "GROUP BY score DESC",
                ],
                1,
                "`ORDER BY <col> DESC` sorts descending; ascending is the default.",
            ),
        ],
    },
    {
        "slug": "git-workflow-check",
        "title": "Git Workflow",
        "difficulty": "beginner",
        "topic": "git",
        "pass_score": 70,
        "xp": 15,
        "description": "Everyday Git commands and what they do.",
        "questions": [
            q(
                "Which command stages a file for the next commit?",
                ["git commit file", "git add file", "git stage file", "git push file"],
                1,
                "`git add` moves changes into the staging area.",
            ),
            q(
                "What does `git pull` do?",
                [
                    "Uploads your commits to the remote",
                    "Fetches remote changes and merges them into your branch",
                    "Deletes your local branch",
                    "Creates a new branch",
                ],
                1,
                "`git pull` is `git fetch` followed by a merge (or rebase).",
            ),
            q(
                "How do you create and switch to a new branch in one command?",
                [
                    "git branch -new feature",
                    "git checkout -b feature",
                    "git switch feature",
                    "git merge feature",
                ],
                1,
                "`git checkout -b <name>` (or `git switch -c <name>`) creates and checks out.",
            ),
            q(
                "What does a `.gitignore` file do?",
                [
                    "Lists files Git should never track",
                    "Stores your commit history",
                    "Configures your username",
                    "Marks files as resolved",
                ],
                0,
                "Paths matching `.gitignore` are kept out of `git status` and `git add`.",
            ),
        ],
    },
]


def _content(z: dict) -> dict:
    return {
        "title": z["title"],
        "description": z.get("description", ""),
        "language": z.get("language"),
        "difficulty": z["difficulty"],
        "topic": z.get("topic"),
        "pass_score": z.get("pass_score", 70),
        "xp_reward": z.get("xp", 15),
        "questions": z["questions"],
        "major_slugs": z.get("majors", []),
    }


async def seed_quizzes(refresh: bool = False) -> None:
    async with async_session() as db:
        rows = {r.slug: r for r in (await db.execute(select(Quiz))).scalars().all()}
        added = updated = 0
        for i, z in enumerate(QUIZZES):
            existing = rows.get(z["slug"])
            if existing is None:
                db.add(Quiz(slug=z["slug"], order=i, created_at=datetime.utcnow(), **_content(z)))
                added += 1
            elif refresh:
                changed = False
                for field, value in _content(z).items():
                    if getattr(existing, field) != value:
                        setattr(existing, field, value)
                        changed = True
                if existing.order != i:
                    existing.order = i
                    changed = True
                updated += changed
        await db.commit()
        print(
            f"Quizzes: {added} added, {updated} refreshed, "
            f"{len(rows) - updated} unchanged, {len(QUIZZES)} defined."
        )


if __name__ == "__main__":
    asyncio.run(seed_quizzes(refresh="--refresh" in sys.argv))
