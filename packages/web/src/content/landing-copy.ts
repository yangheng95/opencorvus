import { platformFacts } from "./platform-facts"
import type { PublicLocale } from "./public-market"

/**
 * Copy for the restyled landing page.
 *
 * Budget, enforced by test/landing-copy.test.ts: 1200 characters of body copy per locale, section
 * headings under 12 characters, section leads under 40, card bodies under 60. The budget is the
 * feature — the previous site spread the same message over eight surfaces and nobody read past the
 * first. Anything that does not fit belongs in the docs.
 *
 * Counting rule for the budget: CJK counts characters, Latin counts words. A 40-character Chinese
 * lead and a 40-word English lead are wildly different amounts of reading, so the English limits
 * below are expressed in words.
 */

export type LandingCta = { readonly label: string; readonly href: string; readonly variant: "primary" | "secondary" }

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
   * The artifact carousel under the hero. `slides` is keyed by the capture id in
   * qa/artifact-gallery/cases.mjs, and the strings are labels on a picture rather than prose a
   * reader has to get through — so they sit outside the body budget for the same reason alt text
   * does. The section's own title and lead are inside it.
   */
  readonly showcase: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly carouselLabel: string
    readonly previous: string
    readonly next: string
    readonly slides: Readonly<Record<string, string>>
  }
  readonly why: {
    readonly eyebrow: string
    readonly title: string
    readonly lead: string
    readonly pillars: readonly {
      readonly id: string
      readonly title: string
      readonly body: string
      readonly evidenceLabel: string
      readonly evidenceValue: string
    }[]
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
      title: "OpenCorvus · 自动化地优化你的每日工作流",
      description:
        "开源的 Agent 工作台。把每天重复的流程交给它，模型、工具、权限、专家团都能换。MIT 许可证，可自托管。",
    },
    hero: {
      eyebrow: "开源 · MIT · 可自托管",
      titleLines: ["自动化地优化", "你的每日工作流"],
      description: "把每天重复的那些流程交给 Agent。模型、工具、权限、专家团，都能换。",
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
    showcase: {
      eyebrow: "产出",
      title: "真实的交付物",
      lead: "每一张都来自一次真实运行：真数据进来，文件或视图出去。",
      carouselLabel: "交付物轮播",
      previous: "上一张",
      next: "下一张",
      slides: {
        terminal: "真实命令，真实回显",
        code: "真正跑过的生成脚本",
        "file-preview": "PDF 简报",
        spreadsheet: "XLSX 模型",
        document: "DOCX 分析简报",
        presentation: "PPTX 汇报",
        chart: "人均 GDP，2000–2024",
        table: "各国最新人均 GDP",
        dashboard: "宏观指标看板",
        candlestick: "BTC-USD 日线",
        map: "本周 2.5 级以上地震",
        network: "express 依赖图",
        tree: "世界银行国家层级",
        timeline: "VS Code 发布节奏",
        diagram: "这些文件是怎么生成的",
        diff: "left-pad 1.2.0 → 1.3.0",
        notebook: "增长率推演过程",
        media: "智能体协作流程",
        "model-3d": "glTF 示例模型",
        "mcp-app": "MCP App：实时行情板",
      },
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
          { axis: "能力封装", cells: ["平台内的 Expert Group", "插件生态", `带版本与 digest 的专家团（${squadTotal} 支）`] },
          { axis: "上手", cells: ["桌面客户端", "npx 一行拉起 Web UI", "安装包或源码构建"] },
        ],
        fairness: "DeepSeek Harness 同样是 MIT 开源，也同样把运行过程完整留痕；它的插件内核比我们更彻底。选它还是选这里，取决于你要的是自己拼一套，还是拿到一套再改。",
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
      title: "OpenCorvus · Automate the workflow you repeat every day",
      description:
        "OpenCorvus is an open-source Agent workbench. Hand it the work you repeat, and swap the models, tools, permissions, and expert squads underneath. MIT licensed, self-hosted.",
    },
    hero: {
      eyebrow: "Open source · MIT · Self-hosted",
      titleLines: ["Automate the workflow", "you repeat every day"],
      description: "Hand the repeat work to an Agent. Models, tools, permissions, squads — all replaceable.",
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
    showcase: {
      eyebrow: "What it produces",
      title: "Real deliverables",
      lead: "Every panel is one real run — live data in, a real file or view out.",
      carouselLabel: "Deliverable gallery",
      previous: "Previous",
      next: "Next",
      slides: {
        terminal: "A real command, read back",
        code: "The generator that actually ran",
        "file-preview": "PDF brief",
        spreadsheet: "XLSX model",
        document: "DOCX analyst brief",
        presentation: "PPTX readout",
        chart: "GDP per capita, 2000–2024",
        table: "Latest GDP per capita by country",
        dashboard: "Macro indicators",
        candlestick: "BTC-USD daily candles",
        map: "Earthquakes, magnitude 2.5+ this week",
        network: "express dependency graph",
        tree: "World Bank country hierarchy",
        timeline: "VS Code release cadence",
        diagram: "How those files were built",
        diff: "left-pad 1.2.0 → 1.3.0",
        notebook: "Growth analysis, worked out",
        media: "Agent teams workflow",
        "model-3d": "glTF sample model",
        "mcp-app": "MCP App — live spot rates",
      },
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
          { axis: "Starting point", cells: ["One sentence to a finished output", "Plugin kernel, compose it yourself", "A whole harness working, then replace any layer"] },
          { axis: "Capability unit", cells: ["Experts and Expert Groups", "Plugins", `Versioned squads with a digest (${squadTotal})`] },
          { axis: "Getting in", cells: ["Desktop client", "One npx line to a web UI", "Installer or source build"] },
        ],
        fairness: "DeepSeek Harness is MIT licensed too, and records a run just as completely; its plugin kernel goes further than ours. The choice is whether you want to assemble a harness or start from one.",
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
