import { useCallback, useState } from "react";

export const MAX_SELECTED = 8;

export function formatPublished(iso) {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function seriesColor(slot) {
  return `var(--series-${slot + 1})`;
}

/** 比較対象の動画と色番号の対応を持つ。色は動画に固定する(選択を外しても他の動画の色は変わらない) */
export function useSeriesSlots() {
  const [slots, setSlots] = useState({});

  const selectFirst = useCallback((videoIds, count) => {
    setSlots(Object.fromEntries(videoIds.slice(0, count).map((id, i) => [id, i])));
  }, []);

  const toggle = useCallback((videoId) => {
    setSlots((prev) => {
      if (videoId in prev) {
        const { [videoId]: _removed, ...rest } = prev;
        return rest;
      }
      const used = new Set(Object.values(prev));
      const free = [...Array(MAX_SELECTED).keys()].find((i) => !used.has(i));
      return free === undefined ? prev : { ...prev, [videoId]: free };
    });
  }, []);

  return { slots, selectFirst, toggle };
}

/** 比較する動画を選ぶボタン群。グラフの凡例も兼ねる */
export default function SeriesChips({ videos, slots, onToggle }) {
  const selectionFull = Object.keys(slots).length >= MAX_SELECTED;

  return (
    <>
      <div className="series-chips">
        {videos.map((video) => {
          const slot = slots[video.video_id];
          const isSelected = slot !== undefined;
          return (
            <button
              key={video.video_id}
              className={isSelected ? "series-chip selected" : "series-chip"}
              onClick={() => onToggle(video.video_id)}
              disabled={!isSelected && selectionFull}
              aria-pressed={isSelected}
              title={video.title}
            >
              <span
                className="series-key"
                style={{ background: isSelected ? seriesColor(slot) : "var(--chart-context)" }}
              />
              <span className="series-chip-title">{video.title}</span>
              <span className="series-chip-date">{formatPublished(video.published_at)}</span>
            </button>
          );
        })}
      </div>
      <p className="series-hint">
        動画をクリックして比較対象を切り替えられます(最大{MAX_SELECTED}本)。選んでいない動画は灰色の細線で表示されます。
      </p>
    </>
  );
}
