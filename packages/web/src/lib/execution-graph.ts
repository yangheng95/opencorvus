import { executionCopy } from "../content/execution-copy"
import type { PublicLocale } from "../content/public-market"

const esc = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/**
 * Selected Advanced greenfield handoffs, plus the two recorded repair loops.
 * A presentation graph, not a runtime projection: no fabricated status or timing.
 */
const nodes = [
  { id: "intent", x: 36, y: 114, stage: 0, role: 0 },
  { id: "requirements", x: 36, y: 234, stage: 0, role: 1 },
  { id: "research", x: 36, y: 354, stage: 0, role: 2 },
  { id: "architecture", x: 250, y: 234, stage: 1, role: 0 },
  { id: "workload", x: 464, y: 94, stage: 1, role: 1 },
  { id: "design", x: 464, y: 274, stage: 1, role: 2 },
  { id: "implementation", x: 678, y: 274, stage: 2, role: 0 },
  { id: "test", x: 892, y: 154, stage: 3, role: 0 },
  { id: "interface-review", x: 892, y: 364, stage: 3, role: 1 },
  { id: "system-review", x: 1106, y: 154, stage: 3, role: 2, width: 148 },
  { id: "delivery", x: 1106, y: 364, stage: 4, role: 0, width: 148 },
] as const

const edges = [
  { from: "intent", to: "architecture", d: "M198 145 C228 145 220 265 250 265" },
  { from: "requirements", to: "architecture", d: "M198 265 H250" },
  { from: "research", to: "architecture", d: "M198 385 C228 385 220 265 250 265" },
  { from: "architecture", to: "workload", d: "M412 265 C442 265 434 125 464 125" },
  { from: "architecture", to: "design", d: "M412 265 C442 265 434 305 464 305" },
  { from: "design", to: "implementation", d: "M626 305 H678" },
  { from: "implementation", to: "test", d: "M840 305 C871 305 861 185 892 185" },
  { from: "implementation", to: "interface-review", d: "M840 305 C871 305 861 395 892 395" },
  { from: "test", to: "system-review", d: "M1054 185 H1106" },
  {
    from: "workload",
    to: "system-review",
    d: "M626 125 H649 Q665 125 665 109 V80 Q665 64 681 64 H1164 Q1180 64 1180 80 V154",
  },
  { from: "implementation", to: "system-review", d: "M759 274 V254 Q759 238 775 238 H1124 Q1140 238 1140 222 V216" },
  { from: "system-review", to: "delivery", d: "M1220 216 V364" },
  { from: "interface-review", to: "delivery", d: "M1054 395 H1106" },
] as const

export function executionGraph(locale: PublicLocale, id = "execution"): string {
  const c = executionCopy[locale]
  const zh = locale === "zh-cn"
  const normal = edges
    .map((edge) => `<path data-from="${edge.from}" data-to="${edge.to}" d="${edge.d}" marker-end="url(#${id}-arrow)"/>`)
    .join("")
  const roles = nodes
    .map((node) => {
      const width = "width" in node ? node.width : 162
      const active = node.id === "implementation"
      const end = node.id === "delivery"
      const label = end ? (zh ? "交付汇总" : "Delivery") : c.roles[node.stage][node.role]!
      const sub = active ? (zh ? "实现与集成" : "Build & integrate") : end ? (zh ? "编排器" : "Orchestrator") : ""
      return `<g data-node="${node.id}" transform="translate(${node.x} ${node.y})">
      <rect width="${width}" height="62" rx="14" fill="${active ? "#365bed" : end ? "#ecf6f1" : "#ffffff"}" stroke="${active ? "#365bed" : end ? "#a8caba" : "#dbe0e9"}"/>
      <circle cx="18" cy="31" r="3" fill="${active ? "#cdd7ff" : end ? "#348062" : "#8894aa"}"/>
      <text x="${(width + 13) / 2}" y="${sub ? 26 : 37}" text-anchor="middle" fill="${active ? "white" : "#273247"}" font-size="${zh ? 17 : 14}" font-weight="600">${esc(label)}</text>
      ${sub ? `<text x="${(width + 13) / 2}" y="45" text-anchor="middle" fill="${active ? "#d6dfff" : "#628674"}" font-size="11">${esc(sub)}</text>` : ""}
    </g>`
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1290 590" width="1290" height="590" role="img" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title">${esc(c.label)}</title>
    <desc id="${id}-desc">${esc(zh ? "意图、需求与调研汇合至架构；架构分派界面设计与工作量复核；设计进入实现；实现分支到测试和界面复核；系统审查与界面复核汇合交付。复核反馈汇合后返回实现，包含计分修正与关卡数据替换。" : "Intent, requirements and research join at architecture, then branch into design and workload review. Implementation branches into testing and interface review. System and interface reviews join at delivery. Review feedback joins before returning to implementation for scoring repair and stage-data replacement.")}</desc>
    <defs>
      <marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="#8193ba" stroke-width="1.5"/></marker>
      <marker id="${id}-repair" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="#ba8649" stroke-width="1.5"/></marker>
      <radialGradient id="${id}-wash"><stop stop-color="#dfe7ff" stop-opacity=".7"/><stop offset="1" stop-color="#f7f9fd" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1290" height="590" rx="24" fill="#f7f9fd"/>
    <ellipse cx="750" cy="290" rx="350" ry="260" fill="url(#${id}-wash)"/>
    <g font-family="Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
      <text x="37" y="42" font-size="13" fill="#68778f" letter-spacing="1">${esc(c.badge)}</text>
      <g fill="none" stroke="#8193ba" stroke-width="1.7">${normal}</g>
      <g fill="none" stroke="#ba8649" stroke-width="1.7" stroke-dasharray="5 4">
        <path data-from="interface-review" data-to="review-feedback" d="M973 426 V460 Q973 480 993 480 H1050" marker-end="url(#${id}-repair)"/>
        <path data-from="system-review" data-to="review-feedback" d="M1106 199 H1094 Q1080 199 1080 213 V460" marker-end="url(#${id}-repair)"/>
        <path data-from="review-feedback" data-to="implementation" d="M1140 510 V540 Q1140 555 1125 555 H747 Q732 555 732 540 V336" marker-end="url(#${id}-repair)"/>
      </g>
      ${roles}
      <g data-node="review-feedback">
        <rect x="1050" y="460" width="190" height="50" rx="14" fill="#fff8ed" stroke="#ba8649"/>
        <text x="1145" y="491" text-anchor="middle" font-size="15" fill="#92602c">${esc(zh ? "复核反馈" : "Review feedback")}</text>
      </g>
      <text x="870" y="512" text-anchor="middle" font-size="12" fill="#92602c">${esc(zh ? "01  计分与结算修正" : "01  Scoring & results repair")}</text>
      <text x="870" y="537" text-anchor="middle" font-size="12" fill="#92602c">${esc(zh ? "02  35 关数据替换" : "02  Replace 35 stages of data")}</text>
      <text x="38" y="541" font-size="12" fill="#748299">${esc(zh ? "实线：工作衔接" : "Solid: work handoff")}</text>
      <text x="38" y="562" font-size="12" fill="#92602c">${esc(zh ? "虚线：复核后的修正回流" : "Dashed: correction after review")}</text>
    </g>
  </svg>`.replace(/[ \t]+$/gm, "")
}
