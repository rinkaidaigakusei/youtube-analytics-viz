import { useState } from "react";
import { AppKeyError, api } from "../api";

/** サーバーの合言葉を入力する欄。正しければこの端末のブラウザに保存して onUnlocked を呼ぶ */
export default function AppKeyGate({ onUnlocked }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    api.setAppKey(value);
    try {
      await api.checkAppKey();
      await onUnlocked();
    } catch (err) {
      api.setAppKey(null);
      setMessage(err instanceof AppKeyError ? err.message : `エラー: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sync-bar app-key-gate" onSubmit={handleSubmit}>
      <label htmlFor="app-key">合言葉を入力してください(この端末に保存されます)</label>
      <input
        id="app-key"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="current-password"
        disabled={busy}
      />
      <button className="button" type="submit" disabled={busy || !value}>
        {busy ? "確認中..." : "開く"}
      </button>
      {message && <span className="sync-message">{message}</span>}
    </form>
  );
}
