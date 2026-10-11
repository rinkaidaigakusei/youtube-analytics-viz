import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import SeriesChips, { formatPublished, seriesColor, useSeriesSlots } from "./SeriesChips";

const DEFAULT_SELECTED = 5;
const RANGES = [
  { key: 7, label: "7日" },
  { key: 30, label: "30日" },
  { key: "all", label: "全期間" },
];
const MILESTONE_DAYS = [1, 3, 7, 30];
// YouTube Analyticsの日別データは反映が2〜3日遅れるので、その分は線を伸ばさない
const ANALYTICS_LAG_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatHours(hours) {
  return `${hours.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}時間`;
}

/** 日別の再生時間(分)を、公開からの日数ごとの累計(時間)に直す。index = 公開からの日数(0 = 公開日) */
function toCumulativeHours(video) {
  const minutesByDay = new Map(video.days);
  const lastDataDay = video.days.length > 0 ? video.days[video.days.length - 1][0] : -1;
  const elapsedDays = Math.floor((new Date(video.fetched_at) - new Date(video.published_at)) / DAY_MS);
  const lastDay = Math.max(lastDataDay, elapsedDays - ANALYTICS_LAG_DAYS);

  const cumulative = [];
  let totalMinutes = 0;
  for (let day = 0; day <= lastDay; day++) {
    totalMinutes += minutesByDay.get(day) ?? 0;
    cumulative.push(Math.round((totalMinutes / 60) * 10) / 10);
  }
  return cumulative;
}

function ChartTooltip({ active, label, payload, selected }) {
  if (!active || !payload) return null;
  const rows = selected
    .map(({ video, slot }) => ({ video, slot, value: payload.find((p) => p.dataKey === video.video_id)?.value }))
    .filter((r) => r.value !== null && r.value !== undefined)
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label === 0 ? "公開日" : `公開から${label}日目`}までの累計</div>
      {rows.map(({ video, slot, value }) => (
        <div key={video.video_id} className="chart-tooltip-row">
          <span className="series-key" style={{ background: seriesColor(slot) }} />
          <strong>{formatHours(value)}</strong>
          <span className="chart-tooltip-title">{video.title}</span>
        </div>
      ))}
    </div>
  );
}

export default function WatchTimeChart({ videos: syncedVideos }) {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(30);
  const { slots, selectFirst, toggle } = useSeriesSlots();

  // syncedVideos が変わる(=同期し直した)たびに取り直す
  useEffect(() => {
    api
      .watchTime()
      .then((list) => {
        const landscape = list.filter((v) => !v.is_short && v.days.length > 0);
        setVideos(landscape);
        selectFirst(
          landscape.map((v) => v.video_id),
          DEFAULT_SELECTED
        );
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [syncedVideos, selectFirst]);

  const prepared = useMemo(
    () => (videos ?? []).map((video) => ({ video, cumulative: toCumulativeHours(video) })),
    [videos]
  );
  const selected = prepared
    .filter(({ video }) => video.video_id in slots)
    .map((p) => ({ ...p, slot: slots[p.video.video_id] }));
  const context = prepared.filter(({ video }) => !(video.video_id in slots));

  const longest = Math.max(1, ...prepared.map(({ cumulative }) => cumulative.length - 1));
  const maxDay = range === "all" ? longest : range;

  const chartData = useMemo(() => {
    const rows = [];
    for (let day = 0; day <= maxDay; day++) {
      const row = { day };
      for (const { video, cumulative } of prepared) row[video.video_id] = cumulative[day] ?? null;
      rows.push(row);
    }
    return rows;
  }, [prepared, maxDay]);

  if (error) return <p className="error-banner">再生時間を読み込めませんでした: {error}</p>;
  if (videos === null) return <p>読み込み中...</p>;
  if (videos.length === 0) {
    return (
      <p className="series-hint">再生時間のデータがまだありません。「動画・Analyticsを同期」を実行してください。</p>
    );
  }

  return (
    <div className="series-chart">
      <div className="metric-select">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            className={key === range ? "metric-button active" : "metric-button"}
            onClick={() => setRange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <SeriesChips videos={videos} slots={slots} onToggle={toggle} />

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, maxDay]}
              allowDecimals={false}
              tickFormatter={(d) => `${d}日`}
              tick={{ fontSize: 12, fill: "var(--chart-muted)" }}
              stroke="var(--chart-axis)"
            />
            <YAxis
              tickFormatter={(v) => `${v.toLocaleString()}h`}
              tick={{ fontSize: 12, fill: "var(--chart-muted)" }}
              stroke="var(--chart-axis)"
            />
            <Tooltip
              content={<ChartTooltip selected={selected} />}
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {context.map(({ video }) => (
              <Line
                key={video.video_id}
                dataKey={video.video_id}
                type="linear"
                stroke="var(--chart-context)"
                strokeWidth={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {selected.map(({ video, slot }) => (
              <Line
                key={video.video_id}
                dataKey={video.video_id}
                type="linear"
                stroke={seriesColor(slot)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--bg)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selected.length > 0 && (
        <div className="video-table-scroll">
          <table className="video-table series-table">
            <thead>
              <tr>
                <th>動画</th>
                <th>公開日時</th>
                {MILESTONE_DAYS.map((d) => (
                  <th key={d} className="num">
                    {d}日目まで
                  </th>
                ))}
                <th className="num">現在までの累計</th>
              </tr>
            </thead>
            <tbody>
              {selected.map(({ video, cumulative, slot }) => (
                <tr key={video.video_id}>
                  <td className="cell-title">
                    <span className="series-key" style={{ background: seriesColor(slot) }} />
                    <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer">
                      {video.title}
                    </a>
                  </td>
                  <td data-label="公開日時">{formatPublished(video.published_at)}</td>
                  {MILESTONE_DAYS.map((d) => (
                    <td key={d} className="num" data-label={`${d}日目まで`}>
                      {cumulative[d] === undefined ? "–" : formatHours(cumulative[d])}
                    </td>
                  ))}
                  <td className="num" data-label="現在までの累計">
                    {formatHours(cumulative[cumulative.length - 1] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
