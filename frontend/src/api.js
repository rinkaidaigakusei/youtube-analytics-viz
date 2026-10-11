const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// 公開後24時間の再生数の記録(GitHub Actionsがdataブランチに追記していくJSON)
const SNAPSHOTS_URL =
  import.meta.env.VITE_SNAPSHOTS_URL ||
  "https://raw.githubusercontent.com/rinkaidaigakusei/youtube-analytics-viz/data/snapshots.json";

// 合言葉はこの端末のブラウザにだけ保存する(保存できない環境でも、開いている間は使える)
const APP_KEY_STORAGE = "ytviz-app-key";
let appKey = null;
try {
  appKey = localStorage.getItem(APP_KEY_STORAGE);
} catch {
  // プライベートウィンドウなど
}

function setAppKey(value) {
  appKey = value;
  try {
    if (value) localStorage.setItem(APP_KEY_STORAGE, value);
    else localStorage.removeItem(APP_KEY_STORAGE);
  } catch {
    // 保存できなくても続行
  }
}

/** 合言葉が未入力・誤りのときに投げる。画面側は入力欄を出す */
export class AppKeyError extends Error {}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...options.headers, ...(appKey ? { Authorization: `Bearer ${appKey}` } : {}) },
  });
  if (res.status === 403) {
    throw new AppKeyError("合言葉が違います。");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  baseUrl: API_BASE_URL,
  hasAppKey: () => Boolean(appKey),
  /** 入力済みの合言葉をクリップボードにコピーする(別の端末に入力するときや控えを取るとき用) */
  copyAppKey: () => navigator.clipboard.writeText(appKey ?? ""),
  setAppKey,
  /** 合言葉が正しければ何も起きず、違えば AppKeyError を投げる */
  checkAppKey: () => request("/api/session"),
  /** Googleの認可画面へ移動する */
  startLogin: async () => {
    const { auth_url } = await request("/auth/login", { method: "POST" });
    window.location.href = auth_url;
  },
  authStatus: () => request("/auth/status"),
  videos: () => request("/api/videos"),
  dailyViews: (videoId) => request(`/api/videos/${videoId}/daily-views`),
  weekdayHourSummary: () => request("/api/summary/weekday-hour"),
  watchTime: () => request("/api/summary/watch-time"),
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
