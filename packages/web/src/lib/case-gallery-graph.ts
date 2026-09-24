import { executionGraph } from "./execution-graph"
import type { GalleryCaseID } from "../content/case-gallery"
import type { PublicLocale } from "../content/public-market"

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")

export function caseGalleryGraph(id: GalleryCaseID, locale: PublicLocale): string {
  if (id === "tank") return executionGraph(locale, "gallery-tank")
  const zh = locale === "zh-cn"
  const nodes = [
    { id: "sources", x: 30, y: 182, label: zh ? "资料与数据" : "Sources & data" },
    { id: "train", x: 274, y: 182, label: zh ? "CUDA 训练" : "CUDA training" },
    { id: "site", x: 532, y: 55, label: zh ? "监控与推理网页" : "Monitor & inference" },
    { id: "figures", x: 532, y: 298, label: zh ? "架构与实验图表" : "Architecture & figures" },
    { id: "paper", x: 785, y: 298, label: zh ? "ACL 格式论文" : "ACL-style paper" },
    { id: "review", x: 1038, y: 182, label: zh ? "独立审校" : "Independent review" },
    { id: "repo", x: 1038, y: 412, label: zh ? "仓库与交付" : "Repository & delivery" },
  ]
  const paths = [
    ["sources", "train", "M230 222 H274"],
    ["train", "site", "M474 222 C506 222 500 95 532 95"],
    ["train", "figures", "M474 222 C506 222 500 338 532 338"],
    ["figures", "paper", "M732 338 H785"],
    ["site", "review", "M732 95 H1118 Q1138 95 1138 115 V182"],
    ["paper", "review", "M985 338 C1018 338 1005 222 1038 222"],
    ["review", "repo", "M1138 262 V412"],
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1290 535" role="img" aria-labelledby="research-graph-title research-graph-desc">
    <title id="research-graph-title">${zh ? "研究工程的工作关系图" : "Research engineering relationship graph"}</title>
    <desc id="research-graph-desc">${zh ? "资料与数据进入 CUDA 训练，分支到网页和图表，图表支撑论文，网页与论文汇入审校后交付仓库。依据任务要求整理，非运行时间线。" : "Sources feed training, which branches into a live site and figures; figures support the paper, and the work joins at review before repository delivery. A requirements-based illustration, not a runtime timeline."}</desc>
    <defs><marker id="research-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="#8193ba" stroke-width="1.5"/></marker></defs>
    <rect width="1290" height="535" rx="24" fill="#f7f9fd"/>
    <g fill="none" stroke="#8193ba" stroke-width="2">${paths.map(([from,to,d])=>`<path data-from="${from}" data-to="${to}" d="${d}" marker-end="url(#research-arrow)"/>`).join("")}</g>
    <g font-family="Arial, Microsoft YaHei, sans-serif">${nodes.map((node)=>`<g data-node="${node.id}" transform="translate(${node.x} ${node.y})"><rect width="200" height="80" rx="16" fill="${node.id === "train" ? "#365bed" : "#fff"}" stroke="#dbe0e9"/><text x="100" y="47" text-anchor="middle" font-size="${zh ? 21 : 17}" font-weight="600" fill="${node.id === "train" ? "#fff" : "#273247"}">${escape(node.label)}</text></g>`).join("")}</g>
  </svg>`
}
