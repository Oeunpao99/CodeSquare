"""Seed the 'Python Intermediate' learning track.

Extends the beginner Python path with the patterns real APIs are built on:
functions, async & await, Pydantic models, and working with JSON.

Idempotent: safe to run repeatedly.
"""

import _bootstrap  # noqa: F401  -- put backend/ on sys.path (see scripts/_bootstrap.py)
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


PYTHON_TRACK = {
    "name": "Python Intermediate",
    "slug": "python-intermediate",
    "icon": "🐍",
    "description": "Level up Python: functions, async/await, Pydantic models, and the patterns real APIs are built on.",
    "color": "#4B8BBE",
    "modules": [
        {
            "title": "Functions & Clean Code",
            "description": "Write reusable, readable functions.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "Default & Keyword Arguments",
                    "content": (
                        "<h2>Flexible functions</h2>"
                        "<p><strong>Default arguments</strong> give a value if the caller omits one. "
                        "<strong>Keyword arguments</strong> let you pass values by name instead of position.</p>"
                        "<pre><code>def greet(name, greeting='Hello'):\n"
                        "    return f'{greeting}, {name}!'\n\n"
                        "greet('Ada')\n"
                        "greet('Ada', greeting='Hi')</code></pre>"
                    ),
                    "code_example": (
                        "def greet(name, greeting='Hello'):\n"
                        "    return f'{greeting}, {name}!'\n\n"
                        "print(greet('Ada'))\n"
                        "print(greet('Grace', greeting='Hi'))"
                    ),
                    "starter_code": (
                        "# give power a default value of 1\n"
                        "def power(base, power):\n"
                        "    return base ** power\n"
                    ),
                    "solution": (
                        "def power(base, power=1):\n"
                        "    return base ** power\n"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Default Argument",
                            "description": "Give the 'power' parameter a default value of 1 so callers can omit it.",
                            "starter_code": "def power(base, power):\n    return base ** power",
                            "solution": "def power(base, power=1):\n    return base ** power",
                            "test_cases": {
                                "tests": [
                                    {"description": "power has a default of 1",
                                     "test": "assert power(5) == 5"}
                                ]
                            },
                            "hints": [
                                "Put an = after the parameter name",
                                "power=1 makes it optional",
                                "Call power(5) to use the default"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "List Comprehensions",
                    "content": (
                        "<h2>Build lists in one line</h2>"
                        "<p>A <strong>list comprehension</strong> maps and filters a list more concisely "
                        "than a <code>for</code> loop.</p>"
                        "<pre><code>squares = [n * n for n in range(5)]\n"
                        "evens   = [n for n in range(10) if n % 2 == 0]</code></pre>"
                    ),
                    "code_example": (
                        "numbers = [1, 2, 3, 4, 5]\n"
                        "doubled = [n * 2 for n in numbers]\n"
                        "print(doubled)  # [2, 4, 6, 8, 10]"
                    ),
                    "starter_code": (
                        "numbers = [1, 2, 3]\n"
                        "# build a list named squares with each number squared\n"
                        "squares = \n"
                    ),
                    "solution": (
                        "numbers = [1, 2, 3]\n"
                        "squares = [n * n for n in numbers]\n"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Square Each Item",
                            "description": "Build a 'squares' list where each number is squared, using a list comprehension.",
                            "starter_code": "numbers = [1, 2, 3]\nsquares = \n",
                            "solution": "numbers = [1, 2, 3]\nsquares = [n * n for n in numbers]",
                            "test_cases": {
                                "tests": [
                                    {"description": "squares equals [1,4,9]",
                                     "test": "assert squares == [1, 4, 9]"}
                                ]
                            },
                            "hints": [
                                "A comprehension looks like [expr for item in items]",
                                "expr = n * n",
                                "squares = [n * n for n in numbers]"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "Async & Pydantic",
            "description": "The patterns CodeSphere's backend uses.",
            "order": 2,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "async / await",
                    "content": (
                        "<h2>Non-blocking code</h2>"
                        "<p>An <code>async def</code> function is a <strong>coroutine</strong> &mdash; it "
                        "pauses at <code>await</code> instead of blocking the whole program. This lets a "
                        "server juggle many requests at once.</p>"
                        "<pre><code>async def fetch_user():\n"
                        "    data = await db.get_user(1)\n"
                        "    return data</code></pre>"
                    ),
                    "code_example": (
                        "import asyncio\n\n"
                        "async def say_hi():\n"
                        "    await asyncio.sleep(0.1)\n"
                        "    return 'hi'\n\n"
                        "print(asyncio.run(say_hi()))"
                    ),
                    "starter_code": (
                        "# make this a coroutine with async\n"
                        "def load():\n"
                        "    return 42\n"
                    ),
                    "solution": (
                        "async def load():\n"
                        "    return 42\n"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Declare a Coroutine",
                            "description": "Convert load into an async coroutine. (Then it can be awaited.)",
                            "starter_code": "def load():\n    return 42",
                            "solution": "async def load():\n    return 42",
                            "test_cases": {
                                "tests": [
                                    {"description": "load is a coroutine",
                                     "test": "import inspect; assert inspect.iscoroutinefunction(load)"}
                                ]
                            },
                            "hints": [
                                "Prepend 'async' before def",
                                "async def load():",
                                "It can still return 42"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Pydantic Models",
                    "content": (
                        "<h2>Validate data with Pydantic</h2>"
                        "<p>CodeSphere uses <strong>Pydantic</strong> to validate request bodies and "
                        "shape responses. Declare fields with types and Pydantic checks them.</p>"
                        "<pre><code>from pydantic import BaseModel\n\n"
                        "class User(BaseModel):\n"
                        "    name: str\n"
                        "    age: int</code></pre>"
                    ),
                    "code_example": (
                        "from pydantic import BaseModel\n\n"
                        "class LessonIn(BaseModel):\n"
                        "    title: str\n"
                        "    xp: int = 10\n\n"
                        "data = {'title': 'Intro', 'xp': 25}\n"
                        "lesson = LessonIn(**data)\n"
                        "print(lesson.title, lesson.xp)"
                    ),
                    "starter_code": (
                        "from pydantic import BaseModel\n\n"
                        "# model a User with name: str and age: int\n"
                    ),
                    "solution": (
                        "from pydantic import BaseModel\n\n"
                        "class User(BaseModel):\n"
                        "    name: str\n"
                        "    age: int\n"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Define a Model",
                            "description": "Define a User Pydantic model with a 'name' str and an integer 'age'.",
                            "starter_code": "from pydantic import BaseModel\n\nclass User(BaseModel):\n    pass",
                            "solution": "from pydantic import BaseModel\n\nclass User(BaseModel):\n    name: str\n    age: int",
                            "test_cases": {
                                "tests": [
                                    {"description": "name is a string field",
                                     "test": "assert User.__fields__['name'].annotation is str or User.model_fields['name'].annotation is str"},
                                    {"description": "age is an int field",
                                     "test": "assert User.model_fields['age'].annotation is int or User.__fields__['age'].annotation is int"}
                                ]
                            },
                            "hints": [
                                "class User(BaseModel):",
                                "Add a field: name: str",
                                "Add a field: age: int"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "Working with JSON",
            "description": "Serialize data your frontend can read.",
            "order": 3,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "json.dumps & json.loads",
                    "content": (
                        "<h2>Between Python and JSON</h2>"
                        "<p><code>json.dumps</code> turns a Python dict into a JSON <em>string</em>; "
                        "<code>json.loads</code> turns a JSON string back into a dict. APIs exchange JSON "
                        "with the frontend.</p>"
                        "<pre><code>import json\n\n"
                        "obj = {'name': 'Ada', 'active': True}\n"
                        "s = json.dumps(obj)\n"
                        "back = json.loads(s)</code></pre>"
                    ),
                    "code_example": (
                        "import json\n\n"
                        "user = {'name': 'Ada', 'level': 5}\n"
                        "payload = json.dumps(user)\n"
                        "print(payload)      # JSON string\n"
                        "print(json.loads(payload))  # back to dict"
                    ),
                    "starter_code": (
                        "import json\n\n"
                        "user = {'name': 'Ada', 'level': 5}\n"
                        "# convert user to a JSON string using json.dumps\n"
                        "payload = \n"
                    ),
                    "solution": (
                        "import json\n\n"
                        "user = {'name': 'Ada', 'level': 5}\n"
                        "payload = json.dumps(user)\n"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Serialize a Dict",
                            "description": "Convert the 'user' dict into a JSON string 'payload' with json.dumps.",
                            "starter_code": "import json\nuser = {'name': 'Ada', 'level': 5}\npayload = ",
                            "solution": "import json\nuser = {'name': 'Ada', 'level': 5}\npayload = json.dumps(user)",
                            "test_cases": {
                                "tests": [
                                    {"description": "payload is a JSON string",
                                     "test": "import json as _j; assert isinstance(payload, str) and _j.loads(payload)['name'] == 'Ada'"}
                                ]
                            },
                            "hints": [
                                "json.dumps(dict) returns a string",
                                "payload = json.dumps(user)",
                                "The result must be a str"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_python_intermediate():
    """Add the Python Intermediate track if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == PYTHON_TRACK["slug"])
        )
        if existing.scalars().first():
            print("Python Intermediate track already exists; nothing to do.")
            return

        language = Language(
            name=PYTHON_TRACK["name"],
            slug=PYTHON_TRACK["slug"],
            icon=PYTHON_TRACK["icon"],
            description=PYTHON_TRACK["description"],
            color=PYTHON_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in PYTHON_TRACK["modules"]:
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
        print("Python Intermediate track seeded successfully!")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_python_intermediate()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
