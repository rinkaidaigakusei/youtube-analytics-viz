from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]

# PKCE code_verifier は authorization_url 発行時と token 交換時で同じ値が必要。
# 個人利用のシングルユーザーアプリなので、state をキーにプロセスメモリで橋渡しする。
_pending_code_verifiers: dict[str, str] = {}


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def _token_path() -> Path:
    path = Path(settings.token_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@router.get("/login")
def login():
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=settings.google_redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    _pending_code_verifiers[state] = flow.code_verifier
    return RedirectResponse(auth_url)


@router.get("/callback")
def callback(code: str, state: str):
    code_verifier = _pending_code_verifiers.pop(state, None)
    if code_verifier is None:
        raise HTTPException(status_code=400, detail="Unknown or expired OAuth state. Please try /auth/login again.")

    flow = Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=settings.google_redirect_uri,
        code_verifier=code_verifier,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    _token_path().write_text(creds.to_json(), encoding="utf-8")
    return RedirectResponse(settings.frontend_origin)


@router.get("/status")
def status():
    return {"authenticated": _token_path().exists()}


def load_credentials() -> Credentials:
    token_path = _token_path()
    if not token_path.exists():
        raise HTTPException(status_code=401, detail="Not authenticated. Visit /auth/login first.")

    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        token_path.write_text(creds.to_json(), encoding="utf-8")
    return creds
