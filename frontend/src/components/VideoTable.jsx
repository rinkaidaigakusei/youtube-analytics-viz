import { useMemo, useState } from "react";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

const COLUMNS = [
  { key: "published_at", label: "公開日時" },
  { key: "title", label: "タイトル" },
  { key: "weekday", label: "曜日" },
  { key: "lifetime_views", label: "累計再生数" },
  { key: "average_view_percentage", label: "視聴維持率" },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function VideoTable({ videos }) {
  const [sortKey, setSortKey] = useState("published_at");
  const [sortDir, setSortDir] = useState("desc");
  const [weekdayFilter, setWeekdayFilter] = useState("all");

  const rows = useMemo(() => {
    return videos.map((v) => {
      const d = new Date(v.published_at);
      return { ...v, weekday: (d.getDay() + 6) % 7 }; // getDay: 0=Sun -> weekday: 0=Mon
    });
  }, [videos]);

  const filtered = useMemo(() => {
    if (weekdayFilter === "all") return rows;
    return rows.filter((r) => r.weekday === Number(weekdayFilter));
  }, [rows, weekdayFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="video-table-wrap">
      <div className="video-table-controls">
        <label>
          曜日フィルタ:{" "}
          <select value={weekdayFilter} onChange={(e) => setWeekdayFilter(e.target.value)}>
            <option value="all">すべて</option>
            {WEEKDAYS.map((label, i) => (
              <option key={i} value={i}>
                {label}曜日
              </option>
            ))}
          </select>
        </label>
        <span className="video-table-count">{sorted.length}件</span>
      </div>
      <div className="video-table-scroll">
        <table className="video-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} onClick={() => toggleSort(col.key)} className="sortable">
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.video_id}>
                <td>{formatDate(v.published_at)}</td>
                <td>
                  <a
                    href={`https://www.youtube.com/watch?v=${v.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {v.title}
                  </a>
                </td>
                <td>{WEEKDAYS[v.weekday]}</td>
                <td>{v.lifetime_views ?? "-"}</td>
                <td>{v.average_view_percentage != null ? `${v.average_view_percentage.toFixed(1)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
