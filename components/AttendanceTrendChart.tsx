"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useThemeColor } from "./useThemeColor";

export default function AttendanceTrendChart({
  data,
}: {
  data: { month: string; attendanceRate: number; trainingRate: number | null }[];
}) {
  const primary = useThemeColor();

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#9a9890" }}
          axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fontSize: 11, fill: "#9a9890" }}
          axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
          tickLine={false}
          width={42}
        />
        <Tooltip
          formatter={(value, name) => [`${value ?? 0}%`, String(name)]}
          cursor={{ stroke: "rgba(255,255,255,0.15)" }}
          contentStyle={{
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#1c1d22",
            color: "#e8e6de",
            fontSize: 12,
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="attendanceRate"
          name="Total närvaro"
          stroke={primary}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="trainingRate"
          name="Träningsnärvaro"
          stroke="#facc15"
          strokeWidth={2}
          dot={{ r: 2.5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
