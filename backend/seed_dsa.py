"""Seed the 'Data Structures & Algorithms' track — the CS core that today only
exists as scattered practice challenges, never taught.

6 modules, beginner -> advanced, house style (2 lessons/module, one Python
exercise each, graded by the substring harness):

  1. Complexity & Big-O         counting work, O(1)/O(n)/O(n^2), trade-offs
  2. Arrays & Two Pointers      in-place scans, the two-pointer pattern
  3. Hash Maps & Sets           O(1) lookup, dedupe, frequency counting
  4. Stacks, Queues & Lists     LIFO / FIFO, when each fits
  5. Recursion & Trees          base case + recursive step, DFS traversal
  6. Searching, Sorting, Graphs binary search, BFS, a first taste of DP

Idempotent: skips if the track already exists.

    ./.venv/Scripts/python.exe seed_dsa.py
    ./.venv/Scripts/python.exe retag_curriculum.py
"""
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


def _p(*parts: str) -> str:
    return "".join(parts)


DSA_TRACK = {
    "name": "Data Structures & Algorithms",
    "slug": "dsa",
    "icon": "🧮",
    "description": (
        "Reason about efficiency and pick the right structure: Big-O, arrays and "
        "two pointers, hash maps, stacks and queues, recursion and trees, then "
        "searching, sorting and graphs."
    ),
    "color": "#8B5CF6",
    "modules": [
        # ---------------------------------------------------------------- #
        {
            "title": "Complexity & Big-O",
            "description": "Measure an algorithm by how its work grows.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Counting the Work",
                    "content": _p(
                        "<h2>Big-O is a growth rate</h2>",
                        "<p>Big-O describes how the number of steps grows as the input "
                        "<code>n</code> grows &mdash; ignoring constants and small terms.</p>",
                        "<ul>",
                        "<li><strong>O(1)</strong> &mdash; constant: <code>arr[0]</code>, a dict "
                        "lookup.</li>",
                        "<li><strong>O(n)</strong> &mdash; one pass: a single <code>for</code> over "
                        "the input.</li>",
                        "<li><strong>O(n&sup2;)</strong> &mdash; a loop inside a loop over the same "
                        "data.</li>",
                        "<li><strong>O(log n)</strong> &mdash; halve the problem each step (binary "
                        "search).</li>",
                        "</ul>",
                        "<pre><code>def has_pair_sum(nums, target):   # O(n^2): nested scan\n"
                        "    for i in range(len(nums)):\n"
                        "        for j in range(i + 1, len(nums)):\n"
                        "            if nums[i] + nums[j] == target:\n"
                        "                return True\n"
                        "    return False</code></pre>",
                        "<p>Module 3 rewrites this as O(n) with a set.</p>",
                    ),
                    "code_example": (
                        "def has_pair_sum(nums, target):\n"
                        "    for i in range(len(nums)):\n"
                        "        for j in range(i + 1, len(nums)):\n"
                        "            if nums[i] + nums[j] == target:\n"
                        "                return True\n"
                        "    return False"
                    ),
                    "starter_code": (
                        "# O(n): return the sum of nums in a single pass (no nested loop).\n"
                        "def total(nums):\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def total(nums):\n"
                        "    s = 0\n"
                        "    for x in nums:\n"
                        "        s += x\n"
                        "    return s"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Linear Pass",
                            "description": "Implement total(nums) in one loop (O(n)) — no nested iteration.",
                            "starter_code": "def total(nums):\n    ...",
                            "solution": (
                                "def total(nums):\n"
                                "    s = 0\n"
                                "    for x in nums:\n"
                                "        s += x\n"
                                "    return s"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Defines total(nums)",
                                     "test": "'def total(nums)' in code"},
                                    {"description": "Single loop over nums",
                                     "test": "code.count('for ') == 1"},
                                    {"description": "Returns the accumulator",
                                     "test": "'return' in code"},
                                ]
                            },
                            "hints": [
                                "Keep a running sum, start at 0",
                                "for x in nums: s += x",
                                "Return s after the loop (or just use sum(nums))",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Time vs Space",
                    "content": _p(
                        "<h2>You can often trade one for the other</h2>",
                        "<p><strong>Space complexity</strong> is how much <em>extra</em> memory an "
                        "algorithm uses as <code>n</code> grows. Building a set or dict to speed up "
                        "lookups costs O(n) space to save time.</p>",
                        "<pre><code># O(n) time, O(n) space — remember what we've seen\n"
                        "def first_repeat(nums):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if x in seen:\n"
                        "            return x\n"
                        "        seen.add(x)\n"
                        "    return None</code></pre>",
                        "<p>The alternative &mdash; comparing every pair &mdash; is O(1) space but "
                        "O(n&sup2;) time. Which matters more depends on the constraints.</p>",
                    ),
                    "code_example": (
                        "def first_repeat(nums):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if x in seen:\n"
                        "            return x\n"
                        "        seen.add(x)\n"
                        "    return None"
                    ),
                    "starter_code": (
                        "# Return the first value that appears twice, using an O(n) set.\n"
                        "def first_repeat(nums):\n"
                        "    seen = set()\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def first_repeat(nums):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if x in seen:\n"
                        "            return x\n"
                        "        seen.add(x)\n"
                        "    return None"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Trade Space for Time",
                            "description": "first_repeat(nums) returns the first duplicate using a set for O(n) time.",
                            "starter_code": "def first_repeat(nums):\n    seen = set()\n    ...",
                            "solution": (
                                "def first_repeat(nums):\n"
                                "    seen = set()\n"
                                "    for x in nums:\n"
                                "        if x in seen:\n"
                                "            return x\n"
                                "        seen.add(x)\n"
                                "    return None"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses a set",
                                     "test": "'set()' in code"},
                                    {"description": "Checks membership before adding",
                                     "test": "'in seen' in code and '.add(' in code"},
                                    {"description": "Single pass",
                                     "test": "code.count('for ') == 1"},
                                ]
                            },
                            "hints": [
                                "Track values in seen = set()",
                                "If x in seen: return x",
                                "Otherwise seen.add(x) and continue",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Arrays & Two Pointers",
            "description": "Scan and transform sequences efficiently.",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "In-Place Operations",
                    "content": _p(
                        "<h2>Modify without a second array</h2>",
                        "<p>Working <em>in place</em> keeps space at O(1). A write pointer tracks "
                        "where the next kept value goes:</p>",
                        "<pre><code>def remove_zeros(nums):\n"
                        "    w = 0\n"
                        "    for x in nums:\n"
                        "        if x != 0:\n"
                        "            nums[w] = x\n"
                        "            w += 1\n"
                        "    del nums[w:]\n"
                        "    return nums</code></pre>",
                        "<p>One read pointer (the loop), one write pointer (<code>w</code>).</p>",
                    ),
                    "code_example": (
                        "def remove_zeros(nums):\n"
                        "    w = 0\n"
                        "    for x in nums:\n"
                        "        if x != 0:\n"
                        "            nums[w] = x\n"
                        "            w += 1\n"
                        "    del nums[w:]\n"
                        "    return nums"
                    ),
                    "starter_code": (
                        "# Keep only non-zero values, in place, using a write pointer w.\n"
                        "def remove_zeros(nums):\n"
                        "    w = 0\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def remove_zeros(nums):\n"
                        "    w = 0\n"
                        "    for x in nums:\n"
                        "        if x != 0:\n"
                        "            nums[w] = x\n"
                        "            w += 1\n"
                        "    del nums[w:]\n"
                        "    return nums"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Write Pointer",
                            "description": "remove_zeros(nums) compacts non-zero values to the front using a write index w.",
                            "starter_code": "def remove_zeros(nums):\n    w = 0\n    ...",
                            "solution": (
                                "def remove_zeros(nums):\n"
                                "    w = 0\n"
                                "    for x in nums:\n"
                                "        if x != 0:\n"
                                "            nums[w] = x\n"
                                "            w += 1\n"
                                "    del nums[w:]\n"
                                "    return nums"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Keeps a write pointer",
                                     "test": "'w = 0' in code and 'w += 1' in code"},
                                    {"description": "Writes back into nums",
                                     "test": "'nums[w]' in code"},
                                    {"description": "Skips zeros",
                                     "test": "'!= 0' in code or '== 0' in code"},
                                ]
                            },
                            "hints": [
                                "w marks the next slot to fill",
                                "On a non-zero x: nums[w] = x; w += 1",
                                "Trim the tail with del nums[w:]",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "The Two-Pointer Pattern",
                    "content": _p(
                        "<h2>Move from both ends</h2>",
                        "<p>On a <strong>sorted</strong> array, a pointer at each end finds a target "
                        "pair in O(n) &mdash; no nested loop:</p>",
                        "<pre><code>def pair_sum(nums, target):   # nums is sorted\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo < hi:\n"
                        "        s = nums[lo] + nums[hi]\n"
                        "        if s == target:\n"
                        "            return (lo, hi)\n"
                        "        if s < target:\n"
                        "            lo += 1\n"
                        "        else:\n"
                        "            hi -= 1\n"
                        "    return None</code></pre>",
                        "<p>Too small &rarr; raise the low end. Too big &rarr; lower the high end.</p>",
                    ),
                    "code_example": (
                        "def pair_sum(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo < hi:\n"
                        "        s = nums[lo] + nums[hi]\n"
                        "        if s == target:\n"
                        "            return (lo, hi)\n"
                        "        if s < target:\n"
                        "            lo += 1\n"
                        "        else:\n"
                        "            hi -= 1\n"
                        "    return None"
                    ),
                    "starter_code": (
                        "# Sorted nums: return indices (lo, hi) that sum to target, else None.\n"
                        "def pair_sum(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def pair_sum(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo < hi:\n"
                        "        s = nums[lo] + nums[hi]\n"
                        "        if s == target:\n"
                        "            return (lo, hi)\n"
                        "        if s < target:\n"
                        "            lo += 1\n"
                        "        else:\n"
                        "            hi -= 1\n"
                        "    return None"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Converging Pointers",
                            "description": "pair_sum walks lo up and hi down while lo < hi to find a pair summing to target.",
                            "starter_code": "def pair_sum(nums, target):\n    lo, hi = 0, len(nums) - 1\n    ...",
                            "solution": (
                                "def pair_sum(nums, target):\n"
                                "    lo, hi = 0, len(nums) - 1\n"
                                "    while lo < hi:\n"
                                "        s = nums[lo] + nums[hi]\n"
                                "        if s == target:\n"
                                "            return (lo, hi)\n"
                                "        if s < target:\n"
                                "            lo += 1\n"
                                "        else:\n"
                                "            hi -= 1\n"
                                "    return None"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Two pointers from both ends",
                                     "test": "'lo, hi' in code and 'len(nums) - 1' in code"},
                                    {"description": "Loops while they haven't crossed",
                                     "test": "'while lo < hi' in code"},
                                    {"description": "Moves a pointer each branch",
                                     "test": "'lo += 1' in code and 'hi -= 1' in code"},
                                ]
                            },
                            "hints": [
                                "s = nums[lo] + nums[hi]",
                                "s < target -> lo += 1 ; s > target -> hi -= 1",
                                "Return (lo, hi) on an exact match",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Hash Maps & Sets",
            "description": "O(1) lookup changes what's possible.",
            "order": 3,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Frequency Counting",
                    "content": _p(
                        "<h2>A dict of counts</h2>",
                        "<pre><code>def counts(items):\n"
                        "    freq = {}\n"
                        "    for it in items:\n"
                        "        freq[it] = freq.get(it, 0) + 1\n"
                        "    return freq</code></pre>",
                        "<p><code>dict.get(key, 0)</code> gives a default so the first "
                        "<code>+ 1</code> works. This is the backbone of anagram checks, "
                        "&ldquo;most common&rdquo;, deduping with counts, and more &mdash; all "
                        "O(n).</p>",
                        "<p><code>collections.Counter(items)</code> does exactly this.</p>",
                    ),
                    "code_example": (
                        "def counts(items):\n"
                        "    freq = {}\n"
                        "    for it in items:\n"
                        "        freq[it] = freq.get(it, 0) + 1\n"
                        "    return freq"
                    ),
                    "starter_code": (
                        "# Build {value: occurrences} for items in one pass.\n"
                        "def counts(items):\n"
                        "    freq = {}\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def counts(items):\n"
                        "    freq = {}\n"
                        "    for it in items:\n"
                        "        freq[it] = freq.get(it, 0) + 1\n"
                        "    return freq"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Count Occurrences",
                            "description": "counts(items) returns a dict mapping each value to how many times it appears.",
                            "starter_code": "def counts(items):\n    freq = {}\n    ...",
                            "solution": (
                                "def counts(items):\n"
                                "    freq = {}\n"
                                "    for it in items:\n"
                                "        freq[it] = freq.get(it, 0) + 1\n"
                                "    return freq"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses a dict",
                                     "test": "'{}' in code or 'dict()' in code"},
                                    {"description": "Defaults missing keys to 0",
                                     "test": "'.get(' in code and ', 0)' in code"},
                                    {"description": "Increments the count",
                                     "test": "'+ 1' in code"},
                                ]
                            },
                            "hints": [
                                "freq = {}",
                                "freq[it] = freq.get(it, 0) + 1",
                                "Return freq (or use collections.Counter)",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Set Lookups Beat Nested Loops",
                    "content": _p(
                        "<h2>From O(n&sup2;) to O(n)</h2>",
                        "<p>The nested-loop pair-sum from module 1, rewritten with a set of "
                        "complements:</p>",
                        "<pre><code>def has_pair_sum(nums, target):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if target - x in seen:\n"
                        "            return True\n"
                        "        seen.add(x)\n"
                        "    return False</code></pre>",
                        "<p><code>x in some_set</code> and <code>x in some_dict</code> are O(1) on "
                        "average; <code>x in some_list</code> is O(n). Reach for a set whenever you "
                        "find yourself scanning to check membership.</p>",
                    ),
                    "code_example": (
                        "def has_pair_sum(nums, target):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if target - x in seen:\n"
                        "            return True\n"
                        "        seen.add(x)\n"
                        "    return False"
                    ),
                    "starter_code": (
                        "# O(n): true if any two values sum to target. Use a set of seen values.\n"
                        "def has_pair_sum(nums, target):\n"
                        "    seen = set()\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def has_pair_sum(nums, target):\n"
                        "    seen = set()\n"
                        "    for x in nums:\n"
                        "        if target - x in seen:\n"
                        "            return True\n"
                        "        seen.add(x)\n"
                        "    return False"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Complement Set",
                            "description": "has_pair_sum checks target - x in a set of seen values, giving O(n).",
                            "starter_code": "def has_pair_sum(nums, target):\n    seen = set()\n    ...",
                            "solution": (
                                "def has_pair_sum(nums, target):\n"
                                "    seen = set()\n"
                                "    for x in nums:\n"
                                "        if target - x in seen:\n"
                                "            return True\n"
                                "        seen.add(x)\n"
                                "    return False"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Looks up the complement",
                                     "test": "'target - x in seen' in code"},
                                    {"description": "Builds the set as it goes",
                                     "test": "'seen.add(' in code"},
                                    {"description": "One pass, no nested loop",
                                     "test": "code.count('for ') == 1"},
                                ]
                            },
                            "hints": [
                                "The complement of x is target - x",
                                "If it's already in seen, you found a pair",
                                "Otherwise seen.add(x)",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Stacks, Queues & Lists",
            "description": "Order of access decides the structure.",
            "order": 4,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Stacks (LIFO)",
                    "content": _p(
                        "<h2>Last in, first out</h2>",
                        "<p>A Python list is a stack: <code>append</code> to push, <code>pop</code> "
                        "to pop &mdash; both O(1). Classic use: matching brackets.</p>",
                        "<pre><code>def balanced(s):\n"
                        "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                        "    stack = []\n"
                        "    for ch in s:\n"
                        "        if ch in '([{':\n"
                        "            stack.append(ch)\n"
                        "        elif ch in pairs:\n"
                        "            if not stack or stack.pop() != pairs[ch]:\n"
                        "                return False\n"
                        "    return not stack</code></pre>",
                    ),
                    "code_example": (
                        "def balanced(s):\n"
                        "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                        "    stack = []\n"
                        "    for ch in s:\n"
                        "        if ch in '([{':\n"
                        "            stack.append(ch)\n"
                        "        elif ch in pairs:\n"
                        "            if not stack or stack.pop() != pairs[ch]:\n"
                        "                return False\n"
                        "    return not stack"
                    ),
                    "starter_code": (
                        "# True if every bracket in s is closed in the right order. Use a stack.\n"
                        "def balanced(s):\n"
                        "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                        "    stack = []\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def balanced(s):\n"
                        "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                        "    stack = []\n"
                        "    for ch in s:\n"
                        "        if ch in '([{':\n"
                        "            stack.append(ch)\n"
                        "        elif ch in pairs:\n"
                        "            if not stack or stack.pop() != pairs[ch]:\n"
                        "                return False\n"
                        "    return not stack"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Balanced Brackets",
                            "description": "balanced(s) pushes openers and pops to match closers, returning True only if the stack ends empty.",
                            "starter_code": (
                                "def balanced(s):\n"
                                "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                                "    stack = []\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "def balanced(s):\n"
                                "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                                "    stack = []\n"
                                "    for ch in s:\n"
                                "        if ch in '([{':\n"
                                "            stack.append(ch)\n"
                                "        elif ch in pairs:\n"
                                "            if not stack or stack.pop() != pairs[ch]:\n"
                                "                return False\n"
                                "    return not stack"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Pushes with append",
                                     "test": "'stack.append(' in code"},
                                    {"description": "Pops to match",
                                     "test": "'stack.pop()' in code"},
                                    {"description": "Requires an empty stack at the end",
                                     "test": "'return not stack' in code or 'len(stack) == 0' in code"},
                                ]
                            },
                            "hints": [
                                "Push every opening bracket",
                                "On a closer, pop and compare to pairs[ch]",
                                "Leftover items on the stack means unbalanced",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Queues (FIFO)",
                    "content": _p(
                        "<h2>First in, first out</h2>",
                        "<p>Use <code>collections.deque</code> for a queue &mdash; "
                        "<code>append</code> to enqueue, <code>popleft</code> to dequeue, both O(1). "
                        "(<code>list.pop(0)</code> is O(n) &mdash; avoid it.)</p>",
                        "<pre><code>from collections import deque\n\n"
                        "def first_n_even(limit):\n"
                        "    q = deque()\n"
                        "    n = 0\n"
                        "    while len(q) < limit:\n"
                        "        if n % 2 == 0:\n"
                        "            q.append(n)\n"
                        "        n += 1\n"
                        "    return list(q)</code></pre>",
                        "<p>Queues drive breadth-first search (module 6).</p>",
                    ),
                    "code_example": (
                        "from collections import deque\n\n"
                        "q = deque()\n"
                        "q.append(1)\n"
                        "q.popleft()"
                    ),
                    "starter_code": (
                        "from collections import deque\n\n"
                        "# Enqueue a, b, c then dequeue one item; return (dequeued, list(q)).\n"
                        "def demo():\n"
                        "    q = deque()\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "from collections import deque\n\n"
                        "def demo():\n"
                        "    q = deque()\n"
                        "    for x in ('a', 'b', 'c'):\n"
                        "        q.append(x)\n"
                        "    first = q.popleft()\n"
                        "    return (first, list(q))"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Use a Deque",
                            "description": "demo() enqueues with append and removes the oldest item with popleft.",
                            "starter_code": (
                                "from collections import deque\n\n"
                                "def demo():\n"
                                "    q = deque()\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "from collections import deque\n\n"
                                "def demo():\n"
                                "    q = deque()\n"
                                "    for x in ('a', 'b', 'c'):\n"
                                "        q.append(x)\n"
                                "    first = q.popleft()\n"
                                "    return (first, list(q))"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Creates a deque",
                                     "test": "'deque()' in code"},
                                    {"description": "Enqueues with append",
                                     "test": "'.append(' in code"},
                                    {"description": "Dequeues the oldest with popleft",
                                     "test": "'.popleft()' in code"},
                                ]
                            },
                            "hints": [
                                "q = deque()",
                                "q.append(x) to add to the back",
                                "q.popleft() removes from the front (FIFO)",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Recursion & Trees",
            "description": "Solve a problem in terms of a smaller one.",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Base Case + Recursive Step",
                    "content": _p(
                        "<h2>Two parts, always</h2>",
                        "<p>Every recursive function needs a <strong>base case</strong> that returns "
                        "without recursing, and a <strong>recursive step</strong> that moves toward "
                        "it. Trust that the smaller call is correct.</p>",
                        "<pre><code>def factorial(n):\n"
                        "    if n <= 1:          # base case\n"
                        "        return 1\n"
                        "    return n * factorial(n - 1)   # step</code></pre>",
                        "<p>No base case, or a step that doesn't shrink <code>n</code> &rarr; "
                        "infinite recursion &rarr; <code>RecursionError</code>.</p>",
                    ),
                    "code_example": (
                        "def factorial(n):\n"
                        "    if n <= 1:\n"
                        "        return 1\n"
                        "    return n * factorial(n - 1)"
                    ),
                    "starter_code": (
                        "# Recursive sum of a list: base case [] -> 0, else first + sum(rest).\n"
                        "def rsum(nums):\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def rsum(nums):\n"
                        "    if not nums:\n"
                        "        return 0\n"
                        "    return nums[0] + rsum(nums[1:])"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Recursive Sum",
                            "description": "rsum(nums) returns 0 for an empty list, otherwise nums[0] + rsum(nums[1:]).",
                            "starter_code": "def rsum(nums):\n    ...",
                            "solution": (
                                "def rsum(nums):\n"
                                "    if not nums:\n"
                                "        return 0\n"
                                "    return nums[0] + rsum(nums[1:])"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Has a base case",
                                     "test": "'if not nums' in code or 'len(nums) == 0' in code or 'nums == []' in code"},
                                    {"description": "Calls itself",
                                     "test": "'rsum(' in code and code.count('rsum(') >= 2"},
                                    {"description": "Recurses on a smaller list",
                                     "test": "'nums[1:]' in code"},
                                ]
                            },
                            "hints": [
                                "Base: if not nums: return 0",
                                "Step: nums[0] + rsum(nums[1:])",
                                "Each call drops the first element",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Depth-First Tree Traversal",
                    "content": _p(
                        "<h2>Recursion fits trees perfectly</h2>",
                        "<p>A binary tree node is <code>{'val', 'left', 'right'}</code> (or "
                        "<code>None</code>). DFS visits a node, then recurses left, then right:</p>",
                        "<pre><code>def tree_sum(node):\n"
                        "    if node is None:            # base case\n"
                        "        return 0\n"
                        "    return node['val'] + tree_sum(node['left']) + tree_sum(node['right'])</code></pre>",
                        "<p>Swap the order of the three parts to get pre-/in-/post-order. BFS "
                        "(level by level) uses a queue instead &mdash; next module.</p>",
                    ),
                    "code_example": (
                        "def tree_sum(node):\n"
                        "    if node is None:\n"
                        "        return 0\n"
                        "    return node['val'] + tree_sum(node['left']) + tree_sum(node['right'])"
                    ),
                    "starter_code": (
                        "# Sum every val in a binary tree of {'val','left','right'} nodes.\n"
                        "def tree_sum(node):\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def tree_sum(node):\n"
                        "    if node is None:\n"
                        "        return 0\n"
                        "    return node['val'] + tree_sum(node['left']) + tree_sum(node['right'])"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Sum a Tree",
                            "description": "tree_sum(node) returns 0 for None, else node['val'] plus the sum of both subtrees.",
                            "starter_code": "def tree_sum(node):\n    ...",
                            "solution": (
                                "def tree_sum(node):\n"
                                "    if node is None:\n"
                                "        return 0\n"
                                "    return node['val'] + tree_sum(node['left']) + tree_sum(node['right'])"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Base case on None",
                                     "test": "'is None' in code"},
                                    {"description": "Recurses into both children",
                                     "test": "\"tree_sum(node['left'])\" in code and \"tree_sum(node['right'])\" in code"},
                                    {"description": "Adds this node's value",
                                     "test": "\"node['val']\" in code"},
                                ]
                            },
                            "hints": [
                                "if node is None: return 0",
                                "Recurse on node['left'] and node['right']",
                                "Add node['val'] to both results",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Searching, Sorting, Graphs",
            "description": "The algorithms interviews and real systems lean on.",
            "order": 6,
            "difficulty": "advanced",
            "lessons": [
                {
                    "title": "Binary Search",
                    "content": _p(
                        "<h2>Halve the search space each step</h2>",
                        "<p>On a <strong>sorted</strong> array, compare the middle element and "
                        "discard half &mdash; O(log n):</p>",
                        "<pre><code>def bsearch(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo <= hi:\n"
                        "        mid = (lo + hi) // 2\n"
                        "        if nums[mid] == target:\n"
                        "            return mid\n"
                        "        if nums[mid] < target:\n"
                        "            lo = mid + 1\n"
                        "        else:\n"
                        "            hi = mid - 1\n"
                        "    return -1</code></pre>",
                        "<p>Watch the two classic bugs: <code>lo &lt;= hi</code> (not "
                        "<code>&lt;</code>), and moving past <code>mid</code> "
                        "(<code>mid + 1</code> / <code>mid - 1</code>) so the range always shrinks.</p>",
                    ),
                    "code_example": (
                        "def bsearch(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo <= hi:\n"
                        "        mid = (lo + hi) // 2\n"
                        "        if nums[mid] == target:\n"
                        "            return mid\n"
                        "        if nums[mid] < target:\n"
                        "            lo = mid + 1\n"
                        "        else:\n"
                        "            hi = mid - 1\n"
                        "    return -1"
                    ),
                    "starter_code": (
                        "# Return the index of target in sorted nums, or -1. O(log n).\n"
                        "def bsearch(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def bsearch(nums, target):\n"
                        "    lo, hi = 0, len(nums) - 1\n"
                        "    while lo <= hi:\n"
                        "        mid = (lo + hi) // 2\n"
                        "        if nums[mid] == target:\n"
                        "            return mid\n"
                        "        if nums[mid] < target:\n"
                        "            lo = mid + 1\n"
                        "        else:\n"
                        "            hi = mid - 1\n"
                        "    return -1"
                    ),
                    "order": 1,
                    "xp_reward": 25,
                    "exercises": [
                        {
                            "title": "Implement Binary Search",
                            "description": "bsearch narrows lo/hi around mid = (lo+hi)//2 while lo <= hi, returning the index or -1.",
                            "starter_code": "def bsearch(nums, target):\n    lo, hi = 0, len(nums) - 1\n    ...",
                            "solution": (
                                "def bsearch(nums, target):\n"
                                "    lo, hi = 0, len(nums) - 1\n"
                                "    while lo <= hi:\n"
                                "        mid = (lo + hi) // 2\n"
                                "        if nums[mid] == target:\n"
                                "            return mid\n"
                                "        if nums[mid] < target:\n"
                                "            lo = mid + 1\n"
                                "        else:\n"
                                "            hi = mid - 1\n"
                                "    return -1"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Midpoint each iteration",
                                     "test": "'(lo + hi) // 2' in code"},
                                    {"description": "Inclusive loop condition",
                                     "test": "'while lo <= hi' in code"},
                                    {"description": "Steps past mid",
                                     "test": "'mid + 1' in code and 'mid - 1' in code"},
                                    {"description": "Reports not-found",
                                     "test": "'return -1' in code"},
                                ]
                            },
                            "hints": [
                                "mid = (lo + hi) // 2",
                                "nums[mid] < target -> lo = mid + 1, else hi = mid - 1",
                                "Loop while lo <= hi; return -1 if it exits",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Breadth-First Search",
                    "content": _p(
                        "<h2>Explore a graph level by level</h2>",
                        "<p>A graph as an adjacency dict <code>{node: [neighbours]}</code>. BFS uses "
                        "a queue and a <code>visited</code> set &mdash; it finds the fewest-edges "
                        "path:</p>",
                        "<pre><code>from collections import deque\n\n"
                        "def bfs(graph, start):\n"
                        "    seen = {start}\n"
                        "    q = deque([start])\n"
                        "    order = []\n"
                        "    while q:\n"
                        "        node = q.popleft()\n"
                        "        order.append(node)\n"
                        "        for nb in graph[node]:\n"
                        "            if nb not in seen:\n"
                        "                seen.add(nb)\n"
                        "                q.append(nb)\n"
                        "    return order</code></pre>",
                        "<p>Swap the queue for a stack (or recursion) and you have DFS. Mark nodes "
                        "seen <em>when you enqueue</em>, not when you visit, or they get queued "
                        "twice.</p>",
                    ),
                    "code_example": (
                        "from collections import deque\n\n"
                        "def bfs(graph, start):\n"
                        "    seen = {start}\n"
                        "    q = deque([start])\n"
                        "    order = []\n"
                        "    while q:\n"
                        "        node = q.popleft()\n"
                        "        order.append(node)\n"
                        "        for nb in graph[node]:\n"
                        "            if nb not in seen:\n"
                        "                seen.add(nb)\n"
                        "                q.append(nb)\n"
                        "    return order"
                    ),
                    "starter_code": (
                        "from collections import deque\n\n"
                        "# Return nodes of graph in BFS order from start. Use a deque + seen set.\n"
                        "def bfs(graph, start):\n"
                        "    seen = {start}\n"
                        "    q = deque([start])\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "from collections import deque\n\n"
                        "def bfs(graph, start):\n"
                        "    seen = {start}\n"
                        "    q = deque([start])\n"
                        "    order = []\n"
                        "    while q:\n"
                        "        node = q.popleft()\n"
                        "        order.append(node)\n"
                        "        for nb in graph[node]:\n"
                        "            if nb not in seen:\n"
                        "                seen.add(nb)\n"
                        "                q.append(nb)\n"
                        "    return order"
                    ),
                    "order": 2,
                    "xp_reward": 25,
                    "exercises": [
                        {
                            "title": "Traverse a Graph",
                            "description": "bfs(graph, start) pops from a deque, enqueues unseen neighbours, and marks them seen on enqueue.",
                            "starter_code": (
                                "from collections import deque\n\n"
                                "def bfs(graph, start):\n"
                                "    seen = {start}\n"
                                "    q = deque([start])\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "from collections import deque\n\n"
                                "def bfs(graph, start):\n"
                                "    seen = {start}\n"
                                "    q = deque([start])\n"
                                "    order = []\n"
                                "    while q:\n"
                                "        node = q.popleft()\n"
                                "        order.append(node)\n"
                                "        for nb in graph[node]:\n"
                                "            if nb not in seen:\n"
                                "                seen.add(nb)\n"
                                "                q.append(nb)\n"
                                "    return order"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Processes the queue until empty",
                                     "test": "'while q' in code and '.popleft()' in code"},
                                    {"description": "Skips already-seen nodes",
                                     "test": "'not in seen' in code"},
                                    {"description": "Marks seen when enqueuing",
                                     "test": "'seen.add(' in code and 'q.append(' in code"},
                                ]
                            },
                            "hints": [
                                "Pop with q.popleft(), record the node",
                                "For each neighbour not in seen: seen.add(nb); q.append(nb)",
                                "Loop while the queue is non-empty",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_dsa_track():
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == DSA_TRACK["slug"])
        )
        if existing.scalars().first():
            print("Data Structures & Algorithms track already exists; nothing to do.")
            return

        language = Language(
            name=DSA_TRACK["name"],
            slug=DSA_TRACK["slug"],
            icon=DSA_TRACK["icon"],
            description=DSA_TRACK["description"],
            color=DSA_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in DSA_TRACK["modules"]:
            module = Module(
                language_id=language.id,
                title=mod_data["title"],
                description=mod_data["description"],
                order=mod_data["order"],
                difficulty=mod_data["difficulty"],
                level=mod_data["order"],
            )
            db.add(module)
            await db.flush()

            for lesson_data in mod_data.get("lessons", []):
                lesson = Lesson(
                    module_id=module.id,
                    title=lesson_data["title"],
                    content=lesson_data["content"],
                    code_example=lesson_data["code_example"],
                    starter_code=lesson_data["starter_code"],
                    solution=lesson_data["solution"],
                    order=lesson_data["order"],
                    xp_reward=lesson_data["xp_reward"],
                )
                db.add(lesson)
                await db.flush()

                for ex_data in lesson_data.get("exercises", []):
                    db.add(
                        Exercise(
                            lesson_id=lesson.id,
                            title=ex_data["title"],
                            description=ex_data["description"],
                            starter_code=ex_data["starter_code"],
                            solution=ex_data["solution"],
                            test_cases=ex_data["test_cases"],
                            hints=ex_data["hints"],
                            order=ex_data["order"],
                        )
                    )

        await db.commit()
        n_mod = len(DSA_TRACK["modules"])
        n_les = sum(len(m["lessons"]) for m in DSA_TRACK["modules"])
        print(f"Data Structures & Algorithms track seeded: {n_mod} modules, {n_les} lessons.")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_dsa_track()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
