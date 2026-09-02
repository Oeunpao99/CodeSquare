"""Seed the 'AI & LLM Engineering' track — the practical LLM-application stack an
AI Engineer needs on top of Python + backend foundations.

6 modules, beginner -> advanced, mirroring the house style (2 lessons/module,
one code exercise each, graded by the same substring harness the other tracks
use):

  1. LLM Foundations           tokens, context, temperature, first API call
  2. Prompting & Structured Output   roles, few-shot, JSON output + validation
  3. Tool Use & Agents         function-calling schema, a bounded agent loop
  4. Embeddings & RAG          similarity, chunk -> embed -> retrieve -> ground
  5. Evaluating LLM Output     golden sets, accuracy, LLM-as-judge
  6. Guardrails & Serving      injection defense, cost/latency, model routing

Idempotent: skips if the track already exists.

    ./.venv/Scripts/python.exe seed_ai_llm.py
    ./.venv/Scripts/python.exe retag_curriculum.py   # normalise the module ladder
"""
from sqlalchemy import select

from database import async_session
from models.models import Language, Module, Lesson, Exercise


def _p(*parts: str) -> str:
    return "".join(parts)


AI_LLM_TRACK = {
    "name": "AI & LLM Engineering",
    "slug": "ai-llm",
    "icon": "🤖",
    "description": (
        "The practical side of shipping AI features: talk to model APIs, get "
        "structured output, wire up tools, build RAG, evaluate results and serve "
        "it safely."
    ),
    "color": "#22D3EE",
    "modules": [
        # ---------------------------------------------------------------- #
        {
            "title": "LLM Foundations",
            "description": "What a language model actually does, and how to call one.",
            "order": 1,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "How a Language Model Works",
                    "content": _p(
                        "<h2>Predicting the next token</h2>",
                        "<p>A large language model (LLM) reads your text as a list of "
                        "<strong>tokens</strong> (word pieces) and repeatedly predicts the most "
                        "likely next token. Everything else &mdash; answering, summarising, writing "
                        "code &mdash; is that one trick applied in a loop.</p>",
                        "<ul>",
                        "<li><strong>Context window</strong> &mdash; the maximum tokens (prompt + "
                        "reply) the model can consider at once. Go over it and the oldest text is "
                        "dropped.</li>",
                        "<li><strong>Temperature</strong> &mdash; 0 is near-deterministic and focused; "
                        "higher (0.7&ndash;1.0) is more varied and creative.</li>",
                        "<li><strong>Hallucination</strong> &mdash; the model always produces "
                        "<em>plausible</em> text, even when it has no grounding for it. That is why "
                        "retrieval and evaluation (later modules) matter.</li>",
                        "</ul>",
                        "<pre><code>params = {\n"
                        "    \"model\": \"claude-sonnet-5\",\n"
                        "    \"temperature\": 0.2,   # focused, mostly repeatable\n"
                        "    \"max_tokens\": 500,    # cap the reply length + cost\n"
                        "}</code></pre>",
                    ),
                    "code_example": (
                        "params = {\n"
                        "    \"model\": \"claude-sonnet-5\",\n"
                        "    \"temperature\": 0.2,\n"
                        "    \"max_tokens\": 500,\n"
                        "}"
                    ),
                    "starter_code": (
                        "# Build a params dict for a focused, length-capped reply.\n"
                        "params = {\n"
                        "    \"model\": \"claude-sonnet-5\",\n"
                        "    # set temperature to 0.2\n"
                        "    # set max_tokens to 500\n"
                        "}\n"
                    ),
                    "solution": (
                        "params = {\n"
                        "    \"model\": \"claude-sonnet-5\",\n"
                        "    \"temperature\": 0.2,\n"
                        "    \"max_tokens\": 500,\n"
                        "}"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Request Parameters",
                            "description": "Finish params so temperature is 0.2 and max_tokens is 500.",
                            "starter_code": (
                                "params = {\n"
                                "    \"model\": \"claude-sonnet-5\",\n"
                                "    # add temperature and max_tokens\n"
                                "}"
                            ),
                            "solution": (
                                "params = {\n"
                                "    \"model\": \"claude-sonnet-5\",\n"
                                "    \"temperature\": 0.2,\n"
                                "    \"max_tokens\": 500,\n"
                                "}"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Sets a low temperature",
                                     "test": "'\"temperature\": 0.2' in code or \"'temperature': 0.2\" in code"},
                                    {"description": "Caps the reply length",
                                     "test": "'max_tokens' in code and '500' in code"},
                                    {"description": "Keeps the model key",
                                     "test": "'model' in code"},
                                ]
                            },
                            "hints": [
                                "Add a key \"temperature\" with the value 0.2",
                                "Add a key \"max_tokens\" with the value 500",
                                "Both go inside the { } as \"key\": value pairs",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Your First Chat Call",
                    "content": _p(
                        "<h2>Messages have roles</h2>",
                        "<p>Chat APIs take a <strong>list of messages</strong>, each with a "
                        "<code>role</code> and <code>content</code>:</p>",
                        "<ul>",
                        "<li><code>system</code> &mdash; standing instructions: who the assistant is, "
                        "format rules, tone. Sent once, at the top.</li>",
                        "<li><code>user</code> &mdash; what the person asked.</li>",
                        "<li><code>assistant</code> &mdash; the model's previous replies (you resend "
                        "them to keep the conversation going).</li>",
                        "</ul>",
                        "<pre><code>messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"You are a concise Python tutor.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"What is a list comprehension?\"},\n"
                        "]\n"
                        "reply = client.chat(messages=messages)      # -> assistant text</code></pre>",
                        "<p>The model is stateless: it only knows what is in <code>messages</code>. "
                        "Memory = you resending the history.</p>",
                    ),
                    "code_example": (
                        "messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"You are a concise Python tutor.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"What is a list comprehension?\"},\n"
                        "]"
                    ),
                    "starter_code": (
                        "# Build the messages list: a system instruction + the user's question.\n"
                        "messages = [\n"
                        "    # {\"role\": \"system\", \"content\": \"...\"},\n"
                        "    # {\"role\": \"user\", \"content\": \"...\"},\n"
                        "]\n"
                    ),
                    "solution": (
                        "messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"You are a concise Python tutor.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"What is a list comprehension?\"},\n"
                        "]"
                    ),
                    "order": 2,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Compose Messages",
                            "description": "Create messages with one system message and one user message, each a dict with role and content.",
                            "starter_code": "messages = [\n    # add a system dict and a user dict\n]",
                            "solution": (
                                "messages = [\n"
                                "    {\"role\": \"system\", \"content\": \"You are a concise Python tutor.\"},\n"
                                "    {\"role\": \"user\", \"content\": \"What is a list comprehension?\"},\n"
                                "]"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Has a system message",
                                     "test": "'\"role\": \"system\"' in code or \"'role': 'system'\" in code"},
                                    {"description": "Has a user message",
                                     "test": "'\"role\": \"user\"' in code or \"'role': 'user'\" in code"},
                                    {"description": "Every message carries content",
                                     "test": "code.count('content') >= 2"},
                                ]
                            },
                            "hints": [
                                "Each item is a dict: {\"role\": ..., \"content\": ...}",
                                "The first role is \"system\", the second is \"user\"",
                                "Separate the two dicts with a comma",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Prompting & Structured Output",
            "description": "Steer the model, and get back data you can parse.",
            "order": 2,
            "difficulty": "beginner",
            "lessons": [
                {
                    "title": "System Prompts & Few-Shot",
                    "content": _p(
                        "<h2>Show, don't just tell</h2>",
                        "<p>Two levers move quality the most:</p>",
                        "<ol>",
                        "<li>A specific <strong>system prompt</strong> &mdash; role, rules, output "
                        "format, what <em>not</em> to do.</li>",
                        "<li><strong>Few-shot examples</strong> &mdash; a couple of "
                        "<code>user</code> &rarr; <code>assistant</code> pairs showing the exact "
                        "shape you want. The model copies the pattern.</li>",
                        "</ol>",
                        "<pre><code>messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"Label the sentiment as POSITIVE or NEGATIVE. One word.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"The build finally passed!\"},\n"
                        "    {\"role\": \"assistant\", \"content\": \"POSITIVE\"},\n"
                        "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                        "]</code></pre>",
                        "<p>The last <code>user</code> turn is the real request; the pair before it "
                        "is the example.</p>",
                    ),
                    "code_example": (
                        "messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"Label sentiment: POSITIVE or NEGATIVE. One word.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"The build finally passed!\"},\n"
                        "    {\"role\": \"assistant\", \"content\": \"POSITIVE\"},\n"
                        "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                        "]"
                    ),
                    "starter_code": (
                        "# Add one few-shot example (a user turn + the assistant answer)\n"
                        "# before the final user turn.\n"
                        "messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"Label sentiment: POSITIVE or NEGATIVE. One word.\"},\n"
                        "    # example pair here\n"
                        "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                        "]\n"
                    ),
                    "solution": (
                        "messages = [\n"
                        "    {\"role\": \"system\", \"content\": \"Label sentiment: POSITIVE or NEGATIVE. One word.\"},\n"
                        "    {\"role\": \"user\", \"content\": \"The build finally passed!\"},\n"
                        "    {\"role\": \"assistant\", \"content\": \"POSITIVE\"},\n"
                        "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                        "]"
                    ),
                    "order": 1,
                    "xp_reward": 15,
                    "exercises": [
                        {
                            "title": "Add a Few-Shot Example",
                            "description": "The messages list must include an assistant turn and at least two user turns (one example, one real).",
                            "starter_code": (
                                "messages = [\n"
                                "    {\"role\": \"system\", \"content\": \"Label sentiment: POSITIVE or NEGATIVE.\"},\n"
                                "    # add an example user turn + assistant turn\n"
                                "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                                "]"
                            ),
                            "solution": (
                                "messages = [\n"
                                "    {\"role\": \"system\", \"content\": \"Label sentiment: POSITIVE or NEGATIVE.\"},\n"
                                "    {\"role\": \"user\", \"content\": \"The build finally passed!\"},\n"
                                "    {\"role\": \"assistant\", \"content\": \"POSITIVE\"},\n"
                                "    {\"role\": \"user\", \"content\": \"It crashed again on startup.\"},\n"
                                "]"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Includes an assistant example",
                                     "test": "'assistant' in code"},
                                    {"description": "Has two user turns (example + real)",
                                     "test": "code.count('\"role\": \"user\"') >= 2 or code.count(\"'role': 'user'\") >= 2"},
                                    {"description": "Keeps the system instruction",
                                     "test": "'system' in code"},
                                ]
                            },
                            "hints": [
                                "Insert a {\"role\": \"user\", ...} then a {\"role\": \"assistant\", ...}",
                                "The assistant example is the answer you want copied, e.g. \"POSITIVE\"",
                                "Leave the final user turn as the real request",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Getting JSON Back",
                    "content": _p(
                        "<h2>Parse, then trust</h2>",
                        "<p>To use a reply in code, ask for <strong>JSON only</strong> and validate "
                        "it &mdash; the model can still return malformed or incomplete data.</p>",
                        "<pre><code>import json\n\n"
                        "SYSTEM = 'Reply with JSON only: {\"summary\": string, \"tags\": string[]}'\n\n"
                        "raw = client.chat(messages=[...])          # the model's text\n"
                        "data = json.loads(raw)                     # may raise ValueError\n\n"
                        "if \"summary\" not in data:\n"
                        "    raise ValueError(\"missing summary\")   # guard before using it</code></pre>",
                        "<p>Real systems wrap <code>json.loads</code> in <code>try/except</code> and "
                        "retry once with an error note. Many APIs also have a native "
                        "&ldquo;JSON mode&rdquo; that guarantees valid JSON syntax &mdash; but not "
                        "that the <em>fields</em> are right, so you still check.</p>",
                    ),
                    "code_example": (
                        "import json\n\n"
                        "data = json.loads(raw)\n"
                        "if \"summary\" not in data:\n"
                        "    raise ValueError(\"missing summary\")"
                    ),
                    "starter_code": (
                        "import json\n\n"
                        "raw = '{\"summary\": \"ok\", \"tags\": [\"build\"]}'\n"
                        "# parse raw into data, then raise ValueError if 'summary' is missing\n"
                    ),
                    "solution": (
                        "import json\n\n"
                        "raw = '{\"summary\": \"ok\", \"tags\": [\"build\"]}'\n"
                        "data = json.loads(raw)\n"
                        "if \"summary\" not in data:\n"
                        "    raise ValueError(\"missing summary\")"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Parse and Validate",
                            "description": "Parse raw with json.loads into data, then raise ValueError when the 'summary' key is absent.",
                            "starter_code": (
                                "import json\n\n"
                                "raw = '{\"summary\": \"ok\", \"tags\": []}'\n"
                                "# data = ...\n"
                                "# if ...: raise ValueError(...)\n"
                            ),
                            "solution": (
                                "import json\n\n"
                                "raw = '{\"summary\": \"ok\", \"tags\": []}'\n"
                                "data = json.loads(raw)\n"
                                "if \"summary\" not in data:\n"
                                "    raise ValueError(\"missing summary\")"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Parses the JSON string",
                                     "test": "'json.loads(' in code"},
                                    {"description": "Checks the summary key",
                                     "test": "'summary' in code and 'not in' in code"},
                                    {"description": "Raises on bad data",
                                     "test": "'raise ValueError' in code"},
                                ]
                            },
                            "hints": [
                                "data = json.loads(raw)",
                                "if \"summary\" not in data:",
                                "    raise ValueError(\"missing summary\")",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Tool Use & Agents",
            "description": "Let the model call your code, in a loop you control.",
            "order": 3,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Function Calling",
                    "content": _p(
                        "<h2>Describe a tool, the model asks to use it</h2>",
                        "<p>You give the model a <strong>tool schema</strong> &mdash; a name, a "
                        "description, and a JSON-Schema for its arguments. When the model decides it "
                        "needs that tool, it returns a structured call (<em>not</em> prose); you run "
                        "the real function and hand back the result.</p>",
                        "<pre><code>weather_tool = {\n"
                        "    \"name\": \"get_weather\",\n"
                        "    \"description\": \"Current weather for a city.\",\n"
                        "    \"parameters\": {\n"
                        "        \"type\": \"object\",\n"
                        "        \"properties\": {\n"
                        "            \"city\": {\"type\": \"string\"}\n"
                        "        },\n"
                        "        \"required\": [\"city\"],\n"
                        "    },\n"
                        "}</code></pre>",
                        "<p>The description and field names <em>are</em> the prompt for the tool "
                        "&mdash; write them for a reader who only sees the schema.</p>",
                    ),
                    "code_example": (
                        "weather_tool = {\n"
                        "    \"name\": \"get_weather\",\n"
                        "    \"description\": \"Current weather for a city.\",\n"
                        "    \"parameters\": {\n"
                        "        \"type\": \"object\",\n"
                        "        \"properties\": {\"city\": {\"type\": \"string\"}},\n"
                        "        \"required\": [\"city\"],\n"
                        "    },\n"
                        "}"
                    ),
                    "starter_code": (
                        "# Complete the tool schema: name it get_weather and give it\n"
                        "# a required string parameter called city.\n"
                        "weather_tool = {\n"
                        "    \"name\": \"\",\n"
                        "    \"description\": \"Current weather for a city.\",\n"
                        "    \"parameters\": {\n"
                        "        \"type\": \"object\",\n"
                        "        \"properties\": {},\n"
                        "        \"required\": [],\n"
                        "    },\n"
                        "}\n"
                    ),
                    "solution": (
                        "weather_tool = {\n"
                        "    \"name\": \"get_weather\",\n"
                        "    \"description\": \"Current weather for a city.\",\n"
                        "    \"parameters\": {\n"
                        "        \"type\": \"object\",\n"
                        "        \"properties\": {\"city\": {\"type\": \"string\"}},\n"
                        "        \"required\": [\"city\"],\n"
                        "    },\n"
                        "}"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Define a Tool Schema",
                            "description": "weather_tool must be named get_weather and declare a string 'city' argument in an object schema.",
                            "starter_code": (
                                "weather_tool = {\n"
                                "    \"name\": \"\",\n"
                                "    \"parameters\": {\"type\": \"object\", \"properties\": {}},\n"
                                "}"
                            ),
                            "solution": (
                                "weather_tool = {\n"
                                "    \"name\": \"get_weather\",\n"
                                "    \"parameters\": {\n"
                                "        \"type\": \"object\",\n"
                                "        \"properties\": {\"city\": {\"type\": \"string\"}},\n"
                                "        \"required\": [\"city\"],\n"
                                "    },\n"
                                "}"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Named get_weather",
                                     "test": "'\"name\": \"get_weather\"' in code or \"'name': 'get_weather'\" in code"},
                                    {"description": "Object-typed parameters",
                                     "test": "'\"type\": \"object\"' in code or \"'type': 'object'\" in code"},
                                    {"description": "Has a string city property",
                                     "test": "'city' in code and 'string' in code"},
                                ]
                            },
                            "hints": [
                                "Set \"name\" to \"get_weather\"",
                                "Under properties add \"city\": {\"type\": \"string\"}",
                                "List \"city\" in the \"required\" array",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "A Bounded Agent Loop",
                    "content": _p(
                        "<h2>Loop: think &rarr; act &rarr; observe</h2>",
                        "<p>An &ldquo;agent&rdquo; is just a loop: ask the model, if it requested a "
                        "tool run it and feed the result back, repeat until the model says it is "
                        "done. The one rule: <strong>always cap the iterations</strong> so a "
                        "confused model can't spin forever (and run up cost).</p>",
                        "<pre><code>MAX_STEPS = 6\n\n"
                        "for step in range(MAX_STEPS):\n"
                        "    resp = model.run(messages)\n"
                        "    if resp.get(\"done\"):\n"
                        "        break\n"
                        "    result = run_tool(resp[\"tool_call\"])\n"
                        "    messages.append({\"role\": \"tool\", \"content\": result})\n"
                        "else:\n"
                        "    raise RuntimeError(\"agent did not finish in time\")</code></pre>",
                        "<p>The <code>for/else</code> runs the <code>else</code> only if the loop "
                        "ended without <code>break</code> &mdash; a clean &ldquo;ran out of "
                        "steps&rdquo; signal.</p>",
                    ),
                    "code_example": (
                        "MAX_STEPS = 6\n"
                        "for step in range(MAX_STEPS):\n"
                        "    resp = model.run(messages)\n"
                        "    if resp.get(\"done\"):\n"
                        "        break"
                    ),
                    "starter_code": (
                        "MAX_STEPS = 6\n"
                        "# loop at most MAX_STEPS times; break when resp.get('done') is truthy\n"
                        "for step in range(MAX_STEPS):\n"
                        "    resp = model.run(messages)\n"
                        "    # ...\n"
                    ),
                    "solution": (
                        "MAX_STEPS = 6\n"
                        "for step in range(MAX_STEPS):\n"
                        "    resp = model.run(messages)\n"
                        "    if resp.get(\"done\"):\n"
                        "        break"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Cap the Iterations",
                            "description": "Loop over range(MAX_STEPS) and break out when resp.get('done') is truthy.",
                            "starter_code": (
                                "MAX_STEPS = 6\n"
                                "for step in range(MAX_STEPS):\n"
                                "    resp = model.run(messages)\n"
                                "    # break when done\n"
                            ),
                            "solution": (
                                "MAX_STEPS = 6\n"
                                "for step in range(MAX_STEPS):\n"
                                "    resp = model.run(messages)\n"
                                "    if resp.get(\"done\"):\n"
                                "        break"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Bounded by MAX_STEPS",
                                     "test": "'range(MAX_STEPS)' in code"},
                                    {"description": "Checks a done flag",
                                     "test": "'done' in code"},
                                    {"description": "Exits the loop",
                                     "test": "'break' in code"},
                                ]
                            },
                            "hints": [
                                "Use for step in range(MAX_STEPS):",
                                "Inside: if resp.get(\"done\"):",
                                "        break",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Embeddings & RAG",
            "description": "Ground answers in your own documents.",
            "order": 4,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Embeddings & Similarity",
                    "content": _p(
                        "<h2>Text as a vector</h2>",
                        "<p>An <strong>embedding</strong> model turns a piece of text into a list of "
                        "numbers (a vector) so that <em>similar meaning</em> &rarr; <em>nearby "
                        "vectors</em>. You compare two vectors with <strong>cosine similarity</strong> "
                        "&mdash; the cosine of the angle between them, from -1 (opposite) to 1 "
                        "(identical direction).</p>",
                        "<pre><code>from math import sqrt\n\n"
                        "def cosine(a, b):\n"
                        "    dot = sum(x * y for x, y in zip(a, b))\n"
                        "    na = sqrt(sum(x * x for x in a))\n"
                        "    nb = sqrt(sum(y * y for y in b))\n"
                        "    return dot / (na * nb)</code></pre>",
                        "<p>Search = embed the query once, then rank stored chunks by "
                        "<code>cosine(query_vec, chunk_vec)</code>. A vector database (pgvector, "
                        "FAISS) just does this ranking fast over millions of rows.</p>",
                    ),
                    "code_example": (
                        "from math import sqrt\n\n"
                        "def cosine(a, b):\n"
                        "    dot = sum(x * y for x, y in zip(a, b))\n"
                        "    return dot / (sqrt(sum(x*x for x in a)) * sqrt(sum(y*y for y in b)))"
                    ),
                    "starter_code": (
                        "from math import sqrt\n\n"
                        "def cosine(a, b):\n"
                        "    # dot product of a and b, divided by the product of their magnitudes\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "from math import sqrt\n\n"
                        "def cosine(a, b):\n"
                        "    dot = sum(x * y for x, y in zip(a, b))\n"
                        "    na = sqrt(sum(x * x for x in a))\n"
                        "    nb = sqrt(sum(y * y for y in b))\n"
                        "    return dot / (na * nb)"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Cosine Similarity",
                            "description": "Implement cosine(a, b): dot product over the product of the two magnitudes.",
                            "starter_code": (
                                "from math import sqrt\n\n"
                                "def cosine(a, b):\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "from math import sqrt\n\n"
                                "def cosine(a, b):\n"
                                "    dot = sum(x * y for x, y in zip(a, b))\n"
                                "    na = sqrt(sum(x * x for x in a))\n"
                                "    nb = sqrt(sum(y * y for y in b))\n"
                                "    return dot / (na * nb)"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Defines cosine(a, b)",
                                     "test": "'def cosine(a, b)' in code"},
                                    {"description": "Pairs the values with zip",
                                     "test": "'zip(a, b)' in code"},
                                    {"description": "Normalises by magnitude",
                                     "test": "'sqrt(' in code or '** 0.5' in code or '**0.5' in code"},
                                    {"description": "Returns a ratio",
                                     "test": "'return' in code and '/' in code"},
                                ]
                            },
                            "hints": [
                                "dot = sum(x * y for x, y in zip(a, b))",
                                "magnitude of a = sqrt(sum(x * x for x in a))",
                                "return dot / (na * nb)",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Retrieval-Augmented Generation",
                    "content": _p(
                        "<h2>Chunk &rarr; embed &rarr; retrieve &rarr; ground</h2>",
                        "<p>RAG stops the model guessing by putting the <em>right source text</em> "
                        "into the prompt:</p>",
                        "<ol>",
                        "<li><strong>Chunk</strong> your docs into passages (a few hundred tokens).</li>",
                        "<li><strong>Embed</strong> every chunk once, store the vectors.</li>",
                        "<li><strong>Retrieve</strong> the top-k chunks nearest the question.</li>",
                        "<li><strong>Ground</strong>: paste those chunks into the prompt and tell the "
                        "model to answer <em>only</em> from them, with citations.</li>",
                        "</ol>",
                        "<pre><code>def retrieve(query_vec, chunks, k=3):\n"
                        "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                        "    scored.sort(key=lambda p: p[0], reverse=True)\n"
                        "    return [c for _, c in scored[:k]]</code></pre>",
                        "<p>If retrieval returns nothing relevant, the right answer is &ldquo;I don't "
                        "know&rdquo; &mdash; say so in the system prompt.</p>",
                    ),
                    "code_example": (
                        "def retrieve(query_vec, chunks, k=3):\n"
                        "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                        "    scored.sort(key=lambda p: p[0], reverse=True)\n"
                        "    return [c for _, c in scored[:k]]"
                    ),
                    "starter_code": (
                        "def retrieve(query_vec, chunks, k=3):\n"
                        "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                        "    # sort by score, highest first, then return the top k chunks\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def retrieve(query_vec, chunks, k=3):\n"
                        "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                        "    scored.sort(key=lambda p: p[0], reverse=True)\n"
                        "    return [c for _, c in scored[:k]]"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Top-K Retrieval",
                            "description": "Sort scored by score descending and return the chunks of the first k pairs.",
                            "starter_code": (
                                "def retrieve(query_vec, chunks, k=3):\n"
                                "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "def retrieve(query_vec, chunks, k=3):\n"
                                "    scored = [(cosine(query_vec, c.vec), c) for c in chunks]\n"
                                "    scored.sort(key=lambda p: p[0], reverse=True)\n"
                                "    return [c for _, c in scored[:k]]"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Sorts the scored pairs",
                                     "test": "'.sort(' in code or 'sorted(' in code"},
                                    {"description": "Highest score first",
                                     "test": "'reverse=True' in code"},
                                    {"description": "Keeps only k",
                                     "test": "'[:k]' in code"},
                                    {"description": "Returns chunks, not score pairs",
                                     "test": "'return' in code"},
                                ]
                            },
                            "hints": [
                                "scored.sort(key=lambda p: p[0], reverse=True)",
                                "Slice the first k: scored[:k]",
                                "Return [c for _, c in scored[:k]]",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Evaluating LLM Output",
            "description": "Measure quality so you can change prompts without fear.",
            "order": 5,
            "difficulty": "intermediate",
            "lessons": [
                {
                    "title": "Build an Eval Set",
                    "content": _p(
                        "<h2>Golden examples turn vibes into a number</h2>",
                        "<p>Collect 20&ndash;100 <strong>cases</strong> &mdash; an input and the "
                        "expected answer &mdash; and score every prompt change against them. Without "
                        "this you are tuning blind.</p>",
                        "<pre><code>cases = [\n"
                        "    {\"input\": \"The build passed\", \"expected\": \"POSITIVE\"},\n"
                        "    {\"input\": \"It crashed again\",  \"expected\": \"NEGATIVE\"},\n"
                        "]\n\n"
                        "def accuracy(cases, predict):\n"
                        "    hits = sum(1 for c in cases if predict(c[\"input\"]) == c[\"expected\"])\n"
                        "    return hits / len(cases)</code></pre>",
                        "<p>Exact match works for labels. For free text, use fuzzy match, keyword "
                        "checks, or an LLM judge (next lesson).</p>",
                    ),
                    "code_example": (
                        "def accuracy(cases, predict):\n"
                        "    hits = sum(1 for c in cases if predict(c[\"input\"]) == c[\"expected\"])\n"
                        "    return hits / len(cases)"
                    ),
                    "starter_code": (
                        "def accuracy(cases, predict):\n"
                        "    # count cases where predict(c['input']) equals c['expected'],\n"
                        "    # then divide by the number of cases\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def accuracy(cases, predict):\n"
                        "    hits = sum(1 for c in cases if predict(c[\"input\"]) == c[\"expected\"])\n"
                        "    return hits / len(cases)"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Score Against Golden Answers",
                            "description": "accuracy(cases, predict) returns the fraction of cases where the prediction matches expected.",
                            "starter_code": (
                                "def accuracy(cases, predict):\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "def accuracy(cases, predict):\n"
                                "    hits = sum(1 for c in cases if predict(c[\"input\"]) == c[\"expected\"])\n"
                                "    return hits / len(cases)"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Compares to the expected value",
                                     "test": "'expected' in code and '==' in code"},
                                    {"description": "Counts the hits",
                                     "test": "'sum(' in code"},
                                    {"description": "Divides by the case count",
                                     "test": "'/ len(' in code or '/len(' in code"},
                                ]
                            },
                            "hints": [
                                "hits = sum(1 for c in cases if predict(c[\"input\"]) == c[\"expected\"])",
                                "Return hits / len(cases)",
                                "predict is a function you call on each c[\"input\"]",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "LLM as a Judge",
                    "content": _p(
                        "<h2>Grade free text with a rubric prompt</h2>",
                        "<p>When answers are prose, have a <em>second</em> model call score them "
                        "against an explicit rubric. Keep the scale small and the criteria concrete "
                        "&mdash; and always ask for the <strong>reason</strong> too, so you can spot "
                        "a bad judge.</p>",
                        "<pre><code>JUDGE = (\n"
                        "    \"Score the answer from 1 to 5 for how faithful it is to the sources. \"\n"
                        "    \"5 = every claim is supported; 1 = contradicts them. \"\n"
                        "    'Reply as JSON: {\"score\": int, \"reason\": string}.'\n"
                        ")</code></pre>",
                        "<p>Validate the judge itself on a handful of hand-scored examples before you "
                        "trust its numbers.</p>",
                    ),
                    "code_example": (
                        "JUDGE = (\n"
                        "    \"Score the answer from 1 to 5 for how faithful it is to the sources. \"\n"
                        "    'Reply as JSON: {\"score\": int, \"reason\": string}.'\n"
                        ")"
                    ),
                    "starter_code": (
                        "# Write a judge prompt: a 1 to 5 score for faithfulness,\n"
                        "# returned as JSON with a score and a reason.\n"
                        "JUDGE = \"\"\n"
                    ),
                    "solution": (
                        "JUDGE = (\n"
                        "    \"Score the answer from 1 to 5 for how faithful it is to the sources. \"\n"
                        "    'Reply as JSON: {\"score\": int, \"reason\": string}.'\n"
                        ")"
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Write a Judge Prompt",
                            "description": "JUDGE must mention a 1 to 5 scale, the word faithful, and ask for JSON with a score and a reason.",
                            "starter_code": "JUDGE = \"\"",
                            "solution": (
                                "JUDGE = (\n"
                                "    \"Score the answer from 1 to 5 for how faithful it is to the sources. \"\n"
                                "    'Reply as JSON: {\"score\": int, \"reason\": string}.'\n"
                                ")"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Defines a 1 to 5 scale",
                                     "test": "'1 to 5' in code or '1-5' in code or '1 and 5' in code"},
                                    {"description": "Judges faithfulness",
                                     "test": "'faithful' in code.lower()"},
                                    {"description": "Asks for a score and a reason",
                                     "test": "'score' in code and 'reason' in code"},
                                ]
                            },
                            "hints": [
                                "Put the whole rubric in the JUDGE string",
                                "Include the phrase \"1 to 5\" and the word \"faithful\"",
                                "End with: Reply as JSON: {\"score\": int, \"reason\": string}",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
        # ---------------------------------------------------------------- #
        {
            "title": "Guardrails & Serving",
            "description": "Ship an AI feature that is safe, fast and affordable.",
            "order": 6,
            "difficulty": "advanced",
            "lessons": [
                {
                    "title": "Guardrails",
                    "content": _p(
                        "<h2>Never trust the input or the output</h2>",
                        "<p>User text reaches a model that will try to follow <em>any</em> instruction "
                        "in it &mdash; including &ldquo;ignore your rules&rdquo; "
                        "(<strong>prompt injection</strong>). Defend on both sides:</p>",
                        "<ul>",
                        "<li><strong>Input</strong> &mdash; length limits, strip or escape known "
                        "injection phrases, keep untrusted text in a clearly labelled block, never "
                        "in the system prompt.</li>",
                        "<li><strong>Output</strong> &mdash; validate structure, filter secrets / PII "
                        "/ banned content before it is shown or stored.</li>",
                        "</ul>",
                        "<pre><code>BANNED = (\"ignore previous\", \"disregard the system\", \"reveal your prompt\")\n\n"
                        "def is_safe(text):\n"
                        "    low = text.lower()\n"
                        "    return not any(phrase in low for phrase in BANNED)</code></pre>",
                    ),
                    "code_example": (
                        "BANNED = (\"ignore previous\", \"disregard the system\", \"reveal your prompt\")\n\n"
                        "def is_safe(text):\n"
                        "    low = text.lower()\n"
                        "    return not any(phrase in low for phrase in BANNED)"
                    ),
                    "starter_code": (
                        "BANNED = (\"ignore previous\", \"disregard the system\", \"reveal your prompt\")\n\n"
                        "def is_safe(text):\n"
                        "    # return False if any banned phrase appears (case-insensitive)\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "BANNED = (\"ignore previous\", \"disregard the system\", \"reveal your prompt\")\n\n"
                        "def is_safe(text):\n"
                        "    low = text.lower()\n"
                        "    return not any(phrase in low for phrase in BANNED)"
                    ),
                    "order": 1,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Reject Injection Attempts",
                            "description": "is_safe(text) returns False (case-insensitively) when any phrase in BANNED appears in text.",
                            "starter_code": (
                                "BANNED = (\"ignore previous\", \"reveal your prompt\")\n\n"
                                "def is_safe(text):\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "BANNED = (\"ignore previous\", \"reveal your prompt\")\n\n"
                                "def is_safe(text):\n"
                                "    low = text.lower()\n"
                                "    return not any(phrase in low for phrase in BANNED)"
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Case-insensitive check",
                                     "test": "'.lower()' in code"},
                                    {"description": "Scans all banned phrases",
                                     "test": "'any(' in code and 'BANNED' in code"},
                                    {"description": "Returns a boolean",
                                     "test": "'return' in code and ('not ' in code or 'False' in code)"},
                                ]
                            },
                            "hints": [
                                "Lowercase once: low = text.lower()",
                                "any(phrase in low for phrase in BANNED)",
                                "Safe means NOT any(...) — return not any(...)",
                            ],
                            "order": 1,
                        }
                    ],
                },
                {
                    "title": "Shipping AI Features",
                    "content": _p(
                        "<h2>Cost and latency are design constraints</h2>",
                        "<p>Every call costs tokens and time. The levers:</p>",
                        "<ul>",
                        "<li><strong>Model routing</strong> &mdash; send easy / short work to a small "
                        "cheap model, hard work to a large one.</li>",
                        "<li><strong>Caching</strong> &mdash; reuse identical results; use provider "
                        "<em>prompt caching</em> for a big fixed system prompt.</li>",
                        "<li><strong>Streaming</strong> &mdash; stream tokens so the user sees output "
                        "immediately even when the full reply is slow.</li>",
                        "<li><strong>Retries</strong> &mdash; exponential backoff on rate limits and "
                        "5xx; always set a timeout.</li>",
                        "</ul>",
                        "<pre><code>def choose_model(prompt_tokens):\n"
                        "    if prompt_tokens < 1000:\n"
                        "        return \"small\"      # cheap, fast\n"
                        "    return \"large\"          # smarter, pricier</code></pre>",
                    ),
                    "code_example": (
                        "def choose_model(prompt_tokens):\n"
                        "    if prompt_tokens < 1000:\n"
                        "        return \"small\"\n"
                        "    return \"large\""
                    ),
                    "starter_code": (
                        "def choose_model(prompt_tokens):\n"
                        "    # 'small' when under 1000 tokens, otherwise 'large'\n"
                        "    ...\n"
                    ),
                    "solution": (
                        "def choose_model(prompt_tokens):\n"
                        "    if prompt_tokens < 1000:\n"
                        "        return \"small\"\n"
                        "    return \"large\""
                    ),
                    "order": 2,
                    "xp_reward": 20,
                    "exercises": [
                        {
                            "title": "Route by Size",
                            "description": "choose_model returns 'small' for fewer than 1000 prompt tokens and 'large' otherwise.",
                            "starter_code": (
                                "def choose_model(prompt_tokens):\n"
                                "    ...\n"
                            ),
                            "solution": (
                                "def choose_model(prompt_tokens):\n"
                                "    if prompt_tokens < 1000:\n"
                                "        return \"small\"\n"
                                "    return \"large\""
                            ),
                            "test_cases": {
                                "tests": [
                                    {"description": "Thresholds at 1000 tokens",
                                     "test": "'1000' in code"},
                                    {"description": "Returns the small model",
                                     "test": "'\"small\"' in code or \"'small'\" in code"},
                                    {"description": "Returns the large model",
                                     "test": "'\"large\"' in code or \"'large'\" in code"},
                                ]
                            },
                            "hints": [
                                "if prompt_tokens < 1000:",
                                "    return \"small\"",
                                "Fall through to return \"large\"",
                            ],
                            "order": 1,
                        }
                    ],
                },
            ],
        },
    ],
}


async def seed_ai_llm_track():
    """Add the AI & LLM Engineering track if it isn't present yet (idempotent)."""
    async with async_session() as db:
        existing = await db.execute(
            select(Language).where(Language.slug == AI_LLM_TRACK["slug"])
        )
        if existing.scalars().first():
            print("AI & LLM Engineering track already exists; nothing to do.")
            return

        language = Language(
            name=AI_LLM_TRACK["name"],
            slug=AI_LLM_TRACK["slug"],
            icon=AI_LLM_TRACK["icon"],
            description=AI_LLM_TRACK["description"],
            color=AI_LLM_TRACK["color"],
        )
        db.add(language)
        await db.flush()

        for mod_data in AI_LLM_TRACK["modules"]:
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
        n_mod = len(AI_LLM_TRACK["modules"])
        n_les = sum(len(m["lessons"]) for m in AI_LLM_TRACK["modules"])
        print(f"AI & LLM Engineering track seeded: {n_mod} modules, {n_les} lessons.")


if __name__ == "__main__":
    import asyncio
    from backfill_exercises import ensure_every_lesson_has_exercise

    async def _run():
        await seed_ai_llm_track()
        await ensure_every_lesson_has_exercise()

    asyncio.run(_run())
