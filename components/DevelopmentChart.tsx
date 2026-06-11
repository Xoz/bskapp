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

export default function DevelopmentChart({
  data,
}: {
  data: Record<string, number | string>[];
}) {
  const levelLabel = (v: number) => LEVELS.find((l) => l.value === Math.round(v))?.label ?? v;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f2" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[1, 4]}
          ticks={[1, 2, 3, 4]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => String(levelLabel(v))}
          width={86}
        />
        <Tooltip
          formatter={(value) => [Number(value).toFixed(1), undefined]}
          labelFormatter={(label) => `Utvärdering ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line
          type="monotone"
          dataKey="total"
          name="Helhet"
          stroke="#16203b"
          strokeWidth={2.5}
          dot={{ r: 4 }}
        />
        {CATEGORIES.map((cat) => (
          <Line
            key={cat.id}
            type="monotone"
            dataKey={cat.id}
            name={cat.short}
            stroke={cat.color}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
