// SVG-renderaren från projektets outputs/ovningsritare/index.html. Ingen iframe.
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const arrow = (o) => ["pass", "run", "dribble"].includes(o.type);
export function drawing(model, selected) {
  let out =
    '<defs><pattern id="grass" width="1000" height="140" patternUnits="userSpaceOnUse"><rect width="1000" height="140" fill="#17633f"/><rect width="1000" height="70" fill="#1b6a45"/></pattern></defs><rect width="1000" height="700" fill="url(#grass)"/><rect x="30" y="30" width="940" height="640" rx="4" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width="2"/>';
  for (const o of [
    ...model.objects.filter(arrow),
    ...model.objects.filter((o) => !arrow(o)),
  ]) {
    let body = "";
    const c = esc(o.color),
      s = o.size;
    if (arrow(o)) {
      out += `<defs><marker id="m${o.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker></defs>`;
      const d = `M${o.x} ${o.y} Q${o.cx} ${o.cy} ${o.x2} ${o.y2}`;
      body = `<path d="${d}" fill="none" stroke="transparent" stroke-width="26"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${4 * s}" ${o.type === "run" ? 'stroke-dasharray="12 10"' : o.type === "dribble" ? 'stroke-dasharray="2 9" stroke-linecap="round"' : ""} marker-end="url(#m${o.id})"/>`;
      if (o.label)
        body += `<text x="${0.25 * o.x + 0.5 * o.cx + 0.25 * o.x2 + 18}" y="${0.25 * o.y + 0.5 * o.cy + 0.25 * o.y2}" fill="${c}" font-size="24" font-weight="700">${esc(o.label)}</text>`;
    } else {
      if (o.type === "player")
        body = `<circle cy="-23" r="10" fill="#f1c79d" stroke="#14372b" stroke-width="2"/><path d="M-12 -10 L-24 0 L-17 12 L-11 7 L-11 25 L11 25 L11 7 L17 12 L24 0 L12 -10 Z" fill="${c}" stroke="#14372b" stroke-width="2"/><path d="M-9 26 L-10 42 M9 26 L10 42" stroke="#142c27" stroke-width="9"/><text y="14" text-anchor="middle" font-size="14" fill="#172b23" font-weight="700">${esc(o.label)}</text>`;
      if (o.type === "goal")
        body = `<rect x="-65" y="-25" width="130" height="45" fill="none" stroke="${c}" stroke-width="5"/><path d="M-40 -25 V20 M-15 -25 V20 M15 -25 V20 M40 -25 V20 M-65 -10 H65 M-65 5 H65" stroke="${c}" stroke-width="1"/>`;
      if (o.type === "cone")
        body = `<ellipse cy="12" rx="23" ry="7" fill="#123b2b" opacity=".4"/><path d="M-21 10 L-7 -19 Q0 -24 7 -19 L21 10 Q0 22 -21 10" fill="${c}" stroke="#833f16" stroke-width="2"/><path d="M-11 -7 L11 -7" stroke="white" stroke-opacity=".7" stroke-width="4"/>`;
      if (o.type === "ball")
        body = `<circle r="14" fill="${c}" stroke="#1c302a" stroke-width="2"/><path d="M0 -7 L7 -2 L4 6 L-4 6 L-7 -2 Z M-10 -10 L-7 -2 M10 -10 L7 -2 M-12 8 L-4 6 M12 8 L4 6 M0 14 L0 6" fill="#243b32" stroke="#243b32" stroke-width="2"/>`;
      if (o.type === "text")
        body = `<text text-anchor="middle" fill="${c}" font-size="23" paint-order="stroke" stroke="#164b34" stroke-width="3">${esc(o.label)}</text>`;
      body = `<g transform="translate(${o.x},${o.y}) scale(${s})">${selected === o.id ? '<circle r="44" fill="none" stroke="#8aebff" stroke-width="2" stroke-dasharray="4 4"/>' : ""}${body}</g>`;
    }
    out += `<g class="object" data-id="${o.id}">${body}</g>`;
  }
  const o = model.objects.find((item) => item.id === selected);
  if (o && arrow(o)) {
    out += `<path d="M${o.x} ${o.y} L${o.cx} ${o.cy} L${o.x2} ${o.y2}" fill="none" stroke="#8aebff" stroke-width="1" stroke-dasharray="5 5"/>`;
    for (const [h, x, y] of [
      ["start", o.x, o.y],
      ["curve", o.cx, o.cy],
      ["end", o.x2, o.y2],
    ])
      out += `<circle class="handle" data-handle="${h}" cx="${x}" cy="${y}" r="10" fill="${h === "curve" ? "#8aebff" : "white"}" stroke="#125673" stroke-width="3"/>`;
  }
  return out;
}
