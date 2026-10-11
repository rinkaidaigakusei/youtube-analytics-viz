import { useState } from "react";
import { api } from "../api";

function CopyAppKeyButton({ className = "link-button sync-bar-end" }) {
  const [label, setLabel] = useState("合言葉をコピー");

  async function handleCopy() {
    try {
      await api.copyAppKey();
      setLabel("コピーしました");
    } catch {
      setLabel("コピーできませんでした");
    }
    setTimeout(() => setLabel("合言葉をコピー"), 2000);
  }

  return (
    <button className={className} onClick={handleCopy}>
      {label}
    </button>
  );
}

export default function SyncBar({ authenticated, onSynced }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSync() {
    setBusy(true);
    setMessage("");
    try {
      const videosResult = await api.syncVideos();
      setMessage(`動画一覧を同期中... (${videosResult.synced}件)`);
      const analyticsResult = await api.syncAnalytics(false);
      setMessage(
        `完了: 動画${videosResult.synced}件 / Analytics新規取得${analyticsResult.synced}件・キャッシュ利用${analyticsResult.skipped_cached}件`
      );
      await onSynced();
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    setBusy(true);
    try {
      await api.startLogin();
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
      setBusy(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="sync-bar">
        <span>未認証です。まずGoogleアカウントでログインしてください。</span>
        <button className="button" onClick={handleLogin} disabled={busy}>
          Googleでログイン
        </button>
        {message && <span className="sync-message">{message}</span>}
        <CopyAppKeyButton />
      </div>
    );
  }

  return (
    <div className="sync-bar">
      <span className="sync-status-ok">認証済み</span>
      <button className="button" onClick={handleSync} disabled={busy}>
        {busy ? "同期中..." : "動画・Analyticsを同期"}
      </button>
      {message && <span className="sync-message">{message}</span>}
      {/* ログインが切れかけているときや、別のアカウントに切り替えたいとき用 */}
      <button className="link-button sync-bar-end" onClick={handleLogin} disabled={busy}>
        Googleに再ログイン
      </button>
      <CopyAppKeyButton className="link-button" />
    </div>
  );
}
