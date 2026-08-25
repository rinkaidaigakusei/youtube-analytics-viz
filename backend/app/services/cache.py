from datetime import datetime, timezone

import isodate
from google.oauth2.credentials import Credentials

from ..db import get_db
from . import youtube_analytics, youtube_data


def _parse_duration_seconds(iso_duration: str) -> int:
    return int(isodate.parse_duration(iso_duration).total_seconds())


def sync_videos(creds: Credentials) -> int:
    """YouTube Data APIから全動画を取得し、videosテーブルにupsertする"""
    videos = youtube_data.list_all_videos(creds)
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        for v in videos:
            conn.execute(
                """
                INSERT INTO videos (video_id, title, published_at, duration_seconds, thumbnail_url, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    title = excluded.title,
                    thumbnail_url = excluded.thumbnail_url,
                    fetched_at = excluded.fetched_at
                """,
                (
                    v["video_id"],
                    v["title"],
                    v["published_at"],
                    _parse_duration_seconds(v["duration"]),
                    v["thumbnail_url"],
                    now,
                ),
            )
    return len(videos)


def sync_analytics_for_video(creds: Credentials, video_id: str, published_at: str, force: bool = False) -> bool:
    """指定動画のAnalyticsデータを取得しキャッシュする。既にキャッシュ済みで force=False ならスキップ(APIクォータ節約)"""
    if not force:
        with get_db() as conn:
            existing = conn.execute("SELECT 1 FROM video_stats WHERE video_id = ?", (video_id,)).fetchone()
        if existing:
            return False

    daily = youtube_analytics.get_daily_views(creds, video_id, published_at, days=2)
    stats = youtube_analytics.get_video_stats(creds, video_id, published_at)
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        for d in daily:
            conn.execute(
                """
                INSERT INTO daily_views (video_id, day_index, date, views)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(video_id, day_index) DO UPDATE SET views = excluded.views
                """,
                (video_id, d["day_index"], d["date"], d["views"]),
            )
        conn.execute(
            """
            INSERT INTO video_stats
                (video_id, lifetime_views, average_view_percentage, average_view_duration_seconds, fetched_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(video_id) DO UPDATE SET
                lifetime_views = excluded.lifetime_views,
                average_view_percentage = excluded.average_view_percentage,
                average_view_duration_seconds = excluded.average_view_duration_seconds,
                fetched_at = excluded.fetched_at
            """,
            (
                video_id,
                stats["lifetime_views"],
                stats["average_view_percentage"],
                stats["average_view_duration_seconds"],
                now,
            ),
        )
    return True
