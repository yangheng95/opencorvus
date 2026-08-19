import type { LocalizedText, PublicLocale } from "./public-market"

/**
 * Editorial declaration of the Expert Squad combinations shown on the public site.
 *
 * This file holds the *editorial* half only: which squads, in what order, what each stage is
 * called, and what it hands the next one. It deliberately holds **no counts**. Role and workflow
 * counts are resolved from the same catalog facts the market pages use and emitted into
 * `squad-compositions.generated.ts` by `script/generate-public-market.ts`, which throws when a
 * declared squad id is not in the catalog.
 *
 * The reason for the split is the one recorded in `platform-facts.ts`: a number typed into copy is
 * a number that drifts. "Six squads, thirty-three roles" is exactly the kind of claim that stays on
 * a landing page for a year after a squad gained a role.
 */

export type SquadCompositionStep = {
  /** Namespace-qualified squad identity, for example `builtin/deep-research`. */
  readonly squadId: string
  /** What this stage is called in the chain. Short — it is a column header, not a sentence. */
  readonly stage: LocalizedText
  /** What this squad hands the next one. */
  readonly handoff: LocalizedText
}

export type SquadComposition = {
  readonly id: string
  readonly title: LocalizedText
  readonly lead: LocalizedText
  readonly steps: readonly SquadCompositionStep[]
  /**
   * Squads that extend the same chain without being part of its shortest honest form. Counted
   * separately so the headline figure stays the one a reader would actually need.
   */
  readonly extras?: {
    readonly lead: LocalizedText
    readonly squadIds: readonly string[]
  }
}

const text = (root: string, zh: string): LocalizedText => ({ root, "zh-cn": zh })

/** The case study. Rendered in full on the landing page and in the composition doc. */
export const FEATURED_COMPOSITION_ID = "research-to-paper"

