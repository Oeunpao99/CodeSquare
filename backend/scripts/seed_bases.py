"""Flesh out the three foundation tracks (python, javascript, html-css).

seed_data.py only lays down a single starter module per base language. The
career majors lean on these as their entry point, so this script appends the
remaining beginner modules + lessons.

Idempotent: a module is only created if one with the same title doesn't already
exist for that language. Safe to re-run.

    python seed_bases.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


def code_check(desc, expr):
    """A string-based exercise test (the runner exposes the raw source as `code`)."""
    return {"description": desc, "test": f"assert {expr}, {desc!r}"}


PYTHON_MODULES = [
    {
        "title": "Control Flow",
        "description": "Make decisions and repeat work.",
        "order": 2,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "if / elif / else",
                "content": (
                    "<h2>Branching</h2><p>An <code>if</code> statement runs a block "
                    "only when its condition is <strong>True</strong>. Add "
                    "<code>elif</code> for more cases and <code>else</code> for "
                    "everything left over. Indentation (4 spaces) marks the block.</p>"
                ),
                "code_example": (
                    "score = 82\n"
                    "if score >= 90:\n"
                    "    grade = 'A'\n"
                    "elif score >= 80:\n"
                    "    grade = 'B'\n"
                    "else:\n"
                    "    grade = 'C'\n"
                    "print(grade)"
                ),
                "starter_code": (
                    "temp = 30\n"
                    "# print 'hot' if temp is 25 or more, otherwise 'cool'\n"
                ),
                "solution": "temp = 30\nif temp >= 25:\n    print('hot')\nelse:\n    print('cool')",
                "order": 1,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Even or Odd",
                        "description": "Set `label` to 'even' or 'odd' based on the value of `n`.",
                        "starter_code": "n = 7\nlabel = ''\n# your code here\nprint(label)",
                        "solution": "n = 7\nlabel = 'even' if n % 2 == 0 else 'odd'\nprint(label)",
                        "test_cases": {"tests": [
                            {"description": "label is 'odd' for n = 7",
                             "test": "assert label == 'odd'"},
                        ]},
                        "hints": ["The remainder operator is %", "n % 2 == 0 means even"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Comparisons & Booleans",
                "content": (
                    "<h2>True / False logic</h2><p>Comparisons (<code>== != &lt; &gt; "
                    "&lt;= &gt;=</code>) produce a <strong>bool</strong>. Combine them "
                    "with <code>and</code>, <code>or</code>, <code>not</code>.</p>"
                ),
                "code_example": (
                    "age = 20\n"
                    "has_ticket = True\n"
                    "can_enter = age >= 18 and has_ticket\n"
                    "print(can_enter)  # True"
                ),
                "starter_code": "a = 5\nb = 12\n# set 'both_positive' to True only if a and b are both > 0\n",
                "solution": "a = 5\nb = 12\nboth_positive = a > 0 and b > 0\nprint(both_positive)",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "while loops",
                "content": (
                    "<h2>Repeat until done</h2><p>A <code>while</code> loop runs as "
                    "long as its condition stays True. Change something inside the "
                    "loop so it eventually stops, or you get an infinite loop.</p>"
                ),
                "code_example": (
                    "count = 3\n"
                    "while count > 0:\n"
                    "    print(count)\n"
                    "    count -= 1\n"
                    "print('lift off')"
                ),
                "starter_code": "# print the numbers 1 to 5 using a while loop\ni = 1\n",
                "solution": "i = 1\nwhile i <= 5:\n    print(i)\n    i += 1",
                "order": 3,
                "xp_reward": 15,
            },
            {
                "title": "for loops & range",
                "content": (
                    "<h2>Loop a known number of times</h2><p><code>for x in range(n)</code> "
                    "gives you 0..n-1. <code>range(a, b)</code> and <code>range(a, b, "
                    "step)</code> also work. Use a <code>for</code> loop over any list "
                    "or string too.</p>"
                ),
                "code_example": (
                    "total = 0\n"
                    "for i in range(1, 6):\n"
                    "    total += i\n"
                    "print(total)  # 15"
                ),
                "starter_code": "# sum the even numbers from 0 to 20 (inclusive)\ntotal = 0\n",
                "solution": "total = 0\nfor i in range(0, 21, 2):\n    total += i\nprint(total)",
                "order": 4,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Countdown",
                        "description": "Append the numbers 5,4,3,2,1 (in that order) to the list `seq`.",
                        "starter_code": "seq = []\n# your code here\nprint(seq)",
                        "solution": "seq = []\nfor i in range(5, 0, -1):\n    seq.append(i)\nprint(seq)",
                        "test_cases": {"tests": [
                            {"description": "seq == [5, 4, 3, 2, 1]",
                             "test": "assert seq == [5, 4, 3, 2, 1]"},
                        ]},
                        "hints": ["range can count down with a negative step",
                                  "range(5, 0, -1)"],
                        "order": 1,
                    }
                ],
            },
        ],
    },
    {
        "title": "Collections",
        "description": "Store many values: lists, dicts and strings.",
        "order": 3,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Lists",
                "content": (
                    "<h2>Ordered collections</h2><p>A list holds items in order. Index "
                    "from <code>0</code>; negative indexes count from the end. "
                    "<code>append</code>, <code>pop</code>, <code>len()</code> and "
                    "slicing (<code>xs[1:3]</code>) are the everyday tools.</p>"
                ),
                "code_example": (
                    "fruits = ['apple', 'pear']\n"
                    "fruits.append('kiwi')\n"
                    "print(fruits[0], fruits[-1], len(fruits))"
                ),
                "starter_code": "nums = [4, 8, 15, 16, 23, 42]\n# print the first three items as a list\n",
                "solution": "nums = [4, 8, 15, 16, 23, 42]\nprint(nums[:3])",
                "order": 1,
                "xp_reward": 15,
            },
            {
                "title": "Looping over lists",
                "content": (
                    "<h2>Process each item</h2><p><code>for item in xs:</code> visits "
                    "each element. Use <code>enumerate(xs)</code> when you also need "
                    "the index. Build a new list as you go.</p>"
                ),
                "code_example": (
                    "prices = [10, 20, 30]\n"
                    "with_tax = []\n"
                    "for p in prices:\n"
                    "    with_tax.append(p * 1.1)\n"
                    "print(with_tax)"
                ),
                "starter_code": "words = ['hi', 'there', 'you']\n# build 'lengths' = [2, 5, 3]\nlengths = []\n",
                "solution": "words = ['hi', 'there', 'you']\nlengths = []\nfor w in words:\n    lengths.append(len(w))\nprint(lengths)",
                "order": 2,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Sum a List",
                        "description": "Without using sum(), set `total` to the sum of every number in `nums`.",
                        "starter_code": "nums = [3, 9, 12, 6]\ntotal = 0\n# your code here\nprint(total)",
                        "solution": "nums = [3, 9, 12, 6]\ntotal = 0\nfor n in nums:\n    total += n\nprint(total)",
                        "test_cases": {"tests": [
                            {"description": "total == 30", "test": "assert total == 30"},
                        ]},
                        "hints": ["Start total at 0", "Add each n inside the loop"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Dictionaries",
                "content": (
                    "<h2>Key &rarr; value lookups</h2><p>A dict maps keys to values: "
                    "<code>d['name']</code>. <code>d.get(key, default)</code> avoids "
                    "errors on missing keys. Loop with <code>for k, v in d.items()</code>.</p>"
                ),
                "code_example": (
                    "user = {'name': 'Sam', 'age': 30}\n"
                    "user['city'] = 'Phnom Penh'\n"
                    "for key, value in user.items():\n"
                    "    print(key, '=', value)"
                ),
                "starter_code": (
                    "inventory = {'pen': 3, 'book': 1}\n"
                    "# add 2 to the pen count, then print the dict\n"
                ),
                "solution": "inventory = {'pen': 3, 'book': 1}\ninventory['pen'] += 2\nprint(inventory)",
                "order": 3,
                "xp_reward": 15,
            },
            {
                "title": "Strings & f-strings",
                "content": (
                    "<h2>Working with text</h2><p>Strings support slicing and methods "
                    "like <code>.lower()</code>, <code>.strip()</code>, "
                    "<code>.split()</code>, <code>.replace()</code>. Build output with "
                    "an <strong>f-string</strong>: <code>f\"Hi {name}\"</code>.</p>"
                ),
                "code_example": (
                    "name = '  Alice  '\n"
                    "clean = name.strip().lower()\n"
                    "print(f'Welcome, {clean}! ({len(clean)} letters)')"
                ),
                "starter_code": "sentence = 'the quick brown fox'\n# print the number of words\n",
                "solution": "sentence = 'the quick brown fox'\nprint(len(sentence.split()))",
                "order": 4,
                "xp_reward": 15,
            },
        ],
    },
    {
        "title": "Functions",
        "description": "Package logic you can reuse.",
        "order": 4,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Defining a function",
                "content": (
                    "<h2>def</h2><p>A function groups steps under a name so you can "
                    "run them again. <code>def greet():</code> defines it; "
                    "<code>greet()</code> calls it.</p>"
                ),
                "code_example": (
                    "def greet():\n"
                    "    print('Hello!')\n\n"
                    "greet()\n"
                    "greet()"
                ),
                "starter_code": "# define a function 'banner' that prints '=== MENU ===', then call it\n",
                "solution": "def banner():\n    print('=== MENU ===')\n\nbanner()",
                "order": 1,
                "xp_reward": 15,
            },
            {
                "title": "Parameters & return",
                "content": (
                    "<h2>Inputs and outputs</h2><p>Parameters feed data in; "
                    "<code>return</code> hands a result back to the caller. A function "
                    "without <code>return</code> gives back <code>None</code>.</p>"
                ),
                "code_example": (
                    "def area(width, height):\n"
                    "    return width * height\n\n"
                    "print(area(3, 4))  # 12"
                ),
                "starter_code": "def double(n):\n    pass  # return n times 2\n\nprint(double(21))",
                "solution": "def double(n):\n    return n * 2\n\nprint(double(21))",
                "order": 2,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Max of Two",
                        "description": "Finish `bigger(a, b)` so it returns the larger of the two arguments.",
                        "starter_code": "def bigger(a, b):\n    pass\n\nresult = bigger(9, 4)\nprint(result)",
                        "solution": "def bigger(a, b):\n    return a if a > b else b\n\nresult = bigger(9, 4)\nprint(result)",
                        "test_cases": {"tests": [
                            {"description": "bigger(9, 4) == 9", "test": "assert bigger(9, 4) == 9"},
                            {"description": "bigger(2, 20) == 20", "test": "assert bigger(2, 20) == 20"},
                        ]},
                        "hints": ["Compare with >", "A conditional expression fits on one line"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Default & keyword arguments",
                "content": (
                    "<h2>Flexible calls</h2><p>Give a parameter a default: "
                    "<code>def greet(name, greeting='Hi')</code>. Callers can pass "
                    "arguments by name: <code>greet('Sam', greeting='Yo')</code>.</p>"
                ),
                "code_example": (
                    "def price(amount, tax=0.1):\n"
                    "    return round(amount * (1 + tax), 2)\n\n"
                    "print(price(100))          # 110.0\n"
                    "print(price(100, tax=0.2)) # 120.0"
                ),
                "starter_code": "def join(parts, sep='-'):\n    pass  # return the parts joined by sep\n\nprint(join(['a', 'b', 'c']))",
                "solution": "def join(parts, sep='-'):\n    return sep.join(parts)\n\nprint(join(['a', 'b', 'c']))",
                "order": 3,
                "xp_reward": 15,
            },
            {
                "title": "Putting it together",
                "content": (
                    "<h2>A tiny program</h2><p>Combine loops, a dict and a function "
                    "to tally votes. This is the shape of most small scripts: read "
                    "input, build a structure, summarise it.</p>"
                ),
                "code_example": (
                    "def tally(votes):\n"
                    "    counts = {}\n"
                    "    for v in votes:\n"
                    "        counts[v] = counts.get(v, 0) + 1\n"
                    "    return counts\n\n"
                    "print(tally(['a', 'b', 'a', 'c', 'a']))"
                ),
                "starter_code": (
                    "def longest(words):\n"
                    "    # return the longest string in the list\n"
                    "    pass\n\n"
                    "print(longest(['hi', 'hello', 'hey']))"
                ),
                "solution": (
                    "def longest(words):\n"
                    "    best = ''\n"
                    "    for w in words:\n"
                    "        if len(w) > len(best):\n"
                    "            best = w\n"
                    "    return best\n\n"
                    "print(longest(['hi', 'hello', 'hey']))"
                ),
                "order": 4,
                "xp_reward": 20,
                "exercises": [
                    {
                        "title": "Word Counter",
                        "description": "Finish `count_words(text)` — return a dict of {word: times it appears}.",
                        "starter_code": "def count_words(text):\n    pass\n\nprint(count_words('a b a c b a'))",
                        "solution": "def count_words(text):\n    counts = {}\n    for w in text.split():\n        counts[w] = counts.get(w, 0) + 1\n    return counts\n\nprint(count_words('a b a c b a'))",
                        "test_cases": {"tests": [
                            {"description": "counts 'a' three times",
                             "test": "assert count_words('a b a c b a')['a'] == 3"},
                        ]},
                        "hints": ["Split the text into words", "dict.get(w, 0) + 1"],
                        "order": 1,
                    }
                ],
            },
        ],
    },
]


JS_MODULES = [
    {
        "title": "Values & Operators",
        "description": "The data JavaScript works with.",
        "order": 2,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Data types",
                "content": (
                    "<h2>Primitives</h2><p>JavaScript has <code>number</code>, "
                    "<code>string</code>, <code>boolean</code>, <code>null</code>, "
                    "<code>undefined</code>. Check with <code>typeof x</code>. Prefer "
                    "<code>const</code>; use <code>let</code> only when you reassign.</p>"
                ),
                "code_example": (
                    "const name = 'Ada';\n"
                    "let age = 36;\n"
                    "const active = true;\n"
                    "console.log(typeof name, typeof age, typeof active);"
                ),
                "starter_code": "// declare a const 'pi' set to 3.14 and log its type\n",
                "solution": "const pi = 3.14;\nconsole.log(typeof pi);",
                "order": 1,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Use const",
                        "description": "Declare a constant called `city` with any string value.",
                        "starter_code": "// declare city here\n",
                        "solution": "const city = 'Phnom Penh';",
                        "test_cases": {"tests": [code_check("uses const", "'const' in code"),
                                                 code_check("names it city", "'city' in code")]},
                        "hints": ["const name = value;"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Template literals",
                "content": (
                    "<h2>Building strings</h2><p>Backtick strings let you embed "
                    "expressions with <code>${...}</code> and span multiple lines.</p>"
                ),
                "code_example": (
                    "const user = 'Sam';\n"
                    "const items = 3;\n"
                    "console.log(`${user} has ${items} item${items === 1 ? '' : 's'}`);"
                ),
                "starter_code": "const w = 4, h = 5;\n// log 'Area: 20' using a template literal\n",
                "solution": "const w = 4, h = 5;\nconsole.log(`Area: ${w * h}`);",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "Comparison & logical operators",
                "content": (
                    "<h2>Making decisions</h2><p>Always compare with <code>===</code> "
                    "and <code>!==</code> (strict). Combine conditions with "
                    "<code>&amp;&amp;</code>, <code>||</code>, <code>!</code>.</p>"
                ),
                "code_example": (
                    "const age = 20, member = false;\n"
                    "console.log(age >= 18 && !member); // true"
                ),
                "starter_code": "const score = 74;\n// log true if score is between 70 and 100 inclusive\n",
                "solution": "const score = 74;\nconsole.log(score >= 70 && score <= 100);",
                "order": 3,
                "xp_reward": 15,
            },
            {
                "title": "Truthy, falsy & coercion",
                "content": (
                    "<h2>Watch the edges</h2><p><code>0</code>, <code>''</code>, "
                    "<code>null</code>, <code>undefined</code>, <code>NaN</code> and "
                    "<code>false</code> are <strong>falsy</strong>; everything else is "
                    "truthy. <code>+</code> with a string concatenates, so convert with "
                    "<code>Number(x)</code>.</p>"
                ),
                "code_example": (
                    "console.log('5' + 1); // '51'\n"
                    "console.log(Number('5') + 1); // 6\n"
                    "console.log(Boolean('')); // false"
                ),
                "starter_code": "const raw = '42';\n// log raw plus 8 as a number (50)\n",
                "solution": "const raw = '42';\nconsole.log(Number(raw) + 8);",
                "order": 4,
                "xp_reward": 15,
            },
        ],
    },
    {
        "title": "Control Flow & Data",
        "description": "Branch, loop, and work with arrays and objects.",
        "order": 3,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "if / else and loops",
                "content": (
                    "<h2>Flow</h2><p><code>if/else if/else</code> branch; "
                    "<code>for (let i = 0; i &lt; n; i++)</code> and "
                    "<code>while</code> repeat. <code>for...of</code> loops the values "
                    "of an array.</p>"
                ),
                "code_example": (
                    "let total = 0;\n"
                    "for (const n of [1, 2, 3, 4]) {\n"
                    "  if (n % 2 === 0) total += n;\n"
                    "}\n"
                    "console.log(total); // 6"
                ),
                "starter_code": "// log every number from 1 to 5 with a for loop\n",
                "solution": "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}",
                "order": 1,
                "xp_reward": 15,
            },
            {
                "title": "Arrays",
                "content": (
                    "<h2>Ordered lists</h2><p>Create with <code>[]</code>. "
                    "<code>push</code>/<code>pop</code>, <code>.length</code>, index "
                    "from 0. <code>includes</code>, <code>indexOf</code> and slicing "
                    "with <code>slice</code>.</p>"
                ),
                "code_example": (
                    "const xs = [10, 20];\n"
                    "xs.push(30);\n"
                    "console.log(xs.length, xs[0], xs.includes(20));"
                ),
                "starter_code": "const names = ['ann', 'bob', 'cy'];\n// log the last name in the array\n",
                "solution": "const names = ['ann', 'bob', 'cy'];\nconsole.log(names[names.length - 1]);",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "map / filter / reduce",
                "content": (
                    "<h2>Transform without loops</h2><p><code>map</code> makes a new "
                    "array of the same length, <code>filter</code> keeps items that "
                    "pass a test, <code>reduce</code> folds an array into one value.</p>"
                ),
                "code_example": (
                    "const nums = [1, 2, 3, 4];\n"
                    "console.log(nums.map(n => n * n));      // [1,4,9,16]\n"
                    "console.log(nums.filter(n => n % 2));   // [1,3]\n"
                    "console.log(nums.reduce((a, b) => a + b)); // 10"
                ),
                "starter_code": "const prices = [10, 25, 5, 40];\n// log a new array of prices over 20\n",
                "solution": "const prices = [10, 25, 5, 40];\nconsole.log(prices.filter(p => p > 20));",
                "order": 3,
                "xp_reward": 20,
            },
            {
                "title": "Objects",
                "content": (
                    "<h2>Named fields</h2><p>Objects group related values by key: "
                    "<code>obj.key</code> or <code>obj['key']</code>. "
                    "<code>Object.keys(obj)</code> lists the keys.</p>"
                ),
                "code_example": (
                    "const book = { title: 'Dune', pages: 412 };\n"
                    "book.author = 'Herbert';\n"
                    "console.log(Object.keys(book));"
                ),
                "starter_code": "const p = { x: 3, y: 4 };\n// log the sum of x and y\n",
                "solution": "const p = { x: 3, y: 4 };\nconsole.log(p.x + p.y);",
                "order": 4,
                "xp_reward": 15,
            },
        ],
    },
    {
        "title": "Functions & the DOM",
        "description": "Reusable logic and reacting to the page.",
        "order": 4,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Functions & arrow functions",
                "content": (
                    "<h2>Two ways to write them</h2><p><code>function add(a, b) { "
                    "return a + b; }</code> or the arrow form <code>const add = (a, b) "
                    "=&gt; a + b;</code>. Arrows are shorter and common for callbacks.</p>"
                ),
                "code_example": (
                    "const square = n => n * n;\n"
                    "function greet(name = 'friend') {\n"
                    "  return `Hi, ${name}`;\n"
                    "}\n"
                    "console.log(square(5), greet());"
                ),
                "starter_code": "// write an arrow function 'toCents' that turns dollars into cents\n// toCents(2.5) === 250\n",
                "solution": "const toCents = d => Math.round(d * 100);\nconsole.log(toCents(2.5));",
                "order": 1,
                "xp_reward": 15,
            },
            {
                "title": "Callbacks",
                "content": (
                    "<h2>Passing behaviour</h2><p>A callback is a function given to "
                    "another function to run later — array methods and event listeners "
                    "both use them.</p>"
                ),
                "code_example": (
                    "['a', 'b', 'c'].forEach((letter, i) => {\n"
                    "  console.log(i, letter);\n"
                    "});"
                ),
                "starter_code": "const nums = [3, 1, 2];\n// use forEach to log each number doubled\n",
                "solution": "const nums = [3, 1, 2];\nnums.forEach(n => console.log(n * 2));",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "Selecting DOM elements",
                "content": (
                    "<h2>Reaching into the page</h2><p><code>document.querySelector"
                    "('#id')</code> returns the first match; "
                    "<code>querySelectorAll('.klass')</code> returns a list. Read or "
                    "set <code>.textContent</code>, <code>.value</code>, "
                    "<code>.classList</code>.</p>"
                ),
                "code_example": (
                    "const title = document.querySelector('h1');\n"
                    "title.textContent = 'Updated!';\n"
                    "title.classList.add('active');"
                ),
                "starter_code": "// set the text of the element with id 'status' to 'ready'\n",
                "solution": "document.querySelector('#status').textContent = 'ready';",
                "order": 3,
                "xp_reward": 15,
            },
            {
                "title": "Handling events",
                "content": (
                    "<h2>Responding to the user</h2><p><code>element.addEventListener"
                    "('click', handler)</code> runs <code>handler</code> every time "
                    "the event fires. The handler often reads an input's "
                    "<code>.value</code> and updates the page.</p>"
                ),
                "code_example": (
                    "const btn = document.querySelector('#go');\n"
                    "let clicks = 0;\n"
                    "btn.addEventListener('click', () => {\n"
                    "  clicks++;\n"
                    "  console.log(`clicked ${clicks} times`);\n"
                    "});"
                ),
                "starter_code": (
                    "const input = document.querySelector('#name');\n"
                    "const btn = document.querySelector('#save');\n"
                    "// on click, log 'Saved: ' + the input value\n"
                ),
                "solution": (
                    "const input = document.querySelector('#name');\n"
                    "const btn = document.querySelector('#save');\n"
                    "btn.addEventListener('click', () => {\n"
                    "  console.log('Saved: ' + input.value);\n"
                    "});"
                ),
                "order": 4,
                "xp_reward": 20,
            },
        ],
    },
]


HTML_MODULES = [
    {
        "title": "Structuring Content",
        "description": "The elements that make up a page.",
        "order": 2,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Text elements",
                "content": (
                    "<h2>Headings, paragraphs, lists</h2><p>Use <code>&lt;h1&gt;</code>"
                    "–<code>&lt;h6&gt;</code> for headings (one <code>h1</code> per "
                    "page), <code>&lt;p&gt;</code> for paragraphs, "
                    "<code>&lt;ul&gt;/&lt;ol&gt;</code> with <code>&lt;li&gt;</code> "
                    "for lists.</p>"
                ),
                "code_example": (
                    "<h1>Recipes</h1>\n"
                    "<p>Quick meals for busy nights.</p>\n"
                    "<ul>\n"
                    "  <li>Pasta</li>\n"
                    "  <li>Fried rice</li>\n"
                    "</ul>"
                ),
                "starter_code": "<!-- add an h2 'Shopping List' and a ul with 3 li items -->\n",
                "solution": "<h2>Shopping List</h2>\n<ul>\n  <li>Eggs</li>\n  <li>Milk</li>\n  <li>Bread</li>\n</ul>",
                "order": 1,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Make a List",
                        "description": "Write a <ul> that contains at least two <li> elements.",
                        "starter_code": "<!-- your list here -->\n",
                        "solution": "<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>",
                        "test_cases": {"tests": [
                            code_check("has a <ul>", "'<ul' in code.lower()"),
                            code_check("has at least two <li>", "code.lower().count('<li') >= 2"),
                        ]},
                        "hints": ["<ul> wraps <li> items"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Links & images",
                "content": (
                    "<h2>Connecting pages</h2><p><code>&lt;a href=\"...\"&gt;text"
                    "&lt;/a&gt;</code> links out; <code>&lt;img src=\"...\" alt=\"...\""
                    "&gt;</code> embeds an image. Always write meaningful "
                    "<code>alt</code> text.</p>"
                ),
                "code_example": (
                    "<a href=\"https://example.com\">Visit the site</a>\n"
                    "<img src=\"logo.png\" alt=\"Company logo\">"
                ),
                "starter_code": "<!-- link the text 'Docs' to https://example.com/docs -->\n",
                "solution": "<a href=\"https://example.com/docs\">Docs</a>",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "Semantic layout",
                "content": (
                    "<h2>Describe the regions</h2><p><code>&lt;header&gt;</code>, "
                    "<code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, "
                    "<code>&lt;section&gt;</code>, <code>&lt;footer&gt;</code> tell "
                    "browsers and screen readers what each block is for.</p>"
                ),
                "code_example": (
                    "<header><h1>My Blog</h1></header>\n"
                    "<main>\n"
                    "  <article><h2>First post</h2><p>Hello.</p></article>\n"
                    "</main>\n"
                    "<footer><p>&copy; 2026</p></footer>"
                ),
                "starter_code": "<!-- wrap a heading in <header> and a paragraph in <main> -->\n",
                "solution": "<header>\n  <h1>Welcome</h1>\n</header>\n<main>\n  <p>Glad you're here.</p>\n</main>",
                "order": 3,
                "xp_reward": 15,
                "exercises": [
                    {
                        "title": "Use Semantic Tags",
                        "description": "Include a <header> and a <footer> element in your markup.",
                        "starter_code": "<!-- your page skeleton -->\n",
                        "solution": "<header><h1>Site</h1></header>\n<main><p>Body</p></main>\n<footer><p>End</p></footer>",
                        "test_cases": {"tests": [
                            code_check("has <header>", "'<header' in code.lower()"),
                            code_check("has <footer>", "'<footer' in code.lower()"),
                        ]},
                        "hints": ["<header> ... </header>", "<footer> ... </footer>"],
                        "order": 1,
                    }
                ],
            },
            {
                "title": "Forms & inputs",
                "content": (
                    "<h2>Collecting input</h2><p><code>&lt;form&gt;</code> wraps "
                    "fields. <code>&lt;label&gt;</code> + <code>&lt;input&gt;</code> "
                    "(with <code>type</code> and <code>name</code>), and a "
                    "<code>&lt;button&gt;</code> to submit.</p>"
                ),
                "code_example": (
                    "<form>\n"
                    "  <label>Email <input type=\"email\" name=\"email\"></label>\n"
                    "  <button type=\"submit\">Sign up</button>\n"
                    "</form>"
                ),
                "starter_code": "<!-- a form with a text input named 'city' and a submit button -->\n",
                "solution": "<form>\n  <label>City <input type=\"text\" name=\"city\"></label>\n  <button type=\"submit\">Go</button>\n</form>",
                "order": 4,
                "xp_reward": 15,
            },
        ],
    },
    {
        "title": "Styling with CSS",
        "description": "Colours, spacing and layout.",
        "order": 3,
        "difficulty": "beginner",
        "lessons": [
            {
                "title": "Selectors & the box model",
                "content": (
                    "<h2>Targeting elements</h2><p>Style by tag (<code>p</code>), "
                    "class (<code>.card</code>) or id (<code>#hero</code>). Every box "
                    "has <strong>content &rarr; padding &rarr; border &rarr; margin</strong>.</p>"
                ),
                "code_example": (
                    ".card {\n"
                    "  padding: 16px;\n"
                    "  border: 1px solid #ddd;\n"
                    "  margin-bottom: 12px;\n"
                    "}"
                ),
                "starter_code": "/* give elements with class 'note' 20px of padding */\n",
                "solution": ".note {\n  padding: 20px;\n}",
                "order": 1,
                "xp_reward": 15,
            },
            {
                "title": "Colours, fonts & spacing",
                "content": (
                    "<h2>Visual polish</h2><p><code>color</code> and "
                    "<code>background-color</code> take names, hex or "
                    "<code>rgb()</code>. <code>font-size</code>, "
                    "<code>font-weight</code>, <code>line-height</code> and "
                    "<code>text-align</code> handle type.</p>"
                ),
                "code_example": (
                    "body {\n"
                    "  color: #222;\n"
                    "  background-color: #fafafa;\n"
                    "  font-family: system-ui, sans-serif;\n"
                    "  line-height: 1.6;\n"
                    "}"
                ),
                "starter_code": "/* make h1 elements 32px and centered */\n",
                "solution": "h1 {\n  font-size: 32px;\n  text-align: center;\n}",
                "order": 2,
                "xp_reward": 15,
            },
            {
                "title": "Flexbox layout",
                "content": (
                    "<h2>Rows and columns</h2><p><code>display: flex</code> on a "
                    "container lays its children in a row. <code>gap</code>, "
                    "<code>justify-content</code> and <code>align-items</code> control "
                    "spacing and alignment.</p>"
                ),
                "code_example": (
                    ".toolbar {\n"
                    "  display: flex;\n"
                    "  gap: 12px;\n"
                    "  justify-content: space-between;\n"
                    "  align-items: center;\n"
                    "}"
                ),
                "starter_code": "/* lay out .row as a flex container with 8px gap */\n",
                "solution": ".row {\n  display: flex;\n  gap: 8px;\n}",
                "order": 3,
                "xp_reward": 20,
            },
            {
                "title": "Project: a profile card",
                "content": (
                    "<h2>Put it together</h2><p>Combine semantic HTML with a class, "
                    "padding, a border-radius and flexbox to build a small card "
                    "component — the bread and butter of UI work.</p>"
                ),
                "code_example": (
                    "<article class=\"card\">\n"
                    "  <h2>Jordan Lee</h2>\n"
                    "  <p>Front-end developer</p>\n"
                    "</article>\n"
                    "<style>\n"
                    "  .card { padding: 20px; border-radius: 12px;\n"
                    "          border: 1px solid #e5e5e5; max-width: 320px; }\n"
                    "</style>"
                ),
                "starter_code": (
                    "<article class=\"card\">\n"
                    "  <!-- add a name and a role -->\n"
                    "</article>\n"
                    "<style>\n"
                    "  /* style .card: padding, rounded corners, a border */\n"
                    "</style>\n"
                ),
                "solution": (
                    "<article class=\"card\">\n"
                    "  <h2>Sam Rith</h2>\n"
                    "  <p>Student</p>\n"
                    "</article>\n"
                    "<style>\n"
                    "  .card { padding: 20px; border-radius: 12px; border: 1px solid #ccc; }\n"
                    "</style>"
                ),
                "order": 4,
                "xp_reward": 25,
            },
        ],
    },
]


BASE_TRACKS = {
    "python": PYTHON_MODULES,
    "javascript": JS_MODULES,
    "html-css": HTML_MODULES,
}


async def seed_bases():
    async with async_session() as db:
        for slug, modules in BASE_TRACKS.items():
            lang = (
                await db.execute(select(Language).where(Language.slug == slug))
            ).scalar_one_or_none()
            if not lang:
                print(f"  ! language '{slug}' not found — run seed_data.py first, skipping")
                continue

            existing_titles = set(
                (
                    await db.execute(
                        select(Module.title).where(Module.language_id == lang.id)
                    )
                ).scalars().all()
            )

            added = 0
            for mod_data in modules:
                if mod_data["title"] in existing_titles:
                    continue
                module = Module(
                    language_id=lang.id,
                    title=mod_data["title"],
                    description=mod_data["description"],
                    order=mod_data["order"],
                    difficulty=mod_data["difficulty"],
                )
                db.add(module)
                await db.flush()

                for lesson_data in mod_data["lessons"]:
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

                    for ex in lesson_data.get("exercises", []):
                        db.add(
                            Exercise(
                                lesson_id=lesson.id,
                                title=ex["title"],
                                description=ex["description"],
                                starter_code=ex["starter_code"],
                                solution=ex["solution"],
                                test_cases=ex["test_cases"],
                                hints=ex.get("hints", []),
                                order=ex["order"],
                            )
                        )
                added += 1

            await db.commit()
            print(f"  {slug}: added {added} module(s)")

    print("Base tracks seeded.")


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_bases())
