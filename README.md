# CodeSphere — AI-Powered Coding Learning Portal

A coding learning portal for complete beginners, with AI built into every step.
From **"what is a variable?"** all the way to **shipping a real project** — no human teacher required.

## ✨ Core Promise

Someone who has never written a line of code can land on the site and go from zero to shipping a real project. The AI plays **several distinct roles**, not a bolted-on chatbot:

| Role | What it does |
|------|--------------|
| 🔍 **Hint-giver** | Inside an exercise, hints escalate from gentle nudges to guided pseudocode. It never just hands over the answer. |
| 🧑‍⚖️ **Code reviewer** | Reviews submitted projects, gives a score, and explains *why* something is wrong — not just *that* it is. |
| 🏗️ **Project generator** | Generates a project sized to exactly what the student has learned so far, then reviews what they submit. |
| 💬 **Tutor / pair programmer** | Free-form chat (also docked in every lesson): answers questions, **writes full code examples, and debugs pasted errors** — replies render with syntax-highlighted, copyable code blocks. |
| 📊 **Progress monitor** | Tracks hints burned per exercise, time stuck on a problem, and failing concepts, then says *"you should go back and redo lesson 3."* |

**Design principle:** the AI helps students *think*, it doesn't think for them.

## 🧭 Feature map (by sidebar)

Every authenticated page shares one shell (`AppLayout`) — a persistent left sidebar
with **Learn · Roadmap · Library · Projects · Settings**. Pick a **career major**
(Settings → Major) and the dashboard, roadmap and Library all re-order around it.
The sidebar itself never re-mounts on navigation (the active pill slides between
items; content cross-fades).

### 📖 Learn — `/dashboard`, `/learn/:slug`, `/learn/:slug/module/:m/lesson/:l`

- **Dashboard** — greeting, your major card, stat tiles (lessons completed · XP · day streak · hints used), an AI recommendation banner, "areas to focus on", and **your major's tracks** (major-ordered) with an *Explore all tracks* toggle. First run with no major → a **major picker onboarding** instead.
- **Course view** (`/learn/:slug`) — sticky header, a course progress ring, and modules as a **`Level 1 → N` ladder** with colour-coded difficulty badges (beginner / intermediate / advanced). Each lesson row shows completion ✓, XP and estimated time.
- **Lesson view** — IDE-style split: reading + a runnable example on the left, an exercise editor on the right. **Run Code** executes real test cases and shows pass/fail inline. **Hints** escalate through 5 levels. The **AI Tutor docks on the right and is drag-resizable** (width remembered); on mobile it's a slide-over drawer. Passing all tests marks the lesson complete.
- **Curriculum** — module difficulty is a real non-decreasing ladder (`Module.level`, normalised by `retag_curriculum.py`) and **every lesson has a checkable exercise** (`backfill_exercises.py`), so nothing is un-completable.

### 🎯 Roadmap — `/roadmap`

- Your major's tracks in teaching order with an overall % and per-track progress bars.
- Status per track (not started / in progress / completed) with **Start / Continue / Review**.
- Expand a track to see its modules as `L{level} · title · difficulty` with per-module lesson counts.

### 📚 Library — `/library`, `/library/:collection`, `/library/:collection/:topic`

A browsable knowledge base — **reference articles, not graded exercises.**

- **Index** — a *"Your {major} library"* row (major-ordered shelves) + all shelves; **category filter chips** (Python · Web · Backend · Data & SQL · DevOps · CS Fundamentals); a **debounced full-text search** over topic title / summary / tags with ranked results.
- **16 shelves** — 8 auto-**mirrored** from the lesson tracks (rebuilt by `seed_docs.py`) + 8 hand-written **standalone references**: Version Control, Dev Workflow, HTTP & the Web, SQL & Databases, API Design, Security Essentials, Testing, Data Structures & Algorithms. Each mirrored shelf opens with a *"What X is for"* **overview primer**.
- **Collection page = a beginner → advanced learning path.** Full-width, two columns: the path on the left, a sticky rail on the right (progress ring, a **Start / Continue / Review** button that jumps to your next unread topic, and a *"levels"* quick-nav). Mirrored shelves render a **vertical timeline** of collapsible *Level* cards (difficulty-coloured nodes, green ✓ at 100%, first unfinished open, topics in a 2-column grid). Standalone shelves render **`── Beginner ──` / `── Intermediate ──` / `── Advanced ──` section breaks** with a responsive card grid.
- **Article reader** — a sticky breadcrumb bar, a left **chapter nav with progress dots**, the prose in the centre with **copy buttons on every code block**, a right **"on this page" TOC with scroll-spy**, a **mini in-browser Python playground** (shown only for runnable snippets), a **"Do the lesson"** CTA, prev/next pager, and an *Ask the AI Tutor* link.
- **Progress** — mirrors your lesson completions (`DocTopic.related_lesson_id`), shown as `N/M done` + bars on cards, on the collection, and per level. Shelf icons are real brand marks / SVG (no emoji).

