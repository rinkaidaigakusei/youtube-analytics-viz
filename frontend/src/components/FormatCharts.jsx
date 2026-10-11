import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsMobile } from "../useIsMobile";

const COLORS = { short: "#7f77dd", landscape: "#1d9e75" };

function truncate(title, max = 28) {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

function FormatBarChart({ videos, color }) {
  const isMobile = useIsMobile();
  const data = [...videos]
    .filter((v) => v.lifetime_views !== null && v.lifetime_views !== undefined)
    .sort((a, b) => b.lifetime_views - a.lifetime_views)
    .slice(0, 15)
    .map((v) => ({
      // スマホは軸が狭いので、どの動画にも付いている先頭の【…】を外してから切り詰める
      title: isMobile ? truncate(v.title.replace(/^【[^】]*】\s*/, "") || v.title, 9) : truncate(v.title),
      fullTitle: v.title,
      views: v.lifetime_views,
    }));

  if (data.length === 0) {
    return <p>データがありません。</p>;
  }

  const height = Math.max(data.length * 36 + 40, 120);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="title" width={isMobile ? 112 : 180} tick={{ fontSize: isMobile ? 11 : 12 }} />
          <Tooltip
            formatter={(value) => [value.toLocaleString(), "累計再生数"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTitle ?? ""}
          />
          <Bar dataKey="views" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FormatCharts({ videos }) {
  const shorts = videos.filter((v) => v.is_short === 1 || v.is_short === true);
  const landscape = videos.filter((v) => v.is_short === 0 || v.is_short === false);

  return (
    <div className="format-charts">
      <div className="format-chart-block">
        <h3>Shorts の再生数(上位15本)</h3>
        <FormatBarChart videos={shorts} color={COLORS.short} />
      </div>
      <div className="format-chart-block">
        <h3>横動画の再生数(上位15本)</h3>
        <FormatBarChart videos={landscape} color={COLORS.landscape} />
      </div>
    </div>
  );
}
