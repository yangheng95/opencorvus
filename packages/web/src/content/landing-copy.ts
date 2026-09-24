import type { PublicLocale } from "./public-market"

/**
 * Shared copy for the concise landing page and the original visual case components in the blog.
 *
 * Copy stays deliberately terse: the previous site spread the same message over eight surfaces and
 * nobody read past the first. Detailed editorial content now lives in blog articles.
 *
 * Counting rule for the budget: CJK counts characters, Latin counts words. A 40-character Chinese
 * lead and a 40-word English lead are wildly different amounts of reading, so the English limits
 * below are expressed in words.
 */

export type LandingCta = { readonly label: string; readonly href: string; readonly variant: "primary" | "secondary" }

/** A long-horizon card with a claim and one checkable fact under it. */
export type LandingPillar = {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly evidenceLabel: string
  readonly evidenceValue: string
}

export type LandingCopy = {
  readonly meta: { readonly title: string; readonly description: string }
  readonly hero: {
    readonly eyebrow: string
    readonly titleLines: readonly [string, string]
    readonly description: string
    readonly ctas: readonly LandingCta[]
    /** The hero's download control. Labels only — the assets come from the release manifest. */
    readonly download: {
      readonly label: string
      /** Prefixed to the detected platform so the button still reads as an action. */
      readonly verb: string
      readonly detecting: string
      readonly menuLabel: string
      readonly allPlatforms: string
      readonly releaseNote: string
    }
    readonly terminalLabel: string
    readonly terminals: readonly { readonly id: string; readonly label: string; readonly lines: readonly string[] }[]
  }
  readonly benchmark: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly strictMetric: string
    readonly baselineLabel: string
    readonly baselineDetail: string
    readonly currentLabel: string
    readonly currentDetail: string
    readonly trackLabel: string
    readonly casesLabel: string
    readonly casesDetail: string
    readonly deltaLabel: string
    readonly deltaDetail: string
    readonly multiplierLabel: string
    readonly multiplierDetail: string
    readonly referenceEyebrow: string
    readonly referenceTitle: string
    readonly notRanking: string
    readonly note: string
  }
  /**
   * The long-horizon section: three ways long work fails, and the mechanism that answers each.
   *
   * Shape borrowed deliberately from LongHorizon-Harness, which names its failure modes
   * (compounding errors, context rot, task-state loss, unverified premises) before it describes a
   * loop. Naming the failure first is what makes the mechanism readable; a page that opens with
   * "durable execution" is answering a question the reader has not asked yet.
   */
  readonly horizon: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly breaks: readonly LandingPillar[]
  }
  /**
   * Squad composition. The chain itself — which squads, what each stage is called, what it hands
   * on — lives in `squad-compositions.ts`, and its squad and role counts are generated from the
   * catalog. Only the framing is here.
   */
  readonly compose: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly caseLabel: string
    readonly paperCaseLabel: string
    readonly missionPromptLabel: string
    readonly requirementsLabel: string
    readonly outputsLabel: string
    readonly overviewLabel: string
    readonly workflowLabel: string
    readonly tasksUnit: string
    readonly milestoneLabel: string
    readonly stageHeading: string
    readonly squadHeading: string
    readonly handoffHeading: string
    /** Unit nouns for the generated totals, e.g. "6 squads · 33 roles". */
    readonly squadsUnit: string
    readonly rolesUnit: string
    /** Column heading for the role count. Chinese needs a noun here, not the measure word. */
    readonly rolesHeading: string
    readonly scale: {
      readonly summary: string
      readonly openSummary: string
      readonly hint: string
      readonly eyebrow: string
      readonly title: string
      readonly lead: string
      readonly stagesUnit: string
    }
    readonly moreLabel: string
    readonly cta: string
  }
}

const GITHUB = "https://github.com/yangheng95/opencorvus"

