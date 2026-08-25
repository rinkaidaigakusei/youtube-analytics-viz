from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query

from ..config import settings
from ..db import get_db
from ..services import cache
from .auth import load_credentials

router = APIRouter(prefix="/api", tags=["analytics"])

WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]


@router.post("/sync/analytics")
def sync_analytics(force: bool = Query(False, description="既存キャッシュがあっても再取得する")):
    creds = load_credentials()
    with get_db() as conn:
        videos = conn.execute("SELECT video_id, published_at FROM videos").fetchall()

    synced = 0
    skipped = 0
    for v in videos:
        did_sync = cache.sync_analytics_for_video(creds, v["video_id"], v["published_at"], force=force)
        if did_sync:
            synced += 1
        else:
            skipped += 1
    return {"synced": synced, "skipped_cached": skipped}


@router.get("/summary/weekday-hour")
def weekday_hour_summary():
    """曜日 × 時間帯ごとの、初速(公開後0-1日の再生数)・累計再生数・平均視聴維持率の集計"""
    tz = ZoneInfo(settings.timezone)

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT v.video_id, v.published_at, s.lifetime_views, s.average_view_percentage,
                   COALESCE(SUM(CASE WHEN d.day_index <= 1 THEN d.views ELSE 0 END), 0) AS early_views
            FROM videos v
            LEFT JOIN video_stats s ON s.video_id = v.video_id
            LEFT JOIN daily_views d ON d.video_id = v.video_id
            GROUP BY v.video_id
            """
        ).fetchall()

    buckets: dict[tuple[int, int], dict] = defaultdict(
        lambda: {"count": 0, "early_views_sum": 0, "lifetime_views_sum": 0, "retention_sum": 0.0, "retention_count": 0}
    )

    for r in rows:
        dt = datetime.fromisoformat(r["published_at"].replace("Z", "+00:00")).astimezone(tz)
        key = (dt.weekday(), dt.hour)
        b = buckets[key]
        b["count"] += 1
        b["early_views_sum"] += r["early_views"] or 0
        b["lifetime_views_sum"] += r["lifetime_views"] or 0
        if r["average_view_percentage"] is not None:
            b["retention_sum"] += r["average_view_percentage"]
            b["retention_count"] += 1

    result = []
    for (weekday, hour), b in buckets.items():
        result.append(
            {
                "weekday": weekday,
                "weekday_label": WEEKDAY_LABELS[weekday],
                "hour": hour,
                "video_count": b["count"],
                "avg_early_views": round(b["early_views_sum"] / b["count"], 1) if b["count"] else 0,
                "avg_lifetime_views": round(b["lifetime_views_sum"] / b["count"], 1) if b["count"] else 0,
                "avg_retention_pct": round(b["retention_sum"] / b["retention_count"], 2)
                if b["retention_count"]
                else None,
            }
        )
    return result
