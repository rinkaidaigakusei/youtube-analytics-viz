from fastapi import APIRouter, Depends

from ..db import get_db
from ..security import require_app_key
from ..services import cache
from .auth import load_credentials

router = APIRouter(prefix="/api", tags=["videos"], dependencies=[Depends(require_app_key)])


@router.get("/session")
def session():
    """合言葉が正しいかをフロントエンドが確かめるための入口"""
    return {"ok": True}


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


@router.get("/summary/watch-time")
def watch_time_summary():
    """動画ごとの日別再生時間(分)。公開からの日数で動画どうしを比較するグラフ用"""
    with get_db() as conn:
        videos = conn.execute(
            """
            SELECT v.video_id, v.title, v.published_at, v.is_short, s.fetched_at
            FROM videos v
            JOIN video_stats s ON s.video_id = v.video_id
            ORDER BY v.published_at DESC
            """
        ).fetchall()
        daily = conn.execute(
            "SELECT video_id, day_index, watch_minutes FROM daily_views "
            "WHERE watch_minutes IS NOT NULL ORDER BY video_id, day_index"
        ).fetchall()

    days_by_video: dict[str, list[list[int]]] = {}
    for d in daily:
        days_by_video.setdefault(d["video_id"], []).append([d["day_index"], d["watch_minutes"]])
    return [{**dict(v), "days": days_by_video.get(v["video_id"], [])} for v in videos]


@router.get("/videos/{video_id}/daily-views")
def video_daily_views(video_id: str):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT day_index, date, views FROM daily_views WHERE video_id = ? ORDER BY day_index",
            (video_id,),
        ).fetchall()
        return [dict(r) for r in rows]
