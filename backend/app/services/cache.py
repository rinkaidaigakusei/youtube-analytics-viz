from datetime import datetime, timezone

import isodate
from google.oauth2.credentials import Credentials

from ..db import get_db
from . import youtube_analytics, youtube_comments, youtube_data


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
                INSERT INTO videos (video_id, title, published_at, duration_seconds, thumbnail_url, is_short, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    title = excluded.title,
                    thumbnail_url = excluded.thumbnail_url,
                    is_short = excluded.is_short,
                    fetched_at = excluded.fetched_at
                """,
                (
                    v["video_id"],
                    v["title"],
                    v["published_at"],
                    _parse_duration_seconds(v["duration"]),
                    v["thumbnail_url"],
                    int(v["is_short"]),
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

    # 初速(day_index<=1)だけでなく、公開後の再生数推移グラフにも使うため長めに取得する
    daily = youtube_analytics.get_daily_views(creds, video_id, published_at, days=29)
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


def sync_comments(creds: Credentials) -> dict:
    """全動画のコメントスレッドを取得し、commentsテーブルにupsertする"""
    with get_db() as conn:
        videos = conn.execute("SELECT video_id, title FROM videos").fetchall()

    now = datetime.now(timezone.utc).isoformat()
    synced_videos = 0
    disabled_videos = 0
    total_comments = 0

    for v in videos:
        threads, comments_disabled = youtube_comments.list_video_comment_threads(creds, v["video_id"])
        if comments_disabled:
            disabled_videos += 1
            continue
        synced_videos += 1

        with get_db() as conn:
            for t in threads:
                conn.execute(
                    """
                    INSERT INTO comments
                        (comment_id, video_id, video_title, author_display_name, text, published_at,
                         like_count, replied, comments_disabled, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                    ON CONFLICT(comment_id) DO UPDATE SET
                        text = excluded.text,
                        like_count = excluded.like_count,
                        replied = excluded.replied,
                        fetched_at = excluded.fetched_at
                    """,
                    (
                        t["comment_id"],
                        v["video_id"],
                        v["title"],
                        t["author_display_name"],
                        t["text"],
                        t["published_at"],
                        t["like_count"],
                        int(t["replied"]),
                        now,
                    ),
                )
                total_comments += 1

    return {"synced_videos": synced_videos, "disabled_videos": disabled_videos, "total_comments": total_comments}


def mark_comment_replied(comment_id: str) -> None:
    with get_db() as conn:
        conn.execute("UPDATE comments SET replied = 1 WHERE comment_id = ?", (comment_id,))
