"""Career readiness — rolls the user's per-skill scores up against their chosen
major's target skill set into a single "job readiness" number plus focus areas
and concrete next steps.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from majors import MAJOR_LABELS, MAJOR_SKILLS, SKILL_LABELS
from models.models import User, UserProject
from routers.auth import get_current_user
from skills import compute_skills, _level

router = APIRouter()


class Component(BaseModel):
    key: str
    label: str
    score: int


class TargetSkill(BaseModel):
    key: str
    label: str
    score: int
    level: str
    lessons_done: int = 0
    lessons_total: int = 0
    challenges_done: int = 0
    challenges_total: int = 0


class ReadinessResponse(BaseModel):
    major: Optional[str] = None
    major_label: Optional[str] = None
    overall: int = 0
    components: List[Component] = []
    target_skills: List[TargetSkill] = []
    focus: List[str] = []
    next_steps: List[str] = []


@router.get("/readiness", response_model=ReadinessResponse)
async def get_readiness(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    major = current_user.major
    if not major or major not in MAJOR_SKILLS:
        return ReadinessResponse(
            next_steps=["Choose a career major in your profile to unlock a job-readiness score."],
        )

    skills = {s["key"]: s for s in await compute_skills(db, current_user.id)}
    targets = MAJOR_SKILLS[major]

    target_rows: List[TargetSkill] = []
    for key in targets:
        s = skills.get(key) or {
            "key": key, "label": SKILL_LABELS.get(key, key), "score": 0, "level": _level(0),
            "lessons_done": 0, "lessons_total": 0, "challenges_done": 0, "challenges_total": 0,
        }
        target_rows.append(
            TargetSkill(
                key=key,
                label=s["label"],
                score=s["score"],
                level=s["level"],
                lessons_done=s["lessons_done"],
                lessons_total=s["lessons_total"],
                challenges_done=s["challenges_done"],
                challenges_total=s["challenges_total"],
            )
        )

    skills_score = round(sum(t.score for t in target_rows) / len(target_rows)) if target_rows else 0

    project_count = (
        await db.execute(
            select(func.count(UserProject.id)).where(UserProject.user_id == current_user.id)
        )
    ).scalar() or 0
    projects_score = min(100, project_count * 25)

    problem_solving = skills.get("problem-solving", {}).get("score", 0)

    overall = round(0.55 * skills_score + 0.25 * projects_score + 0.20 * problem_solving)

    components = [
        Component(key="skills", label="Technical skills", score=skills_score),
        Component(key="projects", label="Projects built", score=projects_score),
        Component(key="problem_solving", label="Problem solving", score=problem_solving),
    ]

    weakest = sorted(target_rows, key=lambda t: t.score)[:2]
    focus = [t.label for t in weakest]

    next_steps: List[str] = []
    if overall >= 75:
        next_steps.append("You're close to job-ready — tighten the weak spots below.")
    for t in weakest:
        if t.lessons_total and t.lessons_done < t.lessons_total:
            next_steps.append(
                f"Finish the {t.label} lessons ({t.lessons_done}/{t.lessons_total} done)."
            )
        elif t.challenges_total and t.challenges_done < t.challenges_total:
            next_steps.append(
                f"Solve more {t.label} challenges ({t.challenges_done}/{t.challenges_total} done)."
            )
        else:
            next_steps.append(f"Keep {t.label} sharp with a harder challenge.")
    if project_count < 2:
        next_steps.append(
            f"Build a project you can show — you have {project_count}, aim for 2+."
        )

    return ReadinessResponse(
        major=major,
        major_label=MAJOR_LABELS.get(major, major),
        overall=overall,
        components=components,
        target_skills=target_rows,
        focus=focus,
        next_steps=next_steps,
    )
