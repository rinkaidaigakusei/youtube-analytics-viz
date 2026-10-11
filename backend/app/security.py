import hmac

from fastapi import Header, HTTPException

from .config import settings


def require_app_key(authorization: str | None = Header(None)) -> None:
    """合言葉(APP_PASSWORD)を知っているリクエストだけを通す。

    このAPIは公開URLで動いており、YouTubeのデータ閲覧やコメント返信の投稿ができるため、
    合言葉が未設定のときは全部拒否する(設定し忘れたまま無防備で動かさない)。
    """
    expected = settings.app_password
    if not expected:
        raise HTTPException(status_code=503, detail="APP_PASSWORD is not configured on the server.")

    supplied = (authorization or "").removeprefix("Bearer ")
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        # 401はGoogle未ログインの意味で使っているので、合言葉の誤りは403で区別する
        raise HTTPException(status_code=403, detail="Invalid app key.")
