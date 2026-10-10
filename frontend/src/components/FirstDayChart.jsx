import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";

const MAX_SELECTED = 8;
const DEFAULT_SELECTED = 5;
const GRID_STEP_HOURS = 0.5;
const MILESTONE_HOURS = [1, 3, 6, 12, 24];
const FORMATS = [
  { key: "all", label: "すべて" },
  { key: "short", label: "Shorts" },
  { key: "landscape", label: "横動画" },
];

function formatPublished(iso) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function ChartTooltip({ active, label, payload, selected }) {
  if (!active || !payload) return null;
  const rows = selected
    .map(({ video, slot }) => ({ video, slot, value: payload.find((p) => p.dataKey === video.video_id)?.value }))
    .filter((r) => r.value !== null && r.value !== undefined)
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;

  return (
    <div className="first-day-tooltip">
      <div className="first-day-tooltip-label">公開から{formatHours(label)}</div>
      {rows.map(({ video, slot, value }) => (
        <div key={video.video_id} className="first-day-tooltip-row">
          <span className="first-day-key" style={{ background: `var(--series-${slot + 1})` }} />
          <strong>{value.toLocaleString()}</strong>
          <span className="first-day-tooltip-title">{video.title}</span>
        </div>
      ))}
    </div>
  );
}

export default function FirstDayChart() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState(null);
  const [format, setFormat] = useState("all");
  // 色は動画に固定する(選択を外しても他の動画の色は変わらない): { video_id: 色番号 }
  const [slots, setSlots] = useState({});

  useEffect(() => {
    api
      .firstDaySnapshots()
      .then((data) => {
        const list = (data?.videos ?? []).filter((v) => v.points.length > 0);
        setVideos(list);
        setSlots(Object.fromEntries(list.slice(0, DEFAULT_SELECTED).map((v, i) => [v.video_id, i])));
      })
      .catch((err) => setError(err.message));
  }, []);

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

  function toggle(videoId) {
    setSlots((prev) => {
      if (videoId in prev) {
        const { [videoId]: _removed, ...rest } = prev;
        return rest;
      }
      const used = new Set(Object.values(prev));
      const free = [...Array(MAX_SELECTED).keys()].find((i) => !used.has(i));
      return free === undefined ? prev : { ...prev, [videoId]: free };
    });
  }

  if (error) return <p className="error-banner">計測データを読み込めませんでした: {error}</p>;
  if (videos === null) return <p>読み込み中...</p>;
  if (videos.length === 0) {
    return (
      <p className="first-day-empty">
        まだ計測した動画がありません。次に投稿した動画から、公開後24時間の再生数が20分おきに自動で記録されます
        (これより前に投稿した動画は、時間単位のデータが残っていないため表示できません)。
      </p>
    );
  }

  const selectionFull = Object.keys(slots).length >= MAX_SELECTED;

  return (
    <div className="first-day">
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

      <div className="first-day-chips">
        {visible.map(({ video }) => {
          const slot = slots[video.video_id];
          const isSelected = slot !== undefined;
          return (
            <button
              key={video.video_id}
              className={isSelected ? "first-day-chip selected" : "first-day-chip"}
              onClick={() => toggle(video.video_id)}
              disabled={!isSelected && selectionFull}
              aria-pressed={isSelected}
              title={video.title}
            >
              <span
                className="first-day-key"
                style={{ background: isSelected ? `var(--series-${slot + 1})` : "var(--fd-context)" }}
              />
              <span className="first-day-chip-title">{video.title}</span>
              <span className="first-day-chip-date">{formatPublished(video.published_at)}</span>
            </button>
          );
        })}
      </div>
      <p className="first-day-hint">
        動画をクリックして比較対象を切り替えられます(最大{MAX_SELECTED}本)。選んでいない動画は灰色の細線で表示されます。
      </p>

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--fd-grid)" vertical={false} />
            <XAxis
              dataKey="h"
              type="number"
              domain={[0, 24]}
              ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
              tickFormatter={(h) => `${h}h`}
              tick={{ fontSize: 12, fill: "var(--fd-muted)" }}
              stroke="var(--fd-axis)"
            />
            <YAxis
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: 12, fill: "var(--fd-muted)" }}
              stroke="var(--fd-axis)"
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTooltip selected={selected} />}
              cursor={{ stroke: "var(--fd-axis)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {context.map(({ video }) => (
              <Line
                key={video.video_id}
                dataKey={video.video_id}
                type="linear"
                stroke="var(--fd-context)"
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
                stroke={`var(--series-${slot + 1})`}
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
          <table className="video-table first-day-table">
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
                  <td>
                    <span className="first-day-key" style={{ background: `var(--series-${slot + 1})` }} />
                    <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer">
                      {video.title}
                    </a>
                  </td>
                  <td>{formatPublished(video.published_at)}</td>
                  {MILESTONE_HOURS.map((h) => {
                    const value = viewsAt(series, h);
                    return (
                      <td key={h} className="num">
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
