"""トークンとキャッシュDBのファイルを、外部のPostgresに控えとして保存・復元する。

Renderの無料プランは、再デプロイだけでなく休止からの復帰でもディスクが消えるため、
ローカルのファイル(token.json / cache.db)だけに頼ると、開くたびに再ログイン・再同期が必要になる。
ファイルの中身をそのまま1行ずつ保存するだけなので、SQLiteを使う既存のコードは変えなくて済む。

DATABASE_URL が未設定なら何もしない(ローカル開発ではディスクが消えないので不要)。
"""

import logging
from pathlib import Path

from ..config import settings

logger = logging.getLogger(__name__)

FILES = {
    "token": lambda: Path(settings.token_file),
    "cache_db": lambda: Path(settings.db_file),
}

# 直近の保存・復元が成功したか(None = まだ何もしていない)。/auth/status で画面に知らせる
_last_ok: bool | None = None


def enabled() -> bool:
    return bool(settings.database_url)


def storage_ok() -> bool | None:
    """控えの保存先が使えているか。未設定なら None"""
    return _last_ok if enabled() else None


def _connect():
    import psycopg  # DATABASE_URL を使うときだけ必要

    conn = psycopg.connect(settings.database_url, connect_timeout=15)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_files ("
        "name TEXT PRIMARY KEY, content BYTEA NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    )
    return conn


def _fetch(name: str) -> bytes | None:
    with _connect() as conn:
        row = conn.execute("SELECT content FROM app_files WHERE name = %s", (name,)).fetchone()
    return bytes(row[0]) if row else None


def _store(name: str, content: bytes) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO app_files (name, content) VALUES (%s, %s) "
            "ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, updated_at = now()",
            (name, content),
        )


def restore_all() -> None:
    """起動時に呼ぶ。控えがあるファイルをローカルに書き戻す(控えが無いファイルは触らない)"""
    global _last_ok
    if not enabled():
        return
    try:
        for name, get_path in FILES.items():
            content = _fetch(name)
            if content is None:
                continue
            path = get_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            logger.info("Restored %s (%d bytes)", name, len(content))
        _last_ok = True
    except Exception:
        # 復元できなくても起動はする(再ログイン・再同期すれば使える)
        logger.exception("Could not restore files from DATABASE_URL")
        _last_ok = False


def save(name: str) -> None:
    """ローカルのファイルを控えとして保存する。失敗しても呼び出し元の処理は止めない"""
    global _last_ok
    if not enabled():
        return
    path = FILES[name]()
    if not path.exists():
        return
    try:
        _store(name, path.read_bytes())
        _last_ok = True
    except Exception:
        logger.exception("Could not save %s to DATABASE_URL", name)
        _last_ok = False
