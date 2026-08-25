import { platformFacts } from "./platform-facts"
import type { PublicLocale } from "./public-market"

/**
 * Copy for the restyled landing page.
 *
 * Copy stays deliberately terse: the previous site spread the same message over eight surfaces and
 * nobody read past the first. Anything that does not fit belongs in the docs.
 *
 * Counting rule for the budget: CJK counts characters, Latin counts words. A 40-character Chinese
 * lead and a 40-word English lead are wildly different amounts of reading, so the English limits
 * below are expressed in words.
 */

export type LandingCta = { readonly label: string; readonly href: string; readonly variant: "primary" | "secondary" }

/** A card with a claim and one checkable fact under it. Shared by the `horizon` and `why` grids. */
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
  /**
   * The recorded run under the hero. It replaced a twenty-frame screenshot carousel: the frames
   * each proved one renderer, but a reader had to assemble the run from stills, and the strongest
   * thing about the product — that one prompt carries all the way to a finished file — was the one
   * thing twenty separate pictures could not show.
   *
   * `label` is the player's accessible name and `caption` is provenance, so both sit outside the
   * body budget for the same reason alt text does. The title and lead are inside it.
   */
  readonly demo: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly label: string
    readonly caption: string
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
  /** Self-evolution: the two paths a squad revision can take, and the boundary on both. */
  readonly evolve: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly paths: readonly { readonly id: string; readonly title: string; readonly body: string }[]
    /** Says plainly that nothing installs itself. Kept in body copy, not a footnote. */
    readonly boundary: string
    readonly cta: string
  }
  readonly why: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly pillars: readonly LandingPillar[]
    /**
     * Comparison against the closest positioned product. Every cell must be a checkable fact about
     * a published capability, never a judgement — the point is to let a reader place us, not to
     * argue. Source is linked in the page footnote.
     */
    readonly compare: {
      readonly title: string
      readonly lead: string
      /** Last column is us; `self` drives the emphasis, not column order. */
      readonly columns: readonly { readonly label: string; readonly href?: string; readonly self?: boolean }[]
      readonly rows: readonly { readonly axis: string; readonly cells: readonly string[] }[]
      /** Says plainly where the others are equal or ahead. A table that only flatters is discounted. */
      readonly fairness: string
      readonly note: string
    }
  }
  readonly squads: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly cta: string
    /** English needs both forms; Chinese uses the same string for each. */
    readonly agentLabel: string
    readonly agentsLabel: string
    readonly workflowLabel: string
    readonly workflowsLabel: string
  }
  readonly start: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly cliTitle: string
    readonly cliBody: string
    /** Must match an install path README.md actually documents. */
    readonly cliCommand: string
    readonly desktopTitle: string
    readonly desktopBody: string
    readonly desktopCta: string
    /** Must match an install path README.md actually documents. */
    readonly serveCommand: string
    readonly copy: string
    readonly copied: string
    readonly trustTitle: string
    readonly trust: readonly { readonly title: string; readonly body: string }[]
  }
  readonly faq: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly items: readonly { readonly q: string; readonly a: string }[]
  }
  readonly join: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly ctas: readonly LandingCta[]
  }
}

const GITHUB = "https://github.com/yangheng95/opencorvus"
const DISCUSSIONS = `${GITHUB}/discussions`

const squadTotal = platformFacts.squadTotal.value

