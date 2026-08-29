from sqlalchemy import select
from models.models import Language, Module, Lesson, Exercise
from database import async_session


FULLSTACK_LANGUAGE = {
    "name": "Full Stack",
    "slug": "full-stack",
    "icon": "🌐",
    "description": "Build complete web apps: frontend, backend, database, migrations, and AI-assisted development",
    "color": "#8FFFEO",
    "modules": [
        # ------------------------------------------------------------------
        # Module 1: Frontend - HTML & CSS
        # ------------------------------------------------------------------
        {
            "title": "Frontend: HTML & CSS",
            "description": "Build the structure and style of web pages",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Semantic HTML Structure",
                    "content": """<h2>Structure with HTML</h2>
<p>A web <strong>frontend</strong> is what users see. HTML gives your page structure.</p>
<ul>
<li><code>&lt;header&gt;</code> - top area (logo, nav)</li>
<li><code>&lt;main&gt;</code> - the page's main content</li>
<li><code>&lt;section&gt;</code> - a distinct part of content</li>
<li><code>&lt;footer&gt;</code> - bottom area</li>
</ul>
<p>These are called <strong>semantic tags</strong> - they describe what content means, which helps accessibility and AI processing.</p>""",
                    "code_example": "<!DOCTYPE html>\n<html>\n<head>\n    <title>My Site</title>\n</head>\n<body>\n    <header>\n        <h1>My Website</h1>\n    </header>\n    <main>\n        <section>\n            <h2>About</h2>\n            <p>Welcome to my page</p>\n        </section>\n    </main>\n    <footer>\n        <p>© 2026</p>\n    </footer>\n</body>\n</html>",
                    "starter_code": "<!DOCTYPE html>\n<html>\n<body>\n    <!-- Add a semantic main section here -->\n    \n</body>\n</html>",
                    "solution": "<!DOCTYPE html>\n<html>\n<body>\n    <main>\n        <section>\n            <h2>Hello World</h2>\n        </section>\n    </main>\n</body>\n</html>",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Semantic Section",
                            "description": "Add a semantic <main> element containing an <h2> heading that says 'Full Stack'.",
                            "starter_code": "<!DOCTYPE html>\n<html>\n<body>\n    <!-- Add your <main> here -->\n    \n</body>\n</html>",
                            "solution": "<!DOCTYPE html>\n<html>\n<body>\n    <main>\n        <h2>Full Stack</h2>\n    </main>\n</body>\n</html>",
                            "test_cases": {
                                "tests": [
                                    {"description": "Contains a main tag",
                                     "test": "'<main>' in code and '</main>' in code"},
                                    {"description": "Contains an h2 heading",
                                     "test": "'<h2>' in code"},
                                    {"description": "Heading says 'Full Stack'",
                                     "test": "'Full Stack' in code"}
                                ]
                            },
                            "hints": [
                                "Wrap your heading in <main> and </main>",
                                "Use <h2>text</h2> for the heading",
                                "Type: <main><h2>Full Stack</h2></main>"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "Styling with CSS",
                    "content": """<h2>Style with CSS</h2>
<p><strong>CSS</strong> (Cascading Style Sheets) controls colors, spacing, fonts, and layout.</p>
<h3>Basic CSS pattern:</h3>
<pre><code>/* selector { property: value; } */
h1 {
  color: #8FFFEO;
  font-size: 32px;
}</code></pre>
<p>A <strong>class</strong> lets you style many elements the same way. Use <code>.className</code> to target it.</p>""",
                    "code_example": "<style>\n  .card {\n    background: #03313A;\n    color: #8FFFEO;\n    border-radius: 12px;\n    padding: 20px;\n  }\n</style>\n<div class=\"card\">\n  <h2>Hello</h2>\n</div>",
                    "starter_code": "<style>\n  /* Style the button class */\n  \n</style>\n<button class=\"btn\">Click me</button>",
                    "solution": "<style>\n  .btn {\n    background: #0E5E6E;\n    color: #fff;\n    border-radius: 8px;\n    padding: 10px 16px;\n  }\n</style>\n<button class=\"btn\">Click me</button>",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Style a Button",
                            "description": "Add a CSS rule that styles the .btn class with a teal background color and white text.",
                            "starter_code": "<style>\n  /* Add your .btn rule here */\n  \n</style>\n<button class=\"btn\">Submit</button>",
                            "solution": "<style>\n  .btn {\n    background: #0E5E6E;\n    color: #fff;\n  }\n</style>\n<button class=\"btn\">Submit</button>",
                            "test_cases": {
                                "tests": [
                                    {"description": "Has a .btn selector",
                                     "test": "'.btn' in code"},
                                    {"description": "Sets a background color",
                                     "test": "'background' in code"},
                                    {"description": "Sets white text",
                                     "test": "'color: #fff' in code or 'color: white;' in code"}
                                ]
                            },
                            "hints": [
                                "A CSS rule has a selector then { }",
                                "background: #0E5E6E;",
                                "color: #fff;"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        },
        # ------------------------------------------------------------------
        # Module 2: Frontend - JavaScript
        # ------------------------------------------------------------------
        {
            "title": "Frontend: JavaScript & Interactivity",
            "description": "Make your pages interactive and talk to APIs",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "JavaScript in the Browser",
                    "content": """<h2>JavaScript Brings Pages Alive</h2>
<p>HTML + CSS build the look; <strong>JavaScript</strong> adds behavior.</p>
<p>You can select an element and change it:</p>
<pre><code>const title = document.querySelector('h1');
title.textContent = 'Hello from JS';</code></pre>
<p><code>document.querySelector</code> finds an element. <code>addEventListener</code> reacts to clicks.</p>""",
                    "code_example": "const btn = document.querySelector('#go');\nconst title = document.querySelector('#title');\n\nbtn.addEventListener('click', () => {\n  title.textContent = 'You clicked it!';\n});",
                    "starter_code": "// Select the button and the title\nconst btn = document.querySelector('#go');\nconst title = document.querySelector('#title');\n\n// Add a click listener that changes the title\n",
                    "solution": "const btn = document.querySelector('#go');\nconst title = document.querySelector('#title');\n\nbtn.addEventListener('click', () => {\n  title.textContent = 'Done!';\n});",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Click Handler",
                            "description": "Write JS that changes a heading's text to 'Done!' when a button is clicked. Use addEventListener.",
                            "starter_code": "const btn = document.querySelector('#go');\nconst title = document.querySelector('#title');\n\nbtn.addEventListener('click', () => {\n  // change the title text here\n});",
                            "solution": "const btn = document.querySelector('#go');\nconst title = document.querySelector('#title');\n\nbtn.addEventListener('click', () => {\n  title.textContent = 'Done!';\n});",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses addEventListener",
                                     "test": "'addEventListener' in code"},
                                    {"description": "Selects the title element",
                                     "test": "'querySelector' in code"},
                                    {"description": "Changes textContent to Done!",
                                     "test": "'textContent' in code and 'Done!' in code"}
                                ]
                            },
                            "hints": [
                                "Use addEventListener('click', handler)",
                                "The handler sets title.textContent",
                                "Set it to the string 'Done!'"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "Fetching Data from an API",
                    "content": """<h2>Fetching Data</h2>
<p>The <strong>frontend</strong> talks to the <strong>backend</strong> over HTTP using <code>fetch</code>.</p>
<pre><code>fetch('https://api.example.com/users')\n  .then(r => r.json())\n  .then(data => console.log(data));</code></pre>
<p>This sends a GET request and receives JSON. The same idea applies no matter what API you use.</p>""",
                    "code_example": "async function loadUsers() {\n  const res = await fetch('/api/users');\n  const data = await res.json();\n  console.log(data);\n}\n\nloadUsers();",
                    "starter_code": "async function loadData() {\n  // fetch from '/api/items'\n  // parse as json\n  // log it\n}\n\nloadData();",
                    "solution": "async function loadData() {\n  const res = await fetch('/api/items');\n  const data = await res.json();\n  console.log(data);\n}\n\nloadData();",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Fetch & Parse JSON",
                            "description": "Write an async function that fetches '/api/items', parses the response as JSON, and logs it to the console.",
                            "starter_code": "async function loadData() {\n  // add fetch and .json() here\n}\n\nloadData();",
                            "solution": "async function loadData() {\n  const res = await fetch('/api/items');\n  const data = await res.json();\n  console.log(data);\n}\n\nloadData();",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses fetch",
                                     "test": "'fetch(' in code"},
                                    {"description": "Parses response as JSON",
                                     "test": "'.json()' in code or '.json(' in code"},
                                    {"description": "Logs to console",
                                     "test": "'console.log(' in code"},
                                    {"description": "Is an async function",
                                     "test": "'async' in code"}
                                ]
                            },
                            "hints": [
                                "const res = await fetch('/api/items')",
                                "const data = await res.json()",
                                "console.log(data)"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        },
        # ------------------------------------------------------------------
        # Module 3: Backend & APIs
        # ------------------------------------------------------------------
        {
            "title": "Backend: APIs & HTTP",
            "description": "Understand servers, routes, and requests",
            "order": 3,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "What is an API?",
                    "content": """<h2>APIs Connect Frontend to Backend</h2>
<p>The <strong>backend</strong> is a server that stores data and processes logic. The web app calls it through an <strong>API</strong> (Application Programming Interface).</p>
<h3>HTTP request anatomy:</h3>
<ul>
<li><strong>Method</strong>: what to do (GET, POST, PUT, DELETE)</li>
<li><strong>URL/route</strong>: which resource (/users, /lessons)</li>
<li><strong>Body</strong>: optional data sent with the request</li>
</ul>
<p>A framework like <strong>FastAPI</strong> defines these routes in Python.</p>""",
                    "code_example": "# FastAPI example\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/api/hello\")\ndef hello():\n    return {\"message\": \"Hello from the backend!\"}\n\n@app.post(\"/api/users\")\ndef create_user():\n    return {\"status\": \"created\"}",
                    "starter_code": "# Define a GET route '/api/hello' that returns a message\n\n",
                    "solution": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/api/hello\")\ndef hello():\n    return {\"message\": \"Hello from the backend!\"}",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Define a Route",
                            "description": "Write a FastAPI GET route at '/api/hello' that returns a dict with a 'message' key. (This code runs in Python.)",
                            "starter_code": "from fastapi import FastAPI\n\napp = FastAPI()\n\n# add your route here",
                            "solution": "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/api/hello\")\ndef hello():\n    return {\"message\": \"Hello\"}",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses the @app.get decorator",
                                     "test": "'@app.get' in __code__ and \"hello\" in __code__"},
                                    {"description": "Returns a message",
                                     "test": "'message' in __code__"}
                                ]
                            },
                            "hints": [
                                "Decorate a function with @app.get(\"/api/hello\")",
                                "Return a dict: {\"message\": \"Hello\"}",
                                "Name the function hello"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "HTTP Methods & JSON",
                    "content": """<h2>Methods & Data</h2>
<p>HTTP <strong>methods</strong> map to CRUD operations:</p>
<ul>
<li><strong>GET</strong> - read data</li>
<li><strong>POST</strong> - create new data</li>
<li><strong>PUT/PATCH</strong> - update</li>
<li><strong>DELETE</strong> - remove</li>
</ul>
<p>Data travels as <strong>JSON</strong> - key/value pairs that both frontend and backend understand.</p>
<pre><code>{"username": "alice", "level": 5}</code></pre>""",
                    "code_example": "import json\n\nuser = {\"username\": \"alice\", \"level\": 5}\nprint(json.dumps(user))  # -> JSON string",
                    "starter_code": "# Create a dict with two keys: 'username' and 'level'\nuser = {\n    \n}\nprint(user)",
                    "solution": "user = {\"username\": \"alice\", \"level\": 5}\nprint(user)",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Build a JSON Object",
                            "description": "Create a Python dict called 'user' with keys 'username' and 'level'.",
                            "starter_code": "user = {\n    \n}\nprint(user)",
                            "solution": "user = {\"username\": \"alice\", \"level\": 5}\nprint(user)",
                            "test_cases": {
                                "tests": [
                                    {"description": "user dict exists",
                                     "test": "'user' in dir() and isinstance(user, dict)"},
                                    {"description": "has a username key",
                                     "test": "'username' in user and isinstance(user['username'], str)"},
                                    {"description": "has a level key",
                                     "test": "'level' in user and isinstance(user['level'], int)"}
                                ]
                            },
                            "hints": [
                                "Use quotes for keys: 'username'",
                                "username should be a string like 'alice'",
                                "level should be a number like 5"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        },
        # ------------------------------------------------------------------
        # Module 4: Databases
        # ------------------------------------------------------------------
        {
            "title": "Databases",
            "description": "Store and query data with SQL",
            "order": 4,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Intro to SQL & Tables",
                    "content": """<h2>Databases Store Data</h2>
<p>A <strong>database</strong> persists data. <strong>SQL</strong> is how we talk to relational databases (like PostgreSQL).</p>
<h3>Core commands:</h3>
<ul>
<li><code>CREATE TABLE</code> - define a structure</li>
<li><code>INSERT</code> - add rows</li>
<li><code>SELECT</code> - read rows</li>
<li><code>UPDATE</code> - change rows</li>
<li><code>DELETE</code> - remove rows</li>
</ul>
<p>A table has <strong>columns</strong> (fields) and <strong>rows</strong> (records).</p>""",
                    "code_example": "CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  username VARCHAR(100) NOT NULL\n);",
                    "starter_code": "-- Create a 'products' table with columns: id (PRIMARY KEY) and name (VARCHAR)\n",
                    "solution": "CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Create a Table",
                            "description": "Write a CREATE TABLE statement for a 'products' table with an 'id' integer primary key and a 'name' text column.",
                            "starter_code": "-- Write your CREATE TABLE here\n",
                            "solution": "CREATE TABLE products (\n  id INT PRIMARY KEY,\n  name TEXT\n);",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses CREATE TABLE",
                                     "test": "'CREATE TABLE' in code.upper()"},
                                    {"description": "Names the table products",
                                     "test": "'PRODUCTS' in code.upper()"},
                                    {"description": "Has an id column",
                                     "test": "'ID' in code.upper()"},
                                    {"description": "Has a name column",
                                     "test": "'NAME' in code.upper()"}
                                ]
                            },
                            "hints": [
                                "CREATE TABLE products ( ... )",
                                "List columns inside the parentheses",
                                "Include an id and a name column"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "Querying Data",
                    "content": """<h2>SELECT, WHERE, and Sorting</h2>
<p>Read data with <code>SELECT</code>, filter with <code>WHERE</code>, and sort with <code>ORDER BY</code>.</p>
<pre><code>SELECT name FROM users WHERE level > 3;</code></pre>
<p><strong>Relationships</strong> link tables. A <code>user_id</code> column on another table is a <em>foreign key</em> pointing back to the user.</p>""",
                    "code_example": "SELECT id, username FROM users\nWHERE level > 3\nORDER BY id ASC;",
                    "starter_code": "-- Select the 'name' column from 'products' where price > 10\n",
                    "solution": "SELECT name FROM products WHERE price > 10;",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Filter a Query",
                            "description": "Write a SELECT that gets the 'name' column from 'products' where the 'price' is greater than 10.",
                            "starter_code": "-- Write your SELECT here\n",
                            "solution": "SELECT name FROM products WHERE price > 10;",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses SELECT",
                                     "test": "'SELECT' in code.upper()"},
                                    {"description": "Selects the name column",
                                     "test": "'NAME' in code.upper()"},
                                    {"description": "Uses WHERE",
                                     "test": "'WHERE' in code.upper()"},
                                    {"description": "Filters price > 10",
                                     "test": "'PRICE > 10' in code.upper() or 'PRICE>10' in code.upper()"}
                                ]
                            },
                            "hints": [
                                "Start with SELECT name",
                                "FROM products",
                                "Add WHERE price > 10"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        },
        # ------------------------------------------------------------------
        # Module 5: Migrations
        # ------------------------------------------------------------------
        {
            "title": "Migrations",
            "description": "Version and evolve your database schema safely",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "What are Migrations?",
                    "content": """<h2>Migrations Version Your Schema</h2>
<p>When you change a <strong>model</strong> (add a table or column), you must update the database. <strong>Migrations</strong> are a version-controlled history of schema changes (like git, but for the DB).</p>
<h3>Why use them?</h3>
<ul>
<li>Apply changes consistently across machines</li>
<li>Team members stay in sync</li>
<li>You can roll back a mistake</li>
</ul>
<p>Tools like <strong>Alembic</strong> generate and apply these migration files.</p>""",
                    "code_example": "# Generate a migration from a model change\nuv run alembic revision --autogenerate -m \"add bio column\"\n\n# Apply it\nuv run alembic upgrade head\n\n# Undo the last one\nuv run alembic downgrade -1",
                    "starter_code": "# List applied migrations to see the current state\n# (write the command as a comment)\n",
                    "solution": "# uv run alembic current",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Know the Commands",
                            "description": "Write a comment line containing the command to show the current migration revision: uv run alembic current",
                            "starter_code": "# Write the command here\n",
                            "solution": "# uv run alembic current",
                            "test_cases": {
                                "tests": [
                                    {"description": "Mentions alembic",
                                     "test": "'alembic' in code.lower()"},
                                    {"description": "Uses the current command",
                                     "test": "'current' in code.lower()"}
                                ]
                            },
                            "hints": [
                                "The command starts with 'uv run'",
                                "It is: uv run alembic current",
                                "Write it as a comment"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "Rolling Back a Migration",
                    "content": """<h2>Upgrade and Downgrade</h2>
<p>Each migration defines an <code>upgrade()</code> (apply) and a <code>downgrade()</code> (undo) function.</p>
<p><strong>Workflow:</strong></p>
<ol>
<li>Change a model</li>
<li>Auto-generate: <code>uv run alembic revision --autogenerate</code></li>
<li>Review the generated file</li>
<li>Apply: <code>uv run alembic upgrade head</code></li>
</ol>
<p>Always review autogenerated migrations — they're a starting point, not gospel.</p>""",
                    "code_example": "# migration file (partial)\ndef upgrade():\n    op.add_column('users', sa.Column('bio', sa.String(), nullable=True))\n\ndef downgrade():\n    op.drop_column('users', 'bio')",
                    "starter_code": "# Write the command to undo the last migration (downgrade one step)\n",
                    "solution": "# uv run alembic downgrade -1",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Undo a Migration",
                            "description": "Write a comment with the command to downgrade by one migration: uv run alembic downgrade -1",
                            "starter_code": "# Write the command here\n",
                            "solution": "# uv run alembic downgrade -1",
                            "test_cases": {
                                "tests": [
                                    {"description": "Mentions alembic",
                                     "test": "'alembic' in code.lower()"},
                                    {"description": "Uses downgrade",
                                     "test": "'downgrade' in code.lower()"}
                                ]
                            },
                            "hints": [
                                "The command is uv run alembic downgrade -1",
                                "It undoes the last migration"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        },
        # ------------------------------------------------------------------
        # Module 6: Using AI in Development
        # ------------------------------------------------------------------
        {
            "title": "Using AI in Development",
            "description": "Work effectively with AI as your coding partner",
            "order": 6,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "AI-Assisted Coding",
                    "content": """<h2>AI Is Your Coding Partner</h2>
<p>AI tools (like CodeSphere's tutor, GitHub Copilot, and ChatGPT) can help you write, explain, debug, and review code.</p>
<h3>Ways AI helps:</h3>
<ul>
<li><strong>Explain</strong> unfamiliar code</li>
<li><strong>Generate</strong> boilerplate / starter projects</li>
<li><strong>Debug</strong> errors and suggest fixes</li>
<li><strong>Review</strong> your code for best practices</li>
</ul>
<p>Use AI as a guide — but always <strong>understand what the code does</strong>.</p>""",
                    "code_example": "# Example prompt to an AI tutor\n\"I'm learning full-stack. Explain how the frontend talks to the backend in one simple paragraph.\"\n\n# Example: ask for a hint instead of the answer\n\"Give me a hint for a FastAPI GET route, don't show the full solution.\"",
                    "starter_code": "# Write one thing you could ask AI to help you with\n# as a comment\n",
                    "solution": "# Help me explain the fetch() function in simple terms",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Best Use of AI",
                            "description": "Write a comment describing a GOOD question to ask the AI tutor. It should be specific and about learning.",
                            "starter_code": "# Your question to the AI tutor goes here\n",
                            "solution": "# Explain REST APIs with a simple real-world example",
                            "test_cases": {
                                "tests": [
                                    {"description": "Starts with a comment",
                                     "test": "code.strip().startswith('#')"},
                                    {"description": "Question is not empty",
                                     "test": "len(code.strip()) > 5"}
                                ]
                            },
                            "hints": [
                                "Start your question with #",
                                "Ask something specific, like explaining a concept",
                                "Be descriptive - the AI can't read your mind"
                            ],
                            "order": 1
                        }
                    ]
                },
                {
                    "title": "Writing Effective Prompts",
                    "content": """<h2>Good Prompts Get Good Answers</h2>
<p>A clear prompt includes <strong>context</strong>, <strong>role</strong>, and <strong>constraints</strong>.</p>
<pre><code>
Prompt: "Act as a beginner-friendly coding tutor.
Explain database migrations in 3 sentences.
Don't use jargon."
</code></pre>
<h3>Good prompt ingredients:</h3>
<ul>
<li>State your skill level</li>
<li>Define the output format (short / code / steps)</li>
<li>Add constraints (no jargon, one example)</li>
<li>Ask for a hint instead of a full answer when learning</li>
</ul>""",
                    "code_example": "# Weak: \"explain SQL\"\n# Strong: \"Explain SQL GROUP BY with one small example for a beginner who knows basic SELECT.\"",
                    "starter_code": "# Write a STRONG prompt asking the AI to explain 'HTTP methods' to a beginner in 2 sentences\n",
                    "solution": "# Explain HTTP methods (GET, POST, PUT, DELETE) in 2 simple sentences for a total beginner, with a real-world example",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Level Up Your Prompt",
                            "description": "Write a strong prompt (as a comment) asking the AI to explain HTTP methods to a beginner in 2 sentences.",
                            "starter_code": "# Your strong prompt here\n",
                            "solution": "# Explain HTTP methods in 2 simple sentences for a beginner",
                            "test_cases": {
                                "tests": [
                                    {"description": "Starts with a comment",
                                     "test": "code.strip().startswith('#')"},
                                    {"description": "Mentions HTTP or methods",
                                     "test": "code.lower().find('http') >= 0 or code.lower().find('method') >= 0"},
                                    {"description": "Is descriptive (more than 10 chars)",
                                     "test": "len(code.strip()) > 10"}
                                ]
                            },
                            "hints": [
                                "Include 'HTTP' or 'methods' in your prompt",
                                "Add context like 'for a beginner'",
                                "Ask for a short, simple explanation"
                            ],
                            "order": 1
                        }
                    ]
                }
            ]
        }
    ]
}


async def seed_fullstack():
    """Adds the Full-Stack language path if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == FULLSTACK_LANGUAGE["slug"])
        )
        if existing.scalars().first():
            print("Full-Stack path already exists; nothing to do.")
            return

        lang_data = FULLSTACK_LANGUAGE
        language = Language(
            name=lang_data["name"],
            slug=lang_data["slug"],
            icon=lang_data["icon"],
            description=lang_data["description"],
            color=lang_data["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in lang_data.get("modules", []):
            module = Module(
                language_id=language.id,
                title=mod_data["title"],
                description=mod_data["description"],
                order=mod_data["order"],
                difficulty=mod_data["difficulty"],
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
                    exercise = Exercise(
                        lesson_id=lesson.id,
                        title=ex_data["title"],
                        description=ex_data["description"],
                        starter_code=ex_data["starter_code"],
                        solution=ex_data["solution"],
                        test_cases=ex_data["test_cases"],
                        hints=ex_data["hints"],
                        order=ex_data["order"],
                    )
                    db.add(exercise)

        await db.commit()
        print("Full-Stack path seeded successfully!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_fullstack())
