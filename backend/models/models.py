import secrets

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


def _public_id() -> str:
    """Opaque, non-sequential id for content that lives at a public URL."""
    return secrets.token_urlsafe(9)  # ~12 url-safe chars, 72 bits

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    google_id = Column(String, unique=True, nullable=True)
    avatar_url = Column(String, nullable=True)          # OAuth-provided picture URL
    avatar_data = Column(String, nullable=True)         # user-uploaded image as a data: URI
    display_name = Column(String, nullable=True)        # shown instead of the login handle
    headline = Column(String, nullable=True)            # one-line "what I'm about"
    bio = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    major = Column(String, nullable=True)  # chosen career track slug, e.g. "ai-engineer"
    plan = Column(String, default="free")  # billing/usage plan key — see backend/plans.py
    plan_expires_at = Column(DateTime, nullable=True)   # when a paid plan lapses back to free
    is_staff = Column(Boolean, default=False)           # can moderate community content
    is_admin = Column(Boolean, default=False)           # can sign in to the /admin-portal console
    verified = Column(Boolean, default=True)            # shown as a verified badge on public profiles
    onboarded_at = Column(DateTime, nullable=True)      # set once the first-run flow is done/skipped
    created_at = Column(DateTime, default=datetime.utcnow)
    
    progress = relationship("UserProgress", back_populates="user")
    hints_used = relationship("HintUsage", back_populates="user")
    projects = relationship("UserProject", back_populates="user")
    notes = relationship("UserNote", back_populates="user")
    challenge_attempts = relationship("ChallengeAttempt", back_populates="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")
    doc_progress = relationship("UserDocProgress", back_populates="user")

class Language(Base):
    __tablename__ = "languages"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    slug = Column(String, unique=True)
    icon = Column(String)
    description = Column(String)
    color = Column(String)
    
    modules = relationship("Module", back_populates="language")

class Module(Base):
    __tablename__ = "modules"
    
    id = Column(Integer, primary_key=True, index=True)
    language_id = Column(Integer, ForeignKey("languages.id"))
    title = Column(String)
    description = Column(String)
    order = Column(Integer)
    difficulty = Column(String, default="beginner")
    level = Column(Integer, default=1)  # 1..N rung on the track's ladder

    language = relationship("Language", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module")

class Lesson(Base):
    __tablename__ = "lessons"
    
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"))
    title = Column(String)
    content = Column(String)
    code_example = Column(String)
    starter_code = Column(String)
    solution = Column(String)
    order = Column(Integer)
    xp_reward = Column(Integer, default=10)
    
    module = relationship("Module", back_populates="lessons")
    exercises = relationship("Exercise", back_populates="lesson")

class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    title = Column(String)
    description = Column(String)
    starter_code = Column(String)
    solution = Column(String)
    test_cases = Column(JSON)
    hints = Column(JSON)
    order = Column(Integer)
    
    lesson = relationship("Lesson", back_populates="exercises")

class UserProgress(Base):
    __tablename__ = "user_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    completed = Column(Boolean, default=False)
    score = Column(Float, default=0)
    time_spent = Column(Integer, default=0)
    attempts = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="progress")

class HintUsage(Base):
    __tablename__ = "hint_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    hint_level = Column(Integer, default=1)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="hints_used")

class UserProject(Base):
    __tablename__ = "user_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    description = Column(String)
    code = Column(String, default="")
    language = Column(String)
    ai_review = Column(JSON, nullable=True)
    # --- workspace fields ---
    notes = Column(String, default="")            # free-form markdown
    brief = Column(JSON, nullable=True)           # {requirements, hints, estimated_time}
    tasks = Column(JSON, default=list)            # [{id, text, done}]
    status = Column(String, default="active")     # active | done | archived
    pinned = Column(Boolean, default=False)
    track_slug = Column(String, nullable=True)    # linked Language.slug
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="projects")


class UserNote(Base):
    """A CodeSquareNote — a one-tap scratchpad for a project idea/reminder.

    `kind` selects the template:
      - "note":      free-form markdown (project requirements, reminders)
      - "project":   like "note" but with an AI-generated structure attached
      - "credential": data point/secret (DB password, portal login) — the value
                     is stored encrypted in `secret` (Fernet) and its metadata
                     (service, username) in `content`.
    """
    __tablename__ = "user_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    kind = Column(String, default="note")          # note | project | credential
    title = Column(String, default="")
    content = Column(String, default="")           # markdown / non-secret meta
    # AI-generated structure: {stack:[...], skills:[...], structure:[...], steps:[...]}
    ai_suggestion = Column(JSON, nullable=True)
    # Encrypted (Fernet) secret value — only ever set for kind == "credential".
    secret = Column(String, nullable=True)
    # Last time the secret was decrypted+shown (audit); cleared when secret changes.
    revealed_at = Column(DateTime, nullable=True)
    # User-starred — favourites float to the top of the list.
    favorite = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notes")


