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
        <PolarGrid stroke="#e5e8ef" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 11.5, fill: "#5a6276", fontFamily: "var(--font-display)" }}
        />
        <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fontSize: 9, fill: "#9aa2b4" }} stroke="#e5e8ef" />
        <Tooltip
          formatter={(value) => Number(value).toFixed(1)}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e5e8ef",
            boxShadow: "0 8px 24px -12px rgba(20,27,46,0.25)",
            fontSize: 13,
          }}
        />
        {compare && (
          <Radar
            name="Föregående"
            dataKey="Föregående"
            stroke="#9aa2b4"
            fill="#9aa2b4"
            fillOpacity={0.12}
            strokeDasharray="4 3"
          />
        )}
        <Radar name="Nu" dataKey="Nu" stroke={primary} fill={primary} fillOpacity={0.28} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