export const squadCompositions: readonly SquadComposition[] = [
  {
    id: FEATURED_COMPOSITION_ID,
    title: text("From a pile of sources to a submitted paper", "从一堆资料到一篇可投的论文"),
    lead: text(
      "Each stage hands the next one an artifact it can read, not a summary it has to trust.",
      "每一段交给下一段的是能读的产物，不是只能信的总结。",
    ),
    steps: [
      {
        squadId: "builtin/scientific-research-design",
        stage: text("Frame", "立题"),
        handoff: text(
          "Evidence landscape, competing hypotheses, and a rigor-and-ethics read, joined into one decision register.",
          "证据地貌、竞争假设、严谨性与伦理判断，合成一份研究决策登记册。",
        ),
      },
      {
        squadId: "builtin/deep-research",
        stage: text("Source", "取证"),
        handoff: text(
          "Multi-perspective discovery and curated evidence, with an independent citation review before anything is written up.",
          "多视角检索与证据策展，成文之前先过一遍独立引文复核。",
        ),
      },
      {
        squadId: "builtin/data-analysis",
        stage: text("Analyze", "分析"),
        handoff: text(
          "Metric reconciliation and parallel performance and segment work, checked by a role that did not run the analysis.",
          "口径对账与表现、分群并行分析，再交给没跑过分析的角色核查。",
        ),
      },
      {
        squadId: "builtin/research-studio",
        stage: text("Draft", "成稿"),
        handoff: text(
          "Durable evidence collection, reproducible analysis, post-computation fact-checking, and template-driven delivery.",
          "可留存的证据收集、可复现的分析、计算之后的事实核查，以及模板化交付。",
        ),
      },
      {
        squadId: "builtin/academic-paper-review",
        stage: text("Review", "审稿"),
        handoff: text(
          "Literature, novelty, logic, methods and figures — plus a citation-and-hallucination auditor separate from all of them.",
          "文献、新颖性、逻辑、方法与图表，外加一个独立于它们的引文与幻觉审计角色。",
        ),
      },
      {
        squadId: "builtin/office-delivery",
        stage: text("Package", "物料"),
        handoff: text(
          "The submission deck built from the same sources, with a real chart and a validation receipt.",
          "投稿物料由同一批来源生成，带真实图表和校验回执。",
        ),
      },
    ],
    extras: {
      lead: text(
        "Prior-art evidence, live-page observation, or a second language extend the same chain.",
        "先验技术证据、实时页面观察、第二语言，都能接在同一条链上。",
      ),
      squadIds: [
        "builtin/patent-landscape-prior-art",
        "builtin/browser-research-acceptance",
        "builtin/localization-adaptation",
      ],
    },
  },
  {
    id: "deal-due-diligence",
    title: text("Deal due diligence", "交易尽调"),
    lead: text(
      "Five owners, and no one summary standing in for another owner's evidence.",
      "五个责任人，谁也不能拿一份总结代替另一个人的证据。",
    ),
    steps: [
      {
        squadId: "builtin/mergers-acquisitions-due-diligence",
        stage: text("Perimeter", "边界"),
        handoff: text("Perimeter and data-room completeness evidence.", "尽调边界与资料室完整性证据。"),
      },
      {
        squadId: "builtin/forensic-accounting-investigations",
        stage: text("Transactions", "交易"),
        handoff: text("Transaction evidence, anomalies, and funds flow.", "交易证据、异常与资金流。"),
      },
      {
        squadId: "builtin/commercial-legal",
        stage: text("Contracts", "合同"),
        handoff: text("Dated authority research and contract analysis.", "带日期的权威检索与合同分析。"),
      },
      {
        squadId: "builtin/tax-compliance",
        stage: text("Tax", "税务"),
        handoff: text("Obligation analysis and remediation planning.", "义务分析与整改规划。"),
      },
      {
        squadId: "builtin/internal-audit-control-assurance",
        stage: text("Controls", "控制"),
        handoff: text("Control design and operating-effectiveness evidence.", "控制设计与运行有效性证据。"),
      },
    ],
  },
  {
    id: "incident-to-knowledge",
    title: text("Incident to written knowledge", "从一次事故到沉淀下来的知识"),
    lead: text(
      "An outage becomes a preserved timeline, a fixed cause, and a page the next on-call can find.",
      "一次故障最后变成留存的时间线、修掉的根因，和下一个值班能搜到的页面。",
    ),
    steps: [
      {
        squadId: "builtin/service-reliability-incident-operations",
        stage: text("Coordinate", "处置"),
        handoff: text("Incident coordination, handoffs, and action evidence.", "事故协调、交接与行动证据。"),
      },
      {
        squadId: "builtin/digital-forensics-incident-investigation",
        stage: text("Preserve", "取证"),
        handoff: text("Preserved artifacts and a reconstructed timeline.", "留存的取证产物与重建的时间线。"),
      },
      {
        squadId: "builtin/review-debug",
        stage: text("Repair", "修复"),
        handoff: text("Root cause, the repair, and independent verification.", "根因、修复，以及独立验证。"),
      },
      {
        squadId: "builtin/knowledge-base-operations",
        stage: text("Publish", "沉淀"),
        handoff: text("A governed page with source and lifecycle evidence.", "带来源与生命周期证据的受管页面。"),
      },
    ],
  },
  {
    id: "product-launch",
    title: text("Launching something", "把东西发出去"),
    lead: text(
      "One decision brief carried through the rest without being re-decided at each stage.",
      "一份决策简报一路走完后面几段，中间不再重新拍板。",
    ),
    steps: [
      {
        squadId: "builtin/product-management",
        stage: text("Decide", "定盘"),
        handoff: text("A verifiable decision brief with customer evidence.", "带客户证据、可验证的决策简报。"),
      },
      {
        squadId: "builtin/marketing-growth",
        stage: text("Plan", "渠道"),
        handoff: text("Audience, channel, experiment, and measurement plan.", "受众、渠道、实验与度量规划。"),
      },
      {
        squadId: "builtin/seo-geo",
        stage: text("Discovery", "可发现性"),
        handoff: text("Search and generative-discovery optimization plan.", "搜索与生成式发现的优化方案。"),
      },
      {
        squadId: "builtin/product-video",
        stage: text("Film", "影片"),
        handoff: text("A reviewed production handoff, claims intact.", "经过复核的制作交接，主张不注水。"),
      },
      {
        squadId: "builtin/localization-adaptation",
        stage: text("Localize", "本地化"),
        handoff: text("A terminology-controlled locale release pack.", "术语受控的语言区发布包。"),
      },
    ],
  },
]

/** Every squad identity any composition names, deduplicated, in declaration order. */
export function declaredCompositionSquadIDs(): string[] {
  const seen = new Set<string>()
  for (const composition of squadCompositions) {
    for (const step of composition.steps) seen.add(step.squadId)
    for (const id of composition.extras?.squadIds ?? []) seen.add(id)
  }
  return [...seen]
}

export function localized(value: LocalizedText, locale: PublicLocale): string {
  return value[locale]
}