class Challenge(Base):
    """A standalone practice problem for the Practice section — independent of the
    lesson tree. Runs against `test_cases` with the same exec/eval harness as
    lesson exercises.
    """
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String)
    prompt = Column(String)                       # plain / lightly-formatted description
    language = Column(String, default="python")   # Language.slug — editor mode + runner
    difficulty = Column(String, default="beginner")  # beginner | intermediate | advanced
    kind = Column(String, default="solve")        # solve | debug — "debug" ships broken code to fix
    topic = Column(String, nullable=True)         # "strings" | "arrays" | "sql" | ...
    starter_code = Column(String, default="")
    solution = Column(String, default="")
    test_cases = Column(JSON, default=dict)       # {"tests": [{"test": ..., "description": ...}]}
    hints = Column(JSON, default=list)
    xp_reward = Column(Integer, default=20)
    major_slugs = Column(JSON, default=list)      # relevant majors; [] = all
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    attempts = relationship(
        "ChallengeAttempt", back_populates="challenge", cascade="all, delete-orphan"
    )


class ChallengeAttempt(Base):
    """One graded submission of a Challenge by a user. The most recent passing row
    marks the challenge solved; the run history feeds Practice stats.
    """
    __tablename__ = "challenge_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    challenge_id = Column(Integer, ForeignKey("challenges.id"))
    code = Column(String, default="")
    passed = Column(Boolean, default=False)
    tests_passed = Column(Integer, default=0)
    tests_total = Column(Integer, default=0)
    ai_review = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="challenge_attempts")
    challenge = relationship("Challenge", back_populates="attempts")


class Quiz(Base):
    """A standalone multiple-choice knowledge check for the Practice section.

    Graded server-side by comparing the submitted option indices against each
    question's `answer`; correct answers are never sent to the client. A quiz is
    "passed" when a submission scores >= `pass_score` percent. First pass awards
    `xp_reward` once (mirrors Challenge XP, folded into the same totals).
    """
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(String, default="")
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)  # optional module cap
    language = Column(String, nullable=True)          # Language.slug — for filtering
    difficulty = Column(String, default="beginner")   # beginner | intermediate | advanced
    topic = Column(String, nullable=True)
    pass_score = Column(Integer, default=70)          # percent needed to pass
    xp_reward = Column(Integer, default=15)
    # [{"q": str, "options": [str, ...], "answer": int, "explain": str}]
    questions = Column(JSON, default=list)
    major_slugs = Column(JSON, default=list)          # relevant majors; [] = all
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    attempts = relationship(
        "QuizAttempt", back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizAttempt(Base):
    """One graded submission of a Quiz. The best-scoring row is the user's score
    for that quiz; any passing row marks it passed.
    """
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), index=True)
    answers = Column(JSON, default=list)              # [int, ...] one per question (-1 = skipped)
    score = Column(Float, default=0)                  # percent 0..100
    correct = Column(Integer, default=0)
    total = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")


class DocCollection(Base):
    """A top-level shelf in the knowledge Library (e.g. "Version Control")."""
    __tablename__ = "doc_collections"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(String)
    icon = Column(String, default="📚")
    color = Column(String, default="#2DD4BF")
    order = Column(Integer, default=0)
    # "mirror" = generated from a lesson track, "standalone" = hand-written reference.
    source = Column(String, default="standalone")
    category = Column(String, nullable=True)  # python | web | backend | data | devops | cs

    topics = relationship(
        "DocTopic",
        back_populates="collection",
        order_by="DocTopic.order",
        cascade="all, delete-orphan",
    )


class DocTopic(Base):
    """One readable chapter/article inside a DocCollection."""
    __tablename__ = "doc_topics"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("doc_collections.id"))
    slug = Column(String, index=True)
    title = Column(String)
    summary = Column(String, default="")
    body = Column(String)                       # HTML
    reading_minutes = Column(Integer, default=4)
    order = Column(Integer, default=0)
    tags = Column(JSON, default=list)           # ["git", "ci"]
    major_slugs = Column(JSON, default=list)    # ["backend-engineer", "automation"]
    related_lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    # Which rung of the shelf's beginner->advanced ladder this topic sits on.
    group_level = Column(Integer, default=1)
    group_difficulty = Column(String, nullable=True)  # beginner | intermediate | advanced

    collection = relationship("DocCollection", back_populates="topics")


class UserDocProgress(Base):
    """Per-user reading state for a Library article: whether they marked it read
    and/or bookmarked it. One row per (user, topic); created lazily on first
    toggle. Independent of lesson-linked progress, which is derived from
    UserProgress and stays the source of truth for track completion.
    """
    __tablename__ = "user_doc_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    topic_id = Column(Integer, ForeignKey("doc_topics.id"), index=True)
    read = Column(Boolean, default=False)
    bookmarked = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="doc_progress")
    topic = relationship("DocTopic")


