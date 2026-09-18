import { landingCopy } from "../src/content/landing-copy"
import { executionGraph } from "../src/lib/execution-graph"
import type { PublicLocale } from "../src/content/public-market"

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/** README and social art embed the same directed graph as the homepage. */
export function coordinationDiagram(locale: PublicLocale): string {
  const c = landingCopy[locale]
  const zh = locale === "zh-cn"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960" role="img" aria-labelledby="share-title">
    <title id="share-title">${escape(c.meta.title)}</title>
    <rect width="1440" height="960" fill="#f7f9fd"/>
    <g font-family="Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
      <text x="72" y="70" fill="#253044" font-size="23" font-weight="600">OpenCorvus</text>
      <text x="72" y="170" fill="#253044" font-size="62" font-weight="700" letter-spacing="-2">${escape(c.hero.titleLines.join(zh ? "" : " "))}</text>
      <text x="72" y="225" fill="#69778f" font-size="24">${escape(c.hero.description)}</text>
      <text x="72" y="910" fill="#69778f" font-size="15">${escape(c.map.disclaimer)}</text>
    </g>
    <g transform="translate(75 280)">${executionGraph(locale, "share")}</g>
  </svg>`
}

export function socialCard(): Buffer {
  const c = landingCopy.root
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#f7f9fd"/>
    <g font-family="Arial, sans-serif">
      <text x="66" y="45" font-size="19" font-weight="600" fill="#253044">OpenCorvus</text>
      <text x="66" y="114" font-size="52" letter-spacing="-2" font-weight="700" fill="#253044">${escape(c.hero.titleLines.join(" "))}</text>
      <text x="66" y="149" font-size="18" fill="#69778f">${escape(c.hero.description)}</text>
    </g>
    <g transform="translate(103 166) scale(.77)">${executionGraph("root", "social")}</g>
  </svg>`)
}
