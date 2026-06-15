"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useThemeColor } from "./useThemeColor";

export interface FormPoint {
  date: string;
  opponent: string;
  rating: number;
  outcome: string;
}

export default function FormTrendChart({ data }: { data: FormPoint[] }) {
  const primary = useThemeColor();
  const ratings = data.map((d) => d.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const pad = Math.max(40, Math.round((max - min) * 0.25));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
        <XAxis
          dataKey="opponent"
          tick={{ fontSize: 11, fill: "#5c5a56" }}
          axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
          tickLine={false}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fontSize: 10.5, fill: "#9a9890", fontFamily: "var(--font-display)" }}
          width={44}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [Math.round(Number(value)), "Form"]}
          labelFormatter={(label) => `Mot ${label}`}
          contentStyle={{
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#1c1d22",
            color: "#e8e6de",
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="rating"
          name="Form"
          stroke={primary}
          strokeWidth={2.5}
          dot={{ r: 4, strokeWidth: 2, fill: "#0e0f11" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
