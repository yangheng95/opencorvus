// Upstream source: anomalyco/opencode packages/opencode/src/util/html.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
