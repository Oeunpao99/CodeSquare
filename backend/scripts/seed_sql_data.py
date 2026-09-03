"""Seed the 'SQL & Data' learning track — the query skills every data / backend /
AI role needs and that no current track teaches (the `sql` skill bucket has zero
lessons today).

6 modules, beginner -> advanced, house style (2 lessons/module, one exercise
each, graded by the substring harness):

  1. Querying Basics            SELECT, WHERE, ORDER BY, LIMIT, DISTINCT
  2. Filtering & Shaping        AND/OR/IN/BETWEEN/LIKE, NULLs, aliases
  3. Aggregation               COUNT/SUM/AVG, GROUP BY, HAVING
  4. Joins                     INNER / LEFT JOIN, join keys, fan-out
  5. Subqueries & CTEs         WITH, scalar subqueries, EXISTS
  6. Windows & Performance     ROW_NUMBER/RANK, SUM() OVER, EXPLAIN, indexes

Idempotent: skips if the track already exists.

    ./.venv/Scripts/python.exe seed_sql_data.py
    ./.venv/Scripts/python.exe retag_curriculum.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


def _p(*parts: str) -> str:
    return "".join(parts)


SQL_TRACK = {
    "name": "SQL & Data",
    "slug": "sql-data",
    "icon": "🗃️",
    "description": (
        "Ask a database precise questions: filter and sort rows, aggregate, join "
        "tables, nest queries with CTEs, and use window functions — then make it "
        "fast."
    ),
    "color": "#F59E0B",
    "modules": [
        # ---------------------------------------------------------------- #
        {
            "title": "Querying Basics",
            "description": "Pull the exact rows and columns you want.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "SELECT, FROM, WHERE",
                    "content": _p(
                        "<h2>Every query starts here</h2>",
                        "<p>SQL reads like a sentence. You name the <strong>columns</strong>, the "
                        "<strong>table</strong>, and a <strong>condition</strong>:</p>",
                        "<pre><code>SELECT name, email\n"
                        "FROM users\n"
                        "WHERE country = 'KH';</code></pre>",
                        "<ul>",
                        "<li><code>SELECT *</code> returns every column &mdash; handy when exploring, "
                        "wasteful in real code.</li>",
                        "<li>Strings use <strong>single quotes</strong>. <code>=</code>, "
                        "<code>&lt;&gt;</code> (not equal), <code>&lt;</code>, <code>&gt;=</code> all "
                        "work.</li>",
                        "<li>SQL keywords are case-insensitive; UPPERCASE is a common convention.</li>",
                        "</ul>",
                    ),
                    "code_example": "SELECT name, email\nFROM users\nWHERE country = 'KH';",
                    "starter_code": (
                        "-- Select the title and price columns from the products table\n"
                        "-- for rows where price is above 100.\n"
                        "SELECT\nFROM\nWHERE ;\n"
                    ),
                    "solution": (
                        "SELECT title, price\n"
                        "FROM products\n"
                        "WHERE price > 100;"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "First Query",
                            "description": "Select title and price from products where price > 100.",
                            "starter_code": "SELECT\nFROM products\nWHERE ;",
                            "solution": "SELECT title, price\nFROM products\nWHERE price > 100;",
                            "test_cases": {
                                "tests": [
                                    {"description": "Selects the two columns",
                                     "test": "'title' in code.lower() and 'price' in code.lower()"},
                                    {"description": "Reads from products",
                                     "test": "'from products' in code.lower()"},
                                    {"description": "Filters on price > 100",
                                     "test": "'where' in code.lower() and '> 100' in code.replace('  ',' ')"},
                                ]
                            },
                            "hints": [
                                "SELECT title, price",
                                "FROM products",
                                "WHERE price > 100;",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "ORDER BY, LIMIT, DISTINCT",
                    "content": _p(
                        "<h2>Sort, cap, and de-duplicate</h2>",
                        "<pre><code>SELECT DISTINCT country\n"
                        "FROM users\n"
                        "ORDER BY country ASC;\n\n"
                        "SELECT title, price\n"
                        "FROM products\n"
                        "ORDER BY price DESC\n"
                        "LIMIT 10;</code></pre>",
                        "<ul>",
                        "<li><code>ORDER BY col DESC</code> &mdash; highest first; <code>ASC</code> is "
                        "the default.</li>",
                        "<li><code>LIMIT n</code> &mdash; return at most <code>n</code> rows (add "
                        "<code>OFFSET</code> to page).</li>",
                        "<li><code>DISTINCT</code> &mdash; collapse duplicate rows of the selected "
                        "columns.</li>",
                        "</ul>",
                        "<p>Order of clauses is fixed: "
                        "<code>SELECT &rarr; FROM &rarr; WHERE &rarr; ORDER BY &rarr; LIMIT</code>.</p>",
                    ),
                    "code_example": (
                        "SELECT title, price\n"
                        "FROM products\n"
                        "ORDER BY price DESC\n"
                        "LIMIT 10;"
                    ),
                    "starter_code": (
                        "-- The 5 most expensive products, priciest first.\n"
                        "SELECT title, price\n"
                        "FROM products\n"
                        "-- order + limit here\n"
                    ),
                    "solution": (
                        "SELECT title, price\n"
                        "FROM products\n"
                        "ORDER BY price DESC\n"
                        "LIMIT 5;"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Top 5 by Price",
                            "description": "Return title and price of the 5 most expensive products, highest price first.",
                            "starter_code": "SELECT title, price\nFROM products\n",
                            "solution": "SELECT title, price\nFROM products\nORDER BY price DESC\nLIMIT 5;",
                            "test_cases": {
                                "tests": [
                                    {"description": "Sorts by price descending",
                                     "test": "'order by price desc' in code.lower()"},
                                    {"description": "Caps at 5 rows",
                                     "test": "'limit 5' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "ORDER BY price DESC",
                                "LIMIT 5",
                                "ORDER BY comes before LIMIT",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Filtering & Shaping",
            "description": "Precise conditions and readable output.",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "AND, OR, IN, BETWEEN, LIKE",
                    "content": _p(
                        "<h2>Combining conditions</h2>",
                        "<pre><code>SELECT *\n"
                        "FROM orders\n"
                        "WHERE status IN ('paid', 'shipped')\n"
                        "  AND total BETWEEN 20 AND 200\n"
                        "  AND email LIKE '%@gmail.com';</code></pre>",
                        "<ul>",
                        "<li><code>IN (...)</code> &mdash; matches any value in the list.</li>",
                        "<li><code>BETWEEN a AND b</code> &mdash; inclusive range.</li>",
                        "<li><code>LIKE</code> &mdash; <code>%</code> is any run of characters, "
                        "<code>_</code> is exactly one.</li>",
                        "<li><code>AND</code> binds tighter than <code>OR</code> &mdash; parenthesise "
                        "when you mix them.</li>",
                        "</ul>",
                    ),
                    "code_example": (
                        "SELECT *\n"
                        "FROM orders\n"
                        "WHERE status IN ('paid', 'shipped')\n"
                        "  AND total BETWEEN 20 AND 200;"
                    ),
                    "starter_code": (
                        "-- orders that are 'paid' or 'shipped' AND total is 20..200 inclusive\n"
                        "SELECT *\n"
                        "FROM orders\n"
                        "WHERE ;\n"
                    ),
                    "solution": (
                        "SELECT *\n"
                        "FROM orders\n"
                        "WHERE status IN ('paid', 'shipped')\n"
                        "  AND total BETWEEN 20 AND 200;"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Compound Filter",
                            "description": "Filter orders where status is in ('paid','shipped') and total is BETWEEN 20 AND 200.",
                            "starter_code": "SELECT *\nFROM orders\nWHERE ;",
                            "solution": (
                                "SELECT *\nFROM orders\n"
                                "WHERE status IN ('paid', 'shipped')\n"
                                "  AND total BETWEEN 20 AND 200;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses IN for status",
                                     "test": "'status in' in code.lower()"},
                                    {"description": "Uses BETWEEN for the range",
                                     "test": "'between 20 and 200' in code.lower()"},
                                    {"description": "Combines them with AND",
                                     "test": "' and ' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "status IN ('paid', 'shipped')",
                                "total BETWEEN 20 AND 200",
                                "Join the two with AND",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "NULLs & Column Aliases",
                    "content": _p(
                        "<h2>Missing values behave differently</h2>",
                        "<p><code>NULL</code> means <em>unknown</em>. It is never equal to anything, "
                        "not even <code>NULL</code> &mdash; so you must use "
                        "<code>IS NULL</code> / <code>IS NOT NULL</code>:</p>",
                        "<pre><code>SELECT\n"
                        "  name,\n"
                        "  COALESCE(phone, 'n/a') AS phone\n"
                        "FROM users\n"
                        "WHERE deleted_at IS NULL;</code></pre>",
                        "<ul>",
                        "<li><code>AS alias</code> &mdash; rename a column in the output.</li>",
                        "<li><code>COALESCE(a, b, ...)</code> &mdash; first non-NULL value.</li>",
                        "<li><code>x = NULL</code> is always false; use <code>x IS NULL</code>.</li>",
                        "</ul>",
                    ),
                    "code_example": (
                        "SELECT name, COALESCE(phone, 'n/a') AS phone\n"
                        "FROM users\n"
                        "WHERE deleted_at IS NULL;"
                    ),
                    "starter_code": (
                        "-- name, plus phone falling back to 'n/a', for non-deleted users\n"
                        "SELECT name, phone\n"
                        "FROM users\n"
                        "WHERE ;\n"
                    ),
                    "solution": (
                        "SELECT name, COALESCE(phone, 'n/a') AS phone\n"
                        "FROM users\n"
                        "WHERE deleted_at IS NULL;"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Handle Missing Data",
                            "description": "Alias COALESCE(phone,'n/a') AS phone and filter to rows where deleted_at IS NULL.",
                            "starter_code": "SELECT name, phone\nFROM users\nWHERE ;",
                            "solution": (
                                "SELECT name, COALESCE(phone, 'n/a') AS phone\n"
                                "FROM users\n"
                                "WHERE deleted_at IS NULL;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Falls back with COALESCE",
                                     "test": "'coalesce(' in code.lower()"},
                                    {"description": "Aliases the column",
                                     "test": "' as phone' in code.lower()"},
                                    {"description": "Tests NULL with IS NULL",
                                     "test": "'is null' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "COALESCE(phone, 'n/a') AS phone",
                                "WHERE deleted_at IS NULL",
                                "Never write = NULL",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Aggregation",
            "description": "Collapse many rows into summary numbers.",
            "order": 3,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "COUNT, SUM, AVG & GROUP BY",
                    "content": _p(
                        "<h2>One row per group</h2>",
                        "<pre><code>SELECT\n"
                        "  country,\n"
                        "  COUNT(*)     AS users,\n"
                        "  AVG(age)     AS avg_age\n"
                        "FROM users\n"
                        "GROUP BY country;</code></pre>",
                        "<p>Rule: every column in <code>SELECT</code> is either <strong>inside an "
                        "aggregate</strong> (<code>COUNT</code>, <code>SUM</code>, <code>AVG</code>, "
                        "<code>MIN</code>, <code>MAX</code>) or <strong>listed in "
                        "<code>GROUP BY</code></strong>.</p>",
                        "<p><code>COUNT(*)</code> counts rows; <code>COUNT(col)</code> skips NULLs; "
                        "<code>COUNT(DISTINCT col)</code> counts unique values.</p>",
                    ),
                    "code_example": (
                        "SELECT country, COUNT(*) AS users\n"
                        "FROM users\n"
                        "GROUP BY country;"
                    ),
                    "starter_code": (
                        "-- number of orders and total revenue per customer_id\n"
                        "SELECT customer_id\n"
                        "FROM orders\n"
                        "-- group here\n"
                    ),
                    "solution": (
                        "SELECT customer_id,\n"
                        "       COUNT(*) AS orders,\n"
                        "       SUM(total) AS revenue\n"
                        "FROM orders\n"
                        "GROUP BY customer_id;"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Per-Customer Totals",
                            "description": "Group orders by customer_id; select COUNT(*) and SUM(total).",
                            "starter_code": "SELECT customer_id\nFROM orders\n",
                            "solution": (
                                "SELECT customer_id, COUNT(*) AS orders, SUM(total) AS revenue\n"
                                "FROM orders\n"
                                "GROUP BY customer_id;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Counts rows per group",
                                     "test": "'count(*)' in code.lower()"},
                                    {"description": "Sums the total column",
                                     "test": "'sum(total)' in code.lower()"},
                                    {"description": "Groups by customer_id",
                                     "test": "'group by customer_id' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "SELECT customer_id, COUNT(*) , SUM(total)",
                                "GROUP BY customer_id",
                                "Non-aggregated columns must appear in GROUP BY",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "HAVING vs WHERE",
                    "content": _p(
                        "<h2>Filter groups after aggregating</h2>",
                        "<p><code>WHERE</code> filters <strong>rows before</strong> grouping. "
                        "<code>HAVING</code> filters <strong>groups after</strong> &mdash; it can see "
                        "the aggregates.</p>",
                        "<pre><code>SELECT customer_id, SUM(total) AS revenue\n"
                        "FROM orders\n"
                        "WHERE status = 'paid'        -- drop unpaid rows first\n"
                        "GROUP BY customer_id\n"
                        "HAVING SUM(total) > 1000;    -- keep only big spenders</code></pre>",
                        "<p>If a condition doesn't use an aggregate, put it in <code>WHERE</code> "
                        "&mdash; it's cheaper.</p>",
                    ),
                    "code_example": (
                        "SELECT customer_id, SUM(total) AS revenue\n"
                        "FROM orders\n"
                        "GROUP BY customer_id\n"
                        "HAVING SUM(total) > 1000;"
                    ),
                    "starter_code": (
                        "-- customers whose paid revenue exceeds 1000\n"
                        "SELECT customer_id, SUM(total) AS revenue\n"
                        "FROM orders\n"
                        "WHERE status = 'paid'\n"
                        "GROUP BY customer_id\n"
                        "-- having here\n"
                    ),
                    "solution": (
                        "SELECT customer_id, SUM(total) AS revenue\n"
                        "FROM orders\n"
                        "WHERE status = 'paid'\n"
                        "GROUP BY customer_id\n"
                        "HAVING SUM(total) > 1000;"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Big Spenders",
                            "description": "Add a HAVING clause keeping only groups where SUM(total) > 1000.",
                            "starter_code": (
                                "SELECT customer_id, SUM(total) AS revenue\n"
                                "FROM orders\n"
                                "WHERE status = 'paid'\n"
                                "GROUP BY customer_id\n"
                            ),
                            "solution": (
                                "SELECT customer_id, SUM(total) AS revenue\n"
                                "FROM orders\n"
                                "WHERE status = 'paid'\n"
                                "GROUP BY customer_id\n"
                                "HAVING SUM(total) > 1000;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Filters groups with HAVING",
                                     "test": "'having' in code.lower()"},
                                    {"description": "Threshold on the aggregate",
                                     "test": "'sum(total) > 1000' in code.lower()"},
                                    {"description": "Row filter stays in WHERE",
                                     "test": "'where status' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "HAVING runs after GROUP BY",
                                "HAVING SUM(total) > 1000",
                                "Keep status = 'paid' in WHERE",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Joins",
            "description": "Combine rows from related tables.",
            "order": 4,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "INNER JOIN",
                    "content": _p(
                        "<h2>Match rows on a key</h2>",
                        "<pre><code>SELECT o.id, u.name, o.total\n"
                        "FROM orders AS o\n"
                        "JOIN users AS u ON u.id = o.user_id;</code></pre>",
                        "<ul>",
                        "<li>Table <strong>aliases</strong> (<code>o</code>, <code>u</code>) keep the "
                        "query short and disambiguate columns.</li>",
                        "<li>The <code>ON</code> clause is the match condition &mdash; usually a "
                        "foreign key = primary key.</li>",
                        "<li><code>INNER JOIN</code> (just <code>JOIN</code>) keeps only rows that "
                        "match on <strong>both</strong> sides.</li>",
                        "</ul>",
                    ),
                    "code_example": (
                        "SELECT o.id, u.name, o.total\n"
                        "FROM orders AS o\n"
                        "JOIN users AS u ON u.id = o.user_id;"
                    ),
                    "starter_code": (
                        "-- order id, product title, quantity\n"
                        "SELECT oi.order_id, p.title, oi.qty\n"
                        "FROM order_items AS oi\n"
                        "-- join products AS p on the product_id key\n"
                    ),
                    "solution": (
                        "SELECT oi.order_id, p.title, oi.qty\n"
                        "FROM order_items AS oi\n"
                        "JOIN products AS p ON p.id = oi.product_id;"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Join Two Tables",
                            "description": "JOIN products AS p to order_items on p.id = oi.product_id.",
                            "starter_code": (
                                "SELECT oi.order_id, p.title, oi.qty\n"
                                "FROM order_items AS oi\n"
                            ),
                            "solution": (
                                "SELECT oi.order_id, p.title, oi.qty\n"
                                "FROM order_items AS oi\n"
                                "JOIN products AS p ON p.id = oi.product_id;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Joins products",
                                     "test": "'join products' in code.lower()"},
                                    {"description": "Matches on the product key",
                                     "test": "'on p.id = oi.product_id' in code.lower().replace('  ',' ')"},
                                ]
                            },
                            "hints": [
                                "JOIN products AS p",
                                "ON p.id = oi.product_id",
                                "Alias the joined table so columns are unambiguous",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "LEFT JOIN & Missing Matches",
                    "content": _p(
                        "<h2>Keep every row on the left</h2>",
                        "<p><code>LEFT JOIN</code> returns every row from the left table; where the "
                        "right side has no match, its columns are <code>NULL</code>. Perfect for "
                        "&ldquo;users <em>and</em> their order count, including users with zero&rdquo;:</p>",
                        "<pre><code>SELECT u.name, COUNT(o.id) AS orders\n"
                        "FROM users AS u\n"
                        "LEFT JOIN orders AS o ON o.user_id = u.id\n"
                        "GROUP BY u.name;</code></pre>",
                        "<p>Note <code>COUNT(o.id)</code> not <code>COUNT(*)</code> &mdash; you want "
                        "to count real orders, not the one NULL row a no-match user still produces.</p>",
                    ),
                    "code_example": (
                        "SELECT u.name, COUNT(o.id) AS orders\n"
                        "FROM users AS u\n"
                        "LEFT JOIN orders AS o ON o.user_id = u.id\n"
                        "GROUP BY u.name;"
                    ),
                    "starter_code": (
                        "-- every user and how many orders they have (0 included)\n"
                        "SELECT u.name, COUNT(o.id) AS orders\n"
                        "FROM users AS u\n"
                        "-- left join + group\n"
                    ),
                    "solution": (
                        "SELECT u.name, COUNT(o.id) AS orders\n"
                        "FROM users AS u\n"
                        "LEFT JOIN orders AS o ON o.user_id = u.id\n"
                        "GROUP BY u.name;"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Include the Zeroes",
                            "description": "LEFT JOIN orders to users on o.user_id = u.id, then GROUP BY u.name.",
                            "starter_code": (
                                "SELECT u.name, COUNT(o.id) AS orders\n"
                                "FROM users AS u\n"
                            ),
                            "solution": (
                                "SELECT u.name, COUNT(o.id) AS orders\n"
                                "FROM users AS u\n"
                                "LEFT JOIN orders AS o ON o.user_id = u.id\n"
                                "GROUP BY u.name;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses a LEFT JOIN",
                                     "test": "'left join orders' in code.lower()"},
                                    {"description": "Matches on user_id",
                                     "test": "'o.user_id = u.id' in code.lower().replace('  ',' ')"},
                                    {"description": "Groups by the user",
                                     "test": "'group by u.name' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "LEFT JOIN orders AS o ON o.user_id = u.id",
                                "GROUP BY u.name",
                                "COUNT(o.id) so no-match rows count as 0",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Subqueries & CTEs",
            "description": "Build a query out of smaller queries.",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Common Table Expressions",
                    "content": _p(
                        "<h2>Name a result, then use it</h2>",
                        "<p>A <code>WITH</code> clause (CTE) lets you define a temporary named result "
                        "and query it below &mdash; far more readable than nesting.</p>",
                        "<pre><code>WITH revenue AS (\n"
                        "    SELECT user_id, SUM(total) AS amount\n"
                        "    FROM orders\n"
                        "    GROUP BY user_id\n"
                        ")\n"
                        "SELECT u.name, r.amount\n"
                        "FROM revenue AS r\n"
                        "JOIN users AS u ON u.id = r.user_id\n"
                        "WHERE r.amount > 500;</code></pre>",
                        "<p>You can chain several CTEs separated by commas, each building on the last.</p>",
                    ),
                    "code_example": (
                        "WITH revenue AS (\n"
                        "    SELECT user_id, SUM(total) AS amount FROM orders GROUP BY user_id\n"
                        ")\n"
                        "SELECT * FROM revenue WHERE amount > 500;"
                    ),
                    "starter_code": (
                        "-- Wrap the per-user revenue query in a CTE named revenue,\n"
                        "-- then select rows where amount > 500.\n"
                        "-- WITH revenue AS ( ... )\n"
                        "SELECT * FROM revenue WHERE amount > 500;\n"
                    ),
                    "solution": (
                        "WITH revenue AS (\n"
                        "    SELECT user_id, SUM(total) AS amount\n"
                        "    FROM orders\n"
                        "    GROUP BY user_id\n"
                        ")\n"
                        "SELECT * FROM revenue WHERE amount > 500;"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Write a CTE",
                            "description": "Define WITH revenue AS (per-user SUM(total)) then select where amount > 500.",
                            "starter_code": "SELECT * FROM revenue WHERE amount > 500;",
                            "solution": (
                                "WITH revenue AS (\n"
                                "    SELECT user_id, SUM(total) AS amount\n"
                                "    FROM orders\n"
                                "    GROUP BY user_id\n"
                                ")\n"
                                "SELECT * FROM revenue WHERE amount > 500;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Declares a CTE",
                                     "test": "'with revenue as' in code.lower()"},
                                    {"description": "Aggregates inside it",
                                     "test": "'sum(total)' in code.lower() and 'group by user_id' in code.lower()"},
                                    {"description": "Queries the CTE",
                                     "test": "'from revenue' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "WITH revenue AS ( SELECT ... )",
                                "Inside: SELECT user_id, SUM(total) AS amount ... GROUP BY user_id",
                                "Then SELECT * FROM revenue WHERE amount > 500",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Scalar Subqueries & EXISTS",
                    "content": _p(
                        "<h2>A query inside a query</h2>",
                        "<pre><code>-- one value:\n"
                        "SELECT title, price\n"
                        "FROM products\n"
                        "WHERE price > (SELECT AVG(price) FROM products);\n\n"
                        "-- 'has at least one related row':\n"
                        "SELECT u.name\n"
                        "FROM users AS u\n"
                        "WHERE EXISTS (\n"
                        "    SELECT 1 FROM orders o WHERE o.user_id = u.id\n"
                        ");</code></pre>",
                        "<p><code>EXISTS</code> stops at the first match, so it's often faster than "
                        "<code>IN</code> with a big subquery. Use <code>NOT EXISTS</code> for "
                        "&ldquo;users with no orders&rdquo;.</p>",
                    ),
                    "code_example": (
                        "SELECT title, price\n"
                        "FROM products\n"
                        "WHERE price > (SELECT AVG(price) FROM products);"
                    ),
                    "starter_code": (
                        "-- products priced above the overall average price\n"
                        "SELECT title, price\n"
                        "FROM products\n"
                        "WHERE price > ( );\n"
                    ),
                    "solution": (
                        "SELECT title, price\n"
                        "FROM products\n"
                        "WHERE price > (SELECT AVG(price) FROM products);"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Above Average",
                            "description": "Filter products where price > a scalar subquery selecting AVG(price) FROM products.",
                            "starter_code": "SELECT title, price\nFROM products\nWHERE price > ( );",
                            "solution": (
                                "SELECT title, price\n"
                                "FROM products\n"
                                "WHERE price > (SELECT AVG(price) FROM products);"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Has a subquery in the WHERE",
                                     "test": "code.lower().count('select') >= 2"},
                                    {"description": "Subquery computes the average",
                                     "test": "'avg(price)' in code.lower()"},
                                    {"description": "Compares price to it",
                                     "test": "'price > (' in code.lower().replace(' (', ' (')"},
                                ]
                            },
                            "hints": [
                                "The subquery goes in parentheses after price >",
                                "(SELECT AVG(price) FROM products)",
                                "A scalar subquery must return exactly one value",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Windows & Performance",
            "description": "Rank within groups, and make queries fast.",
            "order": 6,
            "difficulty": "advanced",
            "lessons": [
                {
                    "title": "Window Functions",
                    "content": _p(
                        "<h2>Aggregate without collapsing rows</h2>",
                        "<p>A window function runs over a set of rows <em>related to the current "
                        "row</em> but keeps every row in the output.</p>",
                        "<pre><code>SELECT\n"
                        "  user_id, total,\n"
                        "  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn,\n"
                        "  SUM(total)   OVER (PARTITION BY user_id) AS user_total\n"
                        "FROM orders;</code></pre>",
                        "<ul>",
                        "<li><code>PARTITION BY</code> &mdash; the group (like GROUP BY, but rows "
                        "stay).</li>",
                        "<li><code>ORDER BY</code> inside <code>OVER</code> &mdash; ordering for "
                        "<code>ROW_NUMBER</code>, <code>RANK</code>, running totals.</li>",
                        "<li>Common use: &ldquo;top N per group&rdquo; &mdash; filter "
                        "<code>rn &lt;= 3</code> in an outer query.</li>",
                        "</ul>",
                    ),
                    "code_example": (
                        "SELECT user_id, total,\n"
                        "  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn\n"
                        "FROM orders;"
                    ),
                    "starter_code": (
                        "-- number each user's orders from largest total (1) downwards\n"
                        "SELECT user_id, total,\n"
                        "  -- ROW_NUMBER() OVER ( ... ) AS rn\n"
                        "FROM orders;\n"
                    ),
                    "solution": (
                        "SELECT user_id, total,\n"
                        "  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn\n"
                        "FROM orders;"
                    ),
                    "order": 1,
                    "xp_reward": 25,
                    "exercises": [
                        {
                            "title": "Rank Within a Group",
                            "description": "Add ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn.",
                            "starter_code": "SELECT user_id, total,\nFROM orders;",
                            "solution": (
                                "SELECT user_id, total,\n"
                                "  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn\n"
                                "FROM orders;"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses a window function",
                                     "test": "'row_number()' in code.lower() and 'over (' in code.lower().replace('over(','over (')"},
                                    {"description": "Partitions by user",
                                     "test": "'partition by user_id' in code.lower()"},
                                    {"description": "Orders by total descending",
                                     "test": "'order by total desc' in code.lower()"},
                                ]
                            },
                            "hints": [
                                "ROW_NUMBER() OVER ( ... ) AS rn",
                                "Inside OVER: PARTITION BY user_id ORDER BY total DESC",
                                "The row count restarts for each user",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "EXPLAIN & Indexes",
                    "content": _p(
                        "<h2>Why is this query slow?</h2>",
                        "<p>Put <code>EXPLAIN</code> (or <code>EXPLAIN ANALYZE</code> in Postgres) "
                        "before a query to see the plan the database chose:</p>",
                        "<pre><code>EXPLAIN ANALYZE\n"
                        "SELECT * FROM orders WHERE user_id = 42;</code></pre>",
                        "<ul>",
                        "<li><strong>Seq Scan</strong> on a big table in a hot query = usually a "
                        "missing index.</li>",
                        "<li>An <strong>index</strong> on the filtered / joined column turns it into "
                        "an <strong>Index Scan</strong>:</li>",
                        "</ul>",
                        "<pre><code>CREATE INDEX idx_orders_user_id ON orders (user_id);</code></pre>",
                        "<p>Index the columns you filter or join on. Cost: every write updates the "
                        "index too, so don't index everything.</p>",
                    ),
                    "code_example": (
                        "CREATE INDEX idx_orders_user_id ON orders (user_id);"
                    ),
                    "starter_code": (
                        "-- Add an index that speeds up  WHERE user_id = ?  on orders.\n"
                        "CREATE INDEX idx_orders_user_id ON  ( );\n"
                    ),
                    "solution": (
                        "CREATE INDEX idx_orders_user_id ON orders (user_id);"
                    ),
                    "order": 2,
                    "xp_reward": 25,
                    "exercises": [
                        {
                            "title": "Add an Index",
                            "description": "CREATE INDEX on orders (user_id) to support lookups by user_id.",
                            "starter_code": "CREATE INDEX idx_orders_user_id ON  ( );",
                            "solution": "CREATE INDEX idx_orders_user_id ON orders (user_id);",
                            "test_cases": {
                                "tests": [
                                    {"description": "Creates an index",
                                     "test": "'create index' in code.lower()"},
                                    {"description": "On the orders table",
                                     "test": "'on orders' in code.lower()"},
                                    {"description": "Covering the user_id column",
                                     "test": "'(user_id)' in code.lower().replace(' (', '(')"},
                                ]
                            },
                            "hints": [
                                "CREATE INDEX <name> ON <table> (<column>);",
                                "Table is orders, column is user_id",
                                "Index what you filter or join on",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_sql_data_track():
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == SQL_TRACK["slug"])
        )
        if existing.scalars().first():
            print("SQL & Data track already exists; nothing to do.")
            return

        language = Language(
            name=SQL_TRACK["name"],
            slug=SQL_TRACK["slug"],
            icon=SQL_TRACK["icon"],
            description=SQL_TRACK["description"],
            color=SQL_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in SQL_TRACK["modules"]:
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
        n_mod = len(SQL_TRACK["modules"])
        n_les = sum(len(m["lessons"]) for m in SQL_TRACK["modules"])
        print(f"SQL & Data track seeded: {n_mod} modules, {n_les} lessons.")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_sql_data_track()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
