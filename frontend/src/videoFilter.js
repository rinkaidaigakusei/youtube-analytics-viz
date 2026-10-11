const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
export const RECENT_OPTIONS = [
  { value: "recent:7", label: "最近1週間" },
  { value: "recent:30", label: "最近1か月" },
  { value: "recent:90", label: "最近3か月" },
];
export const NO_FILTER = { period: "all", weekday: "all" };

/** 公開日時を日本時間の 年・月・曜日(0=月) に分解する */
export function jstParts(iso) {
  const d = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, weekday: (d.getUTCDay() + 6) % 7 };
}

/**
 * 絞り込み条件から、動画を通すかどうかの判定関数を作る。
 * period: "all" | "recent:<日数>" | "y:<年>" | "m:<年>-<月>"、weekday: "all" | "0".."6"
 */
export function makeVideoFilter({ period, weekday }) {
  const now = Date.now();
  const [kind, value] = period.split(":");

  return (video) => {
    const parts = jstParts(video.published_at);
    if (weekday !== "all" && parts.weekday !== Number(weekday)) return false;
    if (kind === "recent") return now - new Date(video.published_at).getTime() <= Number(value) * DAY_MS;
    if (kind === "y") return parts.year === Number(value);
    if (kind === "m") return `${parts.year}-${parts.month}` === value;
    return true;
  };
}

/** 動画がある年と月を新しい順に並べる: [{ year, months: [10, 9, ...] }, ...] */
export function yearMonthOptions(videos) {
  const monthsByYear = new Map();
  for (const video of videos) {
    const { year, month } = jstParts(video.published_at);
    if (!monthsByYear.has(year)) monthsByYear.set(year, new Set());
    monthsByYear.get(year).add(month);
  }
  return [...monthsByYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({ year, months: [...months].sort((a, b) => b - a) }));
}
