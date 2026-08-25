from datetime import date, datetime, timedelta, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def _build_analytics(creds: Credentials):
    return build("youtubeAnalytics", "v2", credentials=creds)


def _parse_published_date(published_at: str) -> date:
    return datetime.fromisoformat(published_at.replace("Z", "+00:00")).date()


def get_daily_views(creds: Credentials, video_id: str, published_at: str, days: int = 2) -> list[dict]:
    """公開日から days 日分の日別再生数(初速の把握用)"""
    analytics = _build_analytics(creds)
    start = _parse_published_date(published_at)
    end = min(start + timedelta(days=days), datetime.now(timezone.utc).date())
    if end < start:
        return []

    resp = (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            metrics="views",
            dimensions="day",
            filters=f"video=={video_id}",
            sort="day",
        )
        .execute()
    )
    rows = resp.get("rows", [])
    return [{"day_index": i, "date": row[0], "views": int(row[1])} for i, row in enumerate(rows)]


def get_video_stats(creds: Credentials, video_id: str, published_at: str) -> dict:
    """公開日〜現在までの累計再生数・平均視聴維持率・平均視聴時間"""
    analytics = _build_analytics(creds)
    start = _parse_published_date(published_at)
    end = datetime.now(timezone.utc).date()
    if end < start:
        end = start

    resp = (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            metrics="views,averageViewPercentage,averageViewDuration",
            filters=f"video=={video_id}",
        )
        .execute()
    )
    rows = resp.get("rows", [])
    if not rows:
        return {"lifetime_views": 0, "average_view_percentage": None, "average_view_duration_seconds": None}

    row = rows[0]
    return {
        "lifetime_views": int(row[0]),
        "average_view_percentage": float(row[1]),
        "average_view_duration_seconds": float(row[2]),
    }
