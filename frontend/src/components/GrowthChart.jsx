import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";

export default function GrowthChart({ videos }) {
  const sortedVideos = useMemo(
    () => [...videos].sort((a, b) => new Date(b.published_at) - new Date(a.published_at)),
    [videos]
  );

  const [selectedId, setSelectedId] = useState(sortedVideos[0]?.video_id ?? "");
  const [dailyViews, setDailyViews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedId && sortedVideos[0]) {
      setSelectedId(sortedVideos[0].video_id);
    }
  }, [sortedVideos, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    api
      .dailyViews(selectedId)
      .then(setDailyViews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const chartData = dailyViews.map((d) => ({ day: `${d.day_index}日目`, views: d.views }));

  return (
    <div className="growth-chart">
      <h3>公開後の再生数推移</h3>
      <select
        className="growth-chart-select"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {sortedVideos.map((v) => (
          <option key={v.video_id} value={v.video_id}>
            {new Date(v.published_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} - {v.title}
          </option>
        ))}
      </select>

      {loading && <p>読み込み中...</p>}
      {error && <p className="error-banner">エラー: {error}</p>}
      {!loading && !error && chartData.length === 0 && <p>データがありません。</p>}
      {!loading && !error && chartData.length > 0 && (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [value.toLocaleString(), "再生数"]} />
              <Line type="monotone" dataKey="views" stroke="#7f77dd" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
