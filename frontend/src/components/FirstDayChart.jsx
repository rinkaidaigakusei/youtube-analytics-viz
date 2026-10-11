import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SeriesTooltip from "./ChartTooltip";
import SeriesChips, { formatPublished, seriesColor, useSeriesSlots } from "./SeriesChips";

const DEFAULT_SELECTED = 5;
const GRID_STEP_HOURS = 0.5;
const MILESTONE_HOURS = [1, 3, 6, 12, 24];
const FORMATS = [
  { key: "all", label: "すべて" },
  { key: "short", label: "Shorts" },
  { key: "landscape", label: "横動画" },
];

function formatHours(h) {
  return Number.isInteger(h) ? `${h}時間` : `${Math.floor(h)}時間30分`;
}

/** 記録点 [経過分, 再生数, ...] を [経過時間(h), 再生数] の列に直す */
function toSeries(points) {
  const series = points.map((p) => [p[0] / 60, p[1]]).sort((a, b) => a[0] - b[0]);
  // 公開直後から記録できている動画だけ 0時間=0再生 を起点にする(途中から記録した動画で伸びを捏造しない)
  if (series.length > 0 && series[0][0] <= 1) series.unshift([0, 0]);
  return series;
}

/** 経過 h 時間時点の再生数を線形補間で求める。記録の範囲外なら null */
function viewsAt(series, h) {
  if (series.length === 0 || h < series[0][0] || h > series[series.length - 1][0]) return null;
  for (let i = 1; i < series.length; i++) {
    const [h0, v0] = series[i - 1];
    const [h1, v1] = series[i];
    if (h <= h1) return h1 === h0 ? v1 : Math.round(v0 + ((v1 - v0) * (h - h0)) / (h1 - h0));
  }
  return series[series.length - 1][1];
}

function matchesFormat(video, format) {
  if (format === "short") return video.is_short === true;
  if (format === "landscape") return video.is_short === false;
  return true;
}

/** videos: 絞り込み済みの記録(null = 読み込み中)。hasAnyVideo: 絞り込み前に1本でも記録があるか */
export default function FirstDayChart({ videos, hasAnyVideo, error }) {
  const [format, setFormat] = useState("all");
  const { slots, selectFirst, toggle } = useSeriesSlots();

  // 読み込み直後と、絞り込みで顔ぶれが変わったときは、新しい順に選び直す
  const idsKey = (videos ?? []).map((v) => v.video_id).join(",");
  useEffect(() => {
    selectFirst(idsKey ? idsKey.split(",") : [], DEFAULT_SELECTED);
  }, [idsKey, selectFirst]);

  const prepared = useMemo(
    () => (videos ?? []).map((video) => ({ video, series: toSeries(video.points) })),
    [videos]
  );
  const visible = prepared.filter(({ video }) => matchesFormat(video, format));
  const selected = visible
    .filter(({ video }) => video.video_id in slots)
    .map((p) => ({ ...p, slot: slots[p.video.video_id] }));
  const context = visible.filter(({ video }) => !(video.video_id in slots));

  const chartData = useMemo(() => {
    const rows = [];
    for (let h = 0; h <= 24; h += GRID_STEP_HOURS) {
      const row = { h };
      for (const { video, series } of prepared) row[video.video_id] = viewsAt(series, h);
      rows.push(row);
    }
    return rows;
  }, [prepared]);

  if (error) return <p className="error-banner">計測データを読み込めませんでした: {error}</p>;
  if (videos === null) return <p>読み込み中...</p>;
  if (videos.length === 0 && hasAnyVideo) {
    return <p className="series-hint">この条件に合う動画の記録はありません。</p>;
  }
  if (videos.length === 0) {
    return (
      <p className="series-hint">
        まだ計測した動画がありません。次に投稿した動画から、公開後24時間の再生数が定期的に自動で記録されます
        (これより前に投稿した動画は、時間単位のデータが残っていないため表示できません)。
      </p>
    );
  }

  return (
    <div className="series-chart">
      <div className="metric-select">
        {FORMATS.map(({ key, label }) => (
          <button
            key={key}
            className={key === format ? "metric-button active" : "metric-button"}
            onClick={() => setFormat(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <SeriesChips videos={visible.map(({ video }) => video)} slots={slots} onToggle={toggle} />

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="h"
              type="number"
              domain={[0, 24]}
              ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 12, fill: "var(--chart-muted)" }}
              stroke="var(--chart-axis)"
            />
            <YAxis
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: 12, fill: "var(--chart-muted)" }}
              stroke="var(--chart-axis)"
              allowDecimals={false}
            />
            <Tooltip
              content={
                <SeriesTooltip
                  selected={selected}
                  formatLabel={(h) => `公開から${formatHours(h)}`}
                  formatValue={(v) => v.toLocaleString()}
                />
              }
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
                {MILESTONE_HOURS.map((h) => (
                  <th key={h} className="num">
                    {h}時間後
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map(({ video, series, slot }) => (
                <tr key={video.video_id}>
                  <td className="cell-title">
                    <span className="series-key" style={{ background: seriesColor(slot) }} />
                    <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer">
                      {video.title}
                    </a>
                  </td>
                  <td data-label="公開日時">{formatPublished(video.published_at)}</td>
                  {MILESTONE_HOURS.map((h) => {
                    const value = viewsAt(series, h);
                    return (
                      <td key={h} className="num" data-label={`${h}時間後`}>
                        {value === null ? "–" : value.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
