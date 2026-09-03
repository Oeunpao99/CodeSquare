"""Populate the "debug" Practice challenges (challenges.kind == 'debug').

A debug challenge ships *broken* code in `starter_code`; the learner finds and
fixes the bug so the tests pass. Same grading harness as solve challenges — the
only difference is `kind` and that the starter code is wrong on purpose.

Idempotent: inserts a challenge only if its slug is missing.

Run after `alembic upgrade head` (and it's safe to run alongside
seed_challenges.py):

    python seed_debug_challenges.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
from datetime import datetime

from sqlalchemy import select

from database import async_session
from models.models import Challenge

ALGO_MAJORS = ["computer-science", "ai-engineer", "backend-engineer"]
WEB_MAJORS = ["web-developer", "computer-science"]


def t(expr: str, desc: str) -> dict:
    return {"test": expr, "description": desc}


CHALLENGES = [
    {
        "slug": "debug-sum-to-n",
        "title": "Debug: Sum 1..n",
        "difficulty": "beginner",
        "topic": "control-flow",
        "xp": 15,
        "prompt": (
            "`sum_to_n(n)` should return 1 + 2 + ... + n, so `sum_to_n(5)` is 15. "
            "It's returning one term short. Find the off-by-one bug and fix it."
        ),
        "starter_code": (
            "def sum_to_n(n):\n"
            "    total = 0\n"
            "    for i in range(1, n):\n"
            "        total += i\n"
            "    return total\n"
        ),
        "solution": (
            "def sum_to_n(n):\n"
            "    total = 0\n"
            "    for i in range(1, n + 1):\n"
            "        total += i\n"
            "    return total\n"
        ),
        "hints": [
            "`range(1, n)` stops at n - 1.",
            "You want the loop to include n itself: `range(1, n + 1)`.",
        ],
        "tests": [
            t("sum_to_n(5) == 15", "sums 1..5 to 15"),
            t("sum_to_n(1) == 1", "sum_to_n(1) is 1"),
            t("sum_to_n(10) == 55", "sums 1..10 to 55"),
        ],
    },
    {
        "slug": "debug-fizzbuzz",
        "title": "Debug: FizzBuzz Order",
        "difficulty": "beginner",
        "topic": "control-flow",
        "xp": 15,
        "prompt": (
            "`fizzbuzz(n)` should return a list for 1..n with 'Fizz' for multiples "
            "of 3, 'Buzz' for multiples of 5 and 'FizzBuzz' for multiples of both. "
            "Right now 15 comes out as 'Fizz'. Fix the logic so both cases win."
        ),
        "starter_code": (
            "def fizzbuzz(n):\n"
            "    out = []\n"
            "    for i in range(1, n + 1):\n"
            "        if i % 3 == 0:\n"
            "            out.append('Fizz')\n"
            "        elif i % 5 == 0:\n"
            "            out.append('Buzz')\n"
            "        elif i % 15 == 0:\n"
            "            out.append('FizzBuzz')\n"
            "        else:\n"
            "            out.append(str(i))\n"
            "    return out\n"
        ),
        "solution": (
            "def fizzbuzz(n):\n"
            "    out = []\n"
            "    for i in range(1, n + 1):\n"
            "        if i % 15 == 0:\n"
            "            out.append('FizzBuzz')\n"
            "        elif i % 3 == 0:\n"
            "            out.append('Fizz')\n"
            "        elif i % 5 == 0:\n"
            "            out.append('Buzz')\n"
            "        else:\n"
            "            out.append(str(i))\n"
            "    return out\n"
        ),
        "hints": [
            "An `elif` only runs when the earlier branches didn't.",
            "The most specific case (divisible by 15) has to be checked first.",
        ],
        "tests": [
            t("fizzbuzz(15)[-1] == 'FizzBuzz'", "15 maps to 'FizzBuzz'"),
            t("fizzbuzz(5) == ['1', '2', 'Fizz', '4', 'Buzz']", "first five entries"),
            t("fizzbuzz(3) == ['1', '2', 'Fizz']", "stops at n"),
        ],
    },
    {
        "slug": "debug-is-palindrome",
        "title": "Debug: Case-Insensitive Palindrome",
        "difficulty": "intermediate",
        "topic": "strings",
        "xp": 25,
        "prompt": (
            "`is_palindrome(s)` should ignore case, so `is_palindrome('Level')` is "
            "True. It only works for all-lowercase input right now. Fix it."
        ),
        "starter_code": (
            "def is_palindrome(s):\n"
            "    return s == s[::-1]\n"
        ),
        "solution": (
            "def is_palindrome(s):\n"
            "    s = s.lower()\n"
            "    return s == s[::-1]\n"
        ),
        "hints": [
            "'Level'[::-1] is 'leveL' — the capital L breaks the match.",
            "Normalise the case before comparing: `s = s.lower()`.",
        ],
        "tests": [
            t("is_palindrome('Level') is True", "case-insensitive match"),
            t("is_palindrome('racecar') is True", "plain palindrome still works"),
            t("is_palindrome('hello') is False", "non-palindrome is False"),
        ],
    },
    {
        "slug": "debug-word-count",
        "title": "Debug: Word Count",
        "difficulty": "intermediate",
        "topic": "dictionaries",
        "xp": 25,
        "prompt": (
            "`word_count(text)` should map each word to how many times it appears. "
            "Every count comes back as 1 — repeats are being overwritten instead of "
            "added up. Fix the tally."
        ),
        "starter_code": (
            "def word_count(text):\n"
            "    counts = {}\n"
            "    for word in text.split():\n"
            "        counts[word] = 1\n"
            "    return counts\n"
        ),
        "solution": (
            "def word_count(text):\n"
            "    counts = {}\n"
            "    for word in text.split():\n"
            "        counts[word] = counts.get(word, 0) + 1\n"
            "    return counts\n"
        ),
        "hints": [
            "`counts[word] = 1` throws away whatever was already there.",
            "Add to the running total: `counts.get(word, 0) + 1`.",
        ],
        "tests": [
            t("word_count('a a b') == {'a': 2, 'b': 1}", "counts repeats"),
            t("word_count('x') == {'x': 1}", "single word"),
            t("word_count('') == {}", "empty text -> empty dict"),
        ],
    },
    {
        "slug": "debug-merge-intervals",
        "title": "Debug: Merge Touching Intervals",
        "difficulty": "advanced",
        "topic": "algorithms",
        "xp": 40,
        "majors": ALGO_MAJORS,
        "prompt": (
            "`merge(intervals)` merges overlapping `[start, end]` pairs. Touching "
            "intervals like `[1, 4]` and `[4, 5]` should merge into `[1, 5]`, but "
            "they're left separate. Fix the comparison."
        ),
        "starter_code": (
            "def merge(intervals):\n"
            "    out = []\n"
            "    for start, end in sorted(intervals):\n"
            "        if out and start < out[-1][1]:\n"
            "            out[-1][1] = max(out[-1][1], end)\n"
            "        else:\n"
            "            out.append([start, end])\n"
            "    return out\n"
        ),
        "solution": (
            "def merge(intervals):\n"
            "    out = []\n"
            "    for start, end in sorted(intervals):\n"
            "        if out and start <= out[-1][1]:\n"
            "            out[-1][1] = max(out[-1][1], end)\n"
            "        else:\n"
            "            out.append([start, end])\n"
            "    return out\n"
        ),
        "hints": [
            "`start < end` treats an exact touch (start == previous end) as a gap.",
            "Use `<=` so `[1, 4]` and `[4, 5]` count as overlapping.",
        ],
        "tests": [
            t("merge([[1, 4], [4, 5]]) == [[1, 5]]", "touching intervals merge"),
            t("merge([[1, 3], [2, 6], [8, 10]]) == [[1, 6], [8, 10]]", "overlap still merges"),
            t("merge([[1, 2], [5, 6]]) == [[1, 2], [5, 6]]", "real gaps stay separate"),
        ],
    },
    {
        "slug": "debug-js-to-cents",
        "title": "Debug: Dollars to Cents",
        "language": "javascript",
        "difficulty": "beginner",
        "topic": "javascript",
        "xp": 15,
        "majors": WEB_MAJORS,
        "prompt": (
            "`const toCents = (dollars) => dollars * 10;` is meant to convert a "
            "dollar amount to cents — $1 is 100 cents, not 10. Fix the multiplier. "
            "(Checked by inspecting your code.)"
        ),
        "starter_code": "const toCents = (dollars) => dollars * 10;\n",
        "solution": "const toCents = (dollars) => dollars * 100;\n",
        "hints": [
            "There are 100 cents in a dollar.",
            "The multiplier should be 100, not 10.",
        ],
        "tests": [
            t("'toCents' in code and '=>' in code", "keeps the toCents arrow function"),
            t("'*100' in code.replace(' ', '')", "multiplies by 100"),
            t("'*10' not in code.replace(' ', '').replace('*100', '')", "no leftover * 10"),
        ],
    },
]


async def seed_debug_challenges() -> None:
    async with async_session() as db:
        existing = {
            slug for (slug,) in (await db.execute(select(Challenge.slug))).all()
        }
        # keep these after any solve challenges so `order` stays stable
        base = 1000
        added = 0
        for i, c in enumerate(CHALLENGES):
            if c["slug"] in existing:
                continue
            db.add(
                Challenge(
                    slug=c["slug"],
                    title=c["title"],
                    prompt=c["prompt"],
                    language=c.get("language", "python"),
                    difficulty=c["difficulty"],
                    kind="debug",
                    topic=c.get("topic"),
                    starter_code=c.get("starter_code", ""),
                    solution=c.get("solution", ""),
                    test_cases={"tests": c["tests"]},
                    hints=c.get("hints", []),
                    xp_reward=c.get("xp", 20),
                    major_slugs=c.get("majors", []),
                    order=base + i,
                    created_at=datetime.utcnow(),
                )
            )
            added += 1
        await db.commit()
        print(
            f"Debug challenges: {added} added, "
            f"{len(CHALLENGES) - added} already present, {len(CHALLENGES)} defined."
        )


if __name__ == "__main__":
    asyncio.run(seed_debug_challenges())
