"use client";

import { useEffect, useState } from "react";

// Läser klubbfärgen från CSS-variabeln så diagrammen följer white label-temat
export function useThemeColor(fallback = "#13306e") {
  const [color, setColor] = useState(fallback);
  useEffect(() => {
    const v = getComputedStyle(document.body).getPropertyValue("--primary").trim();
    if (v) setColor(v);
  }, []);
  return color;
}
