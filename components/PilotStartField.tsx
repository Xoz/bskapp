"use client";

import { useState } from "react";

/** Starttid för pilotmätning. Värdet lämnar aldrig formuläret utanför BSK-appen. */
export default function PilotStartField() {
  const [openedAt] = useState(() => Date.now());
  return <input type="hidden" name="opened_at_ms" value={openedAt} />;
}
