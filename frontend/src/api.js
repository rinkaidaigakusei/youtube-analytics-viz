const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
