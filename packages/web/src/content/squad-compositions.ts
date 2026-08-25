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
  /** Optional copy-ready Mission request shown for long-form examples. */
  readonly prompt?: LocalizedText
  readonly steps: readonly SquadCompositionStep[]
  /**
   * A more granular rendering of the same outcome. The landing page discloses this on demand so
   * the shortest honest chain stays readable while every deeper Task still names one real squad.
   */
  readonly expandedSteps?: readonly SquadCompositionStep[]
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
export const FEATURED_COMPOSITION_ID = "deberta-absa-research-engineering"
export const SELF_PAPER_COMPOSITION_ID = "opencorvus-self-paper"

export const squadCompositions: readonly SquadComposition[] = [
  {
    id: FEATURED_COMPOSITION_ID,
    title: text("Turn DeBERTa into a complete research program", "把 DeBERTa 做成一项完整研究工程"),
    lead: text(
      "Model, data, CUDA experiments, a live product, figures, paper, review, and repository — one Mission, with a complete squad owning every stage.",
      "模型、数据、CUDA 实验、实时网页、图表、论文、审校与仓库都在同一个 Mission 里；每一段都由一支完整专家团负责。",
    ),
    steps: [
      {
        squadId: "builtin/deep-research",
        stage: text("Model & data", "模型与数据"),
        handoff: text(
          "A verified DeBERTa v3 Base ABSA v1.1 source, current ABSA evidence, and a sourced plan to find, clean, or synthesize training data.",
          "核验 DeBERTa v3 Base ABSA v1.1 来源，重查 ABSA 证据，并形成检索、清洗或合成训练数据的可追溯方案。",
        ),
      },
      {
        squadId: "builtin/advanced",
        stage: text("CUDA training system", "CUDA 训练系统"),
        handoff: text(
          "A CUDA-only runtime, iterative baseline and candidate training, an experiment ledger, and a live training-monitor and inference website.",
          "交付仅限 CUDA 的运行环境、基线与候选训练、实验台账，以及自动更新的训练监控与推理网页。",
        ),
      },
      {
        squadId: "builtin/data-analysis",
        stage: text("Architecture evidence", "架构证据"),
        handoff: text(
          "Best-run comparisons, architecture and design diagrams, and reproducible figures bound to the exact winning checkpoint.",
          "对齐最佳实验、模型架构与设计思路，产出绑定精确 checkpoint 的可复现图表。",
        ),
      },
      {
        squadId: "builtin/research-studio",
        stage: text("ACL short paper", "ACL 短文"),
        handoff: text(
          "A concise, informative ACL-style short paper of at least four pages, grounded in related work and the best experiment.",
          "基于相关工作与最佳实验，完成至少四页、concise 且 informative 的 ACL 风格短文。",
        ),
      },
      {
        squadId: "builtin/academic-paper-review",
        stage: text("Independent paper review", "独立论文审校"),
        handoff: text(
          "Resolved findings across facts, citations, novelty, method, structure, figures, hallucination risk, concision, and informativeness.",
          "逐项结算事实、引文、新颖性、方法、结构、图表、幻觉风险、简洁性与信息密度问题。",
        ),
      },
      {
        squadId: "builtin/base",
        stage: text("Mission repository", "Mission 仓库"),
        handoff: text(
          "A reproducible, organized Git repository with the Mission stage map, reviewed documentation, and a verified GitHub push.",
          "交付可复现、组织清晰的 Git 仓库，包含 Mission 阶段图、经审查的文档与已验证的 GitHub 推送。",
        ),
      },
    ],
    expandedSteps: [
      {
        squadId: "builtin/deep-research",
        stage: text("Verify model & literature", "核验模型与文献"),
        handoff: text(
          "Source-verified model identity, licence, checkpoints, and an evidence map of current ABSA work.",
          "核验模型身份、许可与 checkpoint，并建立当前 ABSA 工作的证据图谱。",
        ),
      },
      {
        squadId: "builtin/data-engineering-reliability",
        stage: text("Build the data line", "建立数据管线"),
        handoff: text(
          "Versioned acquisition, cleaning, splitting, synthesis, lineage, and reproducible dataset builds.",
          "版本化完成采集、清洗、切分、合成、血缘与可复现数据构建。",
        ),
      },
      {
        squadId: "builtin/ai-model-governance-evaluation",
        stage: text("Freeze the baseline", "冻结基线"),
        handoff: text(
          "A model-and-data card, fixed evaluation slices, quality risks, and a signed-off baseline protocol.",
          "固化模型与数据卡、评估切片、质量风险和基线协议。",
        ),
      },
      {
        squadId: "builtin/cloud-platform-architecture",
        stage: text("Design CUDA runtime", "设计 CUDA 环境"),
        handoff: text(
          "Pinned driver, CUDA, framework, container, storage, and GPU observability contracts with no CPU training path.",
          "固定驱动、CUDA、框架、容器、存储和 GPU 观测契约，不保留 CPU 训练路径。",
        ),
      },
      {
        squadId: "builtin/advanced",
        stage: text("Implement training", "实现训练系统"),
        handoff: text(
          "A reproducible trainer, configuration surface, checkpoint lifecycle, and focused verification.",
          "交付可复现训练器、配置面、checkpoint 生命周期与聚焦验证。",
        ),
      },
      {
        squadId: "builtin/evolution-lab",
        stage: text("Run candidate campaigns", "运行候选实验"),
        handoff: text(
          "Frozen arms, budgets, mutations, train/test metrics, integrity review, and a best-candidate decision.",
          "冻结对照臂、预算与变异，记录训练/测试指标，完成完整性审查和最佳候选决策。",
        ),
      },
      {
        squadId: "builtin/data-analysis",
        stage: text("Reconcile performance", "对账模型性能"),
        handoff: text(
          "Comparable metrics, slice analysis, uncertainty, failure clusters, and an independently checked ranking.",
          "统一指标口径，分析切片、不确定性和失败簇，并独立核查排名。",
        ),
      },
      {
        squadId: "builtin/frontend-innovate",
        stage: text("Build live product", "构建实时产品"),
        handoff: text(
          "A designed training monitor and inference experience backed by the experiment data contract.",
          "基于实验数据契约，设计并实现训练监控与推理体验。",
        ),
      },
      {
        squadId: "builtin/browser-research-acceptance",
        stage: text("Prove live updates", "验收实时更新"),
        handoff: text(
          "Real-page evidence that metrics refresh, inference works, responsive states hold, and console failures are absent.",
          "用真实页面证明指标会刷新、推理可用、响应式状态成立且控制台无故障。",
        ),
      },
      {
        squadId: "builtin/scientific-research-design",
        stage: text("Explain the design", "解释模型设计"),
        handoff: text(
          "Research questions, hypotheses, ablations, causal limits, and a defensible architecture narrative.",
          "明确研究问题、假设、消融、因果边界和可辩护的架构叙事。",
        ),
      },
      {
        squadId: "builtin/product-management",
        stage: text("Select the winning system", "决策最佳系统"),
        handoff: text(
          "One decision register tying the chosen architecture to user value, evidence, trade-offs, and non-goals.",
          "用同一份决策登记册绑定最佳架构、用户价值、证据、取舍与非目标。",
        ),
      },
      {
        squadId: "builtin/office-delivery",
        stage: text("Render publication figures", "绘制论文图表"),
        handoff: text(
          "Architecture, experiment, and comparison figures generated from the accepted source data with validation receipts.",
          "从已验收源数据生成架构图、实验图和对比图，并附校验回执。",
        ),
      },
      {
        squadId: "builtin/patent-landscape-prior-art",
        stage: text("Map adjacent work", "梳理相邻工作"),
        handoff: text(
          "A dated, query-reproducible adjacent-work landscape separating publications, claims, and open gaps.",
          "形成带日期、可复现查询的相邻工作版图，区分论文、主张与空白。",
        ),
      },
      {
        squadId: "builtin/research-studio",
        stage: text("Draft the ACL paper", "撰写 ACL 论文"),
        handoff: text(
          "A four-plus-page short paper whose method, results, figures, limitations, and citations share one evidence base.",
          "完成四页以上短文，让方法、结果、图表、局限与引文共用同一证据底座。",
        ),
      },
      {
        squadId: "builtin/academic-paper-review",
        stage: text("Audit the manuscript", "独立审查论文"),
        handoff: text(
          "Independent novelty, method, fact, citation, hallucination, organization, and concision findings with resolutions.",
          "独立审查新颖性、方法、事实、引文、幻觉、结构与简洁性，并逐项结算。",
        ),
      },
      {
        squadId: "builtin/review-debug",
        stage: text("Reproduce & debug", "复现与调试"),
        handoff: text(
          "A clean-room reproduction of training, evaluation, inference, and site startup with root-cause fixes.",
          "独立复现训练、评估、推理和网页启动，并修复真实根因。",
        ),
      },
      {
        squadId: "builtin/cybersecurity-assurance",
        stage: text("Harden the repository", "加固仓库"),
        handoff: text(
          "Secret, dependency, provenance, licence, workflow, and release-boundary assurance before publication.",
          "发布前完成密钥、依赖、来源、许可、工作流与发布边界审查。",
        ),
      },
      {
        squadId: "builtin/base",
        stage: text("Publish the Mission repo", "发布 Mission 仓库"),
        handoff: text(
          "An organized Git repository with exact setup, CUDA reproduction, data/model cards, dashboard, paper, evidence, and reviewed GitHub push.",
          "交付组织清晰的 Git 仓库，包含精确安装、CUDA 复现、数据/模型卡、网页、论文、证据与经审查的 GitHub 推送。",
        ),
      },
    ],
  },
  {
    id: SELF_PAPER_COMPOSITION_ID,
    title: text("OpenCorvus writes the paper about OpenCorvus", "让 OpenCorvus 写一篇介绍自己的论文"),
    lead: text(
      "A thirty-page, evidence-dense systems paper built from primary sources, executable evaluation, publication-grade figures, and an independent manuscript audit — not autobiography by assertion.",
      "一篇至少三十页、证据密集的系统论文：以一手材料、可执行评测、出版级图表和独立审稿为底座，不靠自说自话。",
    ),
    prompt: text(
      "Complete this long Mission with one complete Expert Squad owning every numbered stage. Produce a venue-neutral academic systems paper that introduces OpenCorvus and contains at least 30 pages of substantive main text, excluding references and appendices. Page count must not be inflated with repeated background, generic agent prose, oversized figures, loose spacing, appendix migration, or unsupported claims. Reconstruct the system from the current source tree, architecture specifications, documentation, release artifacts, and version history; map related multi-agent harness, long-horizon execution, evidence handoff, evaluation, and self-improvement work from inspected papers and official sources; define falsifiable research questions and bounded contributions; trace architecture, control flow, persistence, Task/Mission semantics, Expert Squad composition, evolution, permissions, recovery, and observability to exact evidence. Design and run reproducible empirical evaluations with declared baselines, datasets or cases, metrics, uncertainty, failures, ablations, and limitations; preserve runnable scripts and canonical result tables. Research Studio must use its analysis-report-quality Skill to build one validated evidence model before drafting. Every figure and table must be necessary, claim-linked, source-traceable, independently reproducible, and redrawn with conclusion-led titles, legible labels, units, sample sizes, uncertainty, captions, accessible encodings, and a deliberate publication theme. Raw notebook output, chart-library defaults, clipped labels, decorative diagrams, screenshots standing in for evidence, and visual garbage are forbidden. Draft the complete paper with abstract, introduction, research questions, related work, system design, implementation, methodology, results, ablations, discussion, threats to validity, limitations, responsible-use/security considerations, reproducibility statement, conclusion, and verified references. Then run independent literature, novelty, logic, methods/statistics/fact, citation/hallucination, and presentation reviews; resolve every critical and major finding, refine the figures again against the final prose, and deliver the manuscript, source, bibliography, evidence ledger, figure sources, and reproduction instructions together.",
      "完成下面的长 Mission，每一个编号都必须由一支完整专家团负责。最终交付一篇介绍 OpenCorvus 的通用学术系统论文：正文至少 30 页，参考文献和附录不计入页数；禁止用重复背景、泛泛而谈的 Agent 文案、超大图表、稀疏排版、把正文挪进附录或无证据主张凑页数。必须从当前源码、架构规格、文档、发布产物与版本历史重建系统；检索并实际阅读多 Agent Harness、长程执行、证据交接、评测与自我改进的相关论文和官方资料；提出可证伪的研究问题与边界清楚的贡献；把架构、控制流、持久化、Task/Mission 语义、专家团组合与进化、权限、恢复和可观测性逐项绑定到精确证据。设计并运行可复现的实证评测，明确基线、数据集或案例、指标、不确定性、失败案例、消融和局限，保存可运行脚本与规范结果表。研究工作室必须先使用 analysis-report-quality Skill 建立并验证唯一证据模型，再开始写作。每一张图表都必须必要、绑定主张、可追溯来源且可独立复现，并以结论式标题、清晰标签、单位、样本量、不确定性、完整图注、无障碍编码和统一出版主题重新绘制；严禁原始 notebook 输出、图表库默认样式、裁切标签、装饰性架构图、用截图代替证据或任何视觉垃圾。正文必须完整包含摘要、引言、研究问题、相关工作、系统设计、实现、方法、结果、消融、讨论、有效性威胁、局限、负责任使用与安全、可复现性声明、结论和核验过的参考文献。最后分别执行文献、新颖性、逻辑、方法/统计/事实、引文/幻觉与呈现审查，结算全部 critical 和 major 问题，让图表再次对齐最终正文，并一起交付论文、源文件、参考文献、证据台账、图表源文件和复现说明。",
    ),
    steps: [
      {
        squadId: "builtin/scientific-research-design",
        stage: text("Freeze the research charter", "冻结研究章程"),
        handoff: text(
          "Falsifiable questions, bounded contributions, competing explanations, evidence needs, ethics, and a no-padding acceptance contract.",
          "冻结可证伪问题、贡献边界、替代解释、证据需求、伦理边界和禁止灌水的验收契约。",
        ),
      },
      {
        squadId: "builtin/deep-research",
        stage: text("Build the source record", "建立一手证据库"),
        handoff: text(
          "Inspected code, specifications, releases, history, papers, and official sources with claim-level locators and search limits.",
          "实际核验源码、规格、版本、历史、论文与官方资料，形成主张级定位和检索边界。",
        ),
      },
      {
        squadId: "builtin/advanced",
        stage: text("Reconstruct the system", "重建系统机制"),
        handoff: text(
          "Executable architecture evidence for control flow, persistence, Mission/Task semantics, squads, evolution, permissions, recovery, and observability.",
          "以可执行证据重建控制流、持久化、Mission/Task 语义、专家团、进化、权限、恢复与可观测性。",
        ),
      },
      {
        squadId: "builtin/data-analysis",
        stage: text("Run empirical evaluation", "运行实证评测"),
        handoff: text(
          "Reproducible baselines, cases, metrics, uncertainty, ablations, failure analysis, canonical tables, and checked quantitative claims.",
          "交付可复现基线、案例、指标、不确定性、消融、失败分析、规范结果表和已核查定量主张。",
        ),
      },
      {
        squadId: "builtin/review-debug",
        stage: text("Reproduce independently", "独立复现"),
        handoff: text(
          "Clean-room reproduction of the claimed workflows and results, with root-cause fixes and unresolved limits recorded.",
          "洁净环境复现关键工作流与结果，修复真实根因并记录仍未解决的边界。",
        ),
      },
      {
        squadId: "builtin/patent-landscape-prior-art",
        stage: text("Position the contribution", "定位相关工作"),
        handoff: text(
          "A query-reproducible landscape that separates inspected prior work, overlap, defensible novelty, and unknowns.",
          "形成可复现检索的相关工作版图，区分已核验工作、重叠、可辩护创新与未知项。",
        ),
      },
      {
        squadId: "builtin/office-delivery",
        stage: text("Refine every figure", "精修全部图表"),
        handoff: text(
          "Publication-grade architecture, experiment, ablation, and comparison figures regenerated from accepted data — never raw plotting output.",
          "从已验收数据重绘出版级架构图、实验图、消融图与对比图，绝不交付原始绘图输出。",
        ),
      },
      {
        squadId: "builtin/research-studio",
        stage: text("Write the thirty-page paper", "撰写三十页论文"),
        handoff: text(
          "One validated evidence model and a concise, information-dense 30+ page main paper whose claims, prose, tables, figures, limits, and references agree.",
          "使用 analysis-report-quality Skill 建立唯一证据模型，完成正文 30 页以上、简洁而信息密集且主张、文字、图表、局限和引文一致的论文。",
        ),
      },
      {
        squadId: "builtin/academic-paper-review",
        stage: text("Audit and finish the manuscript", "独立审稿并定稿"),
        handoff: text(
          "Resolved literature, novelty, logic, method, statistics, fact, citation, hallucination, and presentation findings, followed by a final figure-to-prose reconciliation.",
          "结算文献、新颖性、逻辑、方法、统计、事实、引文、幻觉和呈现问题，并最终对账图表与正文。",
        ),
      },
    ],
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
    for (const step of composition.expandedSteps ?? []) seen.add(step.squadId)
    for (const id of composition.extras?.squadIds ?? []) seen.add(id)
  }
  return [...seen]
}

export function localized(value: LocalizedText, locale: PublicLocale): string {
  return value[locale]
}
