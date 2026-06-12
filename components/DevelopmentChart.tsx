"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES, LEVELS } from "@/lib/svff";
import { useThemeColor } from "./useThemeColor";

export default function DevelopmentChart({
  data,
}: {
  data: Record<string, number | string>[];
}) {
  const primary = useThemeColor();
  const levelLabel = (v: number) => LEVELS.find((l) => l.value === Math.round(v))?.label ?? v;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ef" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9aa2b4" }} axisLine={{ stroke: "#e5e8ef" }} tickLine={false} />
        <YAxis
          domain={[1, 4]}
          ticks={[1, 2, 3, 4]}
          tick={{ fontSize: 10.5, fill: "#5a6276", fontFamily: "var(--font-display)" }}
          tickFormatter={(v) => String(levelLabel(v))}
          width={80}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [Number(value).toFixed(1), undefined]}
          labelFormatter={(label) => `Utvärdering ${label}`}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e5e8ef",
            boxShadow: "0 8px 24px -12px rgba(20,27,46,0.25)",
            fontSize: 13,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12.5 }} iconType="plainline" />
        <Line
          type="monotone"
          dataKey="total"
          name="Helhet"
          stroke={primary}
          strokeWidth={2.5}
          dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
        />
        {CATEGORIES.map((cat) => (
          <Line
            key={cat.id}
            type="monotone"
            dataKey={cat.id}
            name={cat.short}
            stroke={cat.color}
            strokeWidth={1.4}
            strokeOpacity={0.75}
            strokeDasharray="4 3"
            dot={{ r: 2.5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
