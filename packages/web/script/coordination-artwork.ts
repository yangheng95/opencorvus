import { landingCopy } from "../src/content/landing-copy"
import type { PublicLocale } from "../src/content/public-market"

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/** Editable, code-native promotional diagrams; wording is shared with the homepage. */
export function coordinationDiagram(locale: PublicLocale): string {
  const c = landingCopy[locale]
  const zh = locale === "zh-cn"
  const cards = c.map.stages
    .map((stage, i) => {
      const x = 52 + i * 270
      return `<g transform="translate(${x} 338)">
      <rect width="254" height="205" rx="12" fill="#19263a" stroke="#48628a"/>
      <text x="20" y="36" fill="#9bb8ed" font-size="15">0${i + 1}</text>
      <text x="20" y="73" fill="#fff" font-size="24" font-weight="700">${escape(stage.title)}</text>
      ${stage.roles.map((role, j) => `<text x="20" y="${102 + j * 22}" fill="#b9c9de" font-size="16">${escape(role)}</text>`).join("")}
      <text x="20" y="185" fill="#9bd8c6" font-size="15">${escape(stage.output)}</text>
    </g>${i < 4 ? `<path d="M${x + 255} 423 h14" stroke="#8eaaff" stroke-width="2" marker-end="url(#arrow)"/>` : ""}`
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="720" viewBox="0 0 1440 720" role="img" aria-labelledby="title desc">
    <title id="title">${escape(c.map.label)}</title><desc id="desc">${escape(c.map.loop)}. ${escape(c.map.disclaimer)}</desc>
    <defs><marker id="arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 5 2.5 0 5" fill="#8eaaff"/></marker></defs>
    <rect width="1440" height="720" fill="#111b2d" rx="18"/>
    <g font-family="Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
      <text x="52" y="57" fill="#dce7fa" font-size="23" font-weight="700">OpenCorvus</text>
      <text x="1384" y="55" text-anchor="end" fill="#a7bbdc" font-size="14">${escape(c.hero.eyebrow)}</text>
      <text x="52" y="145" fill="white" font-size="${zh ? 48 : 54}" font-weight="700">${escape(c.hero.titleLines.join(zh ? "" : " "))}</text>
      <text x="52" y="192" fill="#acbed9" font-size="21">${escape(zh ? "调研、设计、实现、复核与返工，在同一任务里衔接。" : "Research, design, implementation and review. Connected through the task.")}</text>
      <rect x="52" y="237" width="1334" height="61" rx="9" fill="#1b2f4e" stroke="#486899"/>
      <text x="82" y="275" fill="#eef5ff" font-size="22" font-weight="700">${escape(c.map.owner)}</text>
      <text x="1355" y="274" text-anchor="end" fill="#b8ccec" font-size="18">${escape(c.map.ownerNote)}</text>
      ${c.map.stages.map((_, i) => `<path d="M${179 + i * 270} 298 v39" stroke="#547199"/>`).join("")}
      ${cards}
      <path d="M988 545 V605 H718 V552" fill="none" stroke="#e6b775" stroke-width="3"/>
      <path d="m709 561 9-10 9 10" fill="none" stroke="#e6b775" stroke-width="3"/>
      <rect x="776" y="582" width="570" height="43" rx="6" fill="#392f28"/>
      <text x="800" y="610" fill="#f1c58d" font-size="20">${escape(c.map.loop)}</text>
      <text x="52" y="679" fill="#a9b9d1" font-size="16">${escape(c.map.disclaimer)}</text>
    </g>
  </svg>`
}

export function socialCard(): Buffer {
  const c = landingCopy.root
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#f5f4f0"/>
    <g font-family="Arial, sans-serif">
      <text x="62" y="94" font-size="27" font-weight="700" fill="#14213a">OpenCorvus</text>
      <text x="62" y="155" font-size="13" letter-spacing="1.5" fill="#315be8">${c.hero.eyebrow}</text>
      ${c.hero.titleLines.map((line, i) => `<text x="58" y="${256 + i * 70}" font-size="61" letter-spacing="-2" font-weight="700" fill="#14213a">${escape(line)}</text>`).join("")}
      <text x="62" y="480" font-size="20" fill="#526076">From a goal to a delivery you can inspect.</text>
      <text x="62" y="560" font-size="15" fill="#315be8">Open source · Self-hostable · opencorvus.com</text>
      <rect x="640" y="62" width="504" height="508" rx="17" fill="#111b2d"/>
      <text x="671" y="104" font-size="17" fill="#e9effa">OpenCorvus orchestrator</text>
      <text x="671" y="130" font-size="12" fill="#aebed7">COLLABORATION MAP · ILLUSTRATION</text>
      ${c.map.stages.map((s, i) => `<rect x="668" y="${151 + i * 68}" width="448" height="56" rx="6" fill="#203452"/><text x="687" y="${184 + i * 68}" font-size="14" fill="#9bb8ed">0${i + 1}</text><text x="725" y="${184 + i * 68}" font-size="19" fill="#f2f5ff">${s.title}</text><text x="1096" y="${184 + i * 68}" text-anchor="end" font-size="12" fill="#a3d9c9">${escape(s.output)}</text>`).join("")}
      <text x="674" y="533" fill="#f1c58d" font-size="17">Find an issue → Revise → Review again</text>
    </g>
  </svg>`)
}
