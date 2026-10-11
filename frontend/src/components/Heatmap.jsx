import { Fragment, useState } from "react";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const METRICS = {
  avg_early_views: { label: "初速(公開後0-1日の平均再生数)", format: (v) => Math.round(v).toLocaleString() },
  avg_lifetime_views: { label: "累計平均再生数", format: (v) => Math.round(v).toLocaleString() },
  avg_retention_pct: { label: "平均視聴維持率", format: (v) => `${v.toFixed(1)}%` },
};

function colorFor(ratio) {
  if (ratio === null) return "var(--cell-empty)";
  // 0 -> 薄い, 1 -> 濃い(アクセントカラーのアルファを変える)
  const alpha = 0.08 + ratio * 0.82;
  return `rgba(37, 99, 235, ${alpha.toFixed(3)})`;
}

export default function Heatmap({ data, metric }) {
  const cellMap = new Map();
  for (const row of data) {
    cellMap.set(`${row.weekday}-${row.hour}`, row);
  }

  const values = data.map((r) => r[metric]).filter((v) => v !== null && v !== undefined);
  const max = values.length ? Math.max(...values) : 0;

  const { format, label } = METRICS[metric];
  // タッチ端末ではマウスオーバーが使えないので、タップしたセルの詳細を下に出す
  const [selectedKey, setSelectedKey] = useState(null);
  const selectedCell = selectedKey ? cellMap.get(selectedKey) : null;
  const selectedValue = selectedCell ? selectedCell[metric] : null;

  return (
    <div className="heatmap-wrap">
      <h3>{label}</h3>
      <div className="heatmap-scroll">
        <div className="heatmap-grid">
          <div className="heatmap-corner" />
          {HOURS.map((h) => (
            <div key={`h-${h}`} className="heatmap-hour-label">
              {h}
            </div>
          ))}
          {WEEKDAYS.map((wLabel, weekday) => (
            <Fragment key={`w-${weekday}`}>
              <div className="heatmap-weekday-label">{wLabel}</div>
              {HOURS.map((hour) => {
                const cell = cellMap.get(`${weekday}-${hour}`);
                const value = cell ? cell[metric] : null;
                const ratio = value !== null && value !== undefined && max > 0 ? value / max : null;
                return (
                  <div
                    key={`${weekday}-${hour}`}
                    className={selectedKey === `${weekday}-${hour}` ? "heatmap-cell selected" : "heatmap-cell"}
                    style={{ background: colorFor(ratio) }}
                    onClick={() => setSelectedKey(`${weekday}-${hour}`)}
                    title={
                      cell
                        ? `${wLabel}曜 ${hour}時\n投稿本数: ${cell.video_count}\n${
                            value !== null && value !== undefined ? format(value) : "データなし"
                          }`
                        : `${wLabel}曜 ${hour}時: 投稿なし`
                    }
                  >
                    {cell ? cell.video_count : ""}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {selectedKey && (
        <p className="heatmap-detail">
          {WEEKDAYS[Number(selectedKey.split("-")[0])]}曜 {selectedKey.split("-")[1]}時:{" "}
          {selectedCell
            ? `投稿${selectedCell.video_count}本 / ${
                selectedValue !== null && selectedValue !== undefined ? format(selectedValue) : "データなし"
              }`
            : "投稿なし"}
        </p>
      )}
      <p className="heatmap-hint">
        セル内の数字は投稿本数。色が濃いほど数値が高いことを示す。
        <span className="only-desktop">マウスオーバーで詳細表示。</span>
        <span className="only-mobile">セルをタップすると詳細を表示。</span>
      </p>
    </div>
  );
}
