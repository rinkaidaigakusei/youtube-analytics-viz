"""公開後24時間以内の動画の再生数を記録するスクリプト(GitHub Actionsから定期実行する)。

YouTube Analytics APIは日別の値しか返さないため、公開直後の時間単位の伸びは
「今の再生数」を定期的に記録して自前で作るしかない。公開情報だけを使うので
OAuthトークンは不要で、APIキーだけで動く(標準ライブラリのみ)。

使い方:
    YT_API_KEY=... YT_CHANNEL_ID=UC... python collect_snapshots.py path/to/snapshots.json
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_BASE = "https://www.googleapis.com/youtube/v3"
TRACK_MINUTES = 24 * 60
# 24時間ちょうどの値を補間で出せるよう、24時間を少し過ぎた1点が取れるまでは追跡を続ける
GRACE_MINUTES = 90


def api_get(path: str, api_key: str, **params) -> dict:
    query = urllib.parse.urlencode({**params, "key": api_key})
    try:
        with urllib.request.urlopen(f"{API_BASE}/{path}?{query}", timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        # 例外メッセージにURL(APIキー入り)を残さない
        detail = err.read().decode("utf-8", "replace")[:500]
        raise SystemExit(f"YouTube API error {err.code} on {path}: {detail}") from None


def parse_time(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def parse_duration_seconds(iso_duration: str) -> int | None:
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", iso_duration or "")
    if not m:
        return None
    days, hours, minutes, seconds = (int(g or 0) for g in m.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def is_short_video(video_id: str) -> bool | None:
    """YouTubeはShortsではない動画の /shorts/{id} を /watch にリダイレクトする(backendと同じ判定)"""
    req = urllib.request.Request(f"https://www.youtube.com/shorts/{video_id}", method="HEAD")

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=10) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as err:
        return False if err.code in (301, 302, 303, 307, 308) else None
    except OSError:
        return None


def recent_uploads(api_key: str, channel_id: str) -> list[dict]:
    """チャンネルの直近のアップロード(最大50件)。アップロード再生リストのIDは UC→UU の置換で得られる"""
    uploads_id = "UU" + channel_id[2:]
    resp = api_get("playlistItems", api_key, part="snippet,contentDetails", playlistId=uploads_id, maxResults=50)
    uploads = []
    for item in resp.get("items", []):
        published_at = item["contentDetails"].get("videoPublishedAt")
        if not published_at:
            continue
        uploads.append(
            {
                "video_id": item["contentDetails"]["videoId"],
                "title": item["snippet"]["title"],
                "published_at": published_at,
            }
        )
    return uploads


def needs_tracking(upload: dict, existing: dict | None, now: datetime) -> bool:
    age_minutes = (now - parse_time(upload["published_at"])).total_seconds() / 60
    if age_minutes < 0 or age_minutes > TRACK_MINUTES + GRACE_MINUTES:
        return False
    points = existing["points"] if existing else []
    return not any(p[0] >= TRACK_MINUTES for p in points)


def collect(data: dict, api_key: str, channel_id: str, now: datetime) -> int:
    """追跡対象の動画に1点ずつ記録を足す。足した点の数を返す"""
    by_id = {v["video_id"]: v for v in data["videos"]}
    targets = [u for u in recent_uploads(api_key, channel_id) if needs_tracking(u, by_id.get(u["video_id"]), now)]
    if not targets:
        return 0

    resp = api_get(
        "videos", api_key, part="statistics,contentDetails", id=",".join(u["video_id"] for u in targets)
    )
    items = {item["id"]: item for item in resp.get("items", [])}

    added = 0
    for upload in targets:
        item = items.get(upload["video_id"])
        stats = item["statistics"] if item else {}
        if "viewCount" not in stats:
            continue

        video = by_id.get(upload["video_id"])
        if video is None:
            video = {
                "video_id": upload["video_id"],
                "title": upload["title"],
                "published_at": upload["published_at"],
                "duration_seconds": parse_duration_seconds(item["contentDetails"].get("duration")),
                "is_short": is_short_video(upload["video_id"]),
                "points": [],
            }
            by_id[upload["video_id"]] = video
        video["title"] = upload["title"]

        elapsed = (now - parse_time(upload["published_at"])).total_seconds() / 60
        like_count = int(stats["likeCount"]) if "likeCount" in stats else None
        comment_count = int(stats["commentCount"]) if "commentCount" in stats else None
        # [公開からの経過分, 再生数, 高評価数, コメント数]
        video["points"].append([round(elapsed, 1), int(stats["viewCount"]), like_count, comment_count])
        added += 1

    data["videos"] = sorted(by_id.values(), key=lambda v: v["published_at"], reverse=True)
    return added


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: collect_snapshots.py <snapshots.json>")
    api_key = os.environ.get("YT_API_KEY")
    channel_id = os.environ.get("YT_CHANNEL_ID")
    if not api_key or not channel_id:
        raise SystemExit("YT_API_KEY and YT_CHANNEL_ID must be set.")

    path = Path(sys.argv[1])
    is_new_file = not path.exists()
    data = {"videos": []} if is_new_file else json.loads(path.read_text(encoding="utf-8"))

    now = datetime.now(timezone.utc)
    added = collect(data, api_key, channel_id, now)
    print(f"recorded {added} point(s)")

    # 追跡対象が無いときは書き込まない(=コミットも発生しない)。初回だけは空ファイルを作る
    if added or is_new_file:
        data["updated_at"] = now.isoformat(timespec="seconds")
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
