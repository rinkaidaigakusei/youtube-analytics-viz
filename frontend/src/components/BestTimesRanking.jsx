const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export default function BestTimesRanking({ summary, topN = 5 }) {
  const ranked = [...summary]
    .filter((r) => r.video_count > 0)
    .sort((a, b) => b.avg_early_views - a.avg_early_views)
    .slice(0, topN);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <div className="best-times">
      <h3>おすすめ投稿時間帯(初速が高い順)</h3>
      <ol className="best-times-list">
        {ranked.map((r, i) => (
          <li key={`${r.weekday}-${r.hour}`} className="best-times-item">
            <span className="best-times-rank">{i + 1}</span>
            <span className="best-times-slot">
              {WEEKDAYS[r.weekday]}曜 {r.hour}時台
            </span>
            <span className="best-times-value">初速 平均{Math.round(r.avg_early_views).toLocaleString()}回</span>
            <span className="best-times-count">(投稿{r.video_count}本の実績)</span>
          </li>
        ))}
      </ol>
      <p className="best-times-hint">
        投稿本数が少ないと数値がぶれやすいので、あくまで参考値として見てください。
      </p>
    </div>
  );
}
