from datetime import date, datetime
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def _build_analytics(creds: Credentials):
    return build("youtubeAnalytics", "v2", credentials=creds)


# YouTube Analyticsの「日」は太平洋時間で区切られる
ANALYTICS_TZ = ZoneInfo("America/Los_Angeles")


def _parse_published_date(published_at: str) -> date:
    """公開日(太平洋時間)。UTCの日付で数えると、日本の日中に公開した動画の最初の数時間分が集計から漏れる"""
    return datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone(ANALYTICS_TZ).date()


def get_daily_views(creds: Credentials, video_id: str, published_at: str) -> list[dict]:
    """公開日から現在までの日別の再生数・再生時間(分)"""
    analytics = _build_analytics(creds)
    start = _parse_published_date(published_at)
    end = datetime.now(ANALYTICS_TZ).date()
    if end < start:
        return []

    resp = (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            metrics="views,estimatedMinutesWatched",
            dimensions="day",
            filters=f"video=={video_id}",
            sort="day",
        )
        .execute()
    )
    # 再生が無かった日は行ごと返ってこないことがあるので、day_index は日付から求める
    return [
        {
            "day_index": (date.fromisoformat(row[0]) - start).days,
            "date": row[0],
            "views": int(row[1]),
            "watch_minutes": int(row[2]),
        }
        for row in resp.get("rows", [])
    ]


def get_video_stats(creds: Credentials, video_id: str, published_at: str) -> dict:
    """公開日〜現在までの累計再生数・平均視聴維持率・平均視聴時間"""
    analytics = _build_analytics(creds)
    start = _parse_published_date(published_at)
    end = datetime.now(ANALYTICS_TZ).date()
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
