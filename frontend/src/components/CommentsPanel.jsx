import { useState } from "react";
import { api } from "../api";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function CommentRow({ comment, onReplied }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.replyToComment(comment.comment_id, draft.trim());
      onReplied(comment.comment_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comment-row">
      <div className="comment-meta">
        <span className="comment-author">{comment.author_display_name}</span>
        <span className="comment-video-title">{comment.video_title}</span>
        <span className="comment-date">{formatDate(comment.published_at)}</span>
      </div>
      <p className="comment-text">{comment.text}</p>
      <div className="comment-reply-form">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="返信を入力..."
          rows={2}
          disabled={sending}
        />
        <button className="button" onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? "送信中..." : "返信"}
        </button>
      </div>
      {error && <p className="error-banner">エラー: {error}</p>}
    </div>
  );
}

export default function CommentsPanel({ comments, onSynced, onCommentReplied }) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSync() {
    setSyncing(true);
    setMessage("");
    try {
      const result = await api.syncComments();
      setMessage(
        `完了: ${result.synced_videos}本の動画からコメント取得(コメント無効: ${result.disabled_videos}本)`
      );
      await onSynced();
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="comments-panel">
      <div className="comments-panel-header">
        <h2>未返信コメント ({comments.length}件)</h2>
        <button className="button" onClick={handleSync} disabled={syncing}>
          {syncing ? "同期中..." : "コメントを同期"}
        </button>
      </div>
      {message && <p className="sync-message">{message}</p>}
      {comments.length === 0 ? (
        <p>未返信のコメントはありません。</p>
      ) : (
        <div className="comments-list">
          {comments.map((c) => (
            <CommentRow key={c.comment_id} comment={c} onReplied={onCommentReplied} />
          ))}
        </div>
      )}
    </div>
  );
}
