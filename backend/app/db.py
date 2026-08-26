import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    published_at TEXT NOT NULL,
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    is_short INTEGER,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    comment_id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    video_title TEXT,
    author_display_name TEXT,
    text TEXT,
    published_at TEXT,
    like_count INTEGER,
    replied INTEGER NOT NULL DEFAULT 0,
    comments_disabled INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

CREATE TABLE IF NOT EXISTS daily_views (
    video_id TEXT NOT NULL,
    day_index INTEGER NOT NULL,
    date TEXT NOT NULL,
    views INTEGER NOT NULL,
    PRIMARY KEY (video_id, day_index),
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

CREATE TABLE IF NOT EXISTS video_stats (
    video_id TEXT PRIMARY KEY,
    lifetime_views INTEGER,
    average_view_percentage REAL,
    average_view_duration_seconds REAL,
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);
"""


def _db_path() -> Path:
    path = Path(settings.db_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def get_db():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)
        # 既存DBに対する簡易マイグレーション(is_shortカラムが無い場合のみ追加)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(videos)")}
        if "is_short" not in columns:
            conn.execute("ALTER TABLE videos ADD COLUMN is_short INTEGER")
