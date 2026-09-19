import { executionCopy } from "../src/content/execution-copy"
import { executionGraph } from "../src/lib/execution-graph"
import type { PublicLocale } from "../src/content/public-market"

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/** The supporting README figure uses the same graph as the homepage case. */
export function coordinationDiagram(locale: PublicLocale): string {
  const c = executionCopy[locale]
  const zh = locale === "zh-cn"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960" role="img" aria-labelledby="share-title">
    <title id="share-title">${escape(c.badge)}</title>
    <rect width="1440" height="960" fill="#f7f9fd"/>
    <g font-family="Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
      <text x="72" y="70" fill="#253044" font-size="23" font-weight="600">OpenCorvus</text>
      <text x="72" y="170" fill="#253044" font-size="54" font-weight="700">${zh ? "坦克大战：从调研到交付" : "Tank battle: from research to delivery"}</text>
      <text x="72" y="225" fill="#69778f" font-size="24">${zh ? "19 项验收要求 · 35 关来源数据 · 两轮修正" : "19 acceptance requirements · 35 stages of source data · two correction rounds"}</text>
      <text x="72" y="910" fill="#69778f" font-size="15">${escape(c.disclaimer)}</text>
    </g>
    <g transform="translate(75 280)">${executionGraph(locale, "share")}</g>
  </svg>`
}
