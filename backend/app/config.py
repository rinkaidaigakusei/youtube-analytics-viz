from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str = "http://localhost:8000/auth/callback"
    frontend_origin: str = "http://localhost:5173"
    # OAuthログイン成功後にリダイレクトする実際のページURL(GitHub Pagesはサブパス配信のため
    # frontend_origin(CORS用のオリジンのみ)とは別に持つ必要がある)
    post_login_redirect_url: str = "http://localhost:5173/"
    token_file: str = "data/token.json"
    db_file: str = "data/cache.db"
    timezone: str = "Asia/Tokyo"
    # APIを使うための合言葉。未設定だとAPIは全リクエストを拒否する(security.py)
    app_password: str = ""
    # トークンとキャッシュDBの控えを置くPostgresの接続文字列(services/persist.py)。未設定なら控えは取らない
    database_url: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def frontend_origins(self) -> list[str]:
        """カンマ区切りで複数オリジンを指定できる(例: ローカル + GitHub Pages)"""
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


settings = Settings()
