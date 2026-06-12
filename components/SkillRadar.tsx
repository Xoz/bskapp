"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useThemeColor } from "./useThemeColor";

export default function SkillRadar({
  data,
  compare,
}: {
  data: { category: string; value: number }[];
  // Föregående utvärdering för jämförelse
  compare?: { category: string; value: number }[];
}) {
  const primary = useThemeColor();
  const merged = data.map((d) => ({
    category: d.category,
    Nu: d.value,
    Föregående: compare?.find((c) => c.category === d.category)?.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={merged} outerRadius="72%">
        <PolarGrid stroke="rgba(255,255,255,0.07)" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 11.5, fill: "#9a9890", fontFamily: "var(--font-display)" }}
        />
        <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fontSize: 9, fill: "#5c5a56" }} stroke="rgba(255,255,255,0.07)" />
        <Tooltip
          formatter={(value) => Number(value).toFixed(1)}
          contentStyle={{
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#1c1d22",
            color: "#e8e6de",
            fontSize: 12,
          }}
        />
        {compare && (
          <Radar
            name="Föregående"
            dataKey="Föregående"
            stroke="#5c5a56"
            fill="#5c5a56"
            fillOpacity={0.12}
            strokeDasharray="4 3"
          />
        )}
        <Radar name="Nu" dataKey="Nu" stroke={primary} fill={primary} fillOpacity={0.28} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
