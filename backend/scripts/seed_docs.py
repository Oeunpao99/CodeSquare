"""Populate the knowledge Library (doc_collections / doc_topics).

Two passes:
  1. MIRROR  — every lesson in the known language tracks becomes a read-only
     article, grouped into a collection named after its track. Rebuilt on every
     run so it always matches the current lessons.
  2. STANDALONE — hand-written reference shelves that no track covers
     (Version Control incl. GitHub Actions, Dev Workflow). Only inserted if the
     collection slug is missing, so DB edits are preserved.

Run directly for local/dev (after `alembic upgrade head`):

    python seed_docs.py
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
import asyncio
import html as _htmllib
import re

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import async_session
from models.models import (
    Language, Module, Lesson, DocCollection, DocTopic, UserDocProgress,
)
from majors import MAJOR_TRACKS
from seed_docs_infra import INFRA_SHELVES


# Track slugs to mirror, in the order their shelves should appear.
MIRROR_ORDER = [
    "python", "python-intermediate", "javascript", "html-css",
    "react-typescript", "backend-foundations", "full-stack", "linux-shell",
]

# Filter facet for the Library index. One of: python | web | backend | data | devops | cs
CATEGORY_BY_SLUG = {
    "python": "python",
    "python-intermediate": "python",
    "javascript": "web",
    "html-css": "web",
    "react-typescript": "web",
    "full-stack": "web",
    "backend-foundations": "backend",
    "linux-shell": "devops",
    "version-control": "devops",
    "dev-workflow": "devops",
}

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_P_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.S | re.I)


def strip_html(html: str) -> str:
    # Strip real tags first, THEN unescape — so literal &lt;/&gt; in prose
    # (comparison operators, etc.) survive instead of being eaten as fake tags.
    return _WS_RE.sub(" ", _htmllib.unescape(_TAG_RE.sub(" ", html or ""))).strip()


def first_paragraph(html: str) -> str:
    """Plain-text of the first <p> — a cleaner summary than the whole body,
    which usually opens with a heading that just restates the title."""
    m = _P_RE.search(html or "")
    return strip_html(m.group(1) if m else (html or ""))


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "topic"


def reading_minutes(*parts: str) -> int:
    words = sum(len(strip_html(p).split()) for p in parts)
    return max(2, round(words / 180))


def majors_for_track(slug: str) -> list[str]:
    return [m for m, tracks in MAJOR_TRACKS.items() if slug in tracks]


_TRAILING_HEADING_RE = re.compile(
    r"\s*<h[23][^>]*>\s*(?:example|code example|try it|in code)\s*:?\s*</h[23]>\s*$",
    re.I,
)


def article_body(content_html: str, code_example: str) -> str:
    body = (content_html or "").rstrip()
    # Lessons often end with a bare "Example:" heading that pointed at the
    # separate code_example field — drop it, we render our own below.
    body = _TRAILING_HEADING_RE.sub("", body)
    if code_example:
        safe = (
            code_example.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        body += (
            '<h3>Example</h3><pre class="doc-code"><code>' + safe + "</code></pre>"
        )
    return body


# --------------------------------------------------------------------------- #
#  Pass 1 — mirror lesson tracks
# --------------------------------------------------------------------------- #

async def mirror_tracks(db) -> None:
    langs = (
        await db.execute(
            select(Language).options(
                selectinload(Language.modules).selectinload(Module.lessons)
            )
        )
    ).scalars().all()
    by_slug = {l.slug: l for l in langs}

    order = 0
    for slug in MIRROR_ORDER:
        language = by_slug.get(slug)
        if not language:
            continue
        order += 10

        existing = (
            await db.execute(select(DocCollection).where(DocCollection.slug == slug))
        ).scalar_one_or_none()

        if existing:
            collection = existing
            collection.title = language.name
            collection.description = language.description or ""
            collection.icon = language.icon or "📘"
            collection.color = language.color or "#2DD4BF"
            collection.order = order
            collection.source = "mirror"
            collection.category = CATEGORY_BY_SLUG.get(slug)
            # Drop per-user reading state that points at the topics we're about to
            # rebuild (no ON DELETE CASCADE on that FK).
            old_ids = (
                await db.execute(
                    select(DocTopic.id).where(DocTopic.collection_id == collection.id)
                )
            ).scalars().all()
            if old_ids:
                await db.execute(
                    delete(UserDocProgress).where(UserDocProgress.topic_id.in_(old_ids))
                )
            await db.execute(
                delete(DocTopic).where(DocTopic.collection_id == collection.id)
            )
        else:
            collection = DocCollection(
                slug=slug,
                title=language.name,
                description=language.description or "",
                icon=language.icon or "📘",
                color=language.color or "#2DD4BF",
                order=order,
                source="mirror",
                category=CATEGORY_BY_SLUG.get(slug),
            )
            db.add(collection)
            await db.flush()

        track_majors = majors_for_track(slug)
        seen_slugs: set[str] = set()

        # A curated "what this is for / where it's used" primer, prepended so it
        # sorts first. Re-added on every run (mirror topics are wiped + rebuilt).
        primer = PRIMERS.get(slug)
        if primer:
            db.add(
                DocTopic(
                    collection_id=collection.id,
                    slug="overview",
                    title=primer["title"],
                    summary=primer["summary"],
                    body=primer["body"],
                    reading_minutes=reading_minutes(primer["body"]),
                    order=0,
                    tags=["Overview"],
                    major_slugs=track_majors,
                    related_lesson_id=None,
                    group_level=0,          # sits before Level 1 on the ladder
                    group_difficulty=None,
                )
            )
            seen_slugs.add("overview")

        modules = sorted(language.modules, key=lambda m: (m.order or 0))
        for module in modules:
            lessons = sorted(module.lessons, key=lambda x: (x.order or 0))
            for lesson in lessons:
                tslug = slugify(lesson.title)
                while tslug in seen_slugs:
                    tslug += "-x"
                seen_slugs.add(tslug)

                body = article_body(lesson.content, lesson.code_example)
                summary = first_paragraph(lesson.content) or strip_html(lesson.content)
                db.add(
                    DocTopic(
                        collection_id=collection.id,
                        slug=tslug,
                        title=lesson.title,
                        summary=summary[:200],
                        body=body,
                        reading_minutes=reading_minutes(lesson.content, lesson.code_example),
                        order=(module.order or 0) * 100 + (lesson.order or 0),
                        # tags[0] is the module title — the client groups topics by it.
                        tags=[module.title],
                        major_slugs=track_majors,
                        related_lesson_id=lesson.id,
                        group_level=module.level or module.order or 1,
                        group_difficulty=module.difficulty or "beginner",
                    )
                )
        print(f"  mirrored {slug}: {len(seen_slugs)} topics")


# --------------------------------------------------------------------------- #
#  Pass 2 — standalone reference shelves
# --------------------------------------------------------------------------- #

def _p(*paragraphs: str) -> str:
    return "".join(f"<p>{p}</p>" for p in paragraphs)


def _pre(code: str) -> str:
    safe = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<pre class="doc-code"><code>{safe}</code></pre>'


ALL_MAJORS = list(MAJOR_TRACKS.keys())


def _ul(*items: str) -> str:
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


# One "what is this language for, and where is it used today" primer per mirrored
# shelf. Prepended to the shelf as its "Overview" topic.
PRIMERS = {
    "python": {
        "title": "What Python is for",
        "summary": "A readable, batteries-included language that dominates data, AI, automation and backend scripting.",
        "body": (
            "<h2>Where Python shows up</h2>"
            + _p(
                "Python trades raw speed for readability and a huge standard library. You write "
                "less code, and there is a well-worn package for almost everything.",
                "It is the default language for <strong>data science and machine learning</strong> "
                "(pandas, NumPy, scikit-learn, PyTorch), for <strong>AI / LLM apps</strong> "
                "(the OpenAI and Anthropic SDKs, LangChain), for <strong>automation and scripting</strong> "
                "(file wrangling, scraping, glue between systems), and for <strong>web backends</strong> "
                "via FastAPI, Django and Flask.",
            )
            + "<h3>Typical projects</h3>"
            + _ul(
                "A data-cleaning + reporting script over a CSV or database",
                "A REST API with FastAPI backed by Postgres",
                "A scheduled job that calls an API and files the results",
                "A model training / evaluation notebook",
            )
            + "<h3>Reach for it when…</h3>"
            + _p(
                "…you want to move fast, the problem is data- or automation-shaped, or a mature "
                "library already solves half of it. Think twice for CPU-bound hot loops or "
                "browser front-ends — that is C/Rust and JavaScript territory."
            )
        ),
    },
    "javascript": {
        "title": "What JavaScript is for",
        "summary": "The only language browsers run — and, via Node, a first-class backend and tooling language too.",
        "body": (
            "<h2>The language of the web</h2>"
            + _p(
                "Every browser executes JavaScript, so anything interactive on a web page runs "
                "through it. With <strong>Node.js</strong> the same language runs on servers, in "
                "build tools, and in CLI utilities.",
                "Modern front ends are built with frameworks on top of it — React, Vue, Svelte, "
                "Angular — plus <strong>TypeScript</strong>, a typed layer that compiles back down "
                "to JavaScript and is now the norm on serious projects.",
            )
            + "<h3>Typical projects</h3>"
            + _ul(
                "A single-page app (React/Vue) talking to a JSON API",
                "A Node/Express or Fastify backend",
                "A serverless function (Vercel, Cloudflare Workers, AWS Lambda)",
                "Build tooling and scripts (Vite, ESLint, custom CLIs)",
            )
            + "<h3>Reach for it when…</h3>"
            + _p(
                "…the work touches a browser at all, or you want one language across the whole "
                "stack. For heavy data crunching or ML, call out to Python."
            )
        ),
    },
    "html-css": {
        "title": "What HTML & CSS are for",
        "summary": "HTML is the structure of every web page; CSS is how it looks. Not programming languages — the canvas everything else paints on.",
        "body": (
            "<h2>Structure and style</h2>"
            + _p(
                "<strong>HTML</strong> marks up content into a tree of elements — headings, "
                "paragraphs, lists, forms, links. <strong>CSS</strong> is a rule language that "
                "targets those elements and sets layout, colour, type and spacing.",
                "Everything a user sees in a browser is ultimately HTML styled by CSS, whether "
                "it was hand-written or generated by React. Knowing them well is what separates "
                "a UI that works from one that looks right and is accessible.",
            )
            + "<h3>Core skills</h3>"
            + _ul(
                "Semantic markup (use <code>&lt;nav&gt;</code>, <code>&lt;button&gt;</code>, "
                "<code>&lt;label&gt;</code> — not <code>&lt;div&gt;</code> for everything)",
                "The box model, Flexbox and Grid for layout",
                "Responsive design with relative units and media queries",
                "Basic accessibility — labels, alt text, focus states, colour contrast",
            )
            + "<h3>Reach for it when…</h3>"
            + _p("…always, for anything with a web UI. It is the substrate, not an option.")
        ),
    },
    "react-typescript": {
        "title": "When to reach for React",
        "summary": "A component library for building UI from small, reusable, state-driven pieces — the most common choice for web app front ends.",
        "body": (
            "<h2>UI as components</h2>"
            + _p(
                "React lets you describe the screen as a tree of <strong>components</strong> — "
                "functions that take data (props) and return markup. When state changes, React "
                "re-renders and updates only the parts of the DOM that actually changed.",
                "Paired with <strong>TypeScript</strong>, props and state get compile-time types, "
                "which catches a whole class of bugs before the app runs. This combo is the "
                "default for dashboards, SaaS products and anything with rich interaction.",
            )
            + "<h3>Typical projects</h3>"
            + _ul(
                "A dashboard or admin panel over a REST/GraphQL API",
                "A customer-facing SaaS front end",
                "A design-system component library",
                "A Next.js app with server-side rendering and routing",
            )
            + "<h3>Reach for it when…</h3>"
            + _p(
                "…the UI has real state and interaction. For a mostly-static marketing site, "
                "plain HTML/CSS or a static-site generator is lighter and faster."
            )
        ),
    },
    "backend-foundations": {
        "title": "What backend work is",
        "summary": "The server side: databases, APIs, auth, migrations and the deploy pipeline everything else depends on.",
        "body": (
            "<h2>The part users don't see</h2>"
            + _p(
                "A backend stores data durably, enforces the rules, and exposes it over an API "
                "the front end (or other services) call. The craft is in modelling data well, "
                "designing clear endpoints, handling auth and errors, and evolving the schema "
                "without downtime.",
                "This track covers the spine of it: <strong>SQL and relational modelling</strong>, "
                "<strong>schema migrations</strong>, building <strong>REST APIs</strong> with "
                "FastAPI, <strong>API docs and tooling</strong>, <strong>DevOps basics</strong> "
                "(Docker, CI/CD) and the <strong>Git workflow</strong>.",
            )
            + "<h3>Typical projects</h3>"
            + _ul(
                "A JSON API with authentication over Postgres",
                "A background worker processing a queue",
                "An integration that syncs two systems on a schedule",
                "A migration that adds a column and backfills it safely",
            )
            + "<h3>Reach for these skills when…</h3>"
            + _p(
                "…anything needs to persist, be shared between users, or be called by another "
                "program. If it is just a script on your laptop, you may not need all of it yet."
            )
        ),
    },
    "linux-shell": {
        "title": "Why the shell matters",
        "summary": "Servers run Linux, and the shell is how you drive them — navigate, inspect, automate, deploy.",
        "body": (
            "<h2>Your remote hands</h2>"
            + _p(
                "Almost every server, container and CI runner is Linux, and you talk to them "
                "through a <strong>shell</strong> (usually bash or zsh). Fluency here means you "
                "can inspect a running system, chase down a problem, and script the boring parts "
                "instead of clicking.",
                "The high-value skills: moving around the filesystem, <strong>pipes and "
                "redirection</strong> to chain small tools, <strong>grep / sed / awk</strong> for "
                "text, <strong>permissions and environment variables</strong>, <strong>processes "
                "and signals</strong>, <strong>ssh</strong>, and writing a readable bash script.",
            )
            + "<h3>Typical uses</h3>"
            + _ul(
                "Tailing and filtering logs on a production box",
                "A deploy or backup script run from CI or cron",
                "One-liners that transform a file or a stream",
                "Debugging why a container won't start",
            )
            + "<h3>Reach for it when…</h3>"
            + _p(
                "…you are on a server, in a Dockerfile, or writing CI. For anything longer than "
                "~50 lines or with real data structures, switch to Python."
            )
        ),
    },
}

STANDALONE = [
    {
        "slug": "version-control",
        "title": "Version Control",
        "description": "Git internals, branching, pull requests and CI with GitHub Actions.",
        "icon": "🔀",
        "color": "#F97316",
        "order": 90,
        "category": "devops",
        "topics": [
            {
                "title": "The Git model",
                "summary": "Commits are snapshots, not diffs. Branches are just movable pointers.",
                "tags": ["git", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Snapshots, not diffs</h2>"
                    + _p(
                        "Every <strong>commit</strong> stores a full snapshot of your tracked files "
                        "plus a pointer to its parent commit. Git de-duplicates unchanged files, so "
                        "snapshots stay cheap.",
                        "A <strong>branch</strong> is a 40-character file containing one commit hash. "
                        "Creating a branch writes one tiny file — that's why it's instant. "
                        "<code>HEAD</code> points at the branch you're currently on.",
                    )
                    + "<h3>The three areas</h3>"
                    + _p(
                        "The <strong>working tree</strong> is your files on disk. The "
                        "<strong>index</strong> (staging area) is what goes into the next commit. "
                        "The <strong>repository</strong> is the committed history."
                    )
                    + _pre(
                        "git status         # what changed, what's staged\n"
                        "git add file.py    # working tree -> index\n"
                        "git commit -m msg  # index -> repository"
                    )
                ),
            },
            {
                "title": "Branching & merging",
                "summary": "Branch off main, do work, merge back. Fast-forward vs merge commit.",
                "tags": ["git", "branching"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Parallel lines of work</h2>"
                    + _p(
                        "Start a feature on its own branch so <code>main</code> stays releasable.",
                        "If <code>main</code> hasn't moved since you branched, Git does a "
                        "<strong>fast-forward</strong> — it just slides the pointer. If it has moved, "
                        "Git makes a <strong>merge commit</strong> with two parents.",
                    )
                    + _pre(
                        "git switch -c feature/login\n"
                        "# ...commits...\n"
                        "git switch main\n"
                        "git merge feature/login\n"
                        "git branch -d feature/login"
                    )
                ),
            },
            {
                "title": "Rebase vs merge",
                "summary": "Merge preserves history as it happened; rebase rewrites it into a straight line.",
                "tags": ["git", "rebase", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Two ways to integrate</h2>"
                    + _p(
                        "<strong>Merge</strong> keeps every commit exactly as it happened and adds a "
                        "merge commit. History is truthful but can look tangled.",
                        "<strong>Rebase</strong> replays your branch's commits on top of the latest "
                        "<code>main</code>, giving a linear history — but it creates <em>new</em> "
                        "commits with new hashes.",
                    )
                    + "<h3>The one rule</h3>"
                    + _p(
                        "Never rebase commits you've already pushed and others may have pulled. "
                        "Rebase local work; merge shared work."
                    )
                    + _pre(
                        "git fetch origin\n"
                        "git rebase origin/main      # replay my commits on top\n"
                        "# resolve conflicts, then:\n"
                        "git rebase --continue"
                    )
                ),
            },
            {
                "title": "Pull requests",
                "summary": "Propose a branch for review; CI runs, teammates comment, then it merges.",
                "tags": ["github", "workflow"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Review before merge</h2>"
                    + _p(
                        "Push your branch, open a <strong>pull request</strong> against "
                        "<code>main</code>. The PR is a discussion plus a live diff; every new push "
                        "updates it and re-runs CI.",
                        "Keep PRs small and single-purpose — they get reviewed faster and revert "
                        "cleanly.",
                    )
                    + _pre(
                        "git push -u origin feature/login\n"
                        "gh pr create --fill        # or open it in the GitHub UI\n"
                        "gh pr checks               # watch CI"
                    )
                ),
            },
            {
                "title": "Resolving conflicts",
                "summary": "A conflict is two edits to the same lines. Git marks them; you choose.",
                "tags": ["git", "conflicts"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>When the same lines change twice</h2>"
                    + _p(
                        "Git can auto-merge different regions of a file. When two branches touch the "
                        "same lines it stops and writes conflict markers:"
                    )
                    + _pre(
                        "<<<<<<< HEAD\n"
                        "total = price * qty\n"
                        "=======\n"
                        "total = price * quantity * 1.1\n"
                        ">>>>>>> feature/tax"
                    )
                    + _p(
                        "Edit the file to the version you want, delete the markers, then "
                        "<code>git add</code> it and continue the merge or rebase.",
                        "<code>git merge --abort</code> / <code>git rebase --abort</code> backs out "
                        "entirely if you'd rather start over.",
                    )
                ),
            },
            {
                "title": "GitHub Actions (CI/CD)",
                "summary": "YAML workflows that run on push/PR: install, test, migrate, build, deploy.",
                "tags": ["ci", "github-actions", "devops"],
                "majors": ["backend-engineer", "automation", "data-science", "ai-engineer", "web-developer", "computer-science"],
                "body": (
                    "<h2>Automate the checks</h2>"
                    + _p(
                        "A <strong>workflow</strong> lives at <code>.github/workflows/*.yml</code>. "
                        "It has <strong>triggers</strong> (<code>on:</code>), one or more "
                        "<strong>jobs</strong>, and each job is a list of <strong>steps</strong> that "
                        "run on a fresh virtual machine.",
                    )
                    + _pre(
                        "name: CI\n"
                        "on:\n"
                        "  push:\n"
                        "    branches: [main]\n"
                        "  pull_request:\n"
                        "jobs:\n"
                        "  test:\n"
                        "    runs-on: ubuntu-latest\n"
                        "    steps:\n"
                        "      - uses: actions/checkout@v4\n"
                        "      - uses: actions/setup-python@v5\n"
                        "        with: { python-version: '3.12' }\n"
                        "      - run: pip install -r requirements.txt\n"
                        "      - run: pytest -q"
                    )
                    + "<h3>Deploy on green</h3>"
                    + _p(
                        "Add a second job with <code>needs: test</code> so it only runs when tests "
                        "pass. Store credentials in <strong>repository secrets</strong> and read them "
                        "as <code>${{ secrets.NAME }}</code> — never commit them."
                    )
                ),
            },
        ],
    },
    {
        "slug": "dev-workflow",
        "title": "Dev Workflow",
        "description": "Project layout, environments, Docker, deployment and debugging habits.",
        "icon": "🛠️",
        "color": "#3B82F6",
        "order": 100,
        "category": "devops",
        "topics": [
            {
                "title": "Project layout & virtual environments",
                "summary": "One isolated environment per project so dependencies never collide.",
                "tags": ["python", "setup"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Isolate every project</h2>"
                    + _p(
                        "A <strong>virtual environment</strong> is a private folder of packages for "
                        "one project. Without it, installing a library for project A can break "
                        "project B.",
                        "<code>uv</code> is a fast, modern manager: <code>uv venv</code> creates the "
                        "environment, <code>uv add</code> records a dependency in "
                        "<code>pyproject.toml</code>, and <code>uv run</code> executes inside it.",
                    )
                    + _pre(
                        "uv venv\n"
                        "uv add fastapi 'uvicorn[standard]'\n"
                        "uv run uvicorn main:app --reload"
                    )
                ),
            },
            {
                "title": "Environment variables & secrets",
                "summary": "Config that changes per machine lives in the environment, not the code.",
                "tags": ["config", "12-factor"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Keep config out of code</h2>"
                    + _p(
                        "Database URLs, API keys and feature flags differ between your laptop, CI and "
                        "production. Read them from environment variables so the same build runs "
                        "everywhere.",
                        "Locally, a <code>.env</code> file (git-ignored) holds them; "
                        "<code>python-dotenv</code> loads it. In production the platform injects them.",
                    )
                    + _pre(
                        "# .env  (never commit)\n"
                        "DATABASE_URL=postgresql+asyncpg://user:pass@localhost/app\n"
                        "OPENAI_API_KEY=sk-...\n\n"
                        "# code\n"
                        "import os\n"
                        "DB_URL = os.environ['DATABASE_URL']"
                    )
                ),
            },
            {
                "title": "Docker basics",
                "summary": "Ship the environment with the code so 'works on my machine' stops mattering.",
                "tags": ["docker", "devops"],
                "majors": ["backend-engineer", "automation", "ai-engineer", "data-science", "web-developer"],
                "body": (
                    "<h2>One image, runs anywhere</h2>"
                    + _p(
                        "A <strong>Dockerfile</strong> is a recipe that builds an <strong>image</strong> "
                        "— your app plus its exact OS packages and dependencies. A running image is a "
                        "<strong>container</strong>.",
                        "<strong>docker compose</strong> describes several containers that run together, "
                        "e.g. an API and its database.",
                    )
                    + _pre(
                        "FROM python:3.12-slim\n"
                        "WORKDIR /app\n"
                        "COPY requirements.txt .\n"
                        "RUN pip install -r requirements.txt\n"
                        "COPY . .\n"
                        'CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]'
                    )
                    + _pre("docker compose up --build -d\ndocker compose logs -f api")
                ),
            },
            {
                "title": "Reading a stack trace",
                "summary": "Start at the bottom, find the last line in your code, read the error type.",
                "tags": ["debugging"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Work from the bottom up</h2>"
                    + _p(
                        "Python prints the <strong>most recent call last</strong>. The final line is "
                        "the exception type and message — read it literally. Then scan upward for the "
                        "deepest frame that points at <em>your</em> file, not a library.",
                    )
                    + _pre(
                        "Traceback (most recent call last):\n"
                        '  File "app.py", line 42, in main\n'
                        "    total = subtotal / count\n"
                        "ZeroDivisionError: division by zero"
                    )
                    + _p(
                        "Here: <code>count</code> was 0 at <code>app.py:42</code>. Guard the divisor "
                        "or fix why <code>count</code> is empty."
                    )
                ),
            },
        ],
    },
    {
        "slug": "http-web",
        "title": "HTTP & the Web",
        "description": "How browsers and servers talk: requests, status codes, headers, HTTPS and CORS.",
        "icon": "🌐",
        "color": "#0EA5E9",
        "order": 110,
        "category": "web",
        "topics": [
            {
                "title": "The request/response cycle",
                "summary": "A client sends a request line, headers and an optional body; the server answers with a status, headers and a body.",
                "tags": ["http", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>One round trip</h2>"
                    + _p(
                        "HTTP is a text protocol. The client opens a connection and sends a "
                        "<strong>request</strong>: a method + path + version, then headers, then a "
                        "blank line, then an optional body. The server sends back a "
                        "<strong>response</strong> in the same shape with a status code instead of "
                        "a method.",
                        "It is <strong>stateless</strong> — the server remembers nothing between "
                        "requests unless you carry state yourself (a cookie, a token, a session id).",
                    )
                    + _pre(
                        "GET /users/42 HTTP/1.1\n"
                        "Host: api.example.com\n"
                        "Accept: application/json\n"
                        "\n"
                        "HTTP/1.1 200 OK\n"
                        "Content-Type: application/json\n"
                        "\n"
                        '{"id": 42, "name": "Sam"}'
                    )
                ),
            },
            {
                "title": "Methods & status codes",
                "summary": "GET reads, POST creates, PUT/PATCH update, DELETE removes. 2xx ok, 3xx redirect, 4xx your fault, 5xx server's fault.",
                "tags": ["http"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Verbs</h2>"
                    + _ul(
                        "<code>GET</code> — read, no side effects, cacheable",
                        "<code>POST</code> — create, or an action that isn't idempotent",
                        "<code>PUT</code> — replace a resource wholesale (idempotent)",
                        "<code>PATCH</code> — partial update",
                        "<code>DELETE</code> — remove (idempotent)",
                    )
                    + "<h2>Status families</h2>"
                    + _ul(
                        "<strong>2xx</strong> — 200 OK, 201 Created, 204 No Content",
                        "<strong>3xx</strong> — 301/302 redirect, 304 Not Modified",
                        "<strong>4xx</strong> — 400 bad request, 401 unauthenticated, 403 forbidden, "
                        "404 not found, 409 conflict, 422 validation, 429 too many requests",
                        "<strong>5xx</strong> — 500 unhandled, 502/503 upstream down or overloaded",
                    )
                ),
            },
            {
                "title": "Headers, cookies & sessions",
                "summary": "Headers carry metadata. A cookie is a header the browser stores and sends back. A session is server state keyed by a cookie.",
                "tags": ["http", "cookies"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Metadata on every message</h2>"
                    + _p(
                        "Common request headers: <code>Authorization</code>, <code>Content-Type</code>, "
                        "<code>Accept</code>, <code>User-Agent</code>. Common response headers: "
                        "<code>Content-Type</code>, <code>Cache-Control</code>, <code>Set-Cookie</code>, "
                        "<code>Location</code>.",
                        "<code>Set-Cookie</code> tells the browser to store a value and send it back on "
                        "every future request to that site via the <code>Cookie</code> header. A "
                        "<strong>session</strong> stores the real data server-side (in Redis, a DB) and "
                        "the cookie only holds an opaque id. Flag cookies "
                        "<code>HttpOnly</code>, <code>Secure</code> and <code>SameSite</code>.",
                    )
                ),
            },
            {
                "title": "HTTPS & TLS in one page",
                "summary": "TLS encrypts the connection and proves the server's identity with a certificate. 'S' = the whole exchange is private and tamper-evident.",
                "tags": ["https", "tls", "security"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>What the padlock means</h2>"
                    + _p(
                        "On connect, the server presents a <strong>certificate</strong> signed by a "
                        "certificate authority the browser trusts. The two sides run a handshake to "
                        "agree on keys, then everything after is <strong>encrypted</strong> and "
                        "<strong>integrity-checked</strong>.",
                        "So HTTPS gives you: nobody on the wire can read the traffic, nobody can "
                        "modify it undetected, and you're talking to the real host — not a proxy in "
                        "the middle. It does <em>not</em> say the site is trustworthy, only that the "
                        "pipe is. Get free certs from Let's Encrypt; redirect all HTTP to HTTPS.",
                    )
                ),
            },
            {
                "title": "CORS, explained",
                "summary": "Browsers block a page on origin A from reading responses from origin B unless B opts in with Access-Control-Allow-Origin.",
                "tags": ["cors", "browser"],
                "majors": ["web-developer", "backend-engineer", "computer-science", "automation", "ai-engineer", "data-science"],
                "body": (
                    "<h2>A browser rule, not a server one</h2>"
                    + _p(
                        "The <strong>same-origin policy</strong> stops JavaScript on "
                        "<code>app.example.com</code> from reading a response from "
                        "<code>api.other.com</code>. CORS is how the other server says \"this origin "
                        "is allowed\".",
                        "For anything beyond a simple GET the browser first sends a "
                        "<strong>preflight</strong> <code>OPTIONS</code> request. The API must answer "
                        "it and every real request with the right headers:",
                    )
                    + _pre(
                        "Access-Control-Allow-Origin: https://app.example.com\n"
                        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE\n"
                        "Access-Control-Allow-Headers: Authorization, Content-Type"
                    )
                    + _p(
                        "CORS errors are always fixed on the <strong>server</strong>. It is not a "
                        "bug in your fetch call."
                    )
                ),
            },
            {
                "title": "REST vs GraphQL vs RPC",
                "summary": "REST models resources with URLs + verbs. GraphQL exposes one endpoint and lets the client shape the response. RPC calls named functions.",
                "tags": ["api", "architecture"],
                "majors": ["backend-engineer", "web-developer", "computer-science", "ai-engineer", "data-science", "automation"],
                "body": (
                    "<h2>Three styles</h2>"
                    + _p(
                        "<strong>REST</strong> — nouns as URLs (<code>/users/42/orders</code>), HTTP "
                        "verbs for actions, HTTP status codes for outcomes. Simple, cacheable, "
                        "everywhere. Can mean many round trips or over-fetching.",
                        "<strong>GraphQL</strong> — a single endpoint; the client sends a query "
                        "describing exactly the fields it wants and gets that shape back. Great for "
                        "rich UIs; caching and rate-limiting are harder.",
                        "<strong>RPC</strong> (gRPC, JSON-RPC) — you call <code>CreateUser(...)</code> "
                        "as if it were a local function. Fast and strongly typed (gRPC uses "
                        "protobuf); less friendly to browsers and curl.",
                    )
                ),
            },
        ],
    },
    {
        "slug": "sql-databases",
        "title": "SQL & Databases",
        "description": "Relational modelling, JOINs, indexes, transactions and the query traps that bite in production.",
        "icon": "🗄️",
        "color": "#4169E1",
        "order": 120,
        "category": "data",
        "topics": [
            {
                "title": "The relational model & keys",
                "summary": "Data lives in tables of typed columns. A primary key identifies a row; a foreign key references another table's key.",
                "tags": ["sql", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Tables, rows, keys</h2>"
                    + _p(
                        "Each table models one kind of thing. Every row needs a "
                        "<strong>primary key</strong> — usually an auto-incrementing <code>id</code> "
                        "or a UUID — that is unique and never changes.",
                        "A <strong>foreign key</strong> is a column holding another table's primary "
                        "key, which is how rows relate. The database can enforce that the referenced "
                        "row exists (referential integrity).",
                    )
                    + _pre(
                        "CREATE TABLE authors (\n"
                        "    id    SERIAL PRIMARY KEY,\n"
                        "    name  TEXT NOT NULL\n"
                        ");\n"
                        "CREATE TABLE posts (\n"
                        "    id         SERIAL PRIMARY KEY,\n"
                        "    author_id  INTEGER NOT NULL REFERENCES authors(id),\n"
                        "    title      TEXT NOT NULL,\n"
                        "    created_at TIMESTAMPTZ DEFAULT now()\n"
                        ");"
                    )
                ),
            },
            {
                "title": "JOINs in depth",
                "summary": "INNER keeps only matching rows; LEFT keeps every row from the left side, NULLs where there's no match.",
                "tags": ["sql", "joins"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Combining tables</h2>"
                    + _p(
                        "A JOIN matches rows from two tables on a condition — almost always a "
                        "foreign key equalling a primary key.",
                    )
                    + _ul(
                        "<strong>INNER JOIN</strong> — only rows that match on both sides",
                        "<strong>LEFT JOIN</strong> — all left rows; right columns are NULL when "
                        "there is no match (use this to find \"rows with none\")",
                        "<strong>RIGHT / FULL</strong> — the mirror image, and both sides; rarer",
                    )
                    + _pre(
                        "SELECT a.name, count(p.id) AS post_count\n"
                        "FROM authors a\n"
                        "LEFT JOIN posts p ON p.author_id = a.id\n"
                        "GROUP BY a.name\n"
                        "ORDER BY post_count DESC;"
                    )
                ),
            },
            {
                "title": "Indexes & how the planner uses them",
                "summary": "An index is a sorted lookup structure. It turns a full-table scan into a seek — at the cost of slower writes and disk.",
                "tags": ["sql", "performance"],
                "majors": ["backend-engineer", "data-science", "ai-engineer", "computer-science", "automation", "web-developer"],
                "body": (
                    "<h2>The trade</h2>"
                    + _p(
                        "Without an index, <code>WHERE email = ?</code> reads every row. With one, "
                        "the database jumps straight to the match. Index the columns you filter, "
                        "join and sort on — especially foreign keys.",
                        "Costs: every <code>INSERT</code>/<code>UPDATE</code> must also update the "
                        "index, and indexes take space. Don't index everything.",
                    )
                    + "<h3>See what it's doing</h3>"
                    + _p(
                        "<code>EXPLAIN ANALYZE &lt;query&gt;</code> shows the plan. "
                        "<code>Seq Scan</code> on a big table in a hot query is a red flag; "
                        "<code>Index Scan</code> is what you want."
                    )
                ),
            },
            {
                "title": "Transactions & ACID",
                "summary": "A transaction groups statements so they all commit or all roll back. ACID = atomic, consistent, isolated, durable.",
                "tags": ["sql", "transactions"],
                "majors": ["backend-engineer", "data-science", "ai-engineer", "computer-science", "automation"],
                "body": (
                    "<h2>All or nothing</h2>"
                    + _p(
                        "Wrap related writes in <code>BEGIN ... COMMIT</code>. If anything fails, "
                        "<code>ROLLBACK</code> and the database is as if none of it happened — no "
                        "half-moved money, no orphaned rows.",
                        "<strong>Isolation</strong> controls what concurrent transactions see of each "
                        "other. The default (Read Committed) is fine for most apps; bump to "
                        "Serializable for money-movement style logic and retry on conflict.",
                    )
                    + _pre(
                        "BEGIN;\n"
                        "UPDATE accounts SET balance = balance - 100 WHERE id = 1;\n"
                        "UPDATE accounts SET balance = balance + 100 WHERE id = 2;\n"
                        "COMMIT;"
                    )
                ),
            },
            {
                "title": "Normalization (and when to break it)",
                "summary": "Store each fact once so it can't disagree with itself. Denormalize deliberately, for read speed, with a plan to keep copies in sync.",
                "tags": ["sql", "modelling"],
                "majors": ["backend-engineer", "data-science", "ai-engineer", "computer-science"],
                "body": (
                    "<h2>One fact, one place</h2>"
                    + _p(
                        "Normalized design puts each piece of data in exactly one column of one "
                        "row. A customer's address lives in <code>customers</code>, not copied onto "
                        "every <code>orders</code> row — so it can't be right in one place and stale "
                        "in another.",
                        "<strong>Denormalization</strong> — deliberately duplicating data — is a "
                        "valid optimisation when reads vastly outnumber writes and JOINs are too "
                        "slow. But now you own keeping the copies consistent (triggers, app logic, "
                        "a nightly job). Do it on purpose, not by accident.",
                    )
                ),
            },
            {
                "title": "The N+1 query problem",
                "summary": "Fetching a list, then one query per item to load its relation. 1 + N queries where 2 would do. The most common ORM performance bug.",
                "tags": ["sql", "orm", "performance"],
                "majors": ["backend-engineer", "web-developer", "data-science", "ai-engineer", "automation", "computer-science"],
                "body": (
                    "<h2>Death by a thousand queries</h2>"
                    + _p(
                        "You load 50 posts, then your template accesses <code>post.author.name</code> "
                        "on each — and the ORM lazily fires 50 more queries. 51 round trips to render "
                        "one page.",
                        "Fix it by telling the ORM to load the relation up front — "
                        "<code>selectinload</code> / <code>joinedload</code> in SQLAlchemy, "
                        "<code>select_related</code> / <code>prefetch_related</code> in Django, "
                        "<code>.includes</code> in Rails. Two queries total.",
                    )
                    + _pre(
                        "# bad: 1 + N\n"
                        "posts = session.query(Post).all()\n"
                        "for p in posts:\n"
                        "    print(p.author.name)   # a query each time\n\n"
                        "# good: 2 queries\n"
                        "posts = session.query(Post).options(selectinload(Post.author)).all()"
                    )
                ),
            },
        ],
    },
    {
        "slug": "api-design",
        "title": "API Design",
        "description": "Designing HTTP APIs others enjoy using: resources, errors, auth, pagination, rate limits and webhooks.",
        "icon": "🔌",
        "color": "#14B8A6",
        "order": 130,
        "category": "backend",
        "topics": [
            {
                "title": "Modelling resources & URLs",
                "summary": "Nouns, not verbs. /orders/42/items, not /getOrderItems?id=42. Let HTTP methods be the verbs.",
                "tags": ["api", "rest"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "computer-science", "data-science"],
                "body": (
                    "<h2>URLs name things</h2>"
                    + _ul(
                        "<code>GET /orders</code> — list, <code>POST /orders</code> — create",
                        "<code>GET /orders/42</code> — one, <code>PATCH /orders/42</code> — update, "
                        "<code>DELETE /orders/42</code> — remove",
                        "<code>GET /orders/42/items</code> — a sub-collection",
                    )
                    + _p(
                        "Keep it flat — nest one level, not four. Use plural nouns consistently. "
                        "Put filters and paging in the query string, not the path: "
                        "<code>GET /orders?status=open&amp;limit=20</code>.",
                    )
                ),
            },
            {
                "title": "Status codes & error bodies",
                "summary": "Return the honest status code and a machine-readable error body with a stable code, a message and (for 422) the offending fields.",
                "tags": ["api", "errors"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "computer-science", "data-science"],
                "body": (
                    "<h2>Fail informatively</h2>"
                    + _p(
                        "<code>200</code> for a body, <code>201</code> + <code>Location</code> after "
                        "create, <code>204</code> for a successful delete. <code>400</code> malformed, "
                        "<code>401</code> not logged in, <code>403</code> logged in but not allowed, "
                        "<code>404</code> not there, <code>409</code> conflict, <code>422</code> "
                        "validation failed.",
                    )
                    + _pre(
                        "HTTP/1.1 422 Unprocessable Entity\n"
                        "\n"
                        "{\n"
                        '  "error": "validation_failed",\n'
                        '  "message": "email is required",\n'
                        '  "fields": { "email": "required" }\n'
                        "}"
                    )
                    + _p("Never return <code>200</code> with <code>{\"error\": ...}</code> inside.")
                ),
            },
            {
                "title": "Authentication: keys, JWT, OAuth",
                "summary": "API keys for server-to-server. JWTs for stateless user sessions. OAuth when a third party acts on a user's behalf.",
                "tags": ["api", "auth", "security"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "computer-science"],
                "body": (
                    "<h2>Pick the right one</h2>"
                    + _ul(
                        "<strong>API key</strong> — a long secret string in a header. Fine for your "
                        "own services and CLIs. Rotate them; scope them.",
                        "<strong>JWT</strong> — a signed token holding claims (user id, expiry). The "
                        "server verifies the signature without a DB lookup. Keep them short-lived; "
                        "pair with a refresh token. You can't revoke one before it expires without "
                        "a blocklist.",
                        "<strong>OAuth 2.0</strong> — the \"Log in with Google\" flow: the user "
                        "authorises your app, you get a token to call their data. Don't hand-roll "
                        "it; use a library.",
                    )
                    + _p("Always over HTTPS. Never put a token in a URL — it lands in logs.")
                ),
            },
            {
                "title": "Pagination, filtering & sorting",
                "summary": "Never return an unbounded list. Cursor pagination beats offset for large or changing data.",
                "tags": ["api", "pagination"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "data-science", "computer-science"],
                "body": (
                    "<h2>Bound every collection</h2>"
                    + _p(
                        "<strong>Offset</strong> paging (<code>?limit=20&amp;offset=40</code>) is "
                        "simple but slow deep in a table and skips/repeats rows when data changes "
                        "under you.",
                        "<strong>Cursor</strong> paging returns an opaque <code>next_cursor</code> "
                        "pointing at the last row seen; the next call passes it back. Stable and "
                        "fast at any depth.",
                    )
                    + _pre(
                        'GET /orders?limit=20&status=open&sort=-created_at\n'
                        "\n"
                        "{\n"
                        '  "data": [ ... ],\n'
                        '  "next_cursor": "eyJpZCI6MTQ0fQ"\n'
                        "}"
                    )
                ),
            },
            {
                "title": "Rate limiting & idempotency",
                "summary": "Cap requests per client and say so in headers. Let clients retry unsafe calls safely with an Idempotency-Key.",
                "tags": ["api", "reliability"],
                "majors": ["backend-engineer", "ai-engineer", "automation", "computer-science", "web-developer"],
                "body": (
                    "<h2>Protect the service, help the client</h2>"
                    + _p(
                        "Limit by API key or IP. On the limit, return <code>429</code> with "
                        "<code>Retry-After</code>; on every response include "
                        "<code>X-RateLimit-Remaining</code> so good clients self-throttle.",
                        "Networks drop responses, so clients retry. If they retry "
                        "<code>POST /charges</code> you must not charge twice. Accept an "
                        "<code>Idempotency-Key</code> header, store the first result against it, and "
                        "return that same result for any repeat within a window.",
                    )
                ),
            },
            {
                "title": "Webhooks",
                "summary": "Instead of the client polling you, you POST an event to a URL they registered. Sign the payload; expect retries.",
                "tags": ["api", "events"],
                "majors": ["backend-engineer", "automation", "ai-engineer", "web-developer", "computer-science"],
                "body": (
                    "<h2>Push, don't poll</h2>"
                    + _p(
                        "The consumer gives you a URL. When something happens (<code>payment.succeeded</code>) "
                        "you <code>POST</code> a JSON event there. Sign it with an HMAC of the body so "
                        "the receiver can verify it's really you.",
                        "Assume delivery fails sometimes: retry with backoff, treat a "
                        "<code>2xx</code> as success, and give consumers an event id so they can "
                        "dedupe. On the receiving end, respond fast and do the work in a queue.",
                    )
                ),
            },
        ],
    },
    {
        "slug": "security",
        "title": "Security Essentials",
        "description": "The vulnerabilities every developer should be able to name, spot and prevent.",
        "icon": "🛡️",
        "color": "#EF4444",
        "order": 140,
        "category": "backend",
        "topics": [
            {
                "title": "The OWASP Top 10 at a glance",
                "summary": "A widely-used list of the most impactful web app risks — broken access control, injection, misconfiguration and friends.",
                "tags": ["security", "owasp"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Know the categories</h2>"
                    + _ul(
                        "<strong>Broken access control</strong> — users reaching data/actions that "
                        "aren't theirs (the #1 issue)",
                        "<strong>Cryptographic failures</strong> — secrets in plaintext, weak hashing, no TLS",
                        "<strong>Injection</strong> — SQL, command, template",
                        "<strong>Insecure design</strong> — the flaw is in the plan, not the code",
                        "<strong>Security misconfiguration</strong> — debug on in prod, default creds, open buckets",
                        "<strong>Vulnerable dependencies</strong> — an old library with a known CVE",
                        "<strong>Auth failures</strong> — no rate limiting on login, weak session handling",
                        "<strong>SSRF</strong> — making the server fetch a URL an attacker chose",
                    )
                    + _p("You don't need them memorised — you need to recognise them in review.")
                ),
            },
            {
                "title": "Injection: SQL, command, template",
                "summary": "Any time untrusted input is concatenated into a query, a shell command or a template, it can change the meaning. Use parameters, never string-building.",
                "tags": ["security", "injection"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Data must stay data</h2>"
                    + _pre(
                        "# vulnerable — the input becomes SQL\n"
                        'cur.execute(f"SELECT * FROM users WHERE name = \'{name}\'")\n'
                        "#   name = \"' OR '1'='1\"  -> returns every user\n\n"
                        "# safe — the driver sends value and query separately\n"
                        'cur.execute("SELECT * FROM users WHERE name = %s", (name,))'
                    )
                    + _p(
                        "Same rule for shells (<code>subprocess.run([...])</code> with a list, never "
                        "<code>shell=True</code> on a built string) and for HTML templates (let the "
                        "engine escape; never mark user input as \"safe\").",
                    )
                ),
            },
            {
                "title": "XSS and CSRF",
                "summary": "XSS runs attacker JavaScript in your users' browsers. CSRF makes a logged-in user's browser send a request they didn't intend.",
                "tags": ["security", "browser"],
                "majors": ["web-developer", "backend-engineer", "computer-science", "ai-engineer", "automation", "data-science"],
                "body": (
                    "<h2>Two different attacks</h2>"
                    + _p(
                        "<strong>XSS</strong> — you render user content without escaping, it contains "
                        "<code>&lt;script&gt;</code>, and it runs with your site's privileges (reads "
                        "cookies, makes requests as the user). Defence: escape on output (frameworks "
                        "do this by default), set a Content-Security-Policy, mark cookies "
                        "<code>HttpOnly</code>.",
                        "<strong>CSRF</strong> — a malicious page auto-submits a form to your site; "
                        "the browser attaches the victim's session cookie. Defence: "
                        "<code>SameSite=Lax/Strict</code> cookies plus a per-request CSRF token on "
                        "state-changing forms. Token-in-header APIs are largely immune.",
                    )
                ),
            },
            {
                "title": "Storing passwords: hash, don't encrypt",
                "summary": "Encryption is reversible — a leaked key exposes everything. Use a slow one-way hash built for passwords: bcrypt, scrypt or argon2, with a per-user salt.",
                "tags": ["security", "passwords"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>One-way, on purpose</h2>"
                    + _p(
                        "Never store a password, and never encrypt it (you'd hold a key that "
                        "reverses all of them). Store <code>hash(password + salt)</code> with a "
                        "deliberately slow algorithm so brute force is expensive.",
                        "Use a library: <code>bcrypt</code>, <code>argon2</code>. It handles the "
                        "salt and stores the cost factor in the hash string. To check a login you "
                        "hash the attempt and compare. Add rate limiting and, ideally, a second "
                        "factor.",
                    )
                    + _pre(
                        "from argon2 import PasswordHasher\n"
                        "ph = PasswordHasher()\n"
                        "stored = ph.hash(password)          # at signup\n"
                        "ph.verify(stored, attempt)          # at login (raises on mismatch)"
                    )
                ),
            },
            {
                "title": "Secrets & configuration",
                "summary": "API keys and DB passwords belong in the environment or a secret manager — never in the repo, never in the image, never in logs.",
                "tags": ["security", "config"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Keep secrets out of code</h2>"
                    + _ul(
                        "Read them from environment variables; locally from a git-ignored "
                        "<code>.env</code>",
                        "In production use the platform's secret store (Vault, AWS/GCP Secrets "
                        "Manager, GitHub Actions secrets)",
                        "If one leaks, <strong>rotate it</strong> — deleting the commit is not "
                        "enough, git history and forks keep it",
                        "Scrub secrets from log lines and error reports",
                    )
                ),
            },
            {
                "title": "Least privilege & defense in depth",
                "summary": "Give each user, token and service the minimum access it needs. Assume any one layer will fail and add another behind it.",
                "tags": ["security", "principles"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Two habits that prevent most breaches</h2>"
                    + _p(
                        "<strong>Least privilege</strong>: the app's DB user can read/write its "
                        "tables and nothing else — not <code>DROP</code>, not other databases. An "
                        "API token scoped to <code>read:orders</code> can't touch users. A support "
                        "admin can't change billing.",
                        "<strong>Defense in depth</strong>: validate input <em>and</em> use "
                        "parameterised queries <em>and</em> constrain the DB user. If input "
                        "validation has a hole, the next layer still holds.",
                    )
                ),
            },
        ],
    },
    {
        "slug": "testing",
        "title": "Testing",
        "description": "What to test, at which level, and how to keep the suite fast and trustworthy.",
        "icon": "✅",
        "color": "#22C55E",
        "order": 150,
        "category": "backend",
        "topics": [
            {
                "title": "The testing pyramid",
                "summary": "Many fast unit tests, fewer integration tests, a handful of slow end-to-end tests. Push detail down to the cheap layer.",
                "tags": ["testing"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Shape of a healthy suite</h2>"
                    + _p(
                        "<strong>Unit</strong> tests hit one function/class with no I/O — "
                        "milliseconds each, run thousands. <strong>Integration</strong> tests wire "
                        "a few real pieces together (code + a test database). <strong>End-to-end</strong> "
                        "drives the whole system like a user — slow and flaky-prone, so keep them to "
                        "a few critical journeys.",
                        "Anti-pattern: the <em>ice-cream cone</em> — mostly slow E2E tests, few "
                        "units. It's slow, brittle, and tells you <em>something</em> broke without "
                        "saying what.",
                    )
                ),
            },
            {
                "title": "Unit tests & TDD",
                "summary": "Arrange, act, assert. Test behaviour and edges, not implementation. TDD: write the failing test first, make it pass, refactor.",
                "tags": ["testing", "tdd"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>One behaviour per test</h2>"
                    + _pre(
                        "def test_discount_caps_at_order_total():\n"
                        "    order = Order(total=50)\n"
                        "    apply_discount(order, amount=80)   # act\n"
                        "    assert order.total == 0            # assert\n"
                    )
                    + _p(
                        "Name the test after the rule it checks. Cover the happy path plus the "
                        "edges: empty, zero, negative, huge, missing.",
                        "<strong>TDD</strong> is a loop: red (write a test that fails) → green "
                        "(simplest code that passes) → refactor (clean up, tests stay green). It "
                        "keeps design honest and coverage automatic.",
                    )
                ),
            },
            {
                "title": "Test doubles: mocks, stubs, fakes",
                "summary": "Replace a real dependency with a stand-in. Stub returns canned data; mock also asserts it was called; fake is a lightweight working version.",
                "tags": ["testing", "mocking"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "computer-science", "data-science"],
                "body": (
                    "<h2>Isolate the unit</h2>"
                    + _ul(
                        "<strong>Stub</strong> — \"when asked, return this\". No assertions.",
                        "<strong>Mock</strong> — a stub that also verifies interactions: \"send_email "
                        "was called once with this address\".",
                        "<strong>Fake</strong> — a real implementation that's just simpler: an "
                        "in-memory repository instead of Postgres.",
                    )
                    + _p(
                        "Mock at the boundary (the HTTP client, the clock, the payment gateway), "
                        "not your own internals — over-mocking gives you tests that pass while the "
                        "app is broken.",
                    )
                ),
            },
            {
                "title": "Fixtures & factories",
                "summary": "Fixtures set up and tear down shared state. Factories build valid test objects with sensible defaults you override per test.",
                "tags": ["testing", "pytest"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "data-science", "computer-science"],
                "body": (
                    "<h2>Cheap, isolated setup</h2>"
                    + _pre(
                        "@pytest.fixture\n"
                        "def db():\n"
                        "    conn = connect(TEST_URL)\n"
                        "    conn.begin()\n"
                        "    yield conn\n"
                        "    conn.rollback()      # each test starts clean\n"
                    )
                    + _p(
                        "A <strong>factory</strong> (factory_boy, model-bakery) creates a valid "
                        "<code>User</code> or <code>Order</code> in one call, so a test only states "
                        "the field it actually cares about: "
                        "<code>UserFactory(role='admin')</code>.",
                    )
                ),
            },
            {
                "title": "Integration & end-to-end tests",
                "summary": "Integration tests run real components together against a disposable database. E2E tests drive the deployed app through its real interface.",
                "tags": ["testing", "e2e"],
                "majors": ["backend-engineer", "web-developer", "ai-engineer", "automation", "computer-science"],
                "body": (
                    "<h2>Do the parts fit?</h2>"
                    + _p(
                        "Unit tests can all pass while the wiring is wrong. Integration tests catch "
                        "that: spin up a throwaway Postgres (Docker, or SQLite for speed), run "
                        "migrations, exercise a request end to end through your real router and DB "
                        "layer.",
                        "<strong>E2E</strong> tools (Playwright, Cypress) click through the real UI "
                        "in a browser. Priceless for a few golden paths — sign up, check out — but "
                        "slow and sensitive to timing, so don't test every edge here.",
                    )
                ),
            },
            {
                "title": "Coverage, flakiness & CI gates",
                "summary": "Coverage shows untested lines, not test quality. A flaky test is worse than no test. CI should block merges on red.",
                "tags": ["testing", "ci"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Signals, not targets</h2>"
                    + _p(
                        "<strong>Coverage</strong> is a flashlight for gaps — \"this error branch "
                        "is never hit\" — not a goal to chase to 100%. High coverage with weak "
                        "assertions proves nothing.",
                        "A <strong>flaky</strong> test (passes/fails without code changes) trains "
                        "the team to ignore red. Quarantine and fix it — usually a timing "
                        "assumption, shared state, or real time/order dependence.",
                        "<strong>CI</strong> runs the suite on every push and <em>blocks the merge</em> "
                        "if it's red. That's what makes the tests matter.",
                    )
                ),
            },
        ],
    },
    {
        "slug": "dsa",
        "title": "Data Structures & Algorithms",
        "description": "The core CS toolkit: complexity, the everyday structures, traversal and sorting — enough to reason about performance and pass interviews.",
        "icon": "🧮",
        "color": "#8B5CF6",
        "order": 160,
        "category": "cs",
        "topics": [
            {
                "title": "Big-O in practice",
                "summary": "How run time grows with input size. O(1) constant, O(log n) halving, O(n) linear, O(n log n) good sorts, O(n²) nested loops — avoid at scale.",
                "tags": ["cs", "complexity"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Growth, not stopwatch</h2>"
                    + _ul(
                        "<strong>O(1)</strong> — dict/array lookup by key or index",
                        "<strong>O(log n)</strong> — binary search, balanced-tree ops",
                        "<strong>O(n)</strong> — one pass over the data",
                        "<strong>O(n log n)</strong> — merge/quick/heap sort; the practical floor for "
                        "comparison sorting",
                        "<strong>O(n²)</strong> — a loop inside a loop over the same data; fine for "
                        "n=100, fatal for n=1,000,000",
                    )
                    + _p(
                        "Also watch <strong>space</strong> complexity, and that the worst case can "
                        "differ from the average (quicksort is O(n log n) average, O(n²) worst)."
                    )
                ),
            },
            {
                "title": "Arrays vs linked lists",
                "summary": "Arrays: O(1) index, contiguous memory, slow middle inserts. Linked lists: O(1) insert if you hold the node, no random access.",
                "tags": ["cs", "structures"],
                "majors": ["computer-science", "backend-engineer", "ai-engineer", "data-science", "automation", "web-developer"],
                "body": (
                    "<h2>Different trade-offs</h2>"
                    + _p(
                        "A dynamic <strong>array</strong> (Python <code>list</code>, JS "
                        "<code>Array</code>) stores elements back-to-back: instant index access and "
                        "cache-friendly iteration, but inserting in the middle shifts everything "
                        "after it — O(n).",
                        "A <strong>linked list</strong> chains nodes by pointer: splicing a node in "
                        "or out is O(1) <em>if you already have it</em>, but reaching the k-th "
                        "element means walking k pointers, and the scattered memory is slow to scan.",
                    )
                    + _p("Default to an array. Reach for a list when you insert/remove at the ends a lot — or just use a deque.")
                ),
            },
            {
                "title": "Hash maps",
                "summary": "Key → value in O(1) average. The workhorse structure: dedupe, count, group, cache, index. Backed by a hash function and buckets.",
                "tags": ["cs", "structures"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>The one you'll use most</h2>"
                    + _p(
                        "A hash map turns a key into a bucket index via a hash function, so lookup, "
                        "insert and delete are O(1) on average (O(n) in a pathological collision "
                        "case). Python <code>dict</code>, JS <code>Map</code>/object, Java "
                        "<code>HashMap</code>.",
                        "It converts many O(n²) scans into O(n): \"have I seen this before?\", "
                        "\"count per category\", \"join these two lists on id\". Keys must be "
                        "hashable and immutable.",
                    )
                    + _pre(
                        "# two-sum in O(n) with a hash map\n"
                        "seen = {}\n"
                        "for i, x in enumerate(nums):\n"
                        "    if target - x in seen:\n"
                        "        return (seen[target - x], i)\n"
                        "    seen[x] = i"
                    )
                ),
            },
            {
                "title": "Stacks & queues",
                "summary": "Stack = last in, first out (undo, call stack, DFS). Queue = first in, first out (job queues, BFS). Both O(1) at their ends.",
                "tags": ["cs", "structures"],
                "majors": ["computer-science", "backend-engineer", "ai-engineer", "automation", "data-science"],
                "body": (
                    "<h2>Order of removal</h2>"
                    + _p(
                        "A <strong>stack</strong> pushes and pops the same end. It's how function "
                        "calls nest, how undo works, and how you walk a tree depth-first without "
                        "recursion.",
                        "A <strong>queue</strong> adds at the back and removes from the front — task "
                        "queues, request buffers, breadth-first search. In Python use "
                        "<code>collections.deque</code> (a list's <code>pop(0)</code> is O(n)).",
                    )
                ),
            },
            {
                "title": "Trees & traversal",
                "summary": "Nodes with children. Binary search trees keep data sorted for O(log n) ops; tries index strings; heaps give you the min/max fast.",
                "tags": ["cs", "structures"],
                "majors": ["computer-science", "backend-engineer", "ai-engineer", "data-science"],
                "body": (
                    "<h2>Hierarchies</h2>"
                    + _p(
                        "Trees model anything nested: the DOM, a filesystem, a decision process. "
                        "A <strong>binary search tree</strong> keeps left &lt; node &lt; right so "
                        "search/insert/delete are O(log n) <em>when balanced</em> (unbalanced "
                        "degrades to O(n) — real libraries self-balance).",
                        "Traversal orders: <strong>DFS</strong> (pre/in/post-order, via a stack or "
                        "recursion) goes deep first; <strong>BFS</strong> (via a queue) sweeps level "
                        "by level and finds the shortest path in an unweighted graph.",
                    )
                    + _pre(
                        "def inorder(node):\n"
                        "    if not node: return\n"
                        "    inorder(node.left)\n"
                        "    visit(node.value)\n"
                        "    inorder(node.right)"
                    )
                ),
            },
            {
                "title": "Sorting & searching",
                "summary": "Use the built-in sort (Timsort / introsort, O(n log n)). Binary search finds an item in a sorted list in O(log n).",
                "tags": ["cs", "algorithms"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Don't hand-roll the sort</h2>"
                    + _p(
                        "Language sorts are hybrid, battle-tested and O(n log n). Know the classics "
                        "conceptually — merge sort (divide, sort halves, merge), quicksort "
                        "(partition around a pivot) — but call <code>sorted()</code> in real code.",
                        "<strong>Binary search</strong> needs a sorted sequence: check the middle, "
                        "throw away the half that can't contain the target, repeat. O(log n). It "
                        "also finds insertion points and boundaries (<code>bisect</code>).",
                    )
                ),
            },
            {
                "title": "Recursion",
                "summary": "A function that calls itself on a smaller input, with a base case that stops it. Natural for trees, divide-and-conquer and backtracking.",
                "tags": ["cs", "technique"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Smaller and smaller</h2>"
                    + _p(
                        "Every recursion needs a <strong>base case</strong> (the smallest input, "
                        "answered directly) and a <strong>recursive case</strong> that moves toward "
                        "it. Miss the base case and you get infinite recursion / a stack overflow.",
                        "It shines on self-similar structure — walking a tree, "
                        "<code>quicksort</code>, generating permutations. Deep linear recursion can "
                        "blow the stack; rewrite as a loop or add memoisation when subproblems "
                        "repeat (turning exponential into linear).",
                    )
                    + _pre(
                        "def fib(n, memo={}):\n"
                        "    if n < 2: return n            # base case\n"
                        "    if n not in memo:\n"
                        "        memo[n] = fib(n-1) + fib(n-2)\n"
                        "    return memo[n]"
                    )
                ),
            },
        ],
    },

    # ---------------------------------------------------------------- Go ------
    {
        "slug": "go",
        "title": "Go",
        "description": "A small, fast, statically-typed language built for servers, CLIs and concurrency.",
        "icon": "🐹",
        "color": "#00ADD8",
        "order": 170,
        "category": "backend",
        "topics": [
            {
                "title": "Why Go",
                "summary": "One binary, a tiny language spec, fast compiles, and concurrency baked in.",
                "tags": ["go", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>What it optimises for</h2>"
                    + _p(
                        "Go was designed at Google for large teams building network services. The "
                        "language is deliberately <strong>small</strong> — you can hold the whole spec "
                        "in your head — and the toolchain compiles a project to a <strong>single "
                        "static binary</strong> with no runtime to install.",
                        "It ships a garbage collector, a strong standard library (HTTP server, JSON, "
                        "crypto, testing), and first-class concurrency via <code>goroutines</code> and "
                        "<code>channels</code>.",
                    )
                    + "<h3>Reach for it when…</h3>"
                    + _ul(
                        "You need a fast HTTP or gRPC service with predictable memory use",
                        "You're writing a CLI you want to hand someone as one file",
                        "You want cheap concurrency without callback soup",
                        "Cloud-native tooling — Docker, Kubernetes, Terraform are all Go",
                    )
                    + _pre(
                        "package main\n\n"
                        'import "fmt"\n\n'
                        "func main() {\n"
                        '    fmt.Println("hello")\n'
                        "}\n\n"
                        "# build one binary, run anywhere with the same OS/arch\n"
                        "go build -o app ."
                    )
                ),
            },
            {
                "title": "Structs, methods and interfaces",
                "summary": "No classes. Interfaces are satisfied implicitly — if it has the methods, it fits.",
                "tags": ["go", "types"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Composition over inheritance</h2>"
                    + _p(
                        "A <strong>struct</strong> groups fields. You attach behaviour with methods "
                        "that have a <em>receiver</em>. There is no inheritance — you <strong>embed</strong> "
                        "one struct in another to reuse its fields and methods.",
                        "An <strong>interface</strong> lists method signatures. A type satisfies it "
                        "automatically the moment it has those methods — no <code>implements</code> "
                        "keyword. Accept interfaces, return concrete structs.",
                    )
                    + _pre(
                        "type Stringer interface{ String() string }\n\n"
                        "type User struct{ Name string }\n\n"
                        "func (u User) String() string { return \"user:\" + u.Name }\n\n"
                        "func print(s Stringer) { fmt.Println(s.String()) }\n"
                        "print(User{Name: \"ada\"})   // works — User has String()"
                    )
                ),
            },
            {
                "title": "Goroutines and channels",
                "summary": "Start work with `go f()`. Coordinate with channels instead of shared locks.",
                "tags": ["go", "concurrency", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Cheap concurrent work</h2>"
                    + _p(
                        "<code>go someFunc()</code> runs a function on a <strong>goroutine</strong> — a "
                        "lightweight thread the Go runtime multiplexes onto OS threads. Thousands are "
                        "normal.",
                        "A <strong>channel</strong> is a typed pipe. Sending and receiving block until "
                        "the other side is ready, which is how goroutines synchronise. The mantra: "
                        "<em>don't communicate by sharing memory; share memory by communicating.</em>",
                    )
                    + _pre(
                        "results := make(chan int)\n"
                        "for _, url := range urls {\n"
                        "    go func(u string) { results <- fetchLen(u) }(url)\n"
                        "}\n"
                        "total := 0\n"
                        "for range urls { total += <-results }   // collect all\n"
                    )
                    + "<h3>Watch out for</h3>"
                    + _p(
                        "A goroutine that blocks forever on a channel is a leak. Use "
                        "<code>context.Context</code> for cancellation and <code>select</code> with a "
                        "timeout case."
                    )
                ),
            },
            {
                "title": "Errors, modules and testing",
                "summary": "Errors are values you return and check. `go test` and modules are built in.",
                "tags": ["go", "tooling", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Errors as values</h2>"
                    + _p(
                        "Go has no exceptions for ordinary failures. A function returns "
                        "<code>(result, error)</code> and the caller checks <code>if err != nil</code>. "
                        "Wrap context with <code>fmt.Errorf(\"loading config: %w\", err)</code> and "
                        "unwrap with <code>errors.Is</code> / <code>errors.As</code>.",
                    )
                    + "<h3>Modules and tests</h3>"
                    + _p(
                        "<code>go mod init example.com/app</code> creates a module; imports are fetched "
                        "and pinned in <code>go.mod</code> / <code>go.sum</code>. Tests live next to "
                        "code in <code>*_test.go</code> files and run with <code>go test ./...</code>.",
                    )
                    + _pre(
                        "func Add(a, b int) int { return a + b }\n\n"
                        "func TestAdd(t *testing.T) {\n"
                        "    if got := Add(2, 3); got != 5 {\n"
                        "        t.Fatalf(\"got %d, want 5\", got)\n"
                        "    }\n"
                        "}"
                    )
                ),
            },
        ],
    },

    # -------------------------------------------------------- TypeScript ------
    {
        "slug": "typescript",
        "title": "TypeScript",
        "description": "JavaScript with a static type layer — catch bugs before they run, keep JS's flexibility.",
        "icon": "🔷",
        "color": "#3178C6",
        "order": 175,
        "category": "web",
        "topics": [
            {
                "title": "What TypeScript buys you",
                "summary": "A compile-time type checker over JS. Types are erased — the output is plain JavaScript.",
                "tags": ["typescript", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>A checker, not a new runtime</h2>"
                    + _p(
                        "TypeScript is JavaScript plus <strong>type annotations</strong>. The compiler "
                        "checks them, then <strong>erases</strong> them — what runs is ordinary JS. "
                        "You get editor autocomplete, safe refactors, and errors like "
                        "<em>“string is not assignable to number”</em> at build time instead of 2am.",
                    )
                    + _pre(
                        "function greet(name: string, times: number): string {\n"
                        "  return (name + ' ').repeat(times).trim();\n"
                        "}\n"
                        "greet('sam', 3);      // ok\n"
                        "greet('sam', '3');    // ✗ compile error"
                    )
                    + "<h3>Adopt it gradually</h3>"
                    + _p(
                        "Rename <code>.js</code> to <code>.ts</code>, turn on <code>strict</code> when "
                        "you can, and use <code>// @ts-expect-error</code> sparingly while you migrate."
                    )
                ),
            },
            {
                "title": "Structural typing",
                "summary": "Types match by shape, not by name. If it has the right fields, it fits.",
                "tags": ["typescript", "types"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Shape, not label</h2>"
                    + _p(
                        "Two types are compatible if their <strong>structure</strong> lines up — "
                        "TypeScript doesn't care what you named them. An object literal with "
                        "<code>{ id: number; name: string }</code> satisfies any <code>interface</code> "
                        "asking for exactly that.",
                        "Prefer <code>interface</code> for object shapes you might extend, "
                        "<code>type</code> for unions, tuples and function types.",
                    )
                    + _pre(
                        "interface Point { x: number; y: number }\n"
                        "function len(p: Point) { return Math.hypot(p.x, p.y); }\n\n"
                        "len({ x: 3, y: 4 });               // 5\n"
                        "const v = { x: 3, y: 4, z: 9 };\n"
                        "len(v);                            // ok — extra fields are fine"
                    )
                ),
            },
            {
                "title": "Unions, narrowing and generics",
                "summary": "Model 'one of these' with unions; write reusable code with type parameters.",
                "tags": ["typescript", "generics", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Unions and narrowing</h2>"
                    + _p(
                        "A <strong>union</strong> like <code>string | number</code> says a value is one "
                        "of several types. Inside an <code>if (typeof x === 'string')</code> block "
                        "TypeScript <strong>narrows</strong> it to just <code>string</code> and lets "
                        "you call string methods.",
                    )
                    + "<h3>Generics</h3>"
                    + _p(
                        "A type parameter <code>&lt;T&gt;</code> lets one function work for many types "
                        "while keeping the link between input and output."
                    )
                    + _pre(
                        "function first<T>(arr: T[]): T | undefined {\n"
                        "  return arr[0];\n"
                        "}\n"
                        "const n = first([1, 2, 3]);      // n: number | undefined\n"
                        "const s = first(['a', 'b']);     // s: string | undefined"
                    )
                ),
            },
            {
                "title": "Utility types and tsconfig",
                "summary": "Built-in transforms (Partial, Pick, Record…) and the flags that make the checker useful.",
                "tags": ["typescript", "config", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Deriving types from types</h2>"
                    + _p(
                        "Don't hand-write variants of a type — derive them. "
                        "<code>Partial&lt;User&gt;</code> makes every field optional, "
                        "<code>Pick&lt;User, 'id' | 'name'&gt;</code> keeps two, "
                        "<code>Record&lt;string, number&gt;</code> is a typed dictionary, "
                        "<code>ReturnType&lt;typeof fn&gt;</code> pulls a function's result type.",
                    )
                    + "<h3>tsconfig essentials</h3>"
                    + _ul(
                        "<code>strict: true</code> — turns on all the checks that actually catch bugs",
                        "<code>noUncheckedIndexedAccess</code> — <code>arr[i]</code> becomes <code>T | undefined</code>",
                        "<code>target</code> / <code>module</code> — what JS version and module system to emit",
                        "<code>skipLibCheck</code> — skip type-checking <code>node_modules</code> for speed",
                    )
                ),
            },
        ],
    },

    # --------------------------------------------------------------- PHP ------
    {
        "slug": "php",
        "title": "PHP",
        "description": "The language behind most of the web's CMSes and a huge share of its backends.",
        "icon": "🐘",
        "color": "#777BB4",
        "order": 180,
        "category": "web",
        "topics": [
            {
                "title": "The PHP request model",
                "summary": "Each request starts a fresh process, runs your script top to bottom, and exits.",
                "tags": ["php", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Share-nothing by default</h2>"
                    + _p(
                        "Classic PHP runs one script per HTTP request. Nothing persists between "
                        "requests unless you put it in a database, cache or session. This "
                        "<strong>share-nothing</strong> model makes PHP easy to reason about and hard "
                        "to leak memory in — but means no in-process background work.",
                        "Superglobals carry the request: <code>$_GET</code>, <code>$_POST</code>, "
                        "<code>$_SERVER</code>, <code>$_SESSION</code>. Modern apps wrap these in a "
                        "framework's Request object instead of touching them directly.",
                    )
                    + _pre(
                        "<?php\n"
                        "$name = $_GET['name'] ?? 'world';\n"
                        "echo 'Hello, ' . htmlspecialchars($name);\n"
                        "// script ends -> process is recycled"
                    )
                ),
            },
            {
                "title": "Composer and autoloading",
                "summary": "Composer is PHP's package manager; PSR-4 autoloading maps namespaces to folders.",
                "tags": ["php", "tooling"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Dependencies without the pain</h2>"
                    + _p(
                        "<code>composer require vendor/package</code> installs a library and its "
                        "dependencies into <code>vendor/</code> and pins exact versions in "
                        "<code>composer.lock</code>. <code>require 'vendor/autoload.php'</code> once, "
                        "and every class loads on demand.",
                        "<strong>PSR-4</strong> is the convention: the namespace prefix "
                        "<code>App\\</code> maps to the <code>src/</code> directory, so "
                        "<code>App\\Http\\Controller</code> lives at <code>src/Http/Controller.php</code>.",
                    )
                    + _pre(
                        "// composer.json\n"
                        '"autoload": { "psr-4": { "App\\\\": "src/" } }\n\n'
                        "composer dump-autoload"
                    )
                ),
            },
            {
                "title": "Talking to a database with PDO",
                "summary": "One API for every SQL database, with prepared statements to stop injection.",
                "tags": ["php", "database", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>PDO: portable, parameterised</h2>"
                    + _p(
                        "<strong>PDO</strong> gives one interface for MySQL, PostgreSQL, SQLite and "
                        "more. Always use <strong>prepared statements</strong> with placeholders — "
                        "never string-concatenate values into SQL.",
                    )
                    + _pre(
                        "$pdo = new PDO('mysql:host=db;dbname=app', $user, $pass, [\n"
                        "    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,\n"
                        "]);\n\n"
                        "$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');\n"
                        "$stmt->execute([$email]);\n"
                        "$user = $stmt->fetch(PDO::FETCH_ASSOC);"
                    )
                ),
            },
            {
                "title": "Modern PHP",
                "summary": "Types, enums, readonly properties, match, and first-class callable syntax.",
                "tags": ["php", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>PHP 8+ is a different language</h2>"
                    + _p(
                        "Recent PHP added real type declarations on properties and parameters, "
                        "<code>enum</code>, <code>readonly</code> properties, constructor property "
                        "promotion, the <code>match</code> expression (strict, returns a value), "
                        "named arguments, and nullsafe <code>?-&gt;</code>.",
                    )
                    + _pre(
                        "enum Status: string { case Active = 'active'; case Done = 'done'; }\n\n"
                        "final class Task {\n"
                        "    public function __construct(\n"
                        "        public readonly string $title,\n"
                        "        public Status $status = Status::Active,\n"
                        "    ) {}\n"
                        "}\n\n"
                        "$label = match($task->status) {\n"
                        "    Status::Active => 'In progress',\n"
                        "    Status::Done   => 'Complete',\n"
                        "};"
                    )
                ),
            },
        ],
    },

    # ------------------------------------------------------------ Laravel -----
    {
        "slug": "laravel",
        "title": "Laravel",
        "description": "The batteries-included PHP framework: routing, ORM, queues, auth and more out of the box.",
        "icon": "🔺",
        "color": "#FF2D20",
        "order": 185,
        "category": "web",
        "topics": [
            {
                "title": "Routing and controllers",
                "summary": "Map URLs to closures or controller methods; group and name routes for links.",
                "tags": ["laravel", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>From URL to code</h2>"
                    + _p(
                        "Routes live in <code>routes/web.php</code> (session, CSRF) and "
                        "<code>routes/api.php</code> (stateless, token auth). Point a route at a "
                        "controller method, give it a <strong>name</strong> so you can build URLs "
                        "with <code>route('users.show', $id)</code>, and add "
                        "<strong>middleware</strong> for auth or throttling.",
                    )
                    + _pre(
                        "Route::get('/users/{user}', [UserController::class, 'show'])\n"
                        "    ->name('users.show')\n"
                        "    ->middleware('auth');\n\n"
                        "// route–model binding: {user} is resolved to a User by id automatically"
                    )
                ),
            },
            {
                "title": "Eloquent ORM",
                "summary": "Each model is a table. Relationships, scopes and mass assignment do the heavy lifting.",
                "tags": ["laravel", "eloquent", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Active Record, Laravel style</h2>"
                    + _p(
                        "A model class maps to a table (<code>User</code> → <code>users</code>). "
                        "Define <strong>relationships</strong> as methods — <code>hasMany</code>, "
                        "<code>belongsTo</code>, <code>belongsToMany</code> — and Eloquent writes the "
                        "joins. Guard against mass-assignment with <code>$fillable</code>.",
                        "Watch for the <strong>N+1 query</strong> trap: use "
                        "<code>User::with('posts')</code> to eager-load instead of querying per row.",
                    )
                    + _pre(
                        "class User extends Model {\n"
                        "    protected $fillable = ['name', 'email'];\n"
                        "    public function posts() { return $this->hasMany(Post::class); }\n"
                        "}\n\n"
                        "$users = User::with('posts')->where('active', true)->get();"
                    )
                ),
            },
            {
                "title": "Migrations, requests and validation",
                "summary": "Version your schema in code; validate input in Form Request classes.",
                "tags": ["laravel", "database"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Schema as code</h2>"
                    + _p(
                        "<strong>Migrations</strong> describe table changes in PHP and run in order — "
                        "<code>php artisan migrate</code> on every machine and CI. "
                        "<strong>Seeders</strong> and <strong>factories</strong> fill dev and test "
                        "databases.",
                    )
                    + "<h3>Validation</h3>"
                    + _p(
                        "A <strong>Form Request</strong> holds the rules for one endpoint; the "
                        "controller only runs if input passes, and errors come back as JSON or a "
                        "redirect with the old input."
                    )
                    + _pre(
                        "Schema::create('posts', function (Blueprint $t) {\n"
                        "    $t->id();\n"
                        "    $t->foreignId('user_id')->constrained();\n"
                        "    $t->string('title');\n"
                        "    $t->timestamps();\n"
                        "});\n\n"
                        "// StorePostRequest::rules()\n"
                        "return ['title' => 'required|string|max:120'];"
                    )
                ),
            },
            {
                "title": "Queues, events and the scheduler",
                "summary": "Push slow work to a background worker; run periodic jobs from one cron entry.",
                "tags": ["laravel", "queues", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Do slow things later</h2>"
                    + _p(
                        "Dispatch a <strong>job</strong> (<code>SendInvoice::dispatch($order)</code>) "
                        "and a queue worker (<code>php artisan queue:work</code>) runs it out of the "
                        "request cycle, backed by Redis or the database.",
                        "<strong>Events</strong> + listeners decouple side effects — one "
                        "<code>OrderPaid</code> event can trigger email, analytics and a webhook "
                        "without the checkout code knowing.",
                    )
                    + "<h3>Scheduling</h3>"
                    + _p(
                        "Define recurring tasks in code and register a <strong>single</strong> system "
                        "cron line: <code>* * * * * php artisan schedule:run</code>."
                    )
                ),
            },
        ],
    },

    # --------------------------------------------------------------- Vue ------
    {
        "slug": "vue",
        "title": "Vue",
        "description": "A progressive frontend framework: reactive data, single-file components, gentle learning curve.",
        "icon": "🟩",
        "color": "#42B883",
        "order": 190,
        "category": "web",
        "topics": [
            {
                "title": "Reactivity and the template",
                "summary": "Change data, the DOM updates. Bind with `{{ }}`, `v-bind`, `v-on` and `v-model`.",
                "tags": ["vue", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Data in, DOM out</h2>"
                    + _p(
                        "Vue tracks which pieces of your component's state a template reads. When you "
                        "reassign that state, Vue re-renders just the affected DOM. You never call a "
                        "render function yourself.",
                        "In the template: <code>{{ expr }}</code> for text, <code>:href=\"url\"</code> "
                        "to bind an attribute, <code>@click=\"fn\"</code> for events, and "
                        "<code>v-model</code> for two-way form binding.",
                    )
                    + _pre(
                        "<script setup>\n"
                        "import { ref } from 'vue'\n"
                        "const count = ref(0)\n"
                        "</script>\n\n"
                        "<template>\n"
                        '  <button @click="count++">clicked {{ count }}</button>\n'
                        "</template>"
                    )
                ),
            },
            {
                "title": "Components and props",
                "summary": "Build the UI from small components. Data flows down via props, up via events.",
                "tags": ["vue", "components"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>One-way data flow</h2>"
                    + _p(
                        "A <strong>single-file component</strong> (<code>.vue</code>) bundles template, "
                        "script and scoped styles. A parent passes data down with "
                        "<strong>props</strong> (read-only in the child); the child asks the parent to "
                        "change things by <strong>emitting an event</strong>.",
                        "Use <code>&lt;slot&gt;</code> to let a parent inject markup into a child's "
                        "layout.",
                    )
                    + _pre(
                        "<!-- Child.vue -->\n"
                        "<script setup>\n"
                        "defineProps(['label'])\n"
                        "const emit = defineEmits(['save'])\n"
                        "</script>\n"
                        "<template>\n"
                        '  <button @click="emit(\'save\')">{{ label }}</button>\n'
                        "</template>"
                    )
                ),
            },
            {
                "title": "The Composition API",
                "summary": "`ref`, `reactive`, `computed`, `watch` — and composables to share stateful logic.",
                "tags": ["vue", "composition", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Logic you can extract</h2>"
                    + _p(
                        "<code>ref(x)</code> wraps a primitive (access via <code>.value</code>); "
                        "<code>reactive(obj)</code> wraps an object. <code>computed(() =&gt; …)</code> "
                        "is a cached derived value; <code>watch(src, cb)</code> runs a side effect when "
                        "a source changes.",
                        "Pull related state and functions into a <strong>composable</strong> — a "
                        "plain function named <code>useX()</code> — and reuse it across components.",
                    )
                    + _pre(
                        "// useMouse.js\n"
                        "import { ref, onMounted, onUnmounted } from 'vue'\n"
                        "export function useMouse() {\n"
                        "  const x = ref(0), y = ref(0)\n"
                        "  const move = e => { x.value = e.pageX; y.value = e.pageY }\n"
                        "  onMounted(() => window.addEventListener('mousemove', move))\n"
                        "  onUnmounted(() => window.removeEventListener('mousemove', move))\n"
                        "  return { x, y }\n"
                        "}"
                    )
                ),
            },
            {
                "title": "Routing and state with Pinia",
                "summary": "Vue Router for pages; Pinia stores for state more than one component needs.",
                "tags": ["vue", "state", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>App-level pieces</h2>"
                    + _p(
                        "<strong>Vue Router</strong> maps paths to components, supports nested routes, "
                        "route params, navigation guards for auth, and lazy-loaded chunks per route.",
                        "<strong>Pinia</strong> is the current state library: a <code>store</code> has "
                        "<code>state</code>, <code>getters</code> (computed) and <code>actions</code> "
                        "(methods, can be async). Any component can read or call it, and it's "
                        "type-safe.",
                    )
                    + _pre(
                        "export const useCart = defineStore('cart', {\n"
                        "  state: () => ({ items: [] }),\n"
                        "  getters: { count: (s) => s.items.length },\n"
                        "  actions: { add(p) { this.items.push(p) } },\n"
                        "})"
                    )
                ),
            },
        ],
    },

    # ------------------------------------------------------------ Angular -----
    {
        "slug": "angular",
        "title": "Angular",
        "description": "A full, opinionated frontend framework — components, DI, RxJS and a CLI, all included.",
        "icon": "🅰️",
        "color": "#DD0031",
        "order": 195,
        "category": "web",
        "topics": [
            {
                "title": "The Angular building blocks",
                "summary": "Components, templates, modules (or standalone), services and the CLI.",
                "tags": ["angular", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>A framework, not a library</h2>"
                    + _p(
                        "Angular gives you almost everything: components, a template language, "
                        "dependency injection, routing, forms, an HTTP client, testing setup and the "
                        "<code>ng</code> CLI. It's TypeScript-first and heavier than React or Vue, "
                        "which pays off on large, long-lived apps with big teams.",
                        "A <strong>component</strong> is a class with a decorator that ties it to a "
                        "template and styles. Newer Angular favours <strong>standalone components</strong> "
                        "over the old NgModule system.",
                    )
                    + _pre(
                        "@Component({\n"
                        "  selector: 'app-hello',\n"
                        "  standalone: true,\n"
                        "  template: `<h1>Hello {{ name }}</h1>`,\n"
                        "})\n"
                        "export class HelloComponent { name = 'world'; }"
                    )
                ),
            },
            {
                "title": "Templates and data binding",
                "summary": "Interpolation, property/event binding, and structural directives like @if / @for.",
                "tags": ["angular", "templates"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Four kinds of binding</h2>"
                    + _ul(
                        "<code>{{ value }}</code> — interpolation (text)",
                        "<code>[src]=\"url\"</code> — property binding (component → DOM)",
                        "<code>(click)=\"save()\"</code> — event binding (DOM → component)",
                        "<code>[(ngModel)]=\"name\"</code> — two-way binding on form controls",
                    )
                    + "<h3>Control flow</h3>"
                    + _p(
                        "Modern templates use built-in blocks: <code>@if</code>, <code>@for</code> "
                        "(with a required <code>track</code>), and <code>@switch</code> — replacing the "
                        "old <code>*ngIf</code> / <code>*ngFor</code> directives."
                    )
                    + _pre(
                        "@for (item of items; track item.id) {\n"
                        "  <li>{{ item.name }}</li>\n"
                        "} @empty {\n"
                        "  <li>nothing here</li>\n"
                        "}"
                    )
                ),
            },
            {
                "title": "Services and dependency injection",
                "summary": "Put shared logic in a service; Angular constructs and supplies it for you.",
                "tags": ["angular", "di", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Don't `new` your dependencies</h2>"
                    + _p(
                        "A <strong>service</strong> is a plain class marked "
                        "<code>@Injectable({ providedIn: 'root' })</code>. Ask for it in a "
                        "constructor and Angular's <strong>injector</strong> creates one shared "
                        "instance and hands it over. This makes code testable — swap a real service "
                        "for a fake in a test.",
                    )
                    + _pre(
                        "@Injectable({ providedIn: 'root' })\n"
                        "export class UserApi {\n"
                        "  constructor(private http: HttpClient) {}\n"
                        "  list() { return this.http.get<User[]>('/api/users'); }\n"
                        "}\n\n"
                        "// component\n"
                        "constructor(private users: UserApi) {}"
                    )
                ),
            },
            {
                "title": "RxJS, forms and routing",
                "summary": "Async as streams of values; reactive forms as typed models; lazy-loaded routes.",
                "tags": ["angular", "rxjs", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Observables everywhere</h2>"
                    + _p(
                        "Angular's HTTP client, router and forms emit <strong>Observables</strong> "
                        "(RxJS) — streams you transform with operators like <code>map</code>, "
                        "<code>switchMap</code>, <code>debounceTime</code>. Subscribe in the template "
                        "with the <code>async</code> pipe so Angular unsubscribes for you.",
                    )
                    + "<h3>Forms and routing</h3>"
                    + _p(
                        "<strong>Reactive forms</strong> model the form as a typed "
                        "<code>FormGroup</code> in the class — good for complex validation. The "
                        "<strong>router</strong> supports guards, resolvers and "
                        "<code>loadComponent</code> for per-route code splitting."
                    )
                    + _pre(
                        "search = new FormControl('');\n"
                        "results$ = this.search.valueChanges.pipe(\n"
                        "  debounceTime(300),\n"
                        "  switchMap(q => this.api.search(q ?? '')),\n"
                        ");"
                    )
                ),
            },
        ],
    },

    # ------------------------------------------------------------- DevOps -----
    {
        "slug": "devops",
        "title": "DevOps",
        "description": "Ship software reliably: containers, CI/CD pipelines, infrastructure as code and observability.",
        "icon": "♾️",
        "color": "#2496ED",
        "order": 200,
        "category": "devops",
        "topics": [
            {
                "title": "What DevOps actually means",
                "summary": "Shorten the loop from commit to production, and own what you run.",
                "tags": ["devops", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>A way of working, not a job title</h2>"
                    + _p(
                        "DevOps is the practice of the people who <strong>build</strong> software also "
                        "being responsible for <strong>running</strong> it — with automation closing "
                        "the gap. The goals: small, frequent releases; fast rollback; and feedback "
                        "from production flowing straight back to developers.",
                    )
                    + "<h3>The core practices</h3>"
                    + _ul(
                        "Everything in version control — code, config, infrastructure",
                        "Automated build, test and deploy on every change (CI/CD)",
                        "Immutable, reproducible environments (containers / images)",
                        "Monitoring and alerting so you find problems before users do",
                    )
                ),
            },
            {
                "title": "Containers with Docker",
                "summary": "Package an app and its dependencies into one image that runs the same everywhere.",
                "tags": ["devops", "docker", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Build once, run anywhere</h2>"
                    + _p(
                        "A <strong>Dockerfile</strong> is a recipe; <code>docker build</code> turns it "
                        "into an <strong>image</strong> (a stack of read-only layers); "
                        "<code>docker run</code> starts a <strong>container</strong> — an isolated "
                        "process from that image. The image carries the OS libs, runtime and your "
                        "code, so “works on my machine” stops being a problem.",
                    )
                    + "<h3>Good practice</h3>"
                    + _ul(
                        "Use small base images (<code>-slim</code>, <code>alpine</code>, distroless)",
                        "Multi-stage builds: compile in one stage, copy only the artifact to the final one",
                        "Order steps least-changing first so the layer cache actually helps",
                        "Never bake secrets into an image — pass them at runtime",
                    )
                    + _pre(
                        "FROM python:3.12-slim\n"
                        "WORKDIR /app\n"
                        "COPY requirements.txt .\n"
                        "RUN pip install --no-cache-dir -r requirements.txt\n"
                        "COPY . .\n"
                        'CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]'
                    )
                ),
            },
            {
                "title": "CI/CD pipelines",
                "summary": "A pipeline runs on every push: lint, test, build, and (on main) deploy.",
                "tags": ["devops", "ci-cd", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>The commit-to-prod conveyor</h2>"
                    + _p(
                        "<strong>Continuous Integration</strong> merges everyone's work often and "
                        "verifies it automatically — a green pipeline is the gate to merge. "
                        "<strong>Continuous Delivery/Deployment</strong> extends that to pushing the "
                        "passing build to staging or production, with a manual approval or fully "
                        "automatically.",
                    )
                    + "<h3>Keep it fast and trustworthy</h3>"
                    + _ul(
                        "Fail fast: cheap checks (lint, unit) before slow ones (e2e, deploy)",
                        "Cache dependencies between runs",
                        "One artifact promoted through environments — don't rebuild per stage",
                        "A flaky test is a broken test; quarantine or fix it",
                    )
                    + _pre(
                        "# .github/workflows/ci.yml (sketch)\n"
                        "on: [push]\n"
                        "jobs:\n"
                        "  test:\n"
                        "    steps:\n"
                        "      - uses: actions/checkout@v4\n"
                        "      - run: npm ci && npm test"
                    )
                ),
            },
            {
                "title": "Infrastructure as code & observability",
                "summary": "Declare servers and networks in files; watch running systems with logs, metrics, traces.",
                "tags": ["devops", "iac", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Infrastructure as code</h2>"
                    + _p(
                        "Instead of clicking in a cloud console, describe the desired state in files "
                        "(Terraform, Pulumi, CloudFormation) and let the tool create or update "
                        "resources to match. Benefits: review in a PR, reproduce an environment, and "
                        "recover from disaster by re-applying.",
                    )
                    + "<h3>The three pillars of observability</h3>"
                    + _ul(
                        "<strong>Logs</strong> — structured, timestamped events (what happened)",
                        "<strong>Metrics</strong> — cheap numeric time series: latency, error rate, saturation",
                        "<strong>Traces</strong> — one request's path across services, with timing per hop",
                    )
                    + _p(
                        "Alert on <em>symptoms users feel</em> (error rate, p99 latency), not on every "
                        "CPU spike."
                    )
                ),
            },
        ],
    },

    # --------------------------------------------------------- API Security --
    {
        "slug": "api-security",
        "title": "API Security",
        "description": "Auth, tokens, rate limiting and the attacks that hit HTTP APIs specifically.",
        "icon": "🔐",
        "color": "#10B981",
        "order": 205,
        "category": "backend",
        "topics": [
            {
                "title": "Authentication vs authorization",
                "summary": "AuthN = who you are. AuthZ = what you're allowed to do. Check both, every request.",
                "tags": ["api-security", "auth", "beginner"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Two separate questions</h2>"
                    + _p(
                        "<strong>Authentication</strong> verifies identity — a valid session cookie or "
                        "bearer token. <strong>Authorization</strong> decides whether <em>this</em> "
                        "identity may perform <em>this</em> action on <em>this</em> resource.",
                        "APIs are stateless, so every request must carry its own credential and every "
                        "handler must re-check permissions — never trust that a previous screen "
                        "already did.",
                    )
                    + "<h3>Common shape</h3>"
                    + _pre(
                        "Authorization: Bearer eyJhbGciOi...\n\n"
                        "# server, per request:\n"
                        "user = verify_token(header)          # authN\n"
                        "if not user.can('delete', post):     # authZ\n"
                        "    return 403"
                    )
                ),
            },
            {
                "title": "Tokens: sessions, JWT and OAuth2",
                "summary": "Opaque session ids vs self-contained JWTs; OAuth2 for delegated access.",
                "tags": ["api-security", "tokens", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Pick a credential model</h2>"
                    + _p(
                        "A <strong>session id</strong> is a random opaque string; the server looks it "
                        "up in a store. Easy to revoke, needs shared state. A <strong>JWT</strong> is "
                        "a signed JSON payload the server verifies without a lookup — scales well but "
                        "is hard to revoke before it expires, so keep lifetimes short and pair it "
                        "with a refresh token.",
                        "<strong>OAuth2</strong> is the protocol for letting a third-party app act on "
                        "a user's behalf without seeing their password — the Authorization Code flow "
                        "with PKCE is the current default for web and mobile clients.",
                    )
                    + "<h3>Token hygiene</h3>"
                    + _ul(
                        "Store web tokens in <code>HttpOnly</code>, <code>Secure</code>, <code>SameSite</code> cookies — not <code>localStorage</code>",
                        "Sign with a strong secret/key; verify <code>alg</code>, <code>exp</code>, <code>aud</code>, <code>iss</code>",
                        "Short access token + rotating refresh token; revoke on logout",
                    )
                ),
            },
            {
                "title": "Attacks that target APIs",
                "summary": "Broken object-level auth (IDOR/BOLA), mass assignment, injection, SSRF.",
                "tags": ["api-security", "owasp", "intermediate"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>The API-specific top hits</h2>"
                    + _ul(
                        "<strong>BOLA / IDOR</strong> — <code>GET /orders/123</code> returns someone "
                        "else's order because you only checked login, not ownership. The #1 API risk.",
                        "<strong>Mass assignment</strong> — binding the whole request body to a model "
                        "lets a caller set <code>role=admin</code>. Allow-list fields.",
                        "<strong>Injection</strong> — SQL/NoSQL/command. Use parameterised queries; "
                        "never build queries from strings.",
                        "<strong>SSRF</strong> — a URL you fetch on the server can be pointed at "
                        "internal metadata endpoints. Validate and allow-list outbound hosts.",
                        "<strong>Excessive data exposure</strong> — returning the full DB row and "
                        "trusting the client to hide fields.",
                    )
                ),
            },
            {
                "title": "Rate limiting, secrets and transport",
                "summary": "Throttle abuse, keep secrets out of code, and force TLS everywhere.",
                "tags": ["api-security", "hardening", "advanced"],
                "majors": ALL_MAJORS,
                "body": (
                    "<h2>Limit the blast radius</h2>"
                    + _p(
                        "<strong>Rate limiting</strong> (per IP, per key, per user) blunts credential "
                        "stuffing, scraping and brute force. Return <code>429</code> with a "
                        "<code>Retry-After</code> header. Add stricter limits on auth and "
                        "password-reset endpoints.",
                    )
                    + "<h3>Secrets and transport</h3>"
                    + _ul(
                        "Secrets come from the environment or a vault — never committed, never in the image",
                        "Rotate keys; scope them narrowly; log when one is used to reveal data",
                        "HTTPS only — redirect HTTP, send <code>Strict-Transport-Security</code>",
                        "Lock down CORS to known origins; don't reflect the <code>Origin</code> header",
                    )
                ),
            },
        ],
    },
]

# Cloud & infrastructure reference shelves live in their own module for size.
STANDALONE.extend(INFRA_SHELVES)


_DIFF_RANK = {"beginner": 0, "intermediate": 1, "advanced": 2}
_DIFF_NAMES = ["beginner", "intermediate", "advanced"]


def ladder_difficulty(topic_dicts):
    """A non-decreasing beginner->advanced difficulty per standalone topic:
    an explicit difficulty tag wins, otherwise it's inferred by position."""
    n = len(topic_dicts)
    out, last = [], 0
    for i, t in enumerate(topic_dicts, start=1):
        diff = next((x for x in t.get("tags", []) if x in _DIFF_RANK), None)
        if diff is None:
            diff = "beginner" if i <= n / 3 else "intermediate" if i <= 2 * n / 3 else "advanced"
        if _DIFF_RANK[diff] < last:
            diff = _DIFF_NAMES[last]
        last = _DIFF_RANK[diff]
        out.append(diff)
    return out