export const landingCopy: Record<PublicLocale, LandingCopy> = {
  "zh-cn": {
    meta: {
      title: "OpenCorvus · 为长程工作而做的 Harness",
      description:
        "开源的多 Agent Harness，为跑得久的工作而做：组合起来的专家团、每次交接都有证据、专家团还能按你的反馈修订自己。MIT 许可证，可自托管。",
    },
    hero: {
      eyebrow: "长程任务 Harness · MIT · 可自托管",
      titleLines: ["长程复杂任务，", "让专家团接力。"],
      description: "从调研、实现到独立复核，专家团以产物交接推进任务；保留进度与上下文，并按你的反馈修订。",
      ctas: [
        { label: "查看源码", href: GITHUB, variant: "secondary" },
        { label: "读文档", href: "/start/quickstart/", variant: "secondary" },
        { label: "专家团", href: "/market/", variant: "secondary" },
      ],
      download: {
        label: "下载桌面端",
        verb: "下载",
        detecting: "识别平台中…",
        menuLabel: "选择平台",
        allPlatforms: "全部平台与格式",
        releaseNote: "从 GitHub Release 下载",
      },
      terminalLabel: "两条路",
      terminals: [
        {
          id: "source",
          label: "源码构建",
          lines: [
            `$ git clone ${GITHUB}`,
            "$ cd opencorvus && bun install",
            "$ bun run --cwd packages/opencorvus build",
            "$ bun packages/opencorvus/src/index.ts doctor",
          ],
        },
        {
          id: "serve",
          label: "启动服务",
          lines: [
            "$ cd /path/to/your/repo",
            '$ bun "$OPENCORVUS_SOURCE" serve',
            "",
            "→ 工作台 http://127.0.0.1:7878/ui/",
          ],
        },
      ],
    },
    benchmark: {
      eyebrow: "实测结果",
      title: "Mission 把 Luna 的正确率提升到 {current}",
      lead: "{cases} 个 AutomationBench case，按严格通过标准计分；先看原始模型，再看 OpenCorvus 完整执行后的结果。",
      strictMetric: "严格正确率",
      baselineLabel: "原始 GPT-5.6 Luna",
      baselineDetail: "没有 OpenCorvus Mission 编排",
      currentLabel: "OpenCorvus Mission Base",
      currentDetail: "同一 Luna 模型 · {cases} case",
      trackLabel: "严格正确率从 {baseline} 提升到 {current}",
      casesLabel: "已评测 case",
      casesDetail: "本次冻结样本",
      deltaLabel: "绝对提升",
      deltaDetail: "个百分点",
      multiplierLabel: "相对原始 Luna",
      multiplierDetail: "严格通过率倍数",
      referenceEyebrow: "不同样本参考",
      referenceTitle: "官方 held-out 结果",
      notRanking: "不可横向排名",
      note: "参考值来自所附官方 held-out 对照；它们与本次 {cases}-case 冻结样本不是同一集合，因此只提供量级背景，不构成模型排名。",
    },
    horizon: {
      eyebrow: "长程",
      title: "长程工作在哪里断",
      lead: "三种失败，各自对应一个真实机制。",
      breaks: [
        {
          id: "unfinished",
          title: "跑不彻底",
          body: "需求带验收与非目标；进程丢了是恢复不是重来；终态任务收到你下一条消息就继续。",
          evidenceLabel: "终态",
          evidenceValue: "可重开",
        },
        {
          id: "unusable",
          title: "结果不能用",
          body: "带出处的类型化产物；宿主观测独立于 agent 自述；核查、完整性与视觉复核都是具名阶段。",
          evidenceLabel: "校验",
          evidenceValue: "具名阶段",
        },
        {
          id: "static",
          title: "永远不会变好",
          body: "把你真正想要的说给专家团；它起草修订，你点头才安装，回执就是撤销凭据。",
          evidenceLabel: "安装条件",
          evidenceValue: "你的接受",
        },
      ],
    },
    compose: {
      eyebrow: "组合",
      title: "专家团组合起来",
      lead: "最长的工作不是一支队伍干更久，而是几支各自负责一段。",
      caseLabel: "案例",
      paperCaseLabel: "另一个长 Mission",
      missionPromptLabel: "可直接交给 OpenCorvus 的 Mission",
      requirementsLabel: "原始 Mission 要求",
      outputsLabel: "最终必须交付",
      overviewLabel: "六项高层交付",
      workflowLabel: "完整执行工作流",
      tasksUnit: "个阶段",
      milestoneLabel: "本工作流交付",
      stageHeading: "阶段",
      squadHeading: "专家团",
      handoffHeading: "交出什么",
      squadsUnit: "支专家团",
      rolesUnit: "个具名角色",
      rolesHeading: "角色",
      scale: {
        summary: "展开工作流详情",
        openSummary: "收起工作流详情",
        hint: "把 6 项高层交付展开为 5 条工作流、18 个专家团阶段和逐层里程碑。",
        eyebrow: "任务规模 ×3",
        title: "完整任务的阶段与交付安排",
        lead: "从模型与数据证据开始，穿过 CUDA 训练、实时产品、研究发表，最后收敛到独立复现和 GitHub 发布。",
        stagesUnit: "个专家团阶段",
      },
      moreLabel: "其它组合",
      cta: "看组合是怎么跑的",
    },
  },

  root: {
    meta: {
      title: "OpenCorvus · A harness for long-horizon work",
      description:
        "OpenCorvus is an open-source multi-agent harness for work that runs long: combined expert squads, evidence at every handoff, and squads that revise from your feedback. MIT licensed, self-hosted.",
    },
    hero: {
      eyebrow: "Long-horizon agent harness · MIT · Self-hosted",
      titleLines: ["Long, complex work,", "carried by squads."],
      description:
        "Expert squads carry work from research through implementation and independent review, handing off artifacts, retaining context and revising from your feedback.",
      ctas: [
        { label: "View source", href: GITHUB, variant: "secondary" },
        { label: "Read the docs", href: "/start/quickstart/", variant: "secondary" },
        { label: "Expert Squads", href: "/market/", variant: "secondary" },
      ],
      download: {
        label: "Download",
        verb: "Download",
        detecting: "Detecting platform…",
        menuLabel: "Choose a platform",
        allPlatforms: "All platforms and formats",
        releaseNote: "Served from the GitHub Release",
      },
      terminalLabel: "Two ways in",
      terminals: [
        {
          id: "source",
          label: "Build from source",
          lines: [
            `$ git clone ${GITHUB}`,
            "$ cd opencorvus && bun install",
            "$ bun run --cwd packages/opencorvus build",
            "$ bun packages/opencorvus/src/index.ts doctor",
          ],
        },
        {
          id: "serve",
          label: "Start the server",
          lines: [
            "$ cd /path/to/your/repo",
            '$ bun "$OPENCORVUS_SOURCE" serve',
            "",
            "→ workbench at http://127.0.0.1:7878/ui/",
          ],
        },
      ],
    },
    benchmark: {
      eyebrow: "Measured result",
      title: "Mission raises the same Luna to {current}",
      lead: "{cases} AutomationBench cases scored by strict pass criteria: the unassisted model first, then the result after full OpenCorvus execution.",
      strictMetric: "Strict pass rate",
      baselineLabel: "Original GPT-5.6 Luna",
      baselineDetail: "Without OpenCorvus Mission orchestration",
      currentLabel: "OpenCorvus Mission Base",
      currentDetail: "Same Luna model · {cases} cases",
      trackLabel: "Strict pass rate rises from {baseline} to {current}",
      casesLabel: "Evaluated cases",
      casesDetail: "Current frozen sample",
      deltaLabel: "Absolute lift",
      deltaDetail: "percentage points",
      multiplierLabel: "Versus original Luna",
      multiplierDetail: "strict-pass multiple",
      referenceEyebrow: "Different-sample context",
      referenceTitle: "Official held-out results",
      notRanking: "Not a cross-sample rank",
      note: "Reference values come from the supplied official held-out comparison. They do not use the same sample as this {cases}-case frozen run, so they provide scale context only, not a model ranking.",
    },
    horizon: {
      eyebrow: "Long-horizon",
      title: "Where long work breaks",
      lead: "Three failures, and what answers each.",
      breaks: [
        {
          id: "unfinished",
          title: "It stops short",
          body: "Requirements carry acceptance and non-goals; a lost process is recovered, not restarted; a terminal Task reopens on your next message.",
          evidenceLabel: "Terminal state",
          evidenceValue: "Reopens",
        },
        {
          id: "unusable",
          title: "The result is not usable",
          body: "Typed artifacts with provenance, host observations separate from any agent's summary, and fact-check, integrity and visual review as named stages.",
          evidenceLabel: "Checked by",
          evidenceValue: "Named stages",
        },
        {
          id: "static",
          title: "It never gets better",
          body: "Tell a squad what you actually wanted; it drafts the revision, you accept it, and the receipt undoes it.",
          evidenceLabel: "Installs on",
          evidenceValue: "Your acceptance",
        },
      ],
    },
    compose: {
      eyebrow: "Composition",
      title: "Squads, combined",
      lead: "The longest work is not one team working longer. It is several, each owning a stage.",
      caseLabel: "Case",
      paperCaseLabel: "Another long Mission",
      missionPromptLabel: "Mission to give OpenCorvus",
      requirementsLabel: "Original Mission requirements",
      outputsLabel: "Required final deliveries",
      overviewLabel: "Six high-level deliveries",
      workflowLabel: "Complete execution workflow",
      tasksUnit: "stages",
      milestoneLabel: "Workstream delivery",
      stageHeading: "Stage",
      squadHeading: "Squad",
      handoffHeading: "Hands on",
      squadsUnit: "squads",
      rolesUnit: "named roles",
      rolesHeading: "Roles",
      scale: {
        summary: "Explore the workflow details",
        openSummary: "Collapse the workflow details",
        hint: "Turn six high-level deliveries into five workstreams, eighteen squad-owned stages, and visible milestones.",
        eyebrow: "Workload ×3",
        title: "This is the complete Mission OpenCorvus has to coordinate",
        lead: "It starts with model and data evidence, crosses CUDA training, a live product, and research publication, then converges on independent reproduction and GitHub release.",
        stagesUnit: "squad-owned stages",
      },
      moreLabel: "Other combinations",
      cta: "How composition works",
    },
  },
}
