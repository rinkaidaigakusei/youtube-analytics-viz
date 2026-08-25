import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { api } from "./api";
import Heatmap, { METRICS } from "./components/Heatmap";
import SyncBar from "./components/SyncBar";
import VideoTable from "./components/VideoTable";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [videos, setVideos] = useState([]);
  const [summary, setSummary] = useState([]);
  const [metric, setMetric] = useState("avg_early_views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const status = await api.authStatus();
      setAuthenticated(status.authenticated);
      if (status.authenticated) {
        const [videoList, summaryList] = await Promise.all([api.videos(), api.weekdayHourSummary()]);
        setVideos(videoList);
        setSummary(summaryList);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>YouTube Analytics Viz</h1>
        <p className="subtitle">投稿曜日・時間帯ごとの初速と視聴維持率を可視化</p>
      </header>

      <SyncBar authenticated={authenticated} onSynced={loadData} />

      {error && <p className="error-banner">エラー: {error}</p>}
      {loading && <p>読み込み中...</p>}

      {!loading && authenticated && (
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
              <Heatmap data={summary} metric={metric} />
            ) : (
              <p>まだデータがありません。「動画・Analyticsを同期」を実行してください。</p>
            )}
          </section>

          <section>
            <h2>動画一覧</h2>
            <VideoTable videos={videos} />
          </section>
        </>
      )}
    </div>
  );
}
