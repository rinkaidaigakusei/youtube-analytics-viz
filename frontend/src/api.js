const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// 公開後24時間の再生数の記録(GitHub Actionsがdataブランチに追記していくJSON)
const SNAPSHOTS_URL =
  import.meta.env.VITE_SNAPSHOTS_URL ||
  "https://raw.githubusercontent.com/rinkaidaigakusei/youtube-analytics-viz/data/snapshots.json";

async function request(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  baseUrl: API_BASE_URL,
  loginUrl: `${API_BASE_URL}/auth/login`,
  authStatus: () => request("/auth/status"),
  videos: () => request("/api/videos"),
  dailyViews: (videoId) => request(`/api/videos/${videoId}/daily-views`),
  weekdayHourSummary: () => request("/api/summary/weekday-hour"),
  firstDaySnapshots: async () => {
    const res = await fetch(SNAPSHOTS_URL, { cache: "no-store" });
    if (res.status === 404) return null; // まだ一度も記録されていない
    if (!res.ok) throw new Error(`snapshots failed: ${res.status}`);
    return res.json();
  },
  syncVideos: () => request("/api/sync/videos", { method: "POST" }),
  syncAnalytics: (force = false) =>
    request(`/api/sync/analytics?force=${force}`, { method: "POST" }),
  syncComments: () => request("/api/sync/comments", { method: "POST" }),
  unrepliedComments: () => request("/api/comments?unreplied_only=true"),
  replyToComment: (commentId, text) =>
    request(`/api/comments/${commentId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
};
