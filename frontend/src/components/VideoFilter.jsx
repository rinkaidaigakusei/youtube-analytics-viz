import { RECENT_OPTIONS, WEEKDAYS } from "../videoFilter";

/** グラフと動画一覧に出す動画を、投稿時期と曜日で絞り込む */
export default function VideoFilter({ filter, onChange, yearMonths }) {
  return (
    <div className="video-filter">
      <label>
        投稿時期:{" "}
        <select value={filter.period} onChange={(e) => onChange({ ...filter, period: e.target.value })}>
          <option value="all">すべて</option>
          <optgroup label="最近投稿したもの">
            {RECENT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </optgroup>
          {yearMonths.map(({ year, months }) => (
            <optgroup key={year} label={`${year}年`}>
              <option value={`y:${year}`}>{year}年(1年分)</option>
              {months.map((month) => (
                <option key={month} value={`m:${year}-${month}`}>
                  {year}年{month}月
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        曜日:{" "}
        <select value={filter.weekday} onChange={(e) => onChange({ ...filter, weekday: e.target.value })}>
          <option value="all">すべて</option>
          {WEEKDAYS.map((label, i) => (
            <option key={i} value={i}>
              {label}曜日
            </option>
          ))}
        </select>
      </label>
      <span className="video-filter-note">
        下のグラフと動画一覧に反映されます(ヒートマップとおすすめ投稿時間帯は全期間の集計です)。
      </span>
    </div>
  );
}
