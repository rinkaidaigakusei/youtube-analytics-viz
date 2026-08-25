# YouTube Analytics Viz

自分のYouTubeチャンネルの動画を対象に、**投稿曜日・時間帯ごとの初速(公開後24〜48時間の再生数)や視聴維持率**を集計・可視化するツールです。

- 曜日 × 時間帯のヒートマップで「伸びやすい投稿タイミング」を一目で確認
- 動画一覧を公開日時でソート/フィルタできるテーブル
- 取得したデータはローカル(SQLite)にキャッシュし、APIクォータを節約

## 構成

モノレポ構成です。

```
youtube-analytics-viz/
├── backend/    # FastAPI: OAuth認証 + YouTube Data/Analytics API呼び出し + SQLiteキャッシュ
└── frontend/   # React (Vite): ヒートマップ・動画一覧テーブルの表示(GitHub Pages等で静的配信)
```

- **backend**: 個人のGoogleアカウントでOAuth認証し、YouTube Data API v3 / YouTube Analytics APIからデータを取得。取得結果は `backend/data/cache.db`(SQLite)に保存する。Vercel/Renderなどの無料枠にデプロイ想定。
- **frontend**: backendのAPIを叩いて集計結果を取得し、グラフ表示のみを担当。GitHub Pagesなど静的ホスティングで配信想定。

## セットアップ

### 1. Google Cloud Console 側の設定(最初に1回だけ)

1. [Google Cloud Console](https://console.cloud.google.com/) で新規プロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で以下の2つを有効化
   - **YouTube Data API v3**
   - **YouTube Analytics API**
3. 「APIとサービス」→「OAuth同意画面」を設定
   - User Type: **External**
   - スコープに以下を追加
     - `https://www.googleapis.com/auth/youtube.readonly`
     - `https://www.googleapis.com/auth/yt-analytics.readonly`
   - テストユーザーに自分のGoogleアカウント(対象チャンネルのオーナー)を追加
   - Publishing statusは **Testing** のままでOK(個人利用のため審査不要)
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みのリダイレクトURI: `http://localhost:8000/auth/callback`(本番デプロイ後は本番URLも追加)
   - 発行された **クライアントID** と **クライアントシークレット** を控える

### 2. バックエンド(FastAPI)

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate   # Windows (PowerShell/Git Bash)
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
```

`.env` を開き、Google Cloud Consoleで発行した値を入力する:

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
```

サーバー起動:

```bash
uvicorn app.main:app --reload --port 8000
```

ブラウザで `http://localhost:8000/auth/login` にアクセスして、Googleアカウントでログイン・認可する(初回のみ)。認可が成功すると `backend/data/token.json` にトークンが保存される(このファイルは`.gitignore`済みで絶対にコミットされない)。

データ取得(初回・以降は差分のみ):

```bash
curl -X POST http://localhost:8000/api/sync/videos      # 動画一覧を取得
curl -X POST http://localhost:8000/api/sync/analytics    # 各動画のAnalyticsデータを取得(キャッシュ済みはスキップ)
```

集計結果の確認:

```bash
curl http://localhost:8000/api/summary/weekday-hour
```

### 3. フロントエンド(React / Vite)

準備中(次のステップで実装します)。

```bash
cd frontend
npm install
npm run dev
```

## 環境変数・秘密情報の扱い

- `.env`(クライアントID/シークレット)、`backend/data/token.json`(OAuthトークン)、`backend/data/cache.db`(キャッシュ)はすべて `.gitignore` で除外済み。**誤ってコミットしないよう、GitHubへのpush前に `git status` で確認すること。**
- `backend/.env.example` にはダミー値のみを記載し、実際の値はコミットしない。

## API エンドポイント一覧(backend)

| Method | Path | 説明 |
|---|---|---|
| GET | `/auth/login` | Google OAuth認可画面へリダイレクト |
| GET | `/auth/callback` | OAuthコールバック(トークン保存) |
| GET | `/auth/status` | 認証済みかどうか |
| POST | `/api/sync/videos` | 動画一覧をYouTube Data APIから取得しキャッシュ |
| GET | `/api/videos` | キャッシュ済み動画一覧を返す |
| POST | `/api/sync/analytics?force=false` | 各動画のAnalyticsデータを取得しキャッシュ(`force=true`で再取得) |
| GET | `/api/summary/weekday-hour` | 曜日×時間帯ごとの集計(初速・累計再生数・視聴維持率) |

## 今後のTODO

- [ ] フロントエンド(ヒートマップ・動画一覧テーブル)の実装
- [ ] GitHub Pages / Vercel・Render へのデプロイ手順整備
