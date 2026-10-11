import { useSyncExternalStore } from "react";

// App.css のスマホ向けメディアクエリと同じ幅にそろえる
const query = window.matchMedia("(max-width: 640px)");

function subscribe(callback) {
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** グラフの軸幅など、CSSだけでは切り替えられない箇所のスマホ判定 */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => query.matches);
}
