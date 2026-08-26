from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def get_my_channel_id(youtube) -> str:
    resp = youtube.channels().list(part="id", mine=True).execute()
    return resp["items"][0]["id"]


def _fetch_all_replies(youtube, parent_id: str) -> list[dict]:
    replies = []
    page_token = None
    while True:
        resp = (
            youtube.comments()
            .list(part="snippet", parentId=parent_id, maxResults=100, pageToken=page_token, textFormat="plainText")
            .execute()
        )
        replies.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return replies


def list_video_comment_threads(creds: Credentials, video_id: str) -> tuple[list[dict], bool]:
    """指定動画の全コメントスレッドを取得し、(threads, comments_disabled) を返す。
    各threadは {comment_id, author, text, published_at, like_count, replied} の形。"""
    youtube = build("youtube", "v3", credentials=creds)
    my_channel_id = get_my_channel_id(youtube)

    threads = []
    page_token = None
    try:
        while True:
            resp = (
                youtube.commentThreads()
                .list(
                    part="snippet,replies",
                    videoId=video_id,
                    maxResults=100,
                    pageToken=page_token,
                    textFormat="plainText",
                )
                .execute()
            )
            for thread in resp.get("items", []):
                top = thread["snippet"]["topLevelComment"]
                top_snippet = top["snippet"]
                author_channel_id = top_snippet.get("authorChannelId", {}).get("value")

                if author_channel_id == my_channel_id:
                    continue  # 自分自身の投稿はスキップ

                total_replies = thread["snippet"].get("totalReplyCount", 0)
                replies = thread.get("replies", {}).get("comments", [])
                if total_replies > len(replies):
                    replies = _fetch_all_replies(youtube, top["id"])

                replied = any(
                    r["snippet"].get("authorChannelId", {}).get("value") == my_channel_id for r in replies
                )

                threads.append(
                    {
                        "comment_id": top["id"],
                        "author_display_name": top_snippet.get("authorDisplayName"),
                        "text": top_snippet.get("textDisplay", ""),
                        "published_at": top_snippet.get("publishedAt"),
                        "like_count": top_snippet.get("likeCount", 0),
                        "replied": replied,
                    }
                )
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
    except HttpError as e:
        if e.resp.status in (403, 404):
            return [], True
        raise

    return threads, False


def post_reply(creds: Credentials, parent_comment_id: str, text: str) -> dict:
    youtube = build("youtube", "v3", credentials=creds)
    resp = (
        youtube.comments()
        .insert(part="snippet", body={"snippet": {"parentId": parent_comment_id, "textOriginal": text}})
        .execute()
    )
    return resp
