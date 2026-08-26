from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..db import get_db
from ..services import cache, youtube_comments
from .auth import load_credentials

router = APIRouter(prefix="/api", tags=["comments"])


class ReplyRequest(BaseModel):
    text: str


@router.post("/sync/comments")
def sync_comments():
    creds = load_credentials()
    result = cache.sync_comments(creds)
    return result


@router.get("/comments")
def list_comments(unreplied_only: bool = Query(True)):
    with get_db() as conn:
        query = "SELECT * FROM comments"
        if unreplied_only:
            query += " WHERE replied = 0"
        query += " ORDER BY published_at DESC"
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]


@router.post("/comments/{comment_id}/reply")
def reply_to_comment(comment_id: str, body: ReplyRequest):
    creds = load_credentials()
    with get_db() as conn:
        existing = conn.execute("SELECT 1 FROM comments WHERE comment_id = ?", (comment_id,)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Comment not found in cache. Run sync first.")

    youtube_comments.post_reply(creds, comment_id, body.text)
    cache.mark_comment_replied(comment_id)
    return {"status": "ok"}