export const landingCopy: Record<PublicLocale, LandingCopy> = {
  "zh-cn": {
    meta: {
      title: "OpenCorvus · 为长程工作而做的 Harness",
      description:
        "开源的多 Agent Harness，为跑得久的工作而做：组合起来的专家团、每次交接都有证据、专家团还能按你的反馈修订自己。MIT 许可证，可自托管。",
    },
    hero: {
      eyebrow: "长程任务 Harness · MIT · 可自托管",
      titleLines: ["能跑完的长任务，", "还会越跑越好。"],
      description: "长程任务交给组合起来的专家团，每次交接都有证据，专家团还能按你的反馈改自己。",
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
    demo: {
      eyebrow: "实录",
      title: "一次完整的运行",
      lead: "NVDA 近一年日线进去，K 线图、技术分析和 Word 报告出来。",
      label: "OpenCorvus 桌面端运行录屏",
      caption: "桌面端 v0.0.47beta 的一次真实运行 · 1 分 44 秒 · 无音轨",
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
        summary: "展开完整执行图",
        openSummary: "收起完整执行图",
        hint: "把 6 项高层交付展开为 5 条工作流、18 个专家团阶段和逐层里程碑。",
        eyebrow: "任务规模 ×3",
        title: "这才是 OpenCorvus 实际要协调的完整任务图",
        lead: "从模型与数据证据开始，穿过 CUDA 训练、实时产品、研究发表，最后收敛到独立复现和 GitHub 发布。",
        stagesUnit: "个专家团阶段",
      },
      moreLabel: "其它组合",
      cta: "看组合是怎么跑的",
    },
    evolve: {
      eyebrow: "进化",
      title: "会修订自己的专家团",
      lead: "两条路径，终点都是一次必须由你给出的确认。",
      paths: [
        {
          id: "feedback",
          title: "从你说过的话来",
          body: "说出你真正想要的。宿主复制精确版本、套用改动、校验成可运行的包，然后挂起等你。",
        },
        {
          id: "campaign",
          title: "从度量结果来",
          body: "进化实验室先冻结目标版本、用例、评分器、预算与变异面，再跑对照臂并复核结果。",
        },
      ],
      boundary: "没有你的确认，任何修订都不会安装；每次改动都能回退。",
      cta: "看进化是怎么做的",
    },
    why: {
      eyebrow: "特性",
      title: "开源、定制、可控、透明",
      lead: "四件事，决定一个工具能不能长期用下去。",
      pillars: [
        {
          id: "open",
          title: "开源",
          body: "MIT 许可证，全部源码公开。可自托管、可审计、可 fork。",
          evidenceLabel: "许可证",
          evidenceValue: "MIT",
        },
        {
          id: "custom",
          title: "定制",
          body: "换模型、改工具、调权限、装专家团，都不必改源码。",
          evidenceLabel: "可装专家团",
          evidenceValue: squadTotal,
        },
        {
          id: "control",
          title: "可控",
          body: "跑在自己机器上。工具按项目授权，不可逆操作先问过你。",
          evidenceLabel: "运行位置",
          evidenceValue: "本机",
        },
        {
          id: "transparent",
          title: "透明",
          body: "每次工具调用、参数和结果都留在会话原文里，可逐条回看。",
          evidenceLabel: "过程记录",
          evidenceValue: "全程",
        },
      ],
      compare: {
        title: "和相近产品的区别",
        lead: "定位最接近的两个，放在一起看。",
        columns: [
          { label: "WorkBuddy", href: "https://www.workbuddy.ai/" },
          { label: "DeepSeek Harness", href: "https://www.deepseek.com/harness/" },
          { label: "OpenCorvus", self: true },
        ],
        rows: [
          { axis: "许可", cells: ["商业，Token 套餐计费", "MIT 开源", "MIT 开源"] },
          { axis: "运行位置", cells: ["云端服务", "本地", "本地或自己的服务器"] },
          { axis: "出发点", cells: ["一句话交付成品", "插件内核，能力自行组合", "完整 harness 开箱即用，再逐层替换"] },
          {
            axis: "能力封装",
            cells: ["平台内的 Expert Group", "插件生态", `带版本与 digest 的专家团（${squadTotal} 支）`],
          },
          { axis: "上手", cells: ["桌面客户端", "npx 一行拉起 Web UI", "安装包或源码构建"] },
        ],
        fairness:
          "DeepSeek Harness 同样是 MIT 开源，也同样把运行过程完整留痕；它的插件内核比我们更彻底。选它还是选这里，取决于你要的是自己拼一套，还是拿到一套再改。",
        note: "对比依据两者的公开产品说明",
      },
    },
    squads: {
      eyebrow: "专家团",
      title: `${squadTotal} 支可安装的专家团`,
      lead: "每支都写明了适用场景、角色和工作流。",
      cta: `查看全部 ${squadTotal} 支`,
      agentLabel: "角色",
      agentsLabel: "角色",
      workflowLabel: "工作流",
      workflowsLabel: "工作流",
    },
    start: {
      eyebrow: "开始",
      title: "开始使用",
      lead: "从源码起，或者直接装桌面端。",
      cliTitle: "源码构建",
      cliBody: "装好 Bun，克隆、构建、自检。",
      cliCommand: "git clone https://github.com/yangheng95/opencorvus.git",
      desktopTitle: "已经装好了？",
      desktopBody: "在你的仓库里起服务，工作台开在本地。",
      desktopCta: "读快速开始",
      serveCommand: 'bun "$OPENCORVUS_SOURCE" serve',
      copy: "复制",
      copied: "已复制",
      trustTitle: "三条边界",
      trust: [
        { title: "签名校验", body: "资源包先验签名和 SHA-256，再落盘。" },
        { title: "权限边界", body: "工具按项目授权，不可逆操作需确认。" },
        { title: "证据可回看", body: "每次调用和结果都留在会话原文里。" },
      ],
    },
    faq: {
      eyebrow: "常见问题",
      title: "常见问题",
      lead: "定位、边界、数据去向。",
      items: [
        {
          q: "和 Claude Code、Codex 这类编码助手是什么关系？",
          a: "不在一层，而且能一起用。它们是绑定各自厂商模型的编码会话，OpenCorvus 是底下那层 harness：模型无关、多 Agent 协调、自托管。桌面端还能认出本机装好的 Claude Code、Codex、Gemini Code、Copilot、GLM Code，在当前项目目录直接打开。",
        },
        {
          q: "我已经在用其中一个，还有必要吗？",
          a: "看你缺哪一块。只是想要更好的单次编码对话，不必换。需要跨任务协调、锁版本的专家团、统一的权限与证据、重启后接着跑——那是这里在做的事。",
        },
        {
          q: "代码会离开我的机器吗？",
          a: "运行时在你自己的机器或服务器上，MIT 开源，源码全都能审。模型请求只发给你自己配的 provider；用本地模型就完全不出网。",
        },
        {
          q: "支持哪些模型？",
          a: "内置目录解析出 87 个 provider、2,579 个模型，含本地运行时。换模型是改配置，不是改源码。",
        },
        {
          q: "「专家团」到底是什么？",
          a: "一个能打开看的能力包：角色、工作流、Skills、工具、适用说明、版本和 digest 冻在一起。任务创建时锁死一个版本，中途不会被悄悄换掉。",
        },
        {
          q: "这套东西是自己写的吗？",
          a: "后端 harness 和桌面前端都在这个仓库里，底下没有套第三方 Agent 引擎——这样每一层才换得动。它站在很多开源项目的肩膀上：Bun、AI SDK、Solid、Tauri。",
        },
        {
          q: "长程到底能长到什么程度？",
          a: "取决于你的运行时在不在线。工作能扛过重启，靠的是租约、事件日志和协调器，不是靠某个进程一直活着。已完成、已失败或已取消的任务，收到你下一条消息就在新的执行轮次里继续，旧历史原样保留。",
        },
        {
          q: "它会背着我改自己吗？",
          a: "不会。修订会被起草、校验成可运行的包并挂起，只有你用自己的消息确认之后才安装；返回的回执就是恢复上一个版本的凭据。",
        },
        {
          q: "无人值守能跑多久？",
          a: "只在你的运行时在线时。它不是托管服务，也不承诺无限自治——结果取决于选的模型、能访问的来源和拿到的证据。",
        },
      ],
    },
    join: {
      eyebrow: "参与",
      title: "参与共建",
      lead: "提 issue、写一支专家团，或者直接改代码。",
      ctas: [
        { label: "去 GitHub", href: GITHUB, variant: "primary" },
        { label: "参与讨论", href: DISCUSSIONS, variant: "secondary" },
        { label: "写专家团", href: "/plugins/", variant: "secondary" },
      ],
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
      titleLines: ["Work that finishes,", "and gets better."],
      description:
        "Long-horizon work carried by combined expert squads, evidenced at every handoff, and revised from your feedback.",
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
    demo: {
      eyebrow: "Recorded run",
      title: "One full run",
      lead: "NVDA's last year of daily candles in; chart, technical read and Word report out.",
      label: "Screen recording of an OpenCorvus desktop run",
      caption: "One real run on desktop v0.0.47beta · 1 min 44 s · no audio track",
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
        summary: "Unfold the complete execution map",
        openSummary: "Collapse the execution map",
        hint: "Turn six high-level deliveries into five workstreams, eighteen squad-owned stages, and visible milestones.",
        eyebrow: "Workload ×3",
        title: "This is the complete Mission OpenCorvus has to coordinate",
        lead: "It starts with model and data evidence, crosses CUDA training, a live product, and research publication, then converges on independent reproduction and GitHub release.",
        stagesUnit: "squad-owned stages",
      },
      moreLabel: "Other combinations",
      cta: "How composition works",
    },
    evolve: {
      eyebrow: "Evolution",
      title: "Squads that revise",
      lead: "Two paths, both ending at a confirmation you have to give.",
      paths: [
        {
          id: "feedback",
          title: "From what you said",
          body: "Say what you actually wanted. The host copies the exact revision, applies the edit, validates the package, and stages it.",
        },
        {
          id: "campaign",
          title: "From measurement",
          body: "Evolution Lab freezes the target revision, cases, scorers, budget and mutation surface, then runs the arms and reviews the result.",
        },
      ],
      boundary: "Nothing installs without your confirmation, and every change can be restored.",
      cta: "How evolution works",
    },
    why: {
      eyebrow: "Why",
      title: "Open, yours, controlled, legible",
      lead: "Four things decide whether a tool lasts.",
      pillars: [
        {
          id: "open",
          title: "Open source",
          body: "MIT licensed, every line published. Self-host it, audit it, fork it.",
          evidenceLabel: "Licence",
          evidenceValue: "MIT",
        },
        {
          id: "custom",
          title: "Customizable",
          body: "Swap models, narrow tools, tune permissions, install squads — no forking.",
          evidenceLabel: "Installable squads",
          evidenceValue: squadTotal,
        },
        {
          id: "control",
          title: "In your control",
          body: "Runs on your machine. Tools are scoped per project; irreversible steps ask first.",
          evidenceLabel: "Runs on",
          evidenceValue: "Your machine",
        },
        {
          id: "transparent",
          title: "Fully legible",
          body: "Every tool call, argument and result stays in the transcript, readable line by line.",
          evidenceLabel: "Run record",
          evidenceValue: "Complete",
        },
      ],
      compare: {
        title: "Compared with the nearest two",
        lead: "The closest products in positioning, side by side.",
        columns: [
          { label: "WorkBuddy", href: "https://www.workbuddy.ai/" },
          { label: "DeepSeek Harness", href: "https://www.deepseek.com/harness/" },
          { label: "OpenCorvus", self: true },
        ],
        rows: [
          { axis: "Licence", cells: ["Commercial, token packages", "MIT", "MIT"] },
          { axis: "Runs", cells: ["Cloud service", "Locally", "Your machine or your server"] },
          {
            axis: "Starting point",
            cells: [
              "One sentence to a finished output",
              "Plugin kernel, compose it yourself",
              "A whole harness working, then replace any layer",
            ],
          },
          {
            axis: "Capability unit",
            cells: ["Experts and Expert Groups", "Plugins", `Versioned squads with a digest (${squadTotal})`],
          },
          { axis: "Getting in", cells: ["Desktop client", "One npx line to a web UI", "Installer or source build"] },
        ],
        fairness:
          "DeepSeek Harness is MIT licensed too, and records a run just as completely; its plugin kernel goes further than ours. The choice is whether you want to assemble a harness or start from one.",
        note: "Compared against both products' published documentation",
      },
    },
    squads: {
      eyebrow: "Expert Squads",
      title: `${squadTotal} installable squads`,
      lead: "Each one declares its scope, its roles, and its workflows.",
      cta: `Browse all ${squadTotal}`,
      agentLabel: "role",
      agentsLabel: "roles",
      workflowLabel: "workflow",
      workflowsLabel: "workflows",
    },
    start: {
      eyebrow: "Start",
      title: "Get started",
      lead: "Start from the CLI, or install the desktop build.",
      cliTitle: "Build from source",
      cliBody: "With Bun installed, clone the repository, build, and self-check.",
      cliCommand: "git clone https://github.com/yangheng95/opencorvus.git",
      desktopTitle: "Already installed?",
      desktopBody: "Start the server inside your repository; the workbench opens locally.",
      desktopCta: "Read the quickstart",
      serveCommand: 'bun "$OPENCORVUS_SOURCE" serve',
      copy: "Copy",
      copied: "Copied",
      trustTitle: "Three boundaries",
      trust: [
        { title: "Signature checked", body: "Packages verify signature and SHA-256 before they land." },
        { title: "Permission bounded", body: "Tools are granted per project; irreversible actions confirm." },
        { title: "Evidence kept", body: "Every tool call and result stays in the conversation record." },
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      lead: "Where this sits, what it does not do, and where your code goes.",
      items: [
        {
          q: "How does this relate to Claude Code or Codex?",
          a: "Different layer, and they work together. Those are coding sessions bound to one vendor's models; OpenCorvus is the harness — model-agnostic, multi-agent, self-hosted. The desktop app can even discover Claude Code, Codex, Gemini Code, Copilot, and GLM Code already installed on your machine and open one in the current project directory.",
        },
        {
          q: "I already use one of those. Do I need this?",
          a: "Depends what is missing. If you want a better single coding conversation, stay where you are. If you want coordination across many owned tasks, version-pinned expert squads, one permission and evidence trail, and work that survives a restart — that is what this does.",
        },
        {
          q: "Does my code leave my machine?",
          a: "The runtime runs on your machine or your own server, MIT licensed, every line auditable. Model requests go only to the provider you configure; pick a local runtime and nothing leaves the network at all.",
        },
        {
          q: "Which models are supported?",
          a: "One bundled catalog resolves 87 providers and 2,579 models, local runtimes included. Switching is configuration, not a fork.",
        },
        {
          q: "What exactly is an Expert Squad?",
          a: "An inspectable capability package: roles, workflow, Skills, tools, selection guidance, version, and digest frozen together. A Task pins one exact revision and cannot silently switch it mid-life.",
        },
        {
          q: "Is it built on another agent?",
          a: "The harness and the desktop app are both written in this repository, with no third-party agent engine underneath — that is what makes every layer replaceable. It stands on plenty of open source: Bun, the AI SDK, Solid, Tauri.",
        },
        {
          q: "How long is long-horizon, really?",
          a: "As long as your runtime stays online. Work survives a restart because leases, an event log, and a reconciler own it, not because a process stayed alive. A completed, failed, or cancelled Task reopens on your next message, at a fresh execution occurrence, with the old history intact.",
        },
        {
          q: "Does it change itself behind my back?",
          a: "No. A revision is drafted, validated as a runnable package, and staged. It installs only after you confirm it in your own message, and the receipt you get back is how you restore the previous revision.",
        },
        {
          q: "How long can it run unattended?",
          a: "Only while your runtime is online. This is not a hosted service and it does not promise unbounded autonomy — output depends on the model, the reachable sources, and the available evidence.",
        },
      ],
    },
    join: {
      eyebrow: "Contribute",
      title: "Contribute",
      lead: "File an issue, publish a squad, or send a patch.",
      ctas: [
        { label: "Go to GitHub", href: GITHUB, variant: "primary" },
        { label: "Join discussions", href: DISCUSSIONS, variant: "secondary" },
        { label: "Build a squad", href: "/plugins/", variant: "secondary" },
      ],
    },
  },
}
