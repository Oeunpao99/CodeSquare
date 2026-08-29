from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import Language, Module, Lesson, Exercise
from database import async_session
import json

async def seed_database():
    async with async_session() as db:
        existing = await db.execute(select(Language))
        if existing.scalars().first():
            print("Database already seeded")
            return
        
        languages = [
            {
                "name": "Python",
                "slug": "python",
                "icon": "🐍",
                "description": "Beginner-friendly language perfect for learning programming fundamentals",
                "color": "#3776AB",
                "modules": [
                    {
                        "title": "Python Basics",
                        "description": "Start your Python journey",
                        "order": 1,
                        "difficulty": "beginner",
                        "lessons": [
                            {
                                "title": "What is a Variable?",
                                "content": """<h2>Understanding Variables</h2>
<p>Variables are like labeled boxes that store information. Think of them as containers with names.</p>
<h3>Key Concepts:</h3>
<ul>
<li>Variables hold values (numbers, text, etc.)</li>
<li>Every variable has a name</li>
<li>You can change what's stored in a variable</li>
</ul>
<h3>Example:</h3>""",
                                "code_example": "# Creating variables\nname = \"Alice\"\nage = 25\nheight = 5.6\n\nprint(f\"Hi, I'm {name}!\")\nprint(f\"I'm {age} years old\")\nprint(f\"I'm {height} feet tall\")",
                                "starter_code": "# Create your first variable!\n# Store your name in a variable called 'my_name'\n\nmy_name = \"\"\nprint(\"Hello from\", my_name)",
                                "solution": "my_name = \"Your Name\"\nprint(\"Hello from\", my_name)",
                                "order": 1,
                                "xp_reward": 10,
                                "exercises": [
                                    {
                                        "title": "Create Your First Variable",
                                        "description": "Create a variable called 'age' and store your age in it. Then print a message using that variable.",
                                        "starter_code": "# Create a variable called 'age'\nage = \n\n# Print your age\nprint(\"I am\", age, \"years old\")",
                                        "solution": "age = 25\nprint(\"I am\", age, \"years old\")",
                                        "test_cases": {
                                            "tests": [
                                                {
                                                    "description": "Variable 'age' exists and has a value",
                                                    "test": "assert 'age' in dir() and age > 0"
                                                },
                                                {
                                                    "description": "Print statement works",
                                                    "test": "assert isinstance(age, int) and age > 0"
                                                }
                                            ]
                                        },
                                        "hints": [
                                            "A variable is created with the = sign",
                                            "Put a number after the = sign, like age = 25",
                                            "The print() function displays text on screen"
                                        ],
                                        "order": 1
                                    }
                                ]
                            },
                            {
                                "title": "Data Types",
                                "content": """<h2>Python Data Types</h2>
<p>Python has several types of data. The main ones you'll use are:</p>
<ul>
<li><strong>Strings (str)</strong>: Text wrapped in quotes</li>
<li><strong>Integers (int)</strong>: Whole numbers</li>
<li><strong>Floats (float)</strong>: Numbers with decimals</li>
<li><strong>Booleans (bool)</strong>: True or False</li>
</ul>""",
                                "code_example": "# Different data types\ntext = \"Hello\"        # String\nwhole = 42            # Integer\ndecimal = 3.14        # Float\nis_cool = True        # Boolean\n\nprint(type(text))\nprint(type(whole))\nprint(type(decimal))\nprint(type(is_cool))",
                                "starter_code": "# Create one of each data type\nmy_string = \nmy_integer = \nmy_float = \nmy_boolean = \n\n# Check the types\nprint(type(my_string))\nprint(type(my_integer))",
                                "solution": "my_string = \"Hello\"\nmy_integer = 42\nmy_float = 3.14\nmy_boolean = True\n\nprint(type(my_string))\nprint(type(my_integer))",
                                "order": 2,
                                "xp_reward": 15,
                                "exercises": [
                                    {
                                        "title": "Type Explorer",
                                        "description": "Create variables of each type and use type() to verify them.",
                                        "starter_code": "# Create a string variable\nmy_text = \n\n# Create an integer variable\nmy_number = \n\n# Print their types\nprint(type(my_text))\nprint(type(my_number))",
                                        "solution": "my_text = \"Hello World\"\nmy_number = 100\n\nprint(type(my_text))\nprint(type(my_number))",
                                        "test_cases": {
                                            "tests": [
                                                {
                                                    "description": "String variable exists",
                                                    "test": "assert isinstance(my_text, str)"
                                                },
                                                {
                                                    "description": "Integer variable exists",
                                                    "test": "assert isinstance(my_number, int)"
                                                }
                                            ]
                                        },
                                        "hints": [
                                            "Use quotes for strings: \"hello\"",
                                            "Numbers without quotes are integers: 42",
                                            "type() tells you what type a variable is"
                                        ],
                                        "order": 1
                                    }
                                ]
                            },
                            {
                                "title": "Basic Math Operations",
                                "content": """<h2>Math in Python</h2>
<p>Python can do all kinds of math!</p>
<h3>Operators:</h3>
<ul>
<li><code>+</code> Addition</li>
<li><code>-</code> Subtraction</li>
<li><code>*</code> Multiplication</li>
<li><code>/</code> Division</li>
<li><code>%</code> Modulo (remainder)</li>
<li><code>**</code> Power</li>
</ul>""",
                                "code_example": "# Math operations\na = 10\nb = 3\n\nprint(f\"Add: {a + b}\")\nprint(f\"Subtract: {a - b}\")\nprint(f\"Multiply: {a * b}\")\nprint(f\"Divide: {a / b}\")\nprint(f\"Remainder: {a % b}\")\nprint(f\"Power: {a ** b}\")",
                                "starter_code": "# Calculate the area of a rectangle\nwidth = 10\nheight = 5\n\narea = \nprint(\"Area is:\", area)",
                                "solution": "width = 10\nheight = 5\n\narea = width * height\nprint(\"Area is:\", area)",
                                "order": 3,
                                "xp_reward": 15,
                                "exercises": [
                                    {
                                        "title": "Calculate Area",
                                        "description": "Calculate the area of a rectangle with width 10 and height 5.",
                                        "starter_code": "width = 10\nheight = 5\n\n# Calculate area using multiplication\narea = \n\nprint(\"The area is:\", area)",
                                        "solution": "width = 10\nheight = 5\n\narea = width * height\nprint(\"The area is:\", area)",
                                        "test_cases": {
                                            "tests": [
                                                {
                                                    "description": "Area is calculated correctly",
                                                    "test": "assert area == 50"
                                                }
                                            ]
                                        },
                                        "hints": [
                                            "Area = width × height",
                                            "Use the * operator for multiplication",
                                            "area = width * height"
                                        ],
                                        "order": 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "name": "JavaScript",
                "slug": "javascript",
                "icon": "⚡",
                "description": "The language of the web - build interactive websites and applications",
                "color": "#F7DF1E",
                "modules": [
                    {
                        "title": "JavaScript Fundamentals",
                        "description": "Learn the building blocks of JavaScript",
                        "order": 1,
                        "difficulty": "beginner",
                        "lessons": [
                            {
                                "title": "Variables in JavaScript",
                                "content": """<h2>JavaScript Variables</h2>
<p>In JavaScript, we use <code>let</code>, <code>const</code>, and <code>var</code> to create variables.</p>
<h3>Key Differences:</h3>
<ul>
<li><code>let</code>: Can be changed later</li>
<li><code>const</code>: Cannot be changed (constant)</li>
<li><code>var</code>: Old way, avoid using it</li>
</ul>""",
                                "code_example": "// Creating variables\nlet name = \"Alice\";\nconst age = 25;\nlet height = 5.6;\n\nconsole.log(`Hi, I'm ${name}!`);\nconsole.log(`I'm ${age} years old`);",
                                "starter_code": "// Create a variable with let\nlet myName = \"\";\n\n// Create a constant\nconst MY_AGE = ;\n\nconsole.log(\"Hello from\", myName);",
                                "solution": "let myName = \"Your Name\";\nconst MY_AGE = 25;\n\nconsole.log(\"Hello from\", myName);",
                                "order": 1,
                                "xp_reward": 10,
                                "exercises": [
                                    {
                                        "title": "Your First Variables",
                                        "description": "Create variables using let and const to store information about yourself.",
                                        "starter_code": "// Create a let variable for your name\nlet name = ;\n\n// Create a const for your age\nconst age = ;\n\nconsole.log(name, \"is\", age, \"years old\");",
                                        "solution": "let name = \"Alice\";\nconst age = 25;\n\nconsole.log(name, \"is\", age, \"years old\");",
                                        "test_cases": {
                                            "tests": [
                                                {
                                                    "description": "Name variable exists",
                                                    "test": "typeof name === 'string' && name.length > 0"
                                                },
                                                {
                                                    "description": "Age variable exists",
                                                    "test": "typeof age === 'number' && age > 0"
                                                }
                                            ]
                                        },
                                        "hints": [
                                            "Use let for things that change",
                                            "Use const for things that stay the same",
                                            "Strings need quotes: \"hello\""
                                        ],
                                        "order": 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "name": "HTML & CSS",
                "slug": "html-css",
                "icon": "🎨",
                "description": "Build beautiful websites with structure and style",
                "color": "#E34F26",
                "modules": [
                    {
                        "title": "HTML Basics",
                        "description": "Learn the structure of web pages",
                        "order": 1,
                        "difficulty": "beginner",
                        "lessons": [
                            {
                                "title": "Your First HTML Page",
                                "content": """<h2>HTML - The Building Blocks</h2>
<p>HTML (HyperText Markup Language) is how we structure web content.</p>
<h3>Basic Structure:</h3>
<pre><code>&lt;!DOCTYPE html&gt;
&lt;html&gt;
  &lt;head&gt;
    &lt;title&gt;My Page&lt;/title&gt;
  &lt;/head&gt;
  &lt;body&gt;
    &lt;h1&gt;Hello World&lt;/h1&gt;
  &lt;/body&gt;
&lt;/html&gt;</code></pre>""",
                                "code_example": "<!DOCTYPE html>\n<html>\n<head>\n    <title>My First Page</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n    <p>This is my first web page.</p>\n</body>\n</html>",
                                "starter_code": "<!DOCTYPE html>\n<html>\n<head>\n    <title>My Page</title>\n</head>\n<body>\n    <!-- Add your heading here -->\n    \n</body>\n</html>",
                                "solution": "<!DOCTYPE html>\n<html>\n<head>\n    <title>My Page</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>",
                                "order": 1,
                                "xp_reward": 10,
                                "exercises": [
                                    {
                                        "title": "Create a Heading",
                                        "description": "Add an h1 heading that says 'Welcome to My Website'",
                                        "starter_code": "<!DOCTYPE html>\n<html>\n<body>\n    <!-- Add your h1 heading here -->\n    \n</body>\n</html>",
                                        "solution": "<!DOCTYPE html>\n<html>\n<body>\n    <h1>Welcome to My Website</h1>\n</body>\n</html>",
                                        "test_cases": {
                                            "tests": [
                                                {
                                                    "description": "Contains h1 tag",
                                                    "test": "'<h1>' in code and '</h1>' in code"
                                                },
                                                {
                                                    "description": "Has correct text",
                                                    "test": "'Welcome to My Website' in code"
                                                }
                                            ]
                                        },
                                        "hints": [
                                            "HTML tags come in pairs: <tag>content</tag>",
                                            "h1 is the biggest heading",
                                            "Put the text between <h1> and </h1>"
                                        ],
                                        "order": 1
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
        
        for lang_data in languages:
            language = Language(
                name=lang_data["name"],
                slug=lang_data["slug"],
                icon=lang_data["icon"],
                description=lang_data["description"],
                color=lang_data["color"]
            )
            db.add(language)
            await db.flush()
            
            for mod_data in lang_data.get("modules", []):
                module = Module(
                    language_id=language.id,
                    title=mod_data["title"],
                    description=mod_data["description"],
                    order=mod_data["order"],
                    difficulty=mod_data["difficulty"]
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
                        xp_reward=lesson_data["xp_reward"]
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
                            order=ex_data["order"]
                        )
                        db.add(exercise)
        
        await db.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_database())