### 🧰 Projects — `/projects`, `/projects/:id`, `/projects/generate`

A **persistent project workspace** (was a throwaway one-shot generator before).

- **List** — a grid of your saved projects (language, updated, status, pin). **New project** opens a blank-project modal; **Generate with AI** opens the generator.
- **Generate** (`/projects/generate`) — the AI project generator with its flying-code "generating" animation: a **major-aware language picker**, a difficulty selector, and a **stack-aware skills checklist** (React skills for a React project, shell skills for bash, …). On success it **saves a real project** (brief + starter code) and opens the workspace.
- **Workspace** (`/projects/:id`) — tabs: **Code** (CodeMirror), **Notes** (Markdown editor + live preview), **Brief** (AI requirements & hints), **Tasks** (checklist), **Review** (a saved AI code review — score, feedback, fixes, "nailed it"). Auto-saves; pin / set status / delete.

### 🤖 AI Tutor — `/tutor` + docked in every lesson

- **Multi-turn** conversation (keeps history), not one-shot Q&A.
- **Writes full code examples and debugs pasted errors** — names the cause, shows the fix, says what changed.
- Replies render as **Markdown with syntax-highlighted, copyable fenced code blocks**; multi-line paste-friendly input; quick-action chips (*Give an example · Fix my code · Explain more*).

### ⚙️ Settings — `/profile`

