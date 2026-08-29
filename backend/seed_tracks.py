"""Seed the 'Backend Foundations' learning track.

Covers the stack real teams ship on: databases & SQL, schema migrations,
REST APIs with FastAPI, API docs & tooling (OpenAPI/Swagger, Postman),
DevOps basics (Docker, CI/CD), and the Git/GitHub workflow (incl. SSH).

Idempotent: safe to run repeatedly. Run directly for local/dev:

    python seed_tracks.py

In deployed environments the accompanying Alembic migration
(<rev>_seed_backend_track.py) inserts the language + module shells.
"""
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson


BACKEND_TRACK = {
    "name": "Backend Foundations",
    "slug": "backend-foundations",
    "icon": "🗄️",
    "description": "Databases, migrations, REST APIs, DevOps and the Git workflow real teams ship on.",
    "color": "#3B82F6",
    "modules": [
        {
            "title": "Databases & SQL",
            "description": "Model data in tables and query it with SQL.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Tables, Rows & Columns",
                    "content": (
                        "<h2>Relational basics</h2>"
                        "<p>A <strong>database</strong> stores data in <strong>tables</strong>. "
                        "Each row is one record; each column is one field with a type "
                        "(<code>INTEGER</code>, <code>TEXT</code>, <code>TIMESTAMP</code>, ...).</p>"
                        "<p>One column is the <strong>primary key</strong> &mdash; a value unique to "
                        "each row, usually an auto-incrementing <code>id</code>.</p>"
                    ),
                    "code_example": (
                        "CREATE TABLE users (\n"
                        "    id         SERIAL PRIMARY KEY,\n"
                        "    email      TEXT UNIQUE NOT NULL,\n"
                        "    created_at TIMESTAMP DEFAULT now()\n"
                        ");"
                    ),
                    "starter_code": "-- Create a 'posts' table with id, title and a body column\n",
                    "solution": (
                        "CREATE TABLE posts (\n"
                        "    id    SERIAL PRIMARY KEY,\n"
                        "    title TEXT NOT NULL,\n"
                        "    body  TEXT\n"
                        ");"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                },
                {
                    "title": "SELECT, WHERE & JOIN",
                    "content": (
                        "<h2>Reading data</h2>"
                        "<p><code>SELECT</code> picks columns, <code>WHERE</code> filters rows, "
                        "<code>ORDER BY</code> sorts, and <code>JOIN</code> combines rows from two "
                        "tables on a matching key (usually a <strong>foreign key</strong>).</p>"
                    ),
                    "code_example": (
                        "SELECT p.title, u.email\n"
                        "FROM posts p\n"
                        "JOIN users u ON u.id = p.author_id\n"
                        "WHERE p.published = true\n"
                        "ORDER BY p.created_at DESC;"
                    ),
                    "starter_code": "-- Select every email from users created today\n",
                    "solution": (
                        "SELECT email FROM users\n"
                        "WHERE created_at >= date_trunc('day', now());"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                },
            ],
        },
        {
            "title": "Schema Migrations",
            "description": "Evolve the database over time with Alembic.",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Why Migrations Exist",
                    "content": (
                        "<h2>Versioned schema changes</h2>"
                        "<p>Your models change &mdash; new columns, new tables. A <strong>migration</strong> "
                        "is a small, ordered script that moves the schema from one version to the next, "
                        "so every environment (laptop, CI, production) ends up identical.</p>"
                        "<p>Alembic tracks the current version in an <code>alembic_version</code> table.</p>"
                    ),
                    "code_example": (
                        "# create a migration from model changes\n"
                        "alembic revision --autogenerate -m \"add posts.published\"\n\n"
                        "# apply everything up to the newest\n"
                        "alembic upgrade head\n\n"
                        "# step back one\n"
                        "alembic downgrade -1"
                    ),
                    "starter_code": "# Command that applies all pending migrations:\n",
                    "solution": "alembic upgrade head",
                    "order": 1,
                    "xp_reward": 15,
                },
                {
                    "title": "Anatomy of a Migration",
                    "content": (
                        "<h2>upgrade() and downgrade()</h2>"
                        "<p>Each file has a <code>revision</code>, a <code>down_revision</code> pointer "
                        "(forming a chain), and two functions. <code>upgrade()</code> applies the change; "
                        "<code>downgrade()</code> reverses it exactly.</p>"
                    ),
                    "code_example": (
                        "def upgrade():\n"
                        "    op.add_column('posts', sa.Column('published', sa.Boolean(), server_default='false'))\n\n"
                        "def downgrade():\n"
                        "    op.drop_column('posts', 'published')"
                    ),
                    "starter_code": (
                        "def upgrade():\n"
                        "    # add a nullable 'summary' TEXT column to posts\n"
                        "    pass\n"
                    ),
                    "solution": (
                        "def upgrade():\n"
                        "    op.add_column('posts', sa.Column('summary', sa.Text(), nullable=True))"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                },
            ],
        },
        {
            "title": "Building REST APIs",
            "description": "Serve JSON over HTTP with FastAPI.",
            "order": 3,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Routes, Methods & Status Codes",
                    "content": (
                        "<h2>The shape of an endpoint</h2>"
                        "<p>A REST API maps <strong>HTTP methods</strong> to actions on a resource: "
                        "<code>GET</code> reads, <code>POST</code> creates, <code>PUT/PATCH</code> updates, "
                        "<code>DELETE</code> removes. Responses carry a <strong>status code</strong> "
                        "(200 ok, 201 created, 404 not found, 422 validation error).</p>"
                    ),
                    "code_example": (
                        "from fastapi import FastAPI, HTTPException\n\n"
                        "app = FastAPI()\n\n"
                        "@app.get('/posts/{post_id}')\n"
                        "def get_post(post_id: int):\n"
                        "    post = db.get(post_id)\n"
                        "    if not post:\n"
                        "        raise HTTPException(status_code=404, detail='Not found')\n"
                        "    return post"
                    ),
                    "starter_code": (
                        "from fastapi import FastAPI\n\n"
                        "app = FastAPI()\n\n"
                        "# Add a GET route '/health' that returns {\"status\": \"ok\"}\n"
                    ),
                    "solution": (
                        "from fastapi import FastAPI\n\n"
                        "app = FastAPI()\n\n"
                        "@app.get('/health')\n"
                        "def health():\n"
                        "    return {'status': 'ok'}"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                },
                {
                    "title": "Request Bodies & Pydantic",
                    "content": (
                        "<h2>Validation for free</h2>"
                        "<p>Declare a <code>pydantic</code> model as a parameter and FastAPI parses the "
                        "JSON body, validates types, and returns a 422 with details if it is wrong &mdash; "
                        "before your code runs.</p>"
                    ),
                    "code_example": (
                        "from pydantic import BaseModel\n\n"
                        "class PostIn(BaseModel):\n"
                        "    title: str\n"
                        "    body: str | None = None\n\n"
                        "@app.post('/posts', status_code=201)\n"
                        "def create_post(data: PostIn):\n"
                        "    return db.insert(data.model_dump())"
                    ),
                    "starter_code": (
                        "from pydantic import BaseModel\n\n"
                        "# Model a 'UserIn' with email:str and age:int\n"
                    ),
                    "solution": (
                        "from pydantic import BaseModel\n\n"
                        "class UserIn(BaseModel):\n"
                        "    email: str\n"
                        "    age: int"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                },
            ],
        },
        {
            "title": "API Docs & Tooling",
            "description": "OpenAPI, Swagger UI and testing with Postman.",
            "order": 4,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "OpenAPI & Swagger UI",
                    "content": (
                        "<h2>Docs that write themselves</h2>"
                        "<p>FastAPI generates an <strong>OpenAPI</strong> schema (a JSON description of "
                        "every route) from your type hints. It serves an interactive "
                        "<strong>Swagger UI</strong> at <code>/docs</code> and ReDoc at <code>/redoc</code> "
                        "&mdash; you can call endpoints straight from the browser.</p>"
                    ),
                    "code_example": (
                        "# raw schema\n"
                        "GET http://localhost:8000/openapi.json\n\n"
                        "# interactive docs\n"
                        "open http://localhost:8000/docs"
                    ),
                    "starter_code": "# Path FastAPI serves interactive Swagger docs on:\n",
                    "solution": "/docs",
                    "order": 1,
                    "xp_reward": 15,
                },
                {
                    "title": "Testing with Postman & curl",
                    "content": (
                        "<h2>Hitting the API by hand</h2>"
                        "<p>A <strong>Postman collection</strong> is a saved set of requests you can rerun "
                        "and share. <code>curl</code> does the same from the terminal &mdash; useful in "
                        "scripts and CI.</p>"
                    ),
                    "code_example": (
                        "curl -X POST http://localhost:8000/posts \\\n"
                        "  -H 'Content-Type: application/json' \\\n"
                        "  -d '{\"title\": \"Hello\", \"body\": \"world\"}'"
                    ),
                    "starter_code": "# curl flag that sets the HTTP method:\n",
                    "solution": "-X",
                    "order": 2,
                    "xp_reward": 15,
                },
            ],
        },
        {
            "title": "DevOps Foundations",
            "description": "Containers, environments and CI pipelines.",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Docker & docker compose",
                    "content": (
                        "<h2>Ship the environment, not just the code</h2>"
                        "<p>A <strong>Dockerfile</strong> builds an image with your app and its exact "
                        "dependencies. <strong>docker compose</strong> runs several containers together "
                        "&mdash; e.g. your API plus a Postgres database.</p>"
                    ),
                    "code_example": (
                        "FROM python:3.12-slim\n"
                        "WORKDIR /app\n"
                        "COPY requirements.txt .\n"
                        "RUN pip install -r requirements.txt\n"
                        "COPY . .\n"
                        "CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]"
                    ),
                    "starter_code": "# compose command that builds and starts everything in the background:\n",
                    "solution": "docker compose up --build -d",
                    "order": 1,
                    "xp_reward": 20,
                },
                {
                    "title": "CI Pipelines",
                    "content": (
                        "<h2>Automate the checks</h2>"
                        "<p>A <strong>CI pipeline</strong> runs on every push: install deps, run tests, "
                        "run migrations against a throwaway DB, build the image. If any step fails, the "
                        "pull request is blocked.</p>"
                    ),
                    "code_example": (
                        "# .github/workflows/ci.yml (excerpt)\n"
                        "steps:\n"
                        "  - uses: actions/checkout@v4\n"
                        "  - run: pip install -r requirements.txt\n"
                        "  - run: alembic upgrade head\n"
                        "  - run: pytest -q"
                    ),
                    "starter_code": "# When does a CI pipeline typically run? (one word)\n",
                    "solution": "push",
                    "order": 2,
                    "xp_reward": 20,
                },
            ],
        },
        {
            "title": "Git & GitHub",
            "description": "Branching, pull requests and SSH keys.",
            "order": 6,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Commits & Branches",
                    "content": (
                        "<h2>Save points and parallel lines of work</h2>"
                        "<p>A <strong>commit</strong> is a snapshot with a message. A <strong>branch</strong> "
                        "is a movable pointer to a commit &mdash; you branch off <code>main</code>, do "
                        "work, then merge back.</p>"
                    ),
                    "code_example": (
                        "git switch -c feature/login\n"
                        "git add .\n"
                        "git commit -m \"Add login form\"\n"
                        "git switch main\n"
                        "git merge feature/login"
                    ),
                    "starter_code": "# Command to create and switch to a new branch 'fix/typo':\n",
                    "solution": "git switch -c fix/typo",
                    "order": 1,
                    "xp_reward": 15,
                },
                {
                    "title": "Remotes, SSH & Pull Requests",
                    "content": (
                        "<h2>Working with GitHub</h2>"
                        "<p>Add an <strong>SSH key</strong> so pushes authenticate without a password. "
                        "<code>git push</code> sends your branch to GitHub; a <strong>pull request</strong> "
                        "proposes merging it, where CI runs and teammates review.</p>"
                    ),
                    "code_example": (
                        "ssh-keygen -t ed25519 -C \"you@example.com\"\n"
                        "cat ~/.ssh/id_ed25519.pub   # paste into GitHub > Settings > SSH keys\n\n"
                        "git remote add origin git@github.com:you/repo.git\n"
                        "git push -u origin feature/login"
                    ),
                    "starter_code": "# Command that generates a modern ed25519 SSH key:\n",
                    "solution": "ssh-keygen -t ed25519 -C \"you@example.com\"",
                    "order": 2,
                    "xp_reward": 15,
                },
            ],
        },
    ],
}


async def seed_tracks():
    """Add the Backend Foundations track if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == BACKEND_TRACK["slug"])
        )
        if existing.scalars().first():
            print("Backend Foundations track already exists; nothing to do.")
            return

        language = Language(
            name=BACKEND_TRACK["name"],
            slug=BACKEND_TRACK["slug"],
            icon=BACKEND_TRACK["icon"],
            description=BACKEND_TRACK["description"],
            color=BACKEND_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in BACKEND_TRACK["modules"]:
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
                db.add(
                    Lesson(
                        module_id=module.id,
                        title=lesson_data["title"],
                        content=lesson_data["content"],
                        code_example=lesson_data["code_example"],
                        starter_code=lesson_data["starter_code"],
                        solution=lesson_data["solution"],
                        order=lesson_data["order"],
                        xp_reward=lesson_data["xp_reward"],
                    )
                )

        await db.commit()
        print("Backend Foundations track seeded successfully!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_tracks())
