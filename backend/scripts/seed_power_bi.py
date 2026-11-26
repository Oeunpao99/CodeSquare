"""Seed the 'Power BI' learning track — Microsoft's business-intelligence tool,
following the 6-week classroom plan (one module per week):

  1. Getting Started & Data Sources   Desktop/Service, Get Data, connection modes
  2. Power Query: Clean & Shape       rename/remove/types, split, add columns, steps
  3. Combine & Model                  merge/append, star schema, relationships
  4. DAX Fundamentals                 columns vs measures, CALCULATE, filter context
  5. Time Intelligence & Visuals      date table, YoY, RANKX, conditional formatting
  6. Publish, Share & Secure          workspaces, refresh/gateways, row-level security

House style: 2 lessons/module, one exercise each. The "code" is DAX or Power Query
M, so every test is a pure content check (`'sumx(' in code.lower()`) — the
grader's static layer evaluates those without executing anything.

Idempotent: skips if the track already exists.

    ./.venv/Scripts/python.exe scripts/seed_power_bi.py
    ./.venv/Scripts/python.exe scripts/retag_curriculum.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


def _p(*parts: str) -> str:
    return "".join(parts)


def _lesson(order, title, xp, content, code_example, starter, solution, ex_title, ex_desc, tests, hints):
    """One lesson with its single exercise (the exercise reuses starter/solution)."""
    return {
        "title": title,
        "content": content,
        "code_example": code_example,
        "starter_code": starter,
        "solution": solution,
        "order": order,
        "xp_reward": xp,
        "exercises": [
            {
                "title": ex_title,
                "description": ex_desc,
                "starter_code": starter,
                "solution": solution,
                "test_cases": {
                    "tests": [{"description": d, "test": t} for d, t in tests]
                },
                "hints": hints,
                "order": 1,
            }
        ],
    }


# Normalised view of the submission used by most tests: lower-case, no spaces.
_N = "code.lower().replace(' ', '')"

POWER_BI_TRACK = {
    "name": "Power BI",
    "slug": "power-bi",
    "icon": "📊",
    "description": (
        "Turn raw files and databases into interactive reports: connect to data, "
        "clean it with Power Query, build a star-schema model, write DAX measures, "
        "design visuals, then publish, refresh and secure them in the Power BI "
        "Service."
    ),
    "color": "#F2C811",
    "modules": [
        # ================================================================ #
        #  Week 1
        # ================================================================ #
        {
            "title": "Getting Started & Data Sources",
            "description": "What Power BI is, how a report is built, and how data gets in.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                _lesson(
                    1, "What is Power BI?", 15,
                    _p(
                        "<h2>From spreadsheet to interactive report</h2>",
                        "<p><strong>Power BI</strong> is Microsoft's business-intelligence platform. "
                        "It connects to your data, cleans it, models it, and turns it into reports "
                        "people can click, filter and drill into.</p>",
                        "<h3>The three parts</h3>",
                        "<ul>",
                        "<li><strong>Power BI Desktop</strong> &mdash; free Windows app where you "
                        "build reports (<code>.pbix</code> files).</li>",
                        "<li><strong>Power BI Service</strong> &mdash; app.powerbi.com, where you "
                        "publish, share, refresh and secure them.</li>",
                        "<li><strong>Power BI Mobile</strong> &mdash; phone/tablet apps for viewing.</li>",
                        "</ul>",
                        "<h3>Five steps of every report</h3>",
                        "<ol>",
                        "<li><strong>Get data</strong> &mdash; Excel, CSV, SQL, web&hellip;</li>",
                        "<li><strong>Transform</strong> &mdash; clean it in Power Query.</li>",
                        "<li><strong>Model</strong> &mdash; relate tables to each other.</li>",
                        "<li><strong>Calculate</strong> &mdash; write <strong>DAX</strong> measures.</li>",
                        "<li><strong>Visualize &amp; share</strong> &mdash; build visuals, publish.</li>",
                        "</ol>",
                        "<h3>Desktop's three views</h3>",
                        "<p><strong>Report</strong> view (canvas for visuals), <strong>Table</strong> view "
                        "(see the rows), <strong>Model</strong> view (tables and relationships).</p>",
                        "<h3>Your first measure</h3>",
                        "<p>A <strong>measure</strong> is a named calculation written in DAX. It is "
                        "re-evaluated for whatever the visual is showing:</p>",
                        "<pre><code>Total Sales = SUM(Sales[Amount])</code></pre>",
                        "<p>Columns are referenced as <code>Table[Column]</code>.</p>",
                    ),
                    "Total Sales = SUM(Sales[Amount])",
                    "-- Write a measure named Total Quantity\n-- that adds up the Quantity column of the Sales table.\nTotal Quantity = ",
                    "Total Quantity = SUM(Sales[Quantity])",
                    "First Measure",
                    "Create a measure called Total Quantity that sums Sales[Quantity].",
                    [
                        ("Measure is named Total Quantity", "'totalquantity=' in " + _N),
                        ("Uses SUM", "'sum(' in " + _N),
                        ("References Sales[Quantity]", "'sales[quantity]' in " + _N),
                    ],
                    [
                        "A measure looks like: Name = EXPRESSION",
                        "SUM takes one column: SUM(Table[Column])",
                        "Total Quantity = SUM(Sales[Quantity])",
                    ],
                ),
                _lesson(
                    2, "Get Data & Connection Modes", 15,
                    _p(
                        "<h2>Bringing data in</h2>",
                        "<p><strong>Home &rarr; Get Data</strong> lists 150+ connectors: files (Excel, CSV, "
                        "a whole <em>Folder</em>), databases (SQL Server, PostgreSQL, MySQL), online "
                        "services (SharePoint, Google Analytics) and the web.</p>",
                        "<p>After picking a source you choose <strong>Load</strong> (straight into the "
                        "model) or <strong>Transform Data</strong> (open Power Query first &mdash; almost "
                        "always the better choice).</p>",
                        "<h3>Connection modes</h3>",
                        "<table>",
                        "<tr><th>Mode</th><th>Where data lives</th><th>Use when</th></tr>",
                        "<tr><td>Import</td><td>Copied into the .pbix</td><td>Default; fastest, needs refresh</td></tr>",
                        "<tr><td>DirectQuery</td><td>Stays in the database</td><td>Huge or near-real-time data</td></tr>",
                        "<tr><td>Live Connection</td><td>An existing published model</td><td>Reusing a shared dataset</td></tr>",
                        "<tr><td>Composite</td><td>Mix of Import + DirectQuery</td><td>Big fact table, small dimensions</td></tr>",
                        "</table>",
                        "<h3>Every source is M code</h3>",
                        "<p>Each click in Get Data writes a step in <strong>Power Query M</strong>. A "
                        "query is a <code>let &hellip; in</code> block of named steps:</p>",
                        "<pre><code>let\n"
                        "    Source = Csv.Document(File.Contents(\"C:\\Data\\Sales.csv\"), [Delimiter=\",\"]),\n"
                        "    Promoted = Table.PromoteHeaders(Source)\n"
                        "in\n"
                        "    Promoted</code></pre>",
                        "<p><code>Table.PromoteHeaders</code> turns the first row into column names.</p>",
                    ),
                    'let\n    Source = Csv.Document(File.Contents("C:\\Data\\Sales.csv"), [Delimiter=","]),\n'
                    "    Promoted = Table.PromoteHeaders(Source)\nin\n    Promoted",
                    "// Load C:\\Data\\Customers.csv and promote the first row to headers.\nlet\n    Source = ,\n    Promoted = \nin\n    Promoted",
                    'let\n    Source = Csv.Document(File.Contents("C:\\Data\\Customers.csv"), [Delimiter=","]),\n'
                    "    Promoted = Table.PromoteHeaders(Source)\nin\n    Promoted",
                    "Load a CSV",
                    "Write an M query that reads Customers.csv and promotes headers.",
                    [
                        ("Has a let ... in block", "'let' in code.lower() and 'in' in code.lower().split('let', 1)[-1]"),
                        ("Reads the file with Csv.Document + File.Contents",
                         "'csv.document(' in " + _N + " and 'file.contents(' in " + _N),
                        ("Points at Customers.csv", "'customers.csv' in code.lower()"),
                        ("Promotes headers", "'table.promoteheaders(' in " + _N),
                    ],
                    [
                        "Wrap the file in File.Contents(\"...\") and pass it to Csv.Document(...)",
                        "The second step is Table.PromoteHeaders(Source)",
                        "End with `in Promoted` so the query returns the last step",
                    ],
                ),
            ],
        },
        # ================================================================ #
        #  Week 2
        # ================================================================ #
        {
            "title": "Power Query: Clean & Shape",
            "description": "Fix names, types and messy columns with repeatable steps.",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                _lesson(
                    1, "Rename, Remove & Data Types", 15,
                    _p(
                        "<h2>The Power Query Editor</h2>",
                        "<p>Five areas: the <strong>ribbon</strong>, the <strong>Queries</strong> pane, "
                        "the <strong>data preview</strong>, the <strong>formula bar</strong>, and "
                        "<strong>Applied Steps</strong>. Turn on <em>View &rarr; Column quality</em> to "
                        "see valid / error / empty percentages for every column.</p>",
                        "<h3>Three clean-up steps you'll do every time</h3>",
                        "<pre><code>Renamed = Table.RenameColumns(Source, {{\"cust_nm\", \"Customer Name\"}}),\n"
                        "Removed = Table.RemoveColumns(Renamed, {\"Notes\"}),\n"
                        "Typed   = Table.TransformColumnTypes(Removed, {\n"
                        "    {\"Amount\", type number},\n"
                        "    {\"OrderDate\", type date}\n"
                        "})</code></pre>",
                        "<ul>",
                        "<li><strong>Clear names</strong> &mdash; they become field names in every visual.</li>",
                        "<li><strong>Remove Other Columns</strong> (<code>Table.SelectColumns</code>) is safer "
                        "than removing: new source columns won't sneak in.</li>",
                        "<li><strong>Data types</strong> decide what you can do: text can't be summed, "
                        "a text date can't drive time intelligence. Common types: "
                        "<code>type text</code>, <code>type number</code>, <code>Int64.Type</code>, "
                        "<code>type date</code>, <code>Currency.Type</code>.</li>",
                        "</ul>",
                        "<p>Conversion failures show as <strong>Error</strong> cells &mdash; use "
                        "<em>Remove Errors</em> or <em>Replace Errors</em>, but first find out why.</p>",
                    ),
                    'Typed = Table.TransformColumnTypes(Source, {{"Amount", type number}, {"OrderDate", type date}})',
                    "// Set Amount to a number and OrderDate to a date.\nTyped = Table.TransformColumnTypes(Source, {\n    \n})",
                    'Typed = Table.TransformColumnTypes(Source, {\n    {"Amount", type number},\n    {"OrderDate", type date}\n})',
                    "Fix the Data Types",
                    "Use Table.TransformColumnTypes to make Amount a number and OrderDate a date.",
                    [
                        ("Uses Table.TransformColumnTypes", "'table.transformcolumntypes(' in " + _N),
                        ("Amount is type number", "'\"amount\",typenumber' in " + _N),
                        ("OrderDate is type date", "'\"orderdate\",typedate' in " + _N),
                    ],
                    [
                        "The second argument is a list of {\"Column\", type} pairs",
                        "{\"Amount\", type number}",
                        "{\"OrderDate\", type date}",
                    ],
                ),
                _lesson(
                    2, "Split, Add Columns & Applied Steps", 15,
                    _p(
                        "<h2>Reshape columns</h2>",
                        "<h3>Split</h3>",
                        "<p><em>Split Column &rarr; By Delimiter</em> turns <code>\"Sok, Dara\"</code> into two "
                        "columns. In M: <code>Table.SplitColumn(...)</code>.</p>",
                        "<h3>Add a column</h3>",
                        "<p>Four ways: <strong>Custom Column</strong> (write a formula), "
                        "<strong>Conditional Column</strong> (if/then form), "
                        "<strong>Column From Examples</strong> (type the result, Power BI guesses the "
                        "rule), and <strong>Index Column</strong>. All produce <code>Table.AddColumn</code>:</p>",
                        "<pre><code>Banded = Table.AddColumn(Typed, \"Sales Band\",\n"
                        "    each if [Amount] &gt;= 1000 then \"High\"\n"
                        "         else if [Amount] &gt;= 300 then \"Medium\"\n"
                        "         else \"Low\",\n"
                        "    type text)</code></pre>",
                        "<p><code>each</code> means &ldquo;for every row&rdquo;; <code>[Amount]</code> is that "
                        "row's value.</p>",
                        "<h3>Applied Steps</h3>",
                        "<p>Every action is a step you can <strong>rename</strong>, <strong>delete</strong>, "
                        "<strong>move</strong>, <strong>insert after</strong>, <strong>edit</strong> (gear "
                        "icon) or inspect. Steps re-run on every refresh &mdash; that's what makes cleaning "
                        "repeatable. Queries usually break when a step refers to a column a source "
                        "renamed. <em>Advanced Editor</em> shows the whole query as M.</p>",
                    ),
                    'Banded = Table.AddColumn(Typed, "Sales Band", each if [Amount] >= 1000 then "High" else "Low", type text)',
                    "// Add a column \"Size\": \"Bulk\" when [Quantity] >= 50, otherwise \"Single\".\nSized = Table.AddColumn(Typed, \"Size\", )",
                    'Sized = Table.AddColumn(Typed, "Size", each if [Quantity] >= 50 then "Bulk" else "Single", type text)',
                    "Conditional Column",
                    "Add a Size column with Table.AddColumn: Bulk if Quantity >= 50, else Single.",
                    [
                        ("Uses Table.AddColumn", "'table.addcolumn(' in " + _N),
                        ("Row-by-row with each", "'each' in code.lower()"),
                        ("Checks [Quantity] >= 50", "'[quantity]>=50' in " + _N),
                        ("if / then / else with both labels",
                         "'then' in code.lower() and 'else' in code.lower() and 'bulk' in code.lower() and 'single' in code.lower()"),
                    ],
                    [
                        "The third argument starts with `each`",
                        "each if [Quantity] >= 50 then \"Bulk\" else \"Single\"",
                        "M keywords (if/then/else/each) are lower-case",
                    ],
                ),
            ],
        },
        # ================================================================ #
        #  Week 3
        # ================================================================ #
        {
            "title": "Combine & Model",
            "description": "Merge and append queries, then build a star-schema model.",
            "order": 3,
            "difficulty": "beginner",
            "lessons": [
                _lesson(
                    1, "Merge & Append Queries", 20,
                    _p(
                        "<h2>Two ways to combine tables</h2>",
                        "<table>",
                        "<tr><th></th><th>Append</th><th>Merge</th></tr>",
                        "<tr><td>Adds</td><td>Rows (stack tables)</td><td>Columns (look up)</td></tr>",
                        "<tr><td>Needs</td><td>Same columns</td><td>A matching key</td></tr>",
                        "<tr><td>SQL cousin</td><td>UNION ALL</td><td>JOIN</td></tr>",
                        "<tr><td>M function</td><td><code>Table.Combine</code></td><td><code>Table.NestedJoin</code></td></tr>",
                        "</table>",
                        "<pre><code>AllSales = Table.Combine({Sales_2025, Sales_2026})\n\n"
                        "Merged = Table.NestedJoin(Sales, {\"ProductID\"},\n"
                        "    Products, {\"ProductID\"}, \"Product\", JoinKind.LeftOuter)</code></pre>",
                        "<h3>Join kinds</h3>",
                        "<ul>",
                        "<li><strong>Left Outer</strong> &mdash; all left rows + matches (the usual).</li>",
                        "<li><strong>Inner</strong> &mdash; only rows that match on both sides.</li>",
                        "<li><strong>Full Outer</strong> &mdash; everything from both.</li>",
                        "<li><strong>Left Anti</strong> &mdash; left rows with <em>no</em> match (great for "
                        "finding orphans).</li>",
                        "</ul>",
                        "<p>After a merge, click the expand icon to pick which columns to bring in. "
                        "Tip: for monthly files, the <strong>Folder</strong> connector appends them "
                        "automatically.</p>",
                    ),
                    "AllSales = Table.Combine({Sales_2025, Sales_2026})",
                    "// Stack the three yearly queries into one table.\nAllSales = ",
                    "AllSales = Table.Combine({Sales_2024, Sales_2025, Sales_2026})",
                    "Append Three Years",
                    "Append Sales_2024, Sales_2025 and Sales_2026 with Table.Combine.",
                    [
                        ("Uses Table.Combine", "'table.combine(' in " + _N),
                        ("Passes a list in { }", "'combine({' in " + _N),
                        ("Includes all three years",
                         "'sales_2024' in code.lower() and 'sales_2025' in code.lower() and 'sales_2026' in code.lower()"),
                    ],
                    [
                        "Table.Combine takes ONE argument: a list of tables",
                        "Lists in M use curly braces: {A, B, C}",
                        "Table.Combine({Sales_2024, Sales_2025, Sales_2026})",
                    ],
                ),
                _lesson(
                    2, "Star Schema & Relationships", 20,
                    _p(
                        "<h2>Model your data like a star</h2>",
                        "<p>A <strong>fact</strong> table records events (Sales: date, product, store, "
                        "amount). <strong>Dimension</strong> tables describe them (Products, Customers, "
                        "Stores, Date). Put the fact in the middle, dimensions around it &mdash; a "
                        "<strong>star schema</strong>. When a dimension is split further "
                        "(Product &rarr; Subcategory &rarr; Category) it becomes a <strong>snowflake</strong>; "
                        "Power BI works best when you flatten it back to a star.</p>",
                        "<h3>Relationships</h3>",
                        "<ul>",
                        "<li><strong>Cardinality</strong>: almost always <em>one-to-many</em> "
                        "(one product &rarr; many sales rows).</li>",
                        "<li><strong>Cross-filter direction</strong>: <em>single</em> (dimension filters "
                        "fact) by default; <em>both</em> only when you really need it.</li>",
                        "<li><strong>Active vs inactive</strong>: only one active path between two "
                        "tables; others are dashed and switched on in DAX with "
                        "<code>USERELATIONSHIP</code>.</li>",
                        "</ul>",
                        "<h3>RELATED</h3>",
                        "<p>In a calculated column on the <em>many</em> side, <code>RELATED</code> fetches "
                        "a value from the <em>one</em> side &mdash; like a VLOOKUP that uses the "
                        "relationship:</p>",
                        "<pre><code>Category = RELATED(Products[Category])</code></pre>",
                    ),
                    "Category = RELATED(Products[Category])",
                    "-- Calculated column on Sales: bring in the store's City\n-- from the related Stores table.\nStore City = ",
                    "Store City = RELATED(Stores[City])",
                    "Look Up Through a Relationship",
                    "Add a Store City column to Sales using RELATED(Stores[City]).",
                    [
                        ("Column is named Store City", "'storecity=' in " + _N),
                        ("Uses RELATED", "'related(' in " + _N),
                        ("Fetches Stores[City]", "'stores[city]' in " + _N),
                    ],
                    [
                        "RELATED works from the many side (Sales) to the one side (Stores)",
                        "It takes a single column: RELATED(Table[Column])",
                        "Store City = RELATED(Stores[City])",
                    ],
                ),
            ],
        },
        # ================================================================ #
        #  Week 4
        # ================================================================ #
        {
            "title": "DAX Fundamentals",
            "description": "Calculated columns vs measures, iterators, CALCULATE and filter context.",
            "order": 4,
            "difficulty": "intermediate",
            "lessons": [
                _lesson(
                    1, "Calculated Columns vs Measures", 20,
                    _p(
                        "<h2>Two kinds of DAX calculation</h2>",
                        "<table>",
                        "<tr><th></th><th>Calculated column</th><th>Measure</th></tr>",
                        "<tr><td>Computed</td><td>Once per row, at refresh</td><td>On the fly, per visual</td></tr>",
                        "<tr><td>Stored</td><td>Yes (uses memory)</td><td>No</td></tr>",
                        "<tr><td>Context</td><td>Row context</td><td>Filter context</td></tr>",
                        "<tr><td>Use for</td><td>Slicing / grouping (Age Band)</td><td>Numbers to aggregate (Revenue)</td></tr>",
                        "</table>",
                        "<p>Rule of thumb: if you'll put it on an axis or slicer, it's a column; if "
                        "you'll put it in Values, it's a measure.</p>",
                        "<h3>Iterators: the X functions</h3>",
                        "<p><code>SUM</code> adds one column. When you must calculate per row "
                        "<em>first</em> (quantity &times; price) use an iterator &mdash; "
                        "<code>SUMX</code>, <code>AVERAGEX</code>, <code>MAXX</code>:</p>",
                        "<pre><code>Revenue = SUMX(Sales, Sales[Quantity] * Sales[Unit Price])</code></pre>",
                        "<p>SUMX walks the Sales table row by row, multiplies, then adds the results "
                        "&mdash; no extra stored column needed.</p>",
                        "<p>Other basics: <code>COUNTROWS(Sales)</code>, "
                        "<code>DISTINCTCOUNT(Sales[CustomerID])</code>, <code>AVERAGE</code>, "
                        "<code>MIN</code>/<code>MAX</code>.</p>",
                    ),
                    "Revenue = SUMX(Sales, Sales[Quantity] * Sales[Unit Price])",
                    "-- Measure: total cost = Quantity times Unit Cost, summed over Sales.\nTotal Cost = ",
                    "Total Cost = SUMX(Sales, Sales[Quantity] * Sales[Unit Cost])",
                    "Row-by-Row with SUMX",
                    "Write a Total Cost measure with SUMX over Sales, multiplying Quantity by Unit Cost.",
                    [
                        ("Measure is named Total Cost", "'totalcost=' in " + _N),
                        ("Iterates Sales with SUMX", "'sumx(sales,' in " + _N),
                        ("Multiplies Quantity by Unit Cost",
                         "'sales[quantity]' in " + _N + " and 'sales[unitcost]' in " + _N + " and '*' in code"),
                    ],
                    [
                        "SUMX(Table, expression evaluated per row)",
                        "Column names with spaces still go inside [ ]: Sales[Unit Cost]",
                        "Total Cost = SUMX(Sales, Sales[Quantity] * Sales[Unit Cost])",
                    ],
                ),
                _lesson(
                    2, "CALCULATE & Filter Context", 20,
                    _p(
                        "<h2>The most important function in DAX</h2>",
                        "<p>Every cell in a visual has a <strong>filter context</strong>: the slicers, "
                        "rows and columns that apply to it. A measure is evaluated inside that "
                        "context. <code>CALCULATE</code> lets you <em>change</em> it:</p>",
                        "<pre><code>Phnom Penh Sales =\n"
                        "    CALCULATE([Total Sales], Stores[City] = \"Phnom Penh\")\n\n"
                        "All Sales = CALCULATE([Total Sales], ALL(Sales))</code></pre>",
                        "<ul>",
                        "<li>Filter arguments <strong>replace</strong> existing filters on that column.</li>",
                        "<li><code>ALL(table or column)</code> removes filters &mdash; the classic way to "
                        "get a grand total for percentages.</li>",
                        "<li><code>FILTER(table, condition)</code> for conditions a simple filter can't "
                        "express.</li>",
                        "</ul>",
                        "<h3>Safe division</h3>",
                        "<p>Use <code>DIVIDE(a, b)</code> instead of <code>a / b</code>: it returns blank "
                        "(or a value you choose) instead of an error when <code>b</code> is 0.</p>",
                        "<pre><code>% of Total =\n"
                        "    DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales)))</code></pre>",
                        "<p>Format it as a percentage in <em>Measure tools</em>.</p>",
                    ),
                    "% of Total = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Sales)))",
                    "-- Each product's share of ALL products' sales.\n-- Remove the filter on Products, keep everything else.\nProduct Share = ",
                    "Product Share = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Products)))",
                    "Share of Total",
                    "Write Product Share: [Total Sales] divided by [Total Sales] with ALL(Products), using DIVIDE.",
                    [
                        ("Uses DIVIDE, not /", "'divide(' in " + _N),
                        ("Changes context with CALCULATE", "'calculate([totalsales]' in " + _N),
                        ("Removes the Products filter with ALL", "'all(products)' in " + _N),
                    ],
                    [
                        "The denominator is CALCULATE([Total Sales], ALL(Products))",
                        "DIVIDE(numerator, denominator)",
                        "Product Share = DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Products)))",
                    ],
                ),
            ],
        },
        # ================================================================ #
        #  Week 5
        # ================================================================ #
        {
            "title": "Time Intelligence & Visuals",
            "description": "A proper date table, YoY comparisons, ranking and report design.",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                _lesson(
                    1, "Date Table & Time Intelligence", 20,
                    _p(
                        "<h2>Time intelligence needs a date table</h2>",
                        "<p>Create one table with one row per day, relate it to every fact's date, "
                        "and <strong>Mark as date table</strong>:</p>",
                        "<pre><code>Date =\n"
                        "ADDCOLUMNS(\n"
                        "    CALENDAR(DATE(2024,1,1), DATE(2026,12,31)),\n"
                        "    \"Year\", YEAR([Date]),\n"
                        "    \"Month\", FORMAT([Date], \"MMM\"),\n"
                        "    \"Month No\", MONTH([Date])\n"
                        ")</code></pre>",
                        "<p>Sort <em>Month</em> by <em>Month No</em> so Jan&ndash;Dec appear in order.</p>",
                        "<h3>Common time-intelligence functions</h3>",
                        "<ul>",
                        "<li><code>TOTALYTD([Total Sales], 'Date'[Date])</code> &mdash; year to date.</li>",
                        "<li><code>SAMEPERIODLASTYEAR('Date'[Date])</code> &mdash; shift the period back a year.</li>",
                        "<li><code>DATEADD('Date'[Date], -1, MONTH)</code> &mdash; previous month.</li>",
                        "</ul>",
                        "<pre><code>Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))\n"
                        "YoY % = DIVIDE([Total Sales] - [Sales LY], [Sales LY])</code></pre>",
                        "<p><code>Date</code> is a reserved word, so the table name needs quotes: "
                        "<code>'Date'[Date]</code>.</p>",
                    ),
                    "Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))",
                    "-- Last year's sales for the same period.\nSales LY = ",
                    "Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))",
                    "Same Period Last Year",
                    "Write Sales LY: [Total Sales] calculated over SAMEPERIODLASTYEAR('Date'[Date]).",
                    [
                        ("Uses CALCULATE on [Total Sales]", "'calculate([totalsales]' in " + _N),
                        ("Shifts with SAMEPERIODLASTYEAR", "'sameperiodlastyear(' in " + _N),
                        ("Uses the Date table's Date column", "'date[date]' in " + _N + ".replace(\"'\", '')"),
                    ],
                    [
                        "Time-intelligence functions are filters, so wrap them in CALCULATE",
                        "SAMEPERIODLASTYEAR takes the date column: 'Date'[Date]",
                        "Sales LY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))",
                    ],
                ),
                _lesson(
                    2, "Visuals, Ranking & Conditional Formatting", 20,
                    _p(
                        "<h2>Pick the right visual</h2>",
                        "<table>",
                        "<tr><th>Question</th><th>Visual</th></tr>",
                        "<tr><td>Compare categories</td><td>Bar / column chart</td></tr>",
                        "<tr><td>Trend over time</td><td>Line chart</td></tr>",
                        "<tr><td>One headline number</td><td>Card / KPI</td></tr>",
                        "<tr><td>Detail rows</td><td>Table / matrix</td></tr>",
                        "<tr><td>Where</td><td>Map / filled map</td></tr>",
                        "</table>",
                        "<p>Add <strong>slicers</strong> for filtering, <strong>drill-down</strong> on "
                        "hierarchies (Year &rarr; Month), <strong>drill-through</strong> pages for detail, "
                        "and <strong>tooltips</strong>. Use <em>Edit interactions</em> to control how "
                        "visuals cross-filter each other. Custom visuals come from AppSource.</p>",
                        "<h3>Ranking with RANKX</h3>",
                        "<pre><code>Product Rank =\n"
                        "    RANKX(ALL(Products[Product]), [Total Sales], , DESC)</code></pre>",
                        "<p><code>ALL</code> makes each product rank against <em>every</em> product, not just "
                        "itself. Use it in a <em>Top N</em> visual-level filter.</p>",
                        "<h3>Measure-driven colours</h3>",
                        "<p>Conditional formatting can take its colour from a measure (<em>Format "
                        "style: Field value</em>):</p>",
                        "<pre><code>Margin Colour =\n"
                        "    SWITCH(TRUE(),\n"
                        "        [Margin %] &lt; 0.1, \"#D64550\",\n"
                        "        [Margin %] &lt; 0.25, \"#F2C811\",\n"
                        "        \"#2BA84A\")</code></pre>",
                    ),
                    "Product Rank = RANKX(ALL(Products[Product]), [Total Sales], , DESC)",
                    "-- Rank every store by Total Sales, highest = 1.\nStore Rank = ",
                    "Store Rank = RANKX(ALL(Stores[Store]), [Total Sales], , DESC)",
                    "Rank the Stores",
                    "Write Store Rank using RANKX over ALL(Stores[Store]) by [Total Sales], descending.",
                    [
                        ("Uses RANKX", "'rankx(' in " + _N),
                        ("Ranks against ALL stores", "'rankx(all(stores[store])' in " + _N),
                        ("Ranks by [Total Sales]", "'[totalsales]' in " + _N),
                        ("Highest first (DESC)", "'desc' in code.lower()"),
                    ],
                    [
                        "RANKX(table, expression, [value], [order])",
                        "Skip the third argument with two commas: , , DESC",
                        "Store Rank = RANKX(ALL(Stores[Store]), [Total Sales], , DESC)",
                    ],
                ),
            ],
        },
        # ================================================================ #
        #  Week 6
        # ================================================================ #
        {
            "title": "Publish, Share & Secure",
            "description": "Workspaces, refresh, gateways and row-level security in the Service.",
            "order": 6,
            "difficulty": "advanced",
            "lessons": [
                _lesson(
                    1, "Publishing, Workspaces & Refresh", 25,
                    _p(
                        "<h2>From Desktop to the Power BI Service</h2>",
                        "<p><strong>Home &rarr; Publish</strong> uploads your .pbix to a "
                        "<strong>workspace</strong>, where it becomes a <strong>semantic model</strong> "
                        "(dataset) + a <strong>report</strong>. Pin visuals from reports onto a one-page "
                        "<strong>dashboard</strong>; bundle reports into an <strong>app</strong> for wide "
                        "distribution.</p>",
                        "<h3>Workspace roles</h3>",
                        "<table>",
                        "<tr><th>Role</th><th>Can</th></tr>",
                        "<tr><td>Admin</td><td>Everything, incl. managing access</td></tr>",
                        "<tr><td>Member</td><td>Publish, edit, share, add Contributors</td></tr>",
                        "<tr><td>Contributor</td><td>Publish and edit content</td></tr>",
                        "<tr><td>Viewer</td><td>Only view (give this to most people)</td></tr>",
                        "</table>",
                        "<h3>Keeping data fresh</h3>",
                        "<ul>",
                        "<li>Cloud sources refresh directly; on-premises files and databases need an "
                        "<strong>on-premises data gateway</strong>.</li>",
                        "<li><strong>Scheduled refresh</strong>: up to 8/day on Pro, 48/day on Premium.</li>",
                        "<li><strong>Incremental refresh</strong> reloads only recent data. Create two "
                        "DateTime parameters, <code>RangeStart</code> and <code>RangeEnd</code>, and "
                        "filter the fact table with them in Power Query:</li>",
                        "</ul>",
                        "<pre><code>Filtered = Table.SelectRows(Typed,\n"
                        "    each [OrderDate] &gt;= RangeStart and [OrderDate] &lt; RangeEnd)</code></pre>",
                        "<p>Use <code>&gt;=</code> on one end and <code>&lt;</code> on the other so no row "
                        "lands in two partitions.</p>",
                    ),
                    "Filtered = Table.SelectRows(Typed, each [OrderDate] >= RangeStart and [OrderDate] < RangeEnd)",
                    "// Incremental-refresh filter on the OrderDate column.\nFiltered = Table.SelectRows(Typed, )",
                    "Filtered = Table.SelectRows(Typed, each [OrderDate] >= RangeStart and [OrderDate] < RangeEnd)",
                    "Incremental Refresh Filter",
                    "Filter OrderDate between RangeStart (inclusive) and RangeEnd (exclusive) with Table.SelectRows.",
                    [
                        ("Uses Table.SelectRows", "'table.selectrows(' in " + _N),
                        ("Inclusive lower bound on RangeStart", "'[orderdate]>=rangestart' in " + _N),
                        ("Exclusive upper bound on RangeEnd", "'[orderdate]<rangeend' in " + _N),
                        ("Both conditions joined with and", "'and' in code.lower() and 'each' in code.lower()"),
                    ],
                    [
                        "The condition is `each ...` — one row at a time",
                        "Lower bound: [OrderDate] >= RangeStart",
                        "Upper bound: [OrderDate] < RangeEnd (strictly less than)",
                    ],
                ),
                _lesson(
                    2, "Row-Level Security", 25,
                    _p(
                        "<h2>One report, each user sees only their rows</h2>",
                        "<p><strong>Row-level security (RLS)</strong> filters data by who is viewing. "
                        "In Desktop: <strong>Modeling &rarr; Manage roles</strong>, create a role, and "
                        "give a table a DAX filter that returns TRUE for rows the user may see.</p>",
                        "<h3>Static RLS</h3>",
                        "<pre><code>-- Role \"Siem Reap\" on the Stores table\n"
                        "[Region] = \"Siem Reap\"</code></pre>",
                        "<p>Simple, but you need one role per region.</p>",
                        "<h3>Dynamic RLS</h3>",
                        "<p>Keep a table that maps each manager's email to their region, and filter it "
                        "with <code>USERPRINCIPALNAME()</code> (the signed-in user's email). The "
                        "relationship then filters Stores and Sales automatically:</p>",
                        "<pre><code>-- Role \"Managers\" on the Managers table\n"
                        "[Email] = USERPRINCIPALNAME()</code></pre>",
                        "<h3>Test and assign</h3>",
                        "<ul>",
                        "<li>Desktop: <strong>View as</strong> a role (and a user) to test.</li>",
                        "<li>Service: model <em>&hellip; &rarr; Security</em> to add people or groups to roles.</li>",
                        "<li>RLS applies to Viewers. Workspace Admins/Members/Contributors bypass it.</li>",
                        "</ul>",
                    ),
                    "[Email] = USERPRINCIPALNAME()",
                    "-- Dynamic RLS filter for the SalesReps table:\n-- a rep may only see the row whose RepEmail is their own login.\n",
                    "[RepEmail] = USERPRINCIPALNAME()",
                    "Dynamic RLS Rule",
                    "Write the role filter for SalesReps so each rep sees only rows where RepEmail is their login.",
                    [
                        ("Filters the RepEmail column", "'[repemail]' in " + _N),
                        ("Compares with =", "'=' in code"),
                        ("Uses USERPRINCIPALNAME()", "'userprincipalname()' in " + _N),
                    ],
                    [
                        "An RLS filter is a DAX expression that returns TRUE/FALSE per row",
                        "USERPRINCIPALNAME() returns the viewer's email",
                        "[RepEmail] = USERPRINCIPALNAME()",
                    ],
                ),
            ],
        },
    ],
}


async def seed_power_bi_track():
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == POWER_BI_TRACK["slug"])
        )
        if existing.scalars().first():
            print("Power BI track already exists; nothing to do.")
            return

        language = Language(
            name=POWER_BI_TRACK["name"],
            slug=POWER_BI_TRACK["slug"],
            icon=POWER_BI_TRACK["icon"],
            description=POWER_BI_TRACK["description"],
            color=POWER_BI_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in POWER_BI_TRACK["modules"]:
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
        n_mod = len(POWER_BI_TRACK["modules"])
        n_les = sum(len(m["lessons"]) for m in POWER_BI_TRACK["modules"])
        print(f"Power BI track seeded: {n_mod} modules, {n_les} lessons.")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_power_bi_track()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
