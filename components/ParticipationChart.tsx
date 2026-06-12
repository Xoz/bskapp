"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useThemeColor } from "./useThemeColor";

// Spelade matcher per spelare – SvFF: alla ska få spela lika mycket
export default function ParticipationChart({
  data,
  average,
}: {
  data: { name: string; matches: number }[];
  average: number;
}) {
  const primary = useThemeColor();

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 20, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ef" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#9aa2b4" }}
          axisLine={{ stroke: "#e5e8ef" }}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "#5a6276", fontFamily: "var(--font-display)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [`${value} matcher`, "Spelade"]}
          cursor={{ fill: "rgba(20,27,46,0.04)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e5e8ef",
            boxShadow: "0 8px 24px -12px rgba(20,27,46,0.25)",
            fontSize: 13,
          }}
        />
        {average > 0 && (
          <ReferenceLine
            x={average}
            stroke="#141b2e"
            strokeDasharray="4 3"
            label={{
              value: `Snitt ${Math.round(average * 10) / 10}`,
              fontSize: 11,
              position: "top",
              fill: "#5a6276",
            }}
          />
        )}
        <Bar dataKey="matches" radius={[0, 8, 8, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={average > 0 && d.matches < average * 0.75 ? "#f0b429" : primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
