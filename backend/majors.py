"""Career major → ordered track (Language slug) definitions, mirroring the
frontend's src/majors.js. Keeping the mapping here lets the Roadmap API resolve
a major to its ordered learning path server-side.
"""

MAJOR_TRACKS = {
    "computer-science": ["python", "python-intermediate", "dsa", "javascript", "linux-shell"],
    "data-science": ["python", "python-intermediate", "sql-data", "backend-foundations", "linux-shell"],
    "data-analyst": ["python", "python-intermediate", "sql-data", "linux-shell"],
    "ai-engineer": ["python", "python-intermediate", "sql-data", "backend-foundations", "linux-shell", "ai-llm"],
    "web-developer": ["html-css", "javascript", "react-typescript", "full-stack"],
    "backend-engineer": ["python", "python-intermediate", "sql-data", "backend-foundations", "linux-shell", "full-stack"],
    "automation": ["python", "python-intermediate", "linux-shell", "backend-foundations"],
    # NOTE: network-engineer reuses existing tracks until a dedicated
    # `networking` track (OSI/TCP-IP/DNS/HTTP, network automation) is seeded.
    "network-engineer": ["linux-shell", "python", "python-intermediate", "backend-foundations"],
}

# Library shelves each major should see first, most relevant first. Slugs point at
# DocCollection.slug — mirrored track slugs (same as MAJOR_TRACKS) plus the
# standalone reference shelves. Mirror the frontend's src/libraryMap.js.
_STANDALONE_DOCS = ["version-control", "dev-workflow"]
MAJOR_DOCS = {
    major: tracks + _STANDALONE_DOCS
    for major, tracks in MAJOR_TRACKS.items()
}

# Human labels, mirroring the frontend's src/majors.js.
MAJOR_LABELS = {
    "computer-science": "Computer Science",
    "data-science": "Data Science",
    "data-analyst": "Data Analyst",
    "ai-engineer": "AI Engineer",
    "web-developer": "Web Developer",
    "backend-engineer": "Backend Engineer",
    "automation": "Automation Engineer",
    "network-engineer": "Network Engineer",
}

# Skill buckets for the Progress "skills" view and Career readiness. Each bucket
# aggregates progress from lesson tracks (Language.slug), challenge languages, and
# challenge topics. Keys are stable identifiers used by MAJOR_SKILLS below.
SKILL_DEFS = [
    {
        "key": "python",
        "label": "Python",
        "tracks": ["python", "python-intermediate"],
        "challenge_langs": ["python"],
        "challenge_topics": [],
    },
    {
        "key": "javascript",
        "label": "JavaScript",
        "tracks": ["javascript"],
        "challenge_langs": ["javascript"],
        "challenge_topics": ["javascript"],
    },
    {
        "key": "web",
        "label": "Web & Frontend",
        "tracks": ["html-css", "react-typescript", "full-stack"],
        "challenge_langs": [],
        "challenge_topics": [],
    },
    {
        "key": "backend",
        "label": "Backend & APIs",
        "tracks": ["backend-foundations", "full-stack"],
        "challenge_langs": [],
        "challenge_topics": [],
    },
    {
        "key": "sql",
        "label": "SQL & Data",
        "tracks": ["sql-data"],
        "challenge_langs": ["sql"],
        "challenge_topics": ["sql"],
    },
    {
        "key": "shell",
        "label": "Linux & Shell",
        "tracks": ["linux-shell"],
        "challenge_langs": [],
        "challenge_topics": [],
    },
    {
        "key": "problem-solving",
        "label": "Problem Solving",
        "tracks": [],
        "challenge_langs": [],
        "challenge_topics": [
            "algorithms", "arrays", "strings", "recursion",
            "stacks", "dictionaries", "control-flow",
        ],
    },
    {
        "key": "dsa",
        "label": "Data Structures & Algorithms",
        "tracks": ["dsa"],
        "challenge_langs": [],
        "challenge_topics": [
            "algorithms", "arrays", "recursion", "stacks", "dictionaries",
        ],
    },
    {
        "key": "ai-llm",
        "label": "AI & LLM Apps",
        "tracks": ["ai-llm"],
        "challenge_langs": [],
        "challenge_topics": ["ai", "llm", "prompting", "rag"],
    },
]

SKILL_LABELS = {s["key"]: s["label"] for s in SKILL_DEFS}

# The skills that define "job ready" for each major, most central first.
MAJOR_SKILLS = {
    "computer-science": ["dsa", "python", "problem-solving", "javascript", "shell"],
    "data-science": ["python", "sql", "problem-solving"],
    "data-analyst": ["sql", "python", "problem-solving"],
    "ai-engineer": ["ai-llm", "python", "problem-solving", "sql", "backend"],
    "web-developer": ["javascript", "web", "problem-solving"],
    "backend-engineer": ["python", "backend", "sql", "shell", "problem-solving"],
    "automation": ["python", "shell", "backend"],
    "network-engineer": ["shell", "python", "backend"],
}
