"""Seed the 'React & TypeScript' learning track.

Covers the exact frontend stack CodeSphere is built with: components, props,
state & hooks, TypeScript typing, and consuming APIs.

Idempotent: safe to run repeatedly.
"""
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


REACT_TRACK = {
    "name": "React & TypeScript",
    "slug": "react-typescript",
    "icon": "⚛️",
    "description": "The frontend stack: build components, manage state, type with TypeScript, and talk to APIs.",
    "color": "#61DAFB",
    "modules": [
        {
            "title": "Components & JSX",
            "description": "The building blocks of any React app.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "First Component",
                    "content": (
                        "<h2>Components are functions</h2>"
                        "<p>A React <strong>component</strong> is just a function that returns "
                        "markup called <strong>JSX</strong>. It starts with a capital letter, so "
                        "React treats it as a component rather than an HTML tag.</p>"
                        "<pre><code>function Greeting() {\n"
                        "  return &lt;h1&gt;Hello world&lt;/h1&gt;;\n"
                        "}</code></pre>"
                    ),
                    "code_example": (
                        "function Card() {\n"
                        "  return (\n"
                        "    <div className=\"card\">\n"
                        "      <h2>My Card</h2>\n"
                        "    </div>\n"
                        "  );\n"
                        "}\n\n"
                        "export default Card;"
                    ),
                    "starter_code": (
                        "function Card() {\n"
                        "  // return a <div> containing a <h2> that says 'Hello'\n"
                        "}\n\n"
                        "export default Card;"
                    ),
                    "solution": (
                        "function Card() {\n"
                        "  return (\n"
                        "    <div className=\"card\">\n"
                        "      <h2>Hello</h2>\n"
                        "    </div>\n"
                        "  );\n"
                        "}\n\n"
                        "export default Card;"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "JSX Element",
                            "description": "Return a <div> containing an <h2> that reads 'Hello' from a Card component.",
                            "starter_code": "function Card() {\n  return (\n    // add div + h2 here\n  );\n}\n\nexport default Card;",
                            "solution": "function Card() {\n  return (\n    <div className=\"card\">\n      <h2>Hello</h2>\n    </div>\n  );\n}\n\nexport default Card;",
                            "test_cases": {
                                "tests": [
                                    {"description": "Returns a div",
                                     "test": "'<div' in code and '</div>' in code"},
                                    {"description": "Contains an h2",
                                     "test": "'<h2>' in code"},
                                    {"description": "Heading says Hello",
                                     "test": "'>Hello<' in code or 'Hello' in code"}
                                ]
                            },
                            "hints": [
                                "A component returns JSX, usually in parentheses",
                                "Put <div className=\"card\"> ... </div> inside return",
                                "Add <h2>Hello</h2> inside the div"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Props",
                    "content": (
                        "<h2>Pass data with props</h2>"
                        "<p><strong>Props</strong> are how a parent passes data to a child component. "
                        "They read like function arguments.</p>"
                        "<pre><code>function Greeting({ name }) {\n"
                        "  return &lt;h1&gt;Hi, {name}!&lt;/h1&gt;;\n"
                        "}\n\n"
                        "&lt;Greeting name=\"Ada\" /&gt;</code></pre>"
                    ),
                    "code_example": (
                        "function Greeting({ name }) {\n"
                        "  return <h1>Hi, {name}!</h1>;\n"
                        "}\n\n"
                        "export function App() {\n"
                        "  return <Greeting name=\"Ada\" />;\n"
                        "}"
                    ),
                    "starter_code": (
                        "function Greeting({ name }) {\n"
                        "  // render a <p> with the text: Hello, {name}!\n"
                        "}\n"
                    ),
                    "solution": (
                        "function Greeting({ name }) {\n"
                        "  return <p>Hello, {name}!</p>;\n"
                        "}"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "String Interpolation",
                            "description": "Complete Greeting so it renders <p>Hello, Ada!</p> using the name prop.",
                            "starter_code": "function Greeting({ name }) {\n  // use JSX braces to insert name\n}",
                            "solution": "function Greeting({ name }) {\n  return <p>Hello, {name}!</p>;\n}",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses JSX braces",
                                     "test": "'{name}' in code"},
                                    {"description": "Renders a paragraph",
                                     "test": "'<p>' in code"},
                                    {"description": "Has Hello text",
                                     "test": "'Hello' in code"}
                                ]
                            },
                            "hints": [
                                "Insert a variable with curly braces: {name}",
                                "Wrap in a <p> tag",
                                "Return <p>Hello, {name}!</p>"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "State & Hooks",
            "description": "Make components react over time.",
            "order": 2,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "useState",
                    "content": (
                        "<h2>Managing state</h2>"
                        "<p><code>useState</code> returns the current value and an updater. When you "
                        "call the updater, React re-renders the component with the new value.</p>"
                        "<pre><code>const [count, setCount] = useState(0);\n\n"
                        "&lt;button onClick={() =&gt; setCount(count + 1)}&gt;\n"
                        "  Count: {count}\n"
                        "&lt;/button&gt;</code></pre>"
                        "<p>A component using hooks must start its name with a capital letter and "
                        "hooks must be called at the top level &mdash; never inside loops or conditions.</p>"
                    ),
                    "code_example": (
                        "import { useState } from 'react';\n\n"
                        "function Counter() {\n"
                        "  const [count, setCount] = useState(0);\n"
                        "  return (\n"
                        "    <button onClick={() => setCount(count + 1)}>\n"
                        "      Count: {count}\n"
                        "    </button>\n"
                        "  );\n"
                        "}"
                    ),
                    "starter_code": (
                        "import { useState } from 'react';\n\n"
                        "function Counter() {\n"
                        "  // declare a count state starting at 0\n"
                        "}\n"
                    ),
                    "solution": (
                        "import { useState } from 'react';\n\n"
                        "function Counter() {\n"
                        "  const [count, setCount] = useState(0);\n"
                        "  return <p>Count: {count}</p>;\n"
                        "}"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Declare State",
                            "description": "Declare a 'count' state with useState(0) inside Counter.",
                            "starter_code": "import { useState } from 'react';\n\nfunction Counter() {\n  // const [count, setCount] = useState(0);\n}",
                            "solution": "import { useState } from 'react';\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n}",
                            "test_cases": {
                                "tests": [
                                    {"description": "Imports useState",
                                     "test": "'useState' in code"},
                                    {"description": "Declares count state",
                                     "test": "'] = useState(0)' in code and 'count' in code"},
                                    {"description": "Has a setter",
                                     "test": "'setCount' in code"}
                                ]
                            },
                            "hints": [
                                "Use array destructuring: const [count, setCount] = ...",
                                "Call useState(0) as the initial value",
                                "Format: const [count, setCount] = useState(0);"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "useEffect & Fetch",
                    "content": (
                        "<h2>Running code on render and fetching data</h2>"
                        "<p><code>useEffect</code> runs after the component renders. Pass an empty "
                        "dependency array <code>[]</code> to run once (e.g. when the page loads).</p>"
                        "<pre><code>const [user, setUser] = useState(null);\n\n"
                        "useEffect(() => {\n"
                        "  fetch('/api/user')\n"
                        "    .then(r => r.json())\n"
                        "    .then(setUser);\n"
                        "}, []);</code></pre>"
                    ),
                    "code_example": (
                        "useEffect(() => {\n"
                        "  fetch('/api/languages')\n"
                        "    .then(r => r.json())\n"
                        "    .then(setLanguages);\n"
                        "}, []);"
                    ),
                    "starter_code": (
                        "useEffect(() => {\n"
                        "  // fetch '/api/languages' and parse json\n"
                        "}, []);\n"
                    ),
                    "solution": (
                        "useEffect(() => {\n"
                        "  fetch('/api/languages')\n"
                        "    .then(r => r.json())\n"
                        "    .then(setLanguages);\n"
                        "}, []);"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Fetch on Mount",
                            "description": "Write a useEffect that fetches '/api/languages' and parses it as JSON.",
                            "starter_code": "useEffect(() => {\n  // fetch + .json() here\n}, []);",
                            "solution": "useEffect(() => {\n  fetch('/api/languages')\n    .then(r => r.json())\n    .then(setLanguages);\n}, []);",
                            "test_cases": {
                                "tests": [
                                    {"description": "Uses useEffect",
                                     "test": "'useEffect' in code"},
                                    {"description": "Fetches the endpoint",
                                     "test": "'fetch(' in code and 'api/languages' in code"},
                                    {"description": "Parses as JSON",
                                     "test": "'.json()' in code"},
                                    {"description": "Empty dependency array",
                                     "test": "', []' in code"}
                                ]
                            },
                            "hints": [
                                "Start with useEffect( () => { ... }, [])",
                                "fetch('/api/languages') then .then(r => r.json())",
                                "Pass .json() output to .then(setLanguages)"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        {
            "title": "TypeScript",
            "description": "Add types and catch bugs before they run.",
            "order": 3,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Primitives & Functions",
                    "content": (
                        "<h2>Types catch mistakes</h2>"
                        "<p>TypeScript adds type annotations you write after a colon. The compiler "
                        "checks them and complains before your code ever runs.</p>"
                        "<pre><code>const name: string = 'Ada';\n"
                        "const total: number = 42;\n\n"
                        "function add(a: number, b: number): number {\n"
                        "  return a + b;\n"
                        "}</code></pre>"
                    ),
                    "code_example": (
                        "function greet(name: string): string {\n"
                        "  return `Hello, ${name}!`;\n"
                        "}\n\n"
                        "const result: string = greet('Ada');"
                    ),
                    "starter_code": (
                        "// type the parameter and return value\n"
                        "function double(n) {\n"
                        "  return n * 2;\n"
                        "}\n"
                    ),
                    "solution": (
                        "function double(n: number): number {\n"
                        "  return n * 2;\n"
                        "}"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Type a Function",
                            "description": "Annotate double so n is a number and it returns a number.",
                            "starter_code": "function double(n) {\n  return n * 2;\n}",
                            "solution": "function double(n: number): number {\n  return n * 2;\n}",
                            "test_cases": {
                                "tests": [
                                    {"description": "Parameter is typed number",
                                     "test": "'n: number' in code"},
                                    {"description": "Return type declared",
                                     "test": "': number {' in code or '): number' in code"}
                                ]
                            },
                            "hints": [
                                "Annotate the parameter: (n: number)",
                                "Annotate the return: ): number {",
                                "Result: function double(n: number): number { ... }"
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Interfaces & Types",
                    "content": (
                        "<h2>Shape your data</h2>"
                        "<p>An <code>interface</code> describes the shape of an object. Components use "
                        "it to type their <code>props</code>.</p>"
                        "<pre><code>interface User {\n"
                        "  id: number;\n"
                        "  name: string;\n"
                        "}\n\n"
                        "function Avatar({ user }: { user: User }) {\n"
                        "  return &lt;span&gt;{user.name}&lt;/span&gt;;\n"
                        "}</code></pre>"
                        "<p>In CodeSphere each lesson, module, and language is typed with interfaces "
                        "like these before it is rendered.</p>"
                    ),
                    "code_example": (
                        "interface Lesson {\n"
                        "  id: number;\n"
                        "  title: string;\n"
                        "  xp: number;\n"
                        "}\n\n"
                        "function LessonCard({ lesson }: { lesson: Lesson }) {\n"
                        "  return <h3>{lesson.title}</h3>;\n"
                        "}"
                    ),
                    "starter_code": (
                        "interface Lesson {\n"
                        "  // add id and title fields\n"
                        "}\n"
                    ),
                    "solution": (
                        "interface Lesson {\n"
                        "  id: number;\n"
                        "  title: string;\n"
                        "}"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Define an Interface",
                            "description": "Define a Lesson interface with an 'id' number and a 'title' string.",
                            "starter_code": "interface Lesson {\n  // add id: number and title: string\n}",
                            "solution": "interface Lesson {\n  id: number;\n  title: string;\n}",
                            "test_cases": {
                                "tests": [
                                    {"description": "Declares an interface",
                                     "test": "'interface Lesson' in code"},
                                    {"description": "Has an id number field",
                                     "test": "'id: number' in code"},
                                    {"description": "Has a title string field",
                                     "test": "'title: string' in code"}
                                ]
                            },
                            "hints": [
                                "interface Lesson { ... }",
                                "Add id: number;",
                                "Add title: string;"
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_react_track():
    """Add the React & TypeScript track if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == REACT_TRACK["slug"])
        )
        if existing.scalars().first():
            print("React & TypeScript track already exists; nothing to do.")
            return

        language = Language(
            name=REACT_TRACK["name"],
            slug=REACT_TRACK["slug"],
            icon=REACT_TRACK["icon"],
            description=REACT_TRACK["description"],
            color=REACT_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in REACT_TRACK["modules"]:
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
        print("React & TypeScript track seeded successfully!")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_react_track()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
