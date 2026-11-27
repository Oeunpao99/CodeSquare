"""Private one-to-one conversations for signed-in developers."""
from datetime import timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import storage
from common.avatars import effective_avatar
from database import get_db
from models.models import DirectMessage, DirectMessageRead, User
from routers.auth import get_current_user

router = APIRouter()
TEXT_LIMIT = 4000
MEDIA_LIMITS = {"image": 5, "audio": 5, "video": 25}
MAX_REQUEST_BYTES = (max(MEDIA_LIMITS.values()) + 1) * 1024 * 1024
MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav",
    "video/mp4", "video/webm", "video/quicktime",
}


class ReadReceipt(BaseModel):
    through_id: int = Field(gt=0)


def matches_media_type(content, media_type):
    prefixes = {
        "image/jpeg": (b"\xff\xd8\xff",),
        "image/png": (b"\x89PNG\r\n\x1a\n",),
        "image/gif": (b"GIF87a", b"GIF89a"),
        "audio/webm": (b"\x1aE\xdf\xa3",),
        "video/webm": (b"\x1aE\xdf\xa3",),
        "audio/ogg": (b"OggS",),
    }
    if media_type in prefixes:
        return content.startswith(prefixes[media_type])
    if media_type in {"audio/mp4", "video/mp4", "video/quicktime"}:
        return content[4:8] == b"ftyp"
    if media_type in {"image/webp", "audio/wav"}:
        marker = b"WEBP" if media_type == "image/webp" else b"WAVE"
        return content.startswith(b"RIFF") and content[8:12] == marker
    return content.startswith(b"ID3") or (
        len(content) >= 2 and content[0] == 0xff and content[1] & 0xe0 == 0xe0
    )


def person(user):
    return {
        "username": user.username,
        "display_name": user.display_name,
        "avatar": effective_avatar(user),
    }


def serialize(message, user_id):
    return {
        "id": message.id,
        "mine": message.sender_id == user_id,
        "text": message.text,
        "media_type": message.media_type,
        "created_at": message.created_at.replace(tzinfo=timezone.utc).isoformat(),
    }


async def get_peer(db, username, me):
    peer = await db.scalar(select(User).where(User.username == username, User.id != me.id))
    if peer is None:
        raise HTTPException(404, "Developer not found")
    return peer


@router.get("")
async def inbox(db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    message = DirectMessage
    peer_id = case((message.sender_id == me.id, message.recipient_id), else_=message.sender_id)
    latest = (
        select(peer_id.label("peer_id"), func.max(message.id).label("message_id"))
        .where((message.sender_id == me.id) | (message.recipient_id == me.id))
        .group_by(peer_id)
        .subquery()
    )
    rows = await db.execute(
        select(User, message)
        .join(latest, latest.c.peer_id == User.id)
        .join(message, message.id == latest.c.message_id)
        .order_by(message.id.desc())
    )
    return [{"peer": person(peer), "last_message": serialize(last, me.id)} for peer, last in rows]


@router.get("/with/{username}")
async def thread(
    username: str,
    before: int | None = Query(None, gt=0),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    peer = await get_peer(db, username, me)
    message = DirectMessage
    query = select(message).where(
        ((message.sender_id == me.id) & (message.recipient_id == peer.id))
        | ((message.sender_id == peer.id) & (message.recipient_id == me.id))
    )
    if before is not None:
        query = query.where(message.id < before)
    rows = (await db.scalars(query.order_by(message.id.desc()).limit(51))).all()
    receipts = await db.execute(select(
        DirectMessageRead.reader_id, DirectMessageRead.through_id,
    ).where(
        ((DirectMessageRead.reader_id == me.id) & (DirectMessageRead.peer_id == peer.id))
        | ((DirectMessageRead.reader_id == peer.id) & (DirectMessageRead.peer_id == me.id))
    ))
    through_by_reader = dict(receipts.all())
    return {
        "peer": person(peer),
        "messages": [serialize(row, me.id) for row in reversed(rows[:50])],
        "has_more": len(rows) > 50,
        "read_through": through_by_reader.get(me.id, 0),
        "peer_read_through": through_by_reader.get(peer.id, 0),
    }


@router.post("/with/{username}/read", status_code=204)
async def mark_read(
    username: str,
    receipt: ReadReceipt,
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    peer = await get_peer(db, username, me)
    message_id = await db.scalar(select(DirectMessage.id).where(
        DirectMessage.id == receipt.through_id,
        DirectMessage.sender_id == peer.id,
        DirectMessage.recipient_id == me.id,
    ))
    if message_id is None:
        raise HTTPException(404, "Message not found")
    cursor = DirectMessageRead
    statement = insert(cursor).values(reader_id=me.id, peer_id=peer.id, through_id=message_id)
    await db.execute(statement.on_conflict_do_update(
        index_elements=[cursor.reader_id, cursor.peer_id],
        set_={"through_id": statement.excluded.through_id},
        where=cursor.through_id < statement.excluded.through_id,
    ))
    await db.commit()
    return Response(status_code=204)


@router.post("/with/{username}", status_code=201)
async def send(
    username: str,
    text: str = Form(""),
    attachment: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    me: User = Depends(get_current_user),
):
    peer = await get_peer(db, username, me)
    text = text.strip()
    if len(text) > TEXT_LIMIT:
        raise HTTPException(422, f"Messages can contain up to {TEXT_LIMIT} characters")
    if not text and attachment is None:
        raise HTTPException(422, "Write a message or attach media")

    key = media_type = None
    if attachment is not None:
        media_type = (attachment.content_type or "").split(";")[0].lower()
        if media_type not in MEDIA_TYPES:
            raise HTTPException(415, "Choose a supported image, audio or video file")
        max_mb = MEDIA_LIMITS[media_type.split("/")[0]]
        limit = max_mb * 1024 * 1024
        content = await attachment.read(limit + 1)
        if len(content) > limit:
            raise HTTPException(413, f"This attachment must be {max_mb} MB or smaller")
        if not matches_media_type(content, media_type):
            raise HTTPException(415, "The file does not match its media type")
        key = storage.make_key("messages", attachment.filename or "attachment")

    message = DirectMessage(
        sender_id=me.id, recipient_id=peer.id, text=text, media_key=key, media_type=media_type
    )
    try:
        if key:
            await run_in_threadpool(storage.save, key, content, media_type)
        db.add(message)
        await db.flush()
        result = serialize(message, me.id)
        await db.commit()
    except Exception:
        if key:
            await run_in_threadpool(storage.delete, key)
        raise
    return result


@router.get("/{message_id}/media")
async def media(
    message_id: int, db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user),
):
    message = await db.scalar(select(DirectMessage).where(
        DirectMessage.id == message_id,
        (DirectMessage.sender_id == me.id) | (DirectMessage.recipient_id == me.id),
        DirectMessage.media_key.is_not(None),
    ))
    if message is None:
        raise HTTPException(404, "Attachment not found")
    try:
        content = await run_in_threadpool(storage.read, message.media_key)
    except FileNotFoundError:
        raise HTTPException(404, "Attachment not found") from None
    return Response(content, media_type=message.media_type, headers={
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    })
