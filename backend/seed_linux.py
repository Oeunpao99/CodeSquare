"""Seed the 'Linux & Shell' learning track.

Command-line basics real developers use daily: navigating the filesystem,
environment variables, permissions, processes, and scripting with bash.

Idempotent: safe to run repeatedly.
"""
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


LINUX_TRACK = {
    "name": "Linux & Shell",
    "slug": "linux-shell",
    "icon": "🐧",
    "description": "Command-line fluency: files, env vars, permissions, processes, and bash scripting.",
    "color": "#FCC624",
    "modules": [
        {
            "title": "Navigating & Files",
            "description": "Move around the filesystem and manage files.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "pwd, ls & cd",
                    "content": (
                        "<h2>Find your bearings</h2>"
                        "<p>The terminal has a <strong>current working directory</strong>. "
                        "<code>pwd</code> prints it, <code>ls</code> lists files, and <code>cd</code> "
                        "changes into a directory.</p>"
                        "<pre><code>pwd\n"
                        "ls\n"
                        "ls -la\n"
                        "cd backend\n"
                        "cd ..</code></pre>"
                        "<p><code>..</code> is the parent directory.</p>"
                    ),
                    "code_example": (
                        "# see where you are\n"
                        "pwd\n\n"
                        "# list files, including hidden ones, with details\n"
                        "ls -la\n\n"
                        "# go back one level\n"
                        "cd .."
                    ),
                    "starter_code": "# Command to print your current working directory:\n",
                    "solution": "pwd",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Where am I?",
                            "description": "Write the command that prints the current working directory.",
                            "starter_code": "# type your command here\n",
                            "solution": "pwd",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses pwd",
                                     "test": "'pwd' in code"}
                                ]
                            },
                            "hints": [
                                "It stands for 'print working directory'",
                                "It's three letters: p w d"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "cp, mv & rm",
                    "content": (
                        "<h2>Manage files</h2>"
                        "<p><code>cp</code> copies, <code>mv</code> moves/renames, and <code>rm</code> "
                        "removes. Use them with care &mdash; <code>rm</code> is permanent.</p>"
                        "<pre><code>cp a.txt b.txt\n"
                        "mv b.txt notes.txt\n"
                        "rm notes.txt</code></pre>"
                    ),
                    "code_example": (
                        "# copy a file\n"
                        "cp config.example.toml config.toml\n\n"
                        "# rename it\n"
                        "mv config.toml settings.toml\n\n"
                        "# delete it (permanent!)\n"
                        "rm settings.toml"
                    ),
                    "starter_code": "# Command to COPY app.py to a new file app_backup.py:\n",
                    "solution": "cp app.py app_backup.py",
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Copy a File",
                            "description": "Write the command to copy app.py to app_backup.py.",
                            "starter_code": "# type your copy command here\n",
                            "solution": "cp app.py app_backup.py",
                            "test_cases": {
                                "tests": [
                                    {"description": "Starts with cp",
                                     "test": "code.strip().startswith('cp')"},
                                    {"description": "Names both files",
                                     "test": "'app.py' in code and 'app_backup.py' in code"}
                                ]
                            },
                            "hints": [
                                "The command is cp <source> <destination>",
                                "Source is app.py",
                                "Destination is app_backup.py"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "Environment & Permissions",
            "description": "Configure programs and control access.",
            "order": 2,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Environment Variables",
                    "content": (
                        "<h2>Secrets and settings</h2>"
                        "<p><strong>Environment variables</strong> configure a program without hard-coding "
                        "values. CodeSphere reads them from <code>.env</code> (like "
                        "<code>DATABASE_URL</code>).</p>"
                        "<pre><code>export DATABASE_URL='postgresql://...'\n"
                        "echo $DATABASE_URL</code></pre>"
                    ),
                    "code_example": (
                        "# set a variable for this shell session\n"
                        "export PORT=8000\n\n"
                        "# print its value (the $ dereferences it)\n"
                        "echo $PORT"
                    ),
                    "starter_code": "# Print the value of an env var named APP_ENV:\n",
                    "solution": "echo $APP_ENV",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Read an Env Var",
                            "description": "Write the command that prints the value of APP_ENV.",
                            "starter_code": "# print APP_ENV here\n",
                            "solution": "echo $APP_ENV",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses echo",
                                     "test": "'echo' in code"},
                                    {"description": "References APP_ENV",
                                     "test": "'APP_ENV' in code"}
                                ]
                            },
                            "hints": [
                                "Use echo",
                                "Dereference the variable with a dollar sign",
                                "echo $APP_ENV"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "File Permissions",
                    "content": (
                        "<h2>Who can read, write, execute?</h2>"
                        "<p>Each file has permissions for user (u), group (g), others (o), shown by "
                        "<code>ls -l</code>. <code>chmod</code> changes them using octal numbers: "
                        "<code>7</code>=rwx, <code>6</code>=rw, <code>5</code>=rx, <code>4</code>=r.</p>"
                        "<pre><code>chmod 755 script.sh   # user rwx, group rx, others rx\n"
                        "chmod +x script.sh   # just add execute</code></pre>"
                        "<p>Scripts need an <strong>execute</strong> bit before you can run them.</p>"
                    ),
                    "code_example": (
                        "# give the owner read/write/execute\n"
                        "# and everyone else read/execute\n"
                        "chmod 755 deploy.sh\n\n"
                        "# or simply add execute to all\n"
                        "chmod +x deploy.sh"
                    ),
                    "starter_code": "# Make a script runnable by adding the execute bit:\n",
                    "solution": "chmod +x deploy.sh",
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Make it Executable",
                            "description": "Write the command to add the execute bit to deploy.sh.",
                            "starter_code": "# add execute permission to deploy.sh\n",
                            "solution": "chmod +x deploy.sh",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses chmod",
                                     "test": "'chmod' in code"},
                                    {"description": "Adds execute",
                                     "test": "'+x' in code"},
                                    {"description": "Targets deploy.sh",
                                     "test": "'deploy.sh' in code"}
                                ]
                            },
                            "hints": [
                                "Use chmod",
                                "+x adds the execute bit",
                                "chmod +x deploy.sh"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "Processes & Scripting",
            "description": "Run, inspect, and combine commands.",
            "order": 3,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Running Processes",
                    "content": (
                        "<h2>Start, watch, and stop</h2>"
                        "<p><code>ps</code> lists processes, <code>top</code>/<code>htop</code> show live "
                        "activity, and <code>kill</code> sends a signal to stop a process.</p>"
                        "<pre><code>ps aux\n"
                        "top\n"
                        "kill 1234</code></pre>"
                        "<p>Here on Windows you'd use <code>tasklist</code> and <code>taskkill</code>, and "
                        "in Git Bash/powershell the ideas carry over.</p>"
                    ),
                    "code_example": (
                        "ps aux                # list all processes\n"
                        "top                   # live view\n"
                        "kill 1234             # end process with pid 1234"
                    ),
                    "starter_code": "# List all running processes:\n",
                    "solution": "ps aux",
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "List Processes",
                            "description": "Write the command to list running processes.",
                            "starter_code": "# your command here\n",
                            "solution": "ps aux",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses ps",
                                     "test": "code.strip().startswith('ps') or 'ps aux' in code"}
                                ]
                            },
                            "hints": [
                                "Use ps",
                                "Adding au shows all users with detail",
                                "ps aux"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Pipes & grep",
                    "content": (
                        "<h2>Chain commands</h2>"
                        "<p>The pipe <code>|</code> feeds one command's output into the next. "
                        "<code>grep</code> filters lines matching a pattern.</p>"
                        "<pre><code>ps aux | grep python\n"
                        "ls | grep '\.py$'</code></pre>"
                        "<p>Exactly how you'd find a running server or a file by name.</p>"
                    ),
                    "code_example": (
                        "# find python processes\n"
                        "ps aux | grep python\n\n"
                        "# list only python source files\n"
                        "ls | grep '.py$'"
                    ),
                    "starter_code": "# List only the processes that mention 'uvicorn':\n",
                    "solution": "ps aux | grep uvicorn",
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Pipe and Filter",
                            "description": "Write a command that lists processes and keeps only lines matching 'uvicorn'.",
                            "starter_code": "# ps aux piped into grep\n",
                            "solution": "ps aux | grep uvicorn",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses ps",
                                     "test": "'ps aux' in code"},
                                    {"description": "Uses a pipe",
                                     "test": "'|' in code"},
                                    {"description": "Filters with grep",
                                     "test": "'grep' in code and 'uvicorn' in code"}
                                ]
                            },
                            "hints": [
                                "Pipe ps aux into grep",
                                "ps aux | grep <pattern>",
                                "pattern is uvicorn"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_linux_track():
    """Add the Linux & Shell track if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == LINUX_TRACK["slug"])
        )
        if existing.scalars().first():
            print("Linux & Shell track already exists; nothing to do.")
            return

        language = Language(
            name=LINUX_TRACK["name"],
            slug=LINUX_TRACK["slug"],
            icon=LINUX_TRACK["icon"],
            description=LINUX_TRACK["description"],
            color=LINUX_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in LINUX_TRACK["modules"]:
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
        print("Linux & Shell track seeded successfully!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_linux_track())
