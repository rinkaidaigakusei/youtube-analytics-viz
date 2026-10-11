import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { AppKeyError, api } from "./api";
import AppKeyGate from "./components/AppKeyGate";
import BestTimesRanking from "./components/BestTimesRanking";
import CommentsPanel from "./components/CommentsPanel";
import FirstDayChart from "./components/FirstDayChart";
import FormatCharts from "./components/FormatCharts";
import GrowthChart from "./components/GrowthChart";
import Heatmap, { METRICS } from "./components/Heatmap";
import SyncBar from "./components/SyncBar";
import VideoFilter from "./components/VideoFilter";
import VideoTable from "./components/VideoTable";
import WatchTimeChart from "./components/WatchTimeChart";
import { NO_FILTER, makeVideoFilter, yearMonthOptions } from "./videoFilter";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [videos, setVideos] = useState([]);
  const [summary, setSummary] = useState([]);
  const [comments, setComments] = useState([]);
  const [metric, setMetric] = useState("avg_early_views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // サーバーの合言葉が未入力・誤りのあいだは、入力欄だけを出す
  const [locked, setLocked] = useState(!api.hasAppKey());
  // サーバーが控えの保存先(外部DB)に接続できていない
  const [storageFailed, setStorageFailed] = useState(false);
  // 公開後24時間の記録(null = 読み込み中)。バックエンドとは別の場所から読む
  const [snapshotVideos, setSnapshotVideos] = useState(null);
  const [snapshotError, setSnapshotError] = useState(null);
  const [filter, setFilter] = useState(NO_FILTER);

  const loadData = useCallback(async () => {
    if (!api.hasAppKey()) {
      setLocked(true);
      setLoading(false);
      return;
    }
    try {
      await api.checkAppKey();
      setLocked(false);
      const status = await api.authStatus();
      setAuthenticated(status.authenticated);
      setStorageFailed(status.storage_ok === false);
      if (status.authenticated) {
        const [videoList, summaryList, commentList] = await Promise.all([
          api.videos(),
          api.weekdayHourSummary(),
          api.unrepliedComments(),
        ]);
        setVideos(videoList);
        setSummary(summaryList);
        setComments(commentList);
      }
      setError(null);
    } catch (err) {
      if (err instanceof AppKeyError) {
        // 保存してあった合言葉が通らなくなった(サーバー側で変えた等)ので、入れ直してもらう
        api.setAppKey(null);
        setLocked(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async () => {
    setComments(await api.unrepliedComments());
  }, []);

  const handleCommentReplied = useCallback((commentId) => {
    setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    api
      .firstDaySnapshots()
      .then((data) => setSnapshotVideos((data?.videos ?? []).filter((v) => v.points.length > 0)))
      .catch((err) => setSnapshotError(err.message));
  }, []);

  const matchesFilter = useMemo(() => makeVideoFilter(filter), [filter]);
  const filteredVideos = useMemo(() => videos.filter(matchesFilter), [videos, matchesFilter]);
  const filteredSnapshotVideos = useMemo(
    () => snapshotVideos?.filter(matchesFilter) ?? null,
    [snapshotVideos, matchesFilter]
  );
  const yearMonths = useMemo(
    () => yearMonthOptions([...videos, ...(snapshotVideos ?? [])]),
    [videos, snapshotVideos]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>YouTube Analytics Viz</h1>
        <p className="subtitle">投稿曜日・時間帯ごとの初速と視聴維持率を可視化</p>
      </header>

      {locked ? (
        <AppKeyGate onUnlocked={loadData} />
      ) : (
        <SyncBar authenticated={authenticated} onSynced={loadData} />
      )}

      <VideoFilter filter={filter} onChange={setFilter} yearMonths={yearMonths} />

      {/* 公開情報の記録だけで描けるので、バックエンドの認証・起動を待たずに表示する */}
      <section>
        <h2>公開後24時間の再生数比較</h2>
        <FirstDayChart
          videos={filteredSnapshotVideos}
          hasAnyVideo={(snapshotVideos?.length ?? 0) > 0}
          error={snapshotError}
        />
      </section>

      {storageFailed && (
        <p className="error-banner">
          サーバーが保存先のデータベースに接続できていません。このままだと、サーバーの休止時にログインとデータが消えます。
        </p>
      )}
      {error && <p className="error-banner">エラー: {error}</p>}
      {loading && <p>読み込み中...</p>}

      {!loading && !locked && authenticated && (
        <>
          <section className="metric-select">
            {Object.entries(METRICS).map(([key, { label }]) => (
              <button
                key={key}
                className={key === metric ? "metric-button active" : "metric-button"}
                onClick={() => setMetric(key)}
              >
                {label}
              </button>
            ))}
          </section>

          <section>
            {summary.length > 0 ? (
              <>
                <Heatmap data={summary} metric={metric} />
                <BestTimesRanking summary={summary} />
              </>
            ) : (
              <p>まだデータがありません。「動画・Analyticsを同期」を実行してください。</p>
            )}
          </section>

          <section>
            <h2>フォーマット別再生数</h2>
            <FormatCharts videos={filteredVideos} />
          </section>

          <section>
            <h2>再生数の推移</h2>
            {/* 絞り込みが変わったら選択中の動画を先頭に戻すため、作り直す */}
            {filteredVideos.length > 0 ? (
              <GrowthChart key={`${filter.period}/${filter.weekday}`} videos={filteredVideos} />
            ) : (
              <p>この条件に合う動画はありません。</p>
            )}
          </section>

          <section>
            <h2>横動画の総再生時間比較</h2>
            <WatchTimeChart videos={videos} matchesFilter={matchesFilter} />
          </section>

          <section>
            <CommentsPanel comments={comments} onSynced={loadComments} onCommentReplied={handleCommentReplied} />
          </section>

          <section>
            <h2>動画一覧</h2>
            <VideoTable videos={filteredVideos} />
          </section>
        </>
      )}

      <footer className="app-footer">
        <a href="privacy.html">プライバシーポリシー</a>
      </footer>
    </div>
  );
}
