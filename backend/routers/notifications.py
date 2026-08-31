"""Notifications — post-owner activity on your community posts.

A lightweight inbox: when another user likes or comments on one of your posts,
a Notification row is created for you. The bell in the top bar polls this for an
unread count and lists recent items.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.models import Notification, Post, User
from routers.auth import get_current_user

router = APIRouter()


class Actor(BaseModel):
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None


class NotificationOut(BaseModel):
    id: int
    kind: str                      # "like" | "comment"
    read: bool
    created_at: datetime
    actor: Actor
    post_public_id: str


class NotificationsResponse(BaseModel):
    unread_count: int
    items: List[NotificationOut] = []


def _actor(u: User) -> Actor:
    return Actor(
        username=u.username or f"user{u.id}",
        display_name=u.display_name,
        avatar=(u.avatar_data or u.avatar_url),
    )


@router.get("", response_model=NotificationsResponse)
async def list_notifications(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(Notification, Post)
            .join(Post, Post.id == Notification.post_id)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(min(max(limit, 1), 50))
        )
    ).all()

    items = []
    for n, post in rows:
        actor = (await db.execute(select(User).where(User.id == n.actor_id))).scalar_one_or_none()
        if not actor:
            continue
        items.append(
            NotificationOut(
                id=n.id,
                kind=n.kind,
                read=bool(n.read),
                created_at=n.created_at,
                actor=_actor(actor),
                post_public_id=post.public_id,
            )
        )

    unread = (
        await db.execute(
            select(Notification.id).where(
                Notification.user_id == current_user.id, Notification.read.is_(False)
            )
        )
    ).scalars().all()

    return NotificationsResponse(unread_count=len(unread), items=items)


@router.post("/read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        Notification.__table__.update()
        .where(Notification.user_id == current_user.id, Notification.read.is_(False))
        .values(read=True)
    )
    await db.commit()
    return {"ok": True}