- Sticky identity header, **major picker**, **theme picker** (several themes + accent colours; also reachable from the sidebar profile popup's Activity / Settings / Theme / Color tabs).
- Lesson history, a weekly-activity chart, the **AI progress monitor** ("you should redo lesson 3"), and recent projects.

## 🏗️ Tech Stack

- **Backend:** Python · FastAPI · SQLAlchemy (async) · Alembic · PostgreSQL · Redis
- **Frontend:** React 18 · Vite · Tailwind CSS · CodeMirror · React Router
- **Auth:** Email/password (JWT) + Google OAuth
- **Database:** PostgreSQL (production-grade), managed with Alembic migrations
- **Cache:** Redis (optional, wired for future use)

## 🧱 Project Structure

```
Fast-API/
├── docker/
│   └── docker-compose.dev.yml      # PostgreSQL + Redis + pgAdmin (dev services)
├── backend/
│   ├── alembic/                    # Alembic migration environment & versions
│   ├── models/models.py           # ORM: User, Language/Module/Lesson/Exercise, UserProgress,
│   │                              #   UserProject, DocCollection, DocTopic
│   ├── routers/                    # auth · lessons · ai · progress · roadmap · docs (Library) · projects
│   ├── ai/tutor.py                 # AI hint-giver / reviewer / project-generator / chat tutor
│   ├── majors.py                   # career major → ordered tracks / Library shelves
│   ├── database.py                 # async engine + session
│   ├── main.py                     # FastAPI app
│   ├── seed_data.py … seed_*.py    # lesson-track content (see step 3)
│   ├── retag_curriculum.py         # normalise each track's beginner→advanced ladder
│   ├── backfill_exercises.py       # ensure every lesson has a checkable exercise
│   ├── seed_docs.py                # build the Library (mirror tracks + standalone shelves)
│   ├── alembic.ini
│   └── .env                        # environment config (git-ignored)
└── frontend/
    ├── src/
    │   ├── pages/                  # Landing, Auth, Dashboard, LanguageView, LessonView,
    │   │                          #   Roadmap, Library / LibraryCollection / LibraryArticle,
    │   │                          #   ProjectsList / ProjectWorkspace / GenerateProject, Tutor, Profile
    │   ├── components/             # CodeEditor, AITutor, AppLayout, CollectionLogo, LangLogo, …
    │   ├── context/               # Auth, Major, Theme
    │   ├── services/api.js         # API client (authService, lessonService, aiService,
    │   │                          #   progressService, roadmapService, docService, projectService)
    │   ├── projectStacks.js        # shared stack/skill maps
    │   ├── styles/index.css        # Tailwind + component classes
    │   └── App.jsx                 # routes
    ├── tailwind.config.js
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Docker** (for PostgreSQL, Redis, pgAdmin)
- **[uv](https://docs.astral.sh/uv/)** (Python package manager) — `pip install uv` or see install docs
- **Node.js 18+** & npm

### 1. Start the development services (PostgreSQL + Redis + pgAdmin)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts:

| Service     | Address                 | Credentials                       |
|-------------|-------------------------|-----------------------------------|
| **PostgreSQL** | `localhost:5432`    | user `codesphere` / pass `codesphere` / db `codesphere` |
| **Redis**    | `localhost:6379`        | —                                 |
| **pgAdmin**  | http://localhost:5050   | email `admin@codesphere.dev` / pass `admin` |

> **pgAdmin:** after logging in, add a server → host `postgres`, port `5432`,
> user `codesphere`, password `codesphere`. (Inside Docker the host is `postgres`.)

### 2. Backend setup (uv)

We use **[uv](https://docs.astral.sh/uv/)** to manage the Python environment and dependencies
(`pyproject.toml` + `uv.lock`, in place of `requirements.txt`).

```bash
cd backend

# Create .venv + install all dependencies
#   (uses the pinned Python version from backend/.python-version)
uv sync

# Configure environment
#   Copy backend/.env (already provided) and update GOOGLE_CLIENT_ID / OPENAI_API_KEY
```

**Activating the virtual environment.** `uv sync` creates `backend/.venv`. You don't
*have* to activate it — prefixing a command with `uv run` runs it inside the venv
automatically:

```bash
uv run python -c "import main; print('backend OK')"
```

To get an interactive shell inside the venv instead (so `python`, `uvicorn`,
`alembic` resolve without the `uv run` prefix), activate it:

| Shell | Activate | Deactivate |
|-------|----------|------------|
| PowerShell        | `.venv\Scripts\Activate.ps1` | `deactivate` |
| cmd.exe           | `.venv\Scripts\activate.bat` | `deactivate` |
| Git Bash / WSL    | `source .venv/Scripts/activate` | `deactivate` |
| macOS / Linux     | `source .venv/bin/activate` | `deactivate` |

> PowerShell may block the script with an execution-policy error. Fix it once with
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

Useful `uv` commands:

```bash
uv run python ...          # run a command in the venv (no activation needed)
uv add <package>           # add a dependency (updates pyproject.toml + uv.lock)
uv remove <package>        # remove a dependency
uv sync                    # install to match uv.lock
```

### 3. Apply database migrations (Alembic)

```bash
cd backend
uv run python -m alembic upgrade head      # or just `alembic upgrade head` in an activated venv
```

> **Migrations are the source of truth for the schema.** Run this anytime the schema changes.

#### Seeding the learning content

```bash
cd backend
uv run python seed_data.py        # base languages: Python, JavaScript, HTML/CSS (starter module each)
uv run python seed_bases.py       # fills the base languages out with the rest of the beginner modules
uv run python seed_python_adv.py  # Python Intermediate track
uv run python seed_react.py       # React & TypeScript track
uv run python seed_linux.py       # Linux & Shell track
uv run python seed_tracks.py      # Backend Foundations track
uv run python seed_fullstack.py   # Full Stack track

# then, in this order:
uv run python retag_curriculum.py # normalise each track's beginner->advanced ladder (Module.level / difficulty)
uv run python backfill_exercises.py # give every exercise-less lesson one checkable exercise
uv run python seed_docs.py        # build the Library (mirrors tracks + standalone reference shelves)
```

Every script is idempotent — safe to re-run. Together they give each career **major**
(Profile → Major) a complete set of tracks:

| Major | Tracks |
|---|---|
| Computer Science | Python, Python Intermediate, JavaScript, Linux & Shell |
| Data Science | Python, Python Intermediate, Backend Foundations, Linux & Shell |
| AI Engineer | Python, Python Intermediate, Backend Foundations, Linux & Shell |
| Web Developer | HTML & CSS, JavaScript, React & TypeScript, Full Stack |
| Backend Engineer | Python, Python Intermediate, Backend Foundations, Linux & Shell, Full Stack |
| Automation Engineer | Python, Python Intermediate, Linux & Shell, Backend Foundations |

### 4. Run the backend

```bash
cd backend
uv run python -m uvicorn main:app --reload --port 8000
```

> Use `python -m uvicorn` (not `uv run uvicorn`). On some Windows setups
> `uv run <console-script>` fails with `Access is denied (os error 5)`; going
> through `python -m` avoids it. If you've **activated** the venv (see step 2),
> just `uvicorn main:app --reload --port 8000` works.
>
> If `--reload` stops picking up changes (a known WatchFiles quirk on Windows +
> OneDrive folders), drop `--reload` and restart manually.

API is at **http://localhost:8000** (docs at `/docs`).

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend is at **http://localhost:5173**.

---

## 🔄 Alembic Migration Workflow

**When you change a model** (add a table/column), generate & apply a migration:

```bash
cd backend

# Auto-generate a migration from the current models
uv run python -m alembic revision --autogenerate -m "Description of change"

# Review the generated file in alembic/versions/, then apply it
uv run python -m alembic upgrade head
```

Other useful commands (`python -m alembic …`, or plain `alembic …` in an activated venv):

```bash
uv run python -m alembic history      # list applied migrations
uv run python -m alembic downgrade -1 # undo the last migration
uv run python -m alembic current      # show current revision
```

> Always inspect auto-generated migrations before applying them — autogenerate is a starting point, not gospel.

---

## 🔐 AI Setup (optional but recommended)

Add your API keys to `backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
OPENAI_API_KEY=sk-...
```

- Without `OPENAI_API_KEY`, the app still works using **fallback hints/reviews** so you can test the flow.
- **Google OAuth:** create credentials at the [Google Cloud Console](https://console.cloud.google.com/), add the frontend origin (`http://localhost:5173`) to authorized JavaScript origins, and set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`.

---

## 🎮 Using the App

1. **Create an account** — email/password or **Continue with Google**.
2. **Pick a career major** (Profile → Major) — the dashboard, roadmap and Library re-order around it.
3. **Work through modules & lessons** — each lesson has reading + an in-browser coding exercise with a real code editor; tests run inline.
4. **Get unstuck** — hit **"Pick a Hint"** (escalates through 5 levels, never gives the full answer) or open the **AI Tutor** — it can paste back corrected code and full examples.
5. **Read ahead in the Library** — browse the reference shelves, follow a shelf's beginner → advanced path, or search for a concept ("rebase", "JOIN", "f-string").
6. **Build projects** — create a blank project or **Generate with AI**; then use the workspace (Code / Notes / Tasks / Brief) and hit **AI Review** for a scored critique that's saved with the project.
7. **Track progress** — the roadmap and Library show per-level completion; the AI monitor surfaces failing concepts and recommends redoing past lessons.

---

## 🧪 Useful URLs

| What            | URL                                    |
|-----------------|----------------------------------------|
| Frontend        | http://localhost:5173                  |
| Library         | http://localhost:5173/library          |
| Projects        | http://localhost:5173/projects         |
| FastAPI docs    | http://localhost:8000/docs             |
| pgAdmin         | http://localhost:5050                  |

---

## 🛠️ Troubleshooting

- **Port 5432 already in use** — an existing local PostgreSQL may be running. Either stop it, or change the published port in `docker-compose.dev.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL`.
- **`no such table` / missing-column errors** — you haven't run the migrations. Run `uv run python -m alembic upgrade head`, then re-seed (including `retag_curriculum.py`, `backfill_exercises.py`, `seed_docs.py`).
- **Library is empty** — run `uv run python seed_docs.py` (after the lesson seeds + `retag_curriculum.py`).
- **Redis not needed yet** — the app works without it; Redis is provisioned for future caching/sessions.

---

## 📝 License

Internal project — for educational/demonstration purposes.
