"""Populate the Practice challenge bank (challenges table).

Idempotent: inserts a challenge only if its slug is missing, so edits made in the
DB are preserved across runs.

Run directly for local/dev (after `alembic upgrade head`):

    python seed_challenges.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
from datetime import datetime

from sqlalchemy import select

from database import async_session
from models.models import Challenge

ALGO_MAJORS = ["computer-science", "ai-engineer", "backend-engineer"]
SQL_MAJORS = ["data-science", "ai-engineer", "backend-engineer", "automation"]
WEB_MAJORS = ["web-developer", "computer-science"]


def t(expr: str, desc: str) -> dict:
    return {"test": expr, "description": desc}


CHALLENGES = [
    # ---------------- Python · beginner ----------------
    {
        "slug": "reverse-string",
        "title": "Reverse a String",
        "difficulty": "beginner",
        "topic": "strings",
        "xp": 15,
        "prompt": "Write `reverse_string(s)` that returns the characters of `s` in reverse order.",
        "starter_code": "def reverse_string(s):\n    pass\n",
        "solution": "def reverse_string(s):\n    return s[::-1]\n",
        "hints": [
            "A slice with a negative step walks a string backwards.",
            "`s[::-1]` gives you the whole string, stepping by -1.",
        ],
        "tests": [
            t("reverse_string('abc') == 'cba'", "reverses 'abc' to 'cba'"),
            t("reverse_string('') == ''", "handles the empty string"),
            t("reverse_string('racecar') == 'racecar'", "a palindrome is unchanged"),
        ],
    },
    {
        "slug": "sum-list",
        "title": "Sum a List of Numbers",
        "difficulty": "beginner",
        "topic": "arrays",
        "xp": 15,
        "prompt": "Write `sum_list(nums)` that returns the total of every number in the list. An empty list totals 0.",
        "starter_code": "def sum_list(nums):\n    pass\n",
        "solution": "def sum_list(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total\n",
        "hints": [
            "Start a running total at 0 and add each item.",
            "Python's built-in `sum()` does exactly this.",
        ],
        "tests": [
            t("sum_list([1, 2, 3, 4]) == 10", "sums a short list"),
            t("sum_list([]) == 0", "empty list totals 0"),
            t("sum_list([-5, 5]) == 0", "handles negatives"),
        ],
    },
    {
        "slug": "count-vowels",
        "title": "Count the Vowels",
        "difficulty": "beginner",
        "topic": "strings",
        "xp": 15,
        "prompt": "Write `count_vowels(s)` that returns how many vowels (a, e, i, o, u) appear in `s`, ignoring case.",
        "starter_code": "def count_vowels(s):\n    pass\n",
        "solution": "def count_vowels(s):\n    return sum(1 for ch in s.lower() if ch in 'aeiou')\n",
        "hints": [
            "Lowercase the string first so you only check five letters.",
            "Loop the characters and count the ones in `'aeiou'`.",
        ],
        "tests": [
            t("count_vowels('hello') == 2", "'hello' has 2 vowels"),
            t("count_vowels('SKY') == 0", "no vowels, case-insensitive"),
            t("count_vowels('AeIoU') == 5", "counts every vowel regardless of case"),
        ],
    },
    {
        "slug": "fizzbuzz",
        "title": "FizzBuzz",
        "difficulty": "beginner",
        "topic": "control-flow",
        "xp": 15,
        "prompt": (
            "Write `fizzbuzz(n)` that returns a list of strings for 1..n: 'Fizz' if "
            "divisible by 3, 'Buzz' if divisible by 5, 'FizzBuzz' if both, otherwise "
            "the number as a string."
        ),
        "starter_code": "def fizzbuzz(n):\n    pass\n",
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
            "Check divisibility by 15 first, or your 3-and-5 case never runs.",
            "`str(i)` turns the fallthrough number into a string.",
        ],
        "tests": [
            t("fizzbuzz(5) == ['1', '2', 'Fizz', '4', 'Buzz']", "first five entries"),
            t("fizzbuzz(15)[-1] == 'FizzBuzz'", "15 maps to 'FizzBuzz'"),
            t("fizzbuzz(3) == ['1', '2', 'Fizz']", "stops at n"),
        ],
    },
    {
        "slug": "max-of-three",
        "title": "Largest of Three",
        "difficulty": "beginner",
        "topic": "control-flow",
        "xp": 15,
        "prompt": "Write `max_of_three(a, b, c)` that returns the largest of the three values without using `max()`.",
        "starter_code": "def max_of_three(a, b, c):\n    pass\n",
        "solution": (
            "def max_of_three(a, b, c):\n"
            "    biggest = a\n"
            "    if b > biggest:\n"
            "        biggest = b\n"
            "    if c > biggest:\n"
            "        biggest = c\n"
            "    return biggest\n"
        ),
        "hints": [
            "Assume the first is biggest, then compare the other two against it.",
            "Two `if` checks are enough.",
        ],
        "tests": [
            t("max_of_three(1, 2, 3) == 3", "last is largest"),
            t("max_of_three(9, 4, 4) == 9", "first is largest"),
            t("max_of_three(-1, -5, -3) == -1", "handles negatives"),
        ],
    },
    # ---------------- Python · intermediate ----------------
    {
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "intermediate",
        "topic": "arrays",
        "xp": 25,
        "majors": ALGO_MAJORS,
        "prompt": (
            "Write `two_sum(nums, target)` that returns the indices of the two "
            "numbers adding up to `target`, as a list. Exactly one solution exists; "
            "order of the two indices does not matter."
        ),
        "starter_code": "def two_sum(nums, target):\n    pass\n",
        "solution": (
            "def two_sum(nums, target):\n"
            "    seen = {}\n"
            "    for i, n in enumerate(nums):\n"
            "        if target - n in seen:\n"
            "            return [seen[target - n], i]\n"
            "        seen[n] = i\n"
            "    return []\n"
        ),
        "hints": [
            "For each number, the partner you need is `target - n`.",
            "Keep a dict of value -> index as you scan so the lookup is O(1).",
        ],
        "tests": [
            t("sorted(two_sum([2, 7, 11, 15], 9)) == [0, 1]", "2 + 7 = 9"),
            t("sorted(two_sum([3, 2, 4], 6)) == [1, 2]", "skips the first 3"),
            t("sorted(two_sum([3, 3], 6)) == [0, 1]", "uses two equal values"),
        ],
    },
    {
        "slug": "word-frequency",
        "title": "Word Frequency",
        "difficulty": "intermediate",
        "topic": "dictionaries",
        "xp": 25,
        "prompt": (
            "Write `word_frequency(text)` that returns a dict mapping each "
            "lowercase word to how many times it appears. Split on whitespace."
        ),
        "starter_code": "def word_frequency(text):\n    pass\n",
        "solution": (
            "def word_frequency(text):\n"
            "    counts = {}\n"
            "    for word in text.lower().split():\n"
            "        counts[word] = counts.get(word, 0) + 1\n"
            "    return counts\n"
        ),
        "hints": [
            "`text.lower().split()` gives you the normalised word list.",
            "`counts.get(word, 0) + 1` avoids a KeyError on first sight.",
        ],
        "tests": [
            t("word_frequency('a a b') == {'a': 2, 'b': 1}", "counts repeats"),
            t("word_frequency('The the THE') == {'the': 3}", "case-insensitive"),
            t("word_frequency('') == {}", "empty text -> empty dict"),
        ],
    },
    {
        "slug": "flatten-once",
        "title": "Flatten One Level",
        "difficulty": "intermediate",
        "topic": "arrays",
        "xp": 25,
        "prompt": "Write `flatten(nested)` that takes a list of lists and returns a single list with one level of nesting removed.",
        "starter_code": "def flatten(nested):\n    pass\n",
        "solution": (
            "def flatten(nested):\n"
            "    out = []\n"
            "    for sub in nested:\n"
            "        out.extend(sub)\n"
            "    return out\n"
        ),
        "hints": [
            "`list.extend` appends every item of a sublist in one call.",
            "An empty sublist just contributes nothing.",
        ],
        "tests": [
            t("flatten([[1, 2], [3], []]) == [1, 2, 3]", "merges sublists, drops empties"),
            t("flatten([]) == []", "no sublists -> empty list"),
            t("flatten([['a'], ['b', 'c']]) == ['a', 'b', 'c']", "works on strings too"),
        ],
    },
    {
        "slug": "is-anagram",
        "title": "Anagram Check",
        "difficulty": "intermediate",
        "topic": "strings",
        "xp": 25,
        "prompt": "Write `is_anagram(a, b)` that returns True when `a` and `b` contain the same letters in any order. Ignore case; assume no spaces.",
        "starter_code": "def is_anagram(a, b):\n    pass\n",
        "solution": "def is_anagram(a, b):\n    return sorted(a.lower()) == sorted(b.lower())\n",
        "hints": [
            "Two strings are anagrams iff their sorted characters match.",
            "Lowercase both sides before sorting.",
        ],
        "tests": [
            t("is_anagram('listen', 'silent') is True", "classic anagram"),
            t("is_anagram('Dormitory', 'DirtyRoom') is True", "case-insensitive"),
            t("is_anagram('abc', 'abd') is False", "different letters"),
        ],
    },
    {
        "slug": "fibonacci",
        "title": "Nth Fibonacci",
        "difficulty": "intermediate",
        "topic": "recursion",
        "xp": 25,
        "majors": ALGO_MAJORS,
        "prompt": "Write `fib(n)` returning the nth Fibonacci number, 0-indexed: fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).",
        "starter_code": "def fib(n):\n    pass\n",
        "solution": (
            "def fib(n):\n"
            "    a, b = 0, 1\n"
            "    for _ in range(n):\n"
            "        a, b = b, a + b\n"
            "    return a\n"
        ),
        "hints": [
            "You can iterate instead of recursing: keep the last two values.",
            "`a, b = b, a + b` advances the pair in one step.",
        ],
        "tests": [
            t("fib(0) == 0", "base case 0"),
            t("fib(1) == 1", "base case 1"),
            t("fib(10) == 55", "tenth number"),
        ],
    },
    {
        "slug": "dedupe-preserve-order",
        "title": "Dedupe, Keep Order",
        "difficulty": "intermediate",
        "topic": "arrays",
        "xp": 25,
        "prompt": "Write `dedupe(items)` that removes duplicates while keeping the first occurrence of each value in its original position.",
        "starter_code": "def dedupe(items):\n    pass\n",
        "solution": (
            "def dedupe(items):\n"
            "    seen = set()\n"
            "    out = []\n"
            "    for x in items:\n"
            "        if x not in seen:\n"
            "            seen.add(x)\n"
            "            out.append(x)\n"
            "    return out\n"
        ),
        "hints": [
            "A plain `set(items)` loses ordering — track seen values separately.",
            "Append to the result only the first time you see a value.",
        ],
        "tests": [
            t("dedupe([1, 1, 2, 3, 2, 1]) == [1, 2, 3]", "keeps first occurrences"),
            t("dedupe([]) == []", "empty stays empty"),
            t("dedupe(['a', 'b', 'a']) == ['a', 'b']", "works on strings"),
        ],
    },
    # ---------------- Python · advanced ----------------
    {
        "slug": "binary-search",
        "title": "Binary Search",
        "difficulty": "advanced",
        "topic": "algorithms",
        "xp": 40,
        "majors": ALGO_MAJORS,
        "prompt": "Write `binary_search(arr, target)` for a sorted ascending list. Return the index of `target`, or -1 if absent. Do not use `list.index`.",
        "starter_code": "def binary_search(arr, target):\n    pass\n",
        "solution": (
            "def binary_search(arr, target):\n"
            "    lo, hi = 0, len(arr) - 1\n"
            "    while lo <= hi:\n"
            "        mid = (lo + hi) // 2\n"
            "        if arr[mid] == target:\n"
            "            return mid\n"
            "        if arr[mid] < target:\n"
            "            lo = mid + 1\n"
            "        else:\n"
            "            hi = mid - 1\n"
            "    return -1\n"
        ),
        "hints": [
            "Track a `lo` and `hi` bound and inspect the midpoint each loop.",
            "Move the bound that cannot contain the target; stop when they cross.",
        ],
        "tests": [
            t("binary_search([1, 3, 5, 7, 9], 7) == 3", "finds an element"),
            t("binary_search([1, 3, 5, 7, 9], 4) == -1", "absent -> -1"),
            t("binary_search([], 1) == -1", "empty list -> -1"),
        ],
    },
    {
        "slug": "merge-intervals",
        "title": "Merge Intervals",
        "difficulty": "advanced",
        "topic": "algorithms",
        "xp": 40,
        "majors": ALGO_MAJORS,
        "prompt": "Write `merge(intervals)` where each interval is `[start, end]`. Return the intervals with all overlapping ones merged, sorted by start.",
        "starter_code": "def merge(intervals):\n    pass\n",
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
            "Sort by start first; then a single pass can merge neighbours.",
            "Overlap means the next start is <= the current end.",
        ],
        "tests": [
            t("merge([[1, 3], [2, 6], [8, 10]]) == [[1, 6], [8, 10]]", "merges the first two"),
            t("merge([[1, 4], [4, 5]]) == [[1, 5]]", "touching intervals merge"),
            t("merge([[5, 6], [1, 2]]) == [[1, 2], [5, 6]]", "output is sorted"),
        ],
    },
    {
        "slug": "group-anagrams",
        "title": "Group Anagrams",
        "difficulty": "advanced",
        "topic": "algorithms",
        "xp": 40,
        "majors": ALGO_MAJORS,
        "prompt": "Write `group_anagrams(words)` returning a list of groups, each group a list of words that are anagrams of each other. Group order and within-group order do not matter.",
        "starter_code": "def group_anagrams(words):\n    pass\n",
        "solution": (
            "def group_anagrams(words):\n"
            "    buckets = {}\n"
            "    for w in words:\n"
            "        key = ''.join(sorted(w))\n"
            "        buckets.setdefault(key, []).append(w)\n"
            "    return list(buckets.values())\n"
        ),
        "hints": [
            "The sorted letters of a word are the same for every anagram of it.",
            "Use that string as a dict key and append words into buckets.",
        ],
        "tests": [
            t(
                "sorted(sorted(g) for g in group_anagrams(['eat','tea','tan','ate','nat','bat'])) "
                "== [['ate','eat','tea'], ['bat'], ['nat','tan']]",
                "three groups by letters",
            ),
            t("group_anagrams([]) == []", "no words -> no groups"),
            t(
                "sorted(sorted(g) for g in group_anagrams(['abc','cab','xyz'])) == [['abc','cab'], ['xyz']]",
                "singletons stay in their own group",
            ),
        ],
    },
    {
        "slug": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "advanced",
        "topic": "stacks",
        "xp": 40,
        "majors": ALGO_MAJORS,
        "prompt": "Write `is_valid(s)` returning True if every bracket in `s` (`()`, `[]`, `{}`) is correctly opened and closed in the right order.",
        "starter_code": "def is_valid(s):\n    pass\n",
        "solution": (
            "def is_valid(s):\n"
            "    pairs = {')': '(', ']': '[', '}': '{'}\n"
            "    stack = []\n"
            "    for ch in s:\n"
            "        if ch in '([{':\n"
            "            stack.append(ch)\n"
            "        elif ch in pairs:\n"
            "            if not stack or stack.pop() != pairs[ch]:\n"
            "                return False\n"
            "    return not stack\n"
        ),
        "hints": [
            "Push opening brackets; on a closing bracket the top of the stack must match.",
            "A leftover stack at the end means something never closed.",
        ],
        "tests": [
            t("is_valid('()[]{}') is True", "flat, balanced"),
            t("is_valid('([{}])') is True", "nested, balanced"),
            t("is_valid('([)]') is False", "wrong closing order"),
            t("is_valid('(') is False", "never closed"),
        ],
    },
    # ---------------- JavaScript (content-checked) ----------------
    {
        "slug": "js-arrow-sum",
        "title": "Arrow Function: add",
        "language": "javascript",
        "difficulty": "beginner",
        "topic": "javascript",
        "xp": 15,
        "majors": WEB_MAJORS,
        "prompt": (
            "Define an arrow function `add` that takes two numbers and returns their "
            "sum, e.g. `const add = (a, b) => a + b;`. (This one is checked by "
            "inspecting your code, not by running it.)"
        ),
        "starter_code": "const add = (a, b) => {\n  // return the sum\n};\n",
        "solution": "const add = (a, b) => a + b;\n",
        "hints": [
            "Arrow syntax: `(params) => expression`.",
            "No `return` keyword is needed for a single-expression arrow body.",
        ],
        "tests": [
            t("'add' in code and '=>' in code", "declares an arrow function named add"),
            t("'a' in code and 'b' in code and '+' in code", "adds its two parameters"),
        ],
    },
    {
        "slug": "js-filter-evens",
        "title": "Filter Even Numbers",
        "language": "javascript",
        "difficulty": "beginner",
        "topic": "javascript",
        "xp": 15,
        "majors": WEB_MAJORS,
        "prompt": (
            "Write `const evens = (nums) => ...` that returns only the even numbers "
            "from `nums`, using `Array.prototype.filter`. (Checked by inspecting "
            "your code.)"
        ),
        "starter_code": "const evens = (nums) => {\n  // use .filter and % 2\n};\n",
        "solution": "const evens = (nums) => nums.filter((n) => n % 2 === 0);\n",
        "hints": [
            "`nums.filter(predicate)` keeps items where the predicate is truthy.",
            "`n % 2 === 0` is true for even numbers.",
        ],
        "tests": [
            t("'.filter(' in code.replace(' ', '')", "uses Array.filter"),
            t("'%2' in code.replace(' ', '')", "tests divisibility by 2"),
        ],
    },
    # ---------------- SQL (content-checked) ----------------
    {
        "slug": "sql-select-active-users",
        "title": "SQL: Active Users",
        "language": "sql",
        "difficulty": "beginner",
        "topic": "sql",
        "xp": 15,
        "majors": SQL_MAJORS,
        "prompt": (
            "Write a query that selects the `email` column from a `users` table for "
            "rows where `is_active` is TRUE. (Checked by inspecting your SQL.)"
        ),
        "starter_code": "SELECT ...\nFROM users\nWHERE ...;\n",
        "solution": "SELECT email\nFROM users\nWHERE is_active = TRUE;\n",
        "hints": [
            "Shape: `SELECT <cols> FROM <table> WHERE <condition>;`.",
            "The condition filters on the `is_active` column.",
        ],
        "tests": [
            t("'SELECT' in code.upper() and 'FROM' in code.upper()", "is a SELECT query"),
            t("'WHERE' in code.upper() and 'IS_ACTIVE' in code.upper().replace(' ', '_')", "filters on is_active"),
            t("'EMAIL' in code.upper()", "selects the email column"),
        ],
    },
    {
        "slug": "sql-join-orders",
        "title": "SQL: Join Orders to Customers",
        "language": "sql",
        "difficulty": "intermediate",
        "topic": "sql",
        "xp": 25,
        "majors": SQL_MAJORS,
        "prompt": (
            "Write a query that returns each order's `id` alongside the customer's "
            "`name`, joining `orders` to `customers` on `orders.customer_id = "
            "customers.id`. (Checked by inspecting your SQL.)"
        ),
        "starter_code": "SELECT ...\nFROM orders\nJOIN customers ON ...;\n",
        "solution": (
            "SELECT orders.id, customers.name\n"
            "FROM orders\n"
            "JOIN customers ON orders.customer_id = customers.id;\n"
        ),
        "hints": [
            "`JOIN <table> ON <left.key> = <right.key>` links two tables.",
            "Qualify column names with their table when both sides could match.",
        ],
        "tests": [
            t("'JOIN' in code.upper()", "uses a JOIN"),
            t("'ON' in code.upper() and 'CUSTOMER_ID' in code.upper().replace(' ', '_')", "joins on customer_id"),
            t("'CUSTOMERS' in code.upper() and 'ORDERS' in code.upper()", "references both tables"),
        ],
    },
]


async def seed_challenges() -> None:
    async with async_session() as db:
        existing = {
            slug for (slug,) in (await db.execute(select(Challenge.slug))).all()
        }
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
                    topic=c.get("topic"),
                    starter_code=c.get("starter_code", ""),
                    solution=c.get("solution", ""),
                    test_cases={"tests": c["tests"]},
                    hints=c.get("hints", []),
                    xp_reward=c.get("xp", 20),
                    major_slugs=c.get("majors", []),
                    order=i,
                    created_at=datetime.utcnow(),
                )
            )
            added += 1
        await db.commit()
        print(
            f"Challenges: {added} added, {len(existing)} already present, "
            f"{len(CHALLENGES)} defined."
        )


if __name__ == "__main__":
    asyncio.run(seed_challenges())
