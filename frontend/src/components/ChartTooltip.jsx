import { useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../useIsMobile";
import { seriesColor } from "./SeriesChips";

/** スマホ用: 画面下に固定で出すポップアップ。長いタイトルも折り返して全文を見せられる */
function ChartPopup({ stamp, children }) {
  // 閉じたときの表示内容(stamp)を覚えておき、別の点を選んだらまた開く
  const [closedStamp, setClosedStamp] = useState(null);
  if (closedStamp === stamp) return null;

  return createPortal(
    <div className="chart-popup">
      <button className="chart-popup-close" aria-label="閉じる" onClick={() => setClosedStamp(stamp)}>
        ×
      </button>
      {children}
    </div>,
    document.body
  );
}

/** グラフの吹き出しの枠。パソコンではカーソルの横、スマホでは画面下のポップアップに出す */
export function TooltipFrame({ stamp, children }) {
  const isMobile = useIsMobile();
  const body = <div className="chart-tooltip">{children}</div>;
  return isMobile ? <ChartPopup stamp={stamp}>{body}</ChartPopup> : body;
}

/** 動画どうしを比べる折れ線グラフ用: 選択中の動画の値を大きい順に並べる */
export default function SeriesTooltip({ active, label, payload, selected, formatLabel, formatValue }) {
  if (!active || !payload) return null;
  const rows = selected
    .map(({ video, slot }) => ({ video, slot, value: payload.find((p) => p.dataKey === video.video_id)?.value }))
    .filter((r) => r.value !== null && r.value !== undefined)
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;

  return (
    <TooltipFrame stamp={label}>
      <div className="chart-tooltip-label">{formatLabel(label)}</div>
      {rows.map(({ video, slot, value }) => (
        <div key={video.video_id} className="chart-tooltip-row">
          <span className="series-key" style={{ background: seriesColor(slot) }} />
          <strong>{formatValue(value)}</strong>
          <span className="chart-tooltip-title">{video.title}</span>
        </div>
      ))}
    </TooltipFrame>
  );
}
