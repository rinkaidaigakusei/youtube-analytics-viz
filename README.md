# YouTube Analytics Viz

自分のYouTubeチャンネルの動画を対象に、**投稿曜日・時間帯ごとの初速(公開後24〜48時間の再生数)や視聴維持率**を集計・可視化するツールです。

- 曜日 × 時間帯のヒートマップで「伸びやすい投稿タイミング」を一目で確認
- Shorts / 横動画をフォーマット別に分けた再生数グラフ
- 未返信コメントの一覧表示・アプリ上からの返信投稿
- 動画一覧を公開日時でソート/フィルタできるテーブル
- 公開後24時間の再生数を動画どうしで比較できる折れ線グラフ(定期的に自動記録)
- 横動画の総再生時間(累計)を、公開からの日数で動画どうしで比較できる折れ線グラフ
- 取得したデータはローカル(SQLite)にキャッシュし、APIクォータを節約

## 構成

モノレポ構成です。

```
youtube-analytics-viz/
├── backend/    # FastAPI: OAuth認証 + YouTube Data/Analytics API呼び出し + SQLiteキャッシュ
├── collector/  # 公開後24時間の再生数を記録するスクリプト(GitHub Actionsが定期実行)
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
     - `https://www.googleapis.com/auth/youtube.force-ssl`(コメント取得・返信に必要。読み取り専用の代替スコープは無い)
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

`.env` を開き、Google Cloud Consoleで発行した値と、APIを使うための合言葉を入力する:

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
APP_PASSWORD=長くて推測されにくい文字列
```

`APP_PASSWORD` が未設定だと、APIは全リクエストを拒否する(503)。

サーバー起動:

```bash
uvicorn app.main:app --reload --port 8000
```

フロントエンドを開いて合言葉を入力し、「Googleでログイン」を押して認可する(初回のみ)。認可が成功すると `backend/data/token.json` にトークンが保存される(このファイルは`.gitignore`済みで絶対にコミットされない)。

データ取得(初回・以降は差分のみ):

```bash
# /api/ 以下はすべて合言葉が必要(Authorization: Bearer <APP_PASSWORD>)
curl -X POST -H "Authorization: Bearer $APP_PASSWORD" http://localhost:8000/api/sync/videos      # 動画一覧を取得
curl -X POST -H "Authorization: Bearer $APP_PASSWORD" http://localhost:8000/api/sync/analytics    # 各動画のAnalyticsデータを取得
```

集計結果の確認:

```bash
curl -H "Authorization: Bearer $APP_PASSWORD" http://localhost:8000/api/summary/weekday-hour
```

### 3. フロントエンド(React / Vite)

準備中(次のステップで実装します)。

```bash
cd frontend
npm install
npm run dev
```

## 公開後24時間の再生数比較

YouTube Analytics APIは日別の値しか返さないため、公開直後の時間単位の伸びは「その時点の再生数」を定期的に記録して作っています。

- [.github/workflows/collect-snapshots.yml](.github/workflows/collect-snapshots.yml) が定期的に(5分おき指定。GitHubの都合で実際の間隔は長くなる) [collector/collect_snapshots.py](collector/collect_snapshots.py) を実行し、公開から24時間以内の動画の再生数を `data` ブランチの `snapshots.json` に追記する(対象の動画が無いときは何もコミットしない)
- フロントエンドはその `snapshots.json` を直接読み込んでグラフにする(バックエンドは経由しない)
- **記録を始める前に投稿した動画は、時間単位のデータが存在しないため表示できない**

### セットアップ(最初に1回だけ)

1. Google Cloud Console の「APIとサービス」→「認証情報」→「認証情報を作成」→「**APIキー**」でキーを発行する(「APIの制限」で YouTube Data API v3 のみに絞るのがおすすめ)
2. GitHubリポジトリの Settings > Secrets and variables > Actions > **Secrets** タブで `YT_API_KEY` という名前で登録する
3. Actions タブ > 「Collect first-24h view snapshots」> 「Run workflow」で一度手動実行し、成功すること(`data` ブランチができること)を確認する

別のチャンネルで使う場合は、ワークフロー内の `YT_CHANNEL_ID` を書き換える。

**注意**: GitHubの仕様で、リポジトリに60日間動きが無いと定期実行が自動で止まる(GitHubからメールが届く)。止まった場合は Actions タブから再度有効化する。

## 環境変数・秘密情報の扱い

- `.env`(クライアントID/シークレット)、`backend/data/token.json`(OAuthトークン)、`backend/data/cache.db`(キャッシュ)はすべて `.gitignore` で除外済み。**誤ってコミットしないよう、GitHubへのpush前に `git status` で確認すること。**
- `backend/.env.example` にはダミー値のみを記載し、実際の値はコミットしない。

## API エンドポイント一覧(backend)

`/api/` 以下と `POST /auth/login` は、`Authorization: Bearer <APP_PASSWORD>` ヘッダーが無いと 403 を返す。

| Method | Path | 説明 |
|---|---|---|
| POST | `/auth/login` | Google OAuth認可画面のURLを返す(合言葉が必要) |
| GET | `/auth/callback` | OAuthコールバック(トークン保存) |
| GET | `/auth/status` | 認証済みかどうか |
| GET | `/api/session` | 合言葉が正しいかの確認用 |
| POST | `/api/sync/videos` | 動画一覧をYouTube Data APIから取得しキャッシュ |
| GET | `/api/videos` | キャッシュ済み動画一覧を返す |
| POST | `/api/sync/analytics?force=false` | 各動画のAnalyticsデータ(日別の再生数・再生時間など)を取得しキャッシュ。6時間以内に取得済みの動画はスキップ(`force=true`で再取得) |
| GET | `/api/summary/weekday-hour` | 曜日×時間帯ごとの集計(初速・累計再生数・視聴維持率) |
| GET | `/api/summary/watch-time` | 動画ごとの日別再生時間(分)。総再生時間の比較グラフ用 |
| POST | `/api/sync/comments` | 全動画のコメントを取得しキャッシュ |
| GET | `/api/comments?unreplied_only=true` | 未返信コメント一覧(デフォルトで未返信のみ) |
| POST | `/api/comments/{comment_id}/reply` | 指定コメントへ返信を投稿(body: `{"text": "..."}`) |

## デプロイ

### フロントエンド → GitHub Pages

1. リポジトリの Settings > Pages で、Source を「**GitHub Actions**」に設定
2. Settings > Secrets and variables > Actions > **Variables** タブで `VITE_API_BASE_URL` を追加し、デプロイ済みバックエンドのURLを設定(例: `https://youtube-analytics-viz-backend.onrender.com`)
3. `main`ブランチに`frontend/`配下の変更をpushすると、[.github/workflows/deploy-frontend.yml](.github/workflows/deploy-frontend.yml)が自動でビルド・公開する(`https://<GitHubユーザー名>.github.io/youtube-analytics-viz/`)