class DocRating(Base):
    """One user's 1-5 star rating of a Library shelf. Unique per (user, shelf)."""
    __tablename__ = "doc_ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    collection_id = Column(Integer, ForeignKey("doc_collections.id"), index=True)
    stars = Column(Integer, default=0)          # 1..5
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AiChatSession(Base):
    """One AI-Tutor conversation. Title is auto-set from the first user message.
    Turns are stored oldest-first via `created_at`.
    """
    __tablename__ = "ai_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String, default="New chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)

    turns = relationship(
        "AiChatTurn",
        back_populates="session",
        order_by="AiChatTurn.created_at",
        cascade="all, delete-orphan",
    )


class AiChatTurn(Base):
    __tablename__ = "ai_chat_turns"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("ai_chat_sessions.id"), index=True)
    role = Column(String)          # "user" | "assistant"
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("AiChatSession", back_populates="turns")


class AiUsage(Base):
    """One row per AI call, for the Account & Usage view. `kind` is the surface
    that made the call (chat | hint | review | project | notes). Token counts
    come from the model response's `usage`; 0 when the provider doesn't report
    it. Windows (session = 5h, weekly = 7d) are computed from `created_at`.
    """
    __tablename__ = "user_ai_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    kind = Column(String, index=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    model = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# --------------------------------------------------------------------------- #
#  Community feed — learners post ideas / progress / questions / showcases.    #
# --------------------------------------------------------------------------- #

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    # Opaque public id used in URLs / the API — so posts can't be enumerated.
    public_id = Column(String, unique=True, index=True, default=_public_id)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    kind = Column(String, default="idea")          # idea | progress | question | showcase
    body = Column(String)                          # markdown
    tags = Column(JSON, default=list)              # ["python", "sql"]
    images = Column(JSON, default=list)            # list of data-URI / image URLs
    link_url = Column(String, nullable=True)
    flagged_count = Column(Integer, default=0)
    hidden = Column(Boolean, default=False)        # auto-hidden past the flag threshold, or by staff
    quality_score = Column(Integer, nullable=True)        # 0..100 — heuristic on create, AI on review
    quality_note = Column(String, nullable=True)          # one-line verdict + improvement tip
    quality_ai = Column(Boolean, default=False)           # True when graded by the AI, False = heuristic
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=True)   # set only on an actual edit

    author = relationship("User")
    reactions = relationship("PostReaction", back_populates="post", cascade="all, delete-orphan")
    saves = relationship("PostSave", back_populates="post", cascade="all, delete-orphan")
    reposts = relationship("PostRepost", back_populates="post", cascade="all, delete-orphan")
    comments = relationship(
        "PostComment",
        back_populates="post",
        order_by="PostComment.created_at",
        cascade="all, delete-orphan",
    )


class PostReaction(Base):
    """One row per (post, user) — a like. Presence = liked."""
    __tablename__ = "post_reactions"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="reactions")


class PostSave(Base):
    """One row per (post, user) — a private bookmark. Presence = saved.
    Only the owner ever sees their saved list."""
    __tablename__ = "post_saves"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    post = relationship("Post", back_populates="saves")


class PostRepost(Base):
    """One row per (post, user) — a public repost/boost. Presence = reposted.
    Surfaces on the reposter's profile and in the home feed."""
    __tablename__ = "post_reposts"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    post = relationship("Post", back_populates="reposts")
    user = relationship("User")


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    parent_id = Column(Integer, ForeignKey("post_comments.id"), index=True, nullable=True)
    body = Column(String)
    flagged_count = Column(Integer, default=0)
    hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")
    likes = relationship(
        "PostCommentLike", back_populates="comment", cascade="all, delete-orphan"
    )


class PostCommentLike(Base):
    """One row per (comment, user) — a like. Presence = liked."""
    __tablename__ = "post_comment_likes"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("post_comments.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    comment = relationship("PostComment", back_populates="likes")


# --------------------------------------------------------------------------- #
#  Notifications — post-owner watch. Created when another user likes or         #
#  comments on someone else's community post.                                   #
# --------------------------------------------------------------------------- #

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)    # recipient
    actor_id = Column(Integer, ForeignKey("users.id"), index=True)   # the user who acted
    kind = Column(String)              # "like" | "comment"
    post_id = Column(Integer, ForeignKey("posts.id"), index=True)
    read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    recipient = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])
    post = relationship("Post")


class Follow(Base):
    """One row per (follower, following) pair. Presence = followed."""
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    following_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])


class Payment(Base):
    """A subscription payment. `provider` is "mock" until a real gateway (ABA
    PayWay / Bakong KHQR) is wired; a row that reaches status "paid" extends the
    buyer's `User.plan_expires_at` by one Pro period.
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    provider = Column(String, default="mock")
    provider_ref = Column(String, nullable=True)      # gateway transaction id
    plan = Column(String)                             # plan being purchased
    amount_cents = Column(Integer)
    currency = Column(String, default="USD")
    status = Column(String, default="pending")        # pending | paid | failed | expired
    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)