import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def is_short_video(video_id: str) -> bool:
    """YouTubeはShortsではない動画の /shorts/{id} URLを /watch?v={id} にリダイレクトする。
    この挙動を使ってShorts判定する(API quotaを消費しない)。"""
    try:
        resp = requests.head(
            f"https://www.youtube.com/shorts/{video_id}",
            allow_redirects=False,
            timeout=5,
        )
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _get_uploads_playlist_id(youtube) -> str:
    resp = youtube.channels().list(part="contentDetails", mine=True).execute()
    items = resp.get("items", [])
    if not items:
        raise RuntimeError("No channel found for the authenticated account.")
    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def list_all_videos(creds: Credentials) -> list[dict]:
    """自分のチャンネルの全動画(video_id, title, published_at, duration, thumbnail_url)を取得する"""
    youtube = build("youtube", "v3", credentials=creds)
    uploads_id = _get_uploads_playlist_id(youtube)

    video_ids: list[str] = []
    page_token = None
    while True:
        resp = (
            youtube.playlistItems()
            .list(part="contentDetails", playlistId=uploads_id, maxResults=50, pageToken=page_token)
            .execute()
        )
        video_ids.extend(item["contentDetails"]["videoId"] for item in resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    videos = []
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        resp = youtube.videos().list(part="snippet,contentDetails", id=",".join(chunk)).execute()
        for item in resp.get("items", []):
            thumbnails = item["snippet"].get("thumbnails", {})
            thumb = thumbnails.get("medium") or thumbnails.get("default") or {}
            videos.append(
                {
                    "video_id": item["id"],
                    "title": item["snippet"]["title"],
                    "published_at": item["snippet"]["publishedAt"],
                    "duration": item["contentDetails"]["duration"],
                    "thumbnail_url": thumb.get("url"),
                    "is_short": is_short_video(item["id"]),
                }
            )
    return videos