### バックエンド → Render

[render.yaml](render.yaml) を使ったBlueprintデプロイに対応しています。

1. Renderで「New +」→「Blueprint」→ このリポジトリを選択
2. 環境変数(`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `FRONTEND_ORIGIN` / `APP_PASSWORD`)を入力
   - `APP_PASSWORD`: APIを使うための合言葉。公開URLで動くので必ず設定する
   - `GOOGLE_REDIRECT_URI`: `https://<デプロイ先のURL>/auth/callback`
   - `FRONTEND_ORIGIN`: `https://<GitHubユーザー名>.github.io`(GitHub Pagesのオリジン。ローカルも試すなら`http://localhost:5173,https://<GitHubユーザー名>.github.io`のようにカンマ区切りで併記)
3. Google Cloud Console の OAuthクライアント設定で「承認済みのリダイレクトURI」に本番の`GOOGLE_REDIRECT_URI`を追加
4. デプロイ後、フロントエンドを開いて合言葉を入力し、「Googleでログイン」を押してログインしておく

**注意(無料プランの制約)**: Renderの無料プランはディスクが永続化されないため、再デプロイのたびに`token.json`(認証情報)と`cache.db`(キャッシュ)が消え、再ログイン・再同期が必要になる。個人利用でたまにしか再デプロイしないなら実用上問題ないが、頻繁に再デプロイする場合はRenderの永続ディスク(有料)を検討すること。**Vercelのサーバーレス関数はリクエストごとにファイルシステムがリセットされるため、このアプリのファイルベースのトークン/キャッシュ保存方式とは相性が悪く非推奨。**

## 今後のTODO

- [x] フロントエンド(ヒートマップ・動画一覧テーブル)の実装
- [x] GitHub Pages / Render へのデプロイ手順整備
