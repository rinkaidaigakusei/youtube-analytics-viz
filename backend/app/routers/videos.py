from fastapi import APIRouter

from ..db import get_db
from ..services import cache
from .auth import load_credentials

router = APIRouter(prefix="/api", tags=["videos"])


@router.post("/sync/videos")
def sync_videos():
    creds = load_credentials()
    count = cache.sync_videos(creds)
    return {"synced": count}


@router.get("/videos")
def list_videos():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT v.video_id, v.title, v.published_at, v.duration_seconds, v.thumbnail_url, v.is_short,
                   s.lifetime_views, s.average_view_percentage
            FROM videos v
            LEFT JOIN video_stats s ON s.video_id = v.video_id
            ORDER BY v.published_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]
