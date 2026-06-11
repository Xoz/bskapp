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

export default function SkillRadar({
  data,
  compare,
}: {
  data: { category: string; value: number }[];
  // Föregående utvärdering för jämförelse
  compare?: { category: string; value: number }[];
}) {
  const merged = data.map((d) => ({
    category: d.category,
    Nu: d.value,
    Föregående: compare?.find((c) => c.category === d.category)?.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={merged} outerRadius="75%">
        <PolarGrid stroke="#e3e8f2" />
        <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(value) => Number(value).toFixed(1)} />
        {compare && (
          <Radar
            name="Föregående"
            dataKey="Föregående"
            stroke="#94a3b8"
            fill="#94a3b8"
            fillOpacity={0.15}
            strokeDasharray="4 3"
          />
        )}
        <Radar name="Nu" dataKey="Nu" stroke="#1d44a0" fill="#1d44a0" fillOpacity={0.3} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
