from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import analytics, auth, comments, videos
from .services import persist


@asynccontextmanager
async def lifespan(app: FastAPI):
    persist.restore_all()
    init_db()
    yield


app = FastAPI(title="YouTube Analytics Viz API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def save_cache_after_writes(request: Request, call_next):
    """データを書き換えるAPI(同期・コメント返信)が成功したら、キャッシュDBの控えを取り直す"""
    response = await call_next(request)
    if request.method == "POST" and request.url.path.startswith("/api/") and response.status_code < 400:
        await run_in_threadpool(persist.save, "cache_db")
    return response


app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(analytics.router)
app.include_router(comments.router)


@app.get("/")
def root():
    return {"status": "ok"}