async def seed_standalone(db) -> None:
    for shelf in STANDALONE:
        diffs = ladder_difficulty(shelf["topics"])
        exists = (
            await db.execute(
                select(DocCollection).where(DocCollection.slug == shelf["slug"])
            )
        ).scalar_one_or_none()

        if exists:
            # Refresh shelf metadata + the ladder fields on kept topics; leave
            # bodies/summaries (possibly DB-edited) alone.
            exists.title = shelf["title"]
            exists.description = shelf["description"]
            exists.icon = shelf["icon"]
            exists.color = shelf["color"]
            exists.order = shelf["order"]
            exists.category = shelf.get("category")

            rows = (
                await db.execute(
                    select(DocTopic).where(DocTopic.collection_id == exists.id)
                )
            ).scalars().all()
            by_slug = {r.slug: r for r in rows}
            for i, (t, diff) in enumerate(zip(shelf["topics"], diffs), start=1):
                row = by_slug.get(slugify(t["title"]))
                if row:
                    row.order = i
                    row.group_level = i
                    row.group_difficulty = diff
            print(f"  standalone {shelf['slug']}: metadata + ladder refreshed, {len(shelf['topics'])} topics kept")
            continue

        collection = DocCollection(
            slug=shelf["slug"],
            title=shelf["title"],
            description=shelf["description"],
            icon=shelf["icon"],
            color=shelf["color"],
            order=shelf["order"],
            source="standalone",
            category=shelf.get("category"),
        )
        db.add(collection)
        await db.flush()

        for i, (t, diff) in enumerate(zip(shelf["topics"], diffs), start=1):
            db.add(
                DocTopic(
                    collection_id=collection.id,
                    slug=slugify(t["title"]),
                    title=t["title"],
                    summary=t["summary"],
                    body=t["body"],
                    reading_minutes=reading_minutes(t["body"]),
                    order=i,
                    tags=t.get("tags", []),
                    major_slugs=t.get("majors", []),
                    related_lesson_id=None,
                    group_level=i,
                    group_difficulty=diff,
                )
            )
        print(f"  standalone {shelf['slug']}: {len(shelf['topics'])} topics")


async def seed_docs() -> None:
    async with async_session() as db:
        print("Mirroring lesson tracks...")
        await mirror_tracks(db)
        print("Seeding standalone reference shelves...")
        await seed_standalone(db)
        await db.commit()
    print("Library seeded.")


if __name__ == "__main__":
    asyncio.run(seed_docs())
