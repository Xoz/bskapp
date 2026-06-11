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

export default function PlaytimeChart({
  data,
  average,
}: {
  data: { name: string; minutes: number }[];
  average: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f2" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} unit=" min" />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value} min`, "Speltid"]} />
        {average > 0 && (
          <ReferenceLine
            x={average}
            stroke="#16203b"
            strokeDasharray="4 3"
            label={{ value: `Snitt ${Math.round(average)} min`, fontSize: 11, position: "top" }}
          />
        )}
        <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={average > 0 && d.minutes < average * 0.75 ? "#f59e0b" : "#1d44a0"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
