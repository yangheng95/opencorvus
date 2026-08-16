import { generatedExpertSquadDistribution } from "./expert-squad-distribution.generated"

export type LandingLocale = "root" | "zh-cn"

export const landingProductName = "OpenCorvus"

/** Public catalog facts. Squad counts come from the generated distribution so copy cannot drift. */
const squadTotal = generatedExpertSquadDistribution.total
const squadEmbedded = generatedExpertSquadDistribution.embeddedAlreadyAvailable
const squadImportable = generatedExpertSquadDistribution.bundledMarketImportable

export const landingContent = {
  root: {
    language: { label: "简体中文", href: "/zh-cn/" },
    hero: {
      eyebrow: "Open-source multi-agent harness platform",
      titleLines: ["Works out of the box.", "Yours to rebuild."],
      description: `OpenCorvus ships a complete multi-agent harness — the agent loop, 42 tools, permission authority, memory, context compaction, durable orchestration, and a catalog of ${squadTotal} expert squads — working from the first launch. Every layer underneath is configuration you can replace.`,
      primary: "Quickstart",
      secondary: "View on GitHub",
      boundary:
        "You choose the models, tools, permission rules, and squads. OpenCorvus keeps the loop, the evidence, and the authority visible.",
      harness: {
        label: "One harness, every surface",
        description:
          "The same loop, permission authority, and evidence trail bind desktop conversations, project work, missions, and squads.",
      },
      gallery: {
        label: "Inside the Harness",
        ariaLabel: "OpenCorvus product surfaces",
        items: [
          {
            id: "work",
            kind: "image",
            label: "Work",
            title: "Shape a review-ready deliverable",
            description:
              "Set the outcome, select the Work Harness, and keep production and review in one conversation.",
            alt: "The OpenCorvus Work Harness with the composer, product mode, tools, and suggested long-form tasks visible.",
          },
          {
            id: "code",
            kind: "image",
            label: "Code",
            title: "Stay grounded in the project",
            description:
              "Switch the same operating surface to Code for repository work, terminals, files, and engineering evidence.",
            alt: "The OpenCorvus Code Harness selected in the project-bound composer.",
          },
          {
            id: "mission",
            kind: "image",
            label: "Mission",
            title: "Hand an outcome to a Mission",
            description:
              "Move from one conversation to Mission-scale coordination without losing the selected context and controls.",
            alt: "The OpenCorvus composer switched to Mission with the Expert Squad context boundary visible.",
          },
          {
            id: "squads",
            kind: "image",
            label: "Squads",
            title: "Inspect the capability package",
            description:
              "Compare and install Expert Squads explicitly; installation never activates a team on its own.",
            alt: "The OpenCorvus Expert Squad Market and its explicit local installation controls.",
          },
        ],
      },
    },
    runtime: {
      eyebrow: "Running on first launch",
      label: "What ships with the harness",
      items: [
        ["87", "Model providers", "2,579 models resolved from one bundled catalog."],
        [
          String(squadTotal),
          "Expert squads",
          `${squadEmbedded} ready immediately, ${squadImportable} importable from the public catalog.`,
        ],
        ["13", "Chat channels", "Slack, Discord, Telegram, Feishu, Teams, and more."],
      ],
    },
    layers: {
      eyebrow: "01 · What the harness already does",
      title: "A complete harness, layer by layer.",
      description:
        "Every layer below runs the moment you install. Every layer below is also a configuration surface — swap the model, narrow the tools, tighten the permissions, or replace an entire squad.",
      layerLabel: "Layer",
      shipsLabel: "Ships working",
      swapLabel: "Replace via",
      footer:
        "Configuration lives in one project file. Beyond it, the JavaScript SDK, plugin API, Model Context Protocol servers, and Agent Client Protocol let you extend or embed the harness itself.",
      items: [
        {
          index: "01",
          name: "Agent loop",
          ships: "Five primary roles — coding, chat, work, control, and mission — on a streaming loop with typed tool results.",
          swap: "agent · prompt overrides",
        },
        {
          index: "02",
          name: "Tools",
          ships: "42 built-in tools, with Browser and Computer control available as default capability blocks.",
          swap: "tools · mcp · lsp · plugin",
        },
        {
          index: "03",
          name: "Models",
          ships: "87 providers and 2,579 models resolved from one bundled catalog, including local runtimes.",
          swap: "model · small_model · provider",
        },
        {
          index: "04",
          name: "Context",
          ships: "Automatic compaction and per-turn context budgeting keep long runs inside the window.",
          swap: "model and budget configuration",
        },
        {
          index: "05",
          name: "Memory",
          ships: "Project and session memory with search, organization, and explicit injection.",
          swap: "instructions · memory configuration",
        },
        {
          index: "06",
          name: "Permission",
          ships: "Every side effect passes one durable allow, ask, or deny authority before it runs.",
          swap: "permission rules · shell scope",
        },
        {
          index: "07",
          name: "Expert squads",
          ships: `${squadTotal} inspectable squads in the public catalog; a Task pins one exact revision and cannot silently switch it.`,
          swap: "expert_squads · author your own",
        },
        {
          index: "08",
          name: "Durable execution",
          ships: "Process leases, an event log, and a reconciler resume owned work after a restart.",
          swap: "Platform guarantee",
        },
        {
          index: "09",
          name: "Verification",
          ships: "Integrity review, fact-checking, and visual QA run as named stages, not as afterthoughts.",
          swap: "acceptance configuration",
        },
        {
          index: "10",
          name: "Evidence",
          ships: "Host observations record file changes and command results apart from any agent summary.",
          swap: "Platform guarantee",
        },
        {
          index: "11",
          name: "Surfaces",
          ships: "Desktop application, HTTP API with server-sent events, 13 chat channels, and scheduled automation.",
          swap: "SDK · plugin API · Agent Client Protocol",
        },
      ],
    },
    squads: {
      eyebrow: "02 · The team layer",
      title: "Choose or build the Expert Squad that fits the work.",
      description: `Each Expert Squad is a configurable, inspectable package: roles, workflow, Skills, tools, selection guidance, version, and digest travel together. ${squadTotal} are published in the catalog; the rest is yours to write.`,
      capabilities: [
        ["Start from task fit", "Choose by the outcome, inputs, and limits the team declares."],
        ["Shape roles and workflow", "Give each specialist visible responsibility and connect their handoffs."],
        ["Freeze an exact revision", "Keep roles, capabilities, workflow, version, and digest bound together."],
      ],
      catalogAlt: "OpenCorvus Expert Squad catalog",
      installedAlt: "Installed Expert Squad details in OpenCorvus",
      action: "Explore Expert Squads",
      buildAction: "Build your Expert Squad",
    },
    mission: {
      eyebrow: "03 · The durable layer",
      title: "Let one Expert Squad carry a Task from first instruction to reviewed delivery.",
      description:
        "A Task keeps one exact Expert Squad and its workflow fixed through the lifecycle. Named roles hand off typed Artifacts and evidence; when an outcome needs several Tasks or Squads, a Mission connects their dependencies without erasing ownership.",
      facts: [
        [
          "One fixed team per Task",
          "A Task resolves one exact Expert Squad revision at creation and cannot silently switch it mid-run.",
        ],
        [
          "Typed handoffs",
          "Named roles pass exact Artifact references and evidence instead of relying on summaries alone.",
        ],
        [
          "Mission-scale coordination",
          "When an outcome needs several Tasks or Squads, Mission records dependencies and preserves each Task's owner.",
        ],
      ],
      imageAlt: "OpenCorvus Task continuing across desktop and headless runtime surfaces",
    },
    community: {
      eyebrow: "04 · Build your own",
      title: "Extend the harness. Expand what everyone can accomplish.",
      description:
        "Package specialist knowledge as an inspectable Expert Squad, validate it with the open SDK, and contribute it through the source repository. Self-service listing is not open yet; community review remains part of publication.",
      cards: [
        {
          label: "Run the harness",
          title: "Install, connect a workspace, and run your first Task in minutes.",
          note: "OpenCorvus quickstart →",
          href: "/start/quickstart/",
          primary: true,
        },
        {
          label: "Contribute an Expert Squad",
          title: "Package, validate, and contribute specialist knowledge through the open source path.",
          note: "Expert Squad author path →",
          href: "/publish/",
          primary: false,
        },
        {
          label: "Join the discussion",
          title: "Share use cases, review proposals, and help shape the community.",
          note: "GitHub Discussions →",
          href: "https://github.com/yangheng95/opencorvus/discussions",
          primary: false,
        },
      ],
    },
  },
  "zh-cn": {
    language: { label: "English", href: "/" },
    hero: {
      eyebrow: "开源多 Agent Harness 平台",
      titleLines: ["开箱即用的完整 Harness，", "每一层都可以重建。"],
      description: `OpenCorvus 内置一套完整的多 Agent Harness：Agent 循环、42 个工具、权限授权、记忆、上下文压缩、持久化编排，以及 ${squadTotal} 个专家团的目录，首次启动即可运行。而下面的每一层，都是你可以替换的配置。`,
      primary: "快速开始",
      secondary: "在 GitHub 上查看",
      boundary: "由你决定模型、工具、权限规则与专家团；OpenCorvus 让循环、证据与授权始终可见。",
      harness: {
        label: "同一套 Harness，覆盖每个界面",
        description: "同一个循环、权限授权与证据链，贯穿桌面对话、项目工作、Mission 与专家团。",
      },
      gallery: {
        label: "Harness 内部",
        ariaLabel: "OpenCorvus 产品界面",
        items: [
          {
            id: "work",
            kind: "image",
            label: "Work",
            title: "把成果推进到可审查状态",
            description: "明确目标，选择 Work Harness，让生产与复核留在同一段对话里。",
            alt: "OpenCorvus Work Harness，显示了输入区、产品模式、工具和长程任务建议。",
          },
          {
            id: "code",
            kind: "image",
            label: "Code",
            title: "始终扎根真实项目",
            description: "在同一运行界面切换到 Code，把代码仓库、终端、文件和工程证据连在一起。",
            alt: "在项目输入区中选中的 OpenCorvus Code Harness。",
          },
          {
            id: "mission",
            kind: "image",
            label: "Mission",
            title: "把结果交给 Mission 推进",
            description: "从单段对话进入 Mission 级协同，同时保留已选上下文与控制。",
            alt: "OpenCorvus 输入区切换至 Mission，并显示专家团上下文边界。",
          },
          {
            id: "squads",
            kind: "image",
            label: "专家团",
            title: "检查完整能力包",
            description: "显式比较和安装专家团；安装本身绝不会自动激活一支团队。",
            alt: "OpenCorvus 专家团市场及其显式本地安装控制。",
          },
        ],
      },
    },
    runtime: {
      eyebrow: "首次启动即可运行",
      label: "Harness 内置了什么",
      items: [
        ["87", "模型供应商", "从内置目录解析 2,579 个模型。"],
        [String(squadTotal), "专家团", `${squadEmbedded} 个已内置可用，${squadImportable} 个可从公开目录导入。`],
        ["13", "聊天渠道", "Slack、Discord、Telegram、飞书、Teams 等。"],
      ],
    },
    layers: {
      eyebrow: "01 · Harness 已经做到的",
      title: "一套完整 Harness，逐层可见。",
      description:
        "下面每一层在安装后立即运行；同时每一层也都是配置面——换模型、收窄工具、收紧权限，或者整支专家团都可以替换。",
      layerLabel: "层",
      shipsLabel: "开箱运行",
      swapLabel: "可替换为",
      footer:
        "配置集中在一个项目文件中。除此之外，JavaScript SDK、插件 API、Model Context Protocol 服务与 Agent Client Protocol 让你扩展甚至嵌入 Harness 本身。",
      items: [
        {
          index: "01",
          name: "Agent 循环",
          ships: "coding、chat、work、control、mission 五个主要角色，运行在带类型工具结果的流式循环上。",
          swap: "agent · 提示词覆盖",
        },
        {
          index: "02",
          name: "工具",
          ships: "42 个内置工具，浏览器与计算机控制作为默认能力块提供。",
          swap: "tools · mcp · lsp · plugin",
        },
        {
          index: "03",
          name: "模型",
          ships: "从内置目录解析 87 个供应商、2,579 个模型，并支持本地运行时。",
          swap: "model · small_model · provider",
        },
        {
          index: "04",
          name: "上下文",
          ships: "自动压缩与逐轮上下文预算，让长程运行始终留在窗口内。",
          swap: "模型与预算配置",
        },
        {
          index: "05",
          name: "记忆",
          ships: "项目与会话记忆，具备检索、组织与显式注入能力。",
          swap: "instructions · 记忆配置",
        },
        {
          index: "06",
          name: "权限",
          ships: "每一次副作用执行前，都要经过一道持久化的允许／询问／拒绝授权。",
          swap: "permission 规则 · shell 作用域",
        },
        {
          index: "07",
          name: "专家团",
          ships: `公开目录中有 ${squadTotal} 个可检查的专家团；任务锁定一个精确版本，不会静默切换。`,
          swap: "expert_squads · 自行编写",
        },
        {
          index: "08",
          name: "持久化执行",
          ships: "进程租约、事件日志与协调器，在重启后恢复已归属的工作。",
          swap: "平台保证",
        },
        {
          index: "09",
          name: "校验",
          ships: "完整性复核、事实核查与视觉 QA 作为具名阶段运行，而不是事后补救。",
          swap: "验收配置",
        },
        {
          index: "10",
          name: "证据",
          ships: "宿主观测独立记录文件变更与命令结果，不依赖 Agent 的自述总结。",
          swap: "平台保证",
        },
        {
          index: "11",
          name: "接入界面",
          ships: "桌面应用、带 SSE 的 HTTP API、13 个聊天渠道与定时自动化。",
          swap: "SDK · 插件 API · Agent Client Protocol",
        },
      ],
    },
    squads: {
      eyebrow: "02 · 团队层",
      title: "选择或构建真正适合任务的专家团。",
      description: `每个专家团都是可配置、可检查的能力包：角色、工作流、Skills、工具、选择说明、版本与摘要一起交付。目录中已发布 ${squadTotal} 个，其余由你编写。`,
      capabilities: [
        ["从任务适配开始", "根据团队声明的目标、输入与边界来选择。"],
        ["配置角色与工作流", "为每位专家分配可见责任，并明确彼此的交接关系。"],
        ["冻结精确版本", "把角色、能力、工作流、版本与摘要绑定在同一精确版本中。"],
      ],
      catalogAlt: "OpenCorvus 专家团目录",
      installedAlt: "OpenCorvus 中已安装专家团的详情",
      action: "探索专家团",
      buildAction: "构建你的专家团",
    },
    mission: {
      eyebrow: "03 · 持久层",
      title: "让一个专家团把任务从首次指令推进到经过复核的交付。",
      description:
        "一个任务在整个生命周期中固定使用同一精确版本的专家团及其工作流。具名角色通过带类型的产物与证据完成交接；当一个结果需要多个任务或专家团时，Mission 连接它们的依赖，同时保留清晰责任。",
      facts: [
        ["每个任务固定一支团队", "任务创建时解析一个精确版本的专家团，运行中不能静默切换。"],
        ["带类型的交接", "具名角色传递精确的 Artifact 引用与证据，而不是只依赖文字总结。"],
        ["Mission 级协同", "当一个结果需要多个任务或专家团时，Mission 记录依赖并保留每个任务的责任归属。"],
      ],
      imageAlt: "OpenCorvus 任务在桌面和无头运行界面之间保持连续",
    },
    community: {
      eyebrow: "04 · 打造你自己的",
      title: "扩展 Harness，让每个人都能完成更多。",
      description:
        "把专业知识封装成可检查的专家团，用开放 SDK 完成验证，再通过源码仓库贡献。自助上架尚未开放，社区审查仍是发布路径的一部分。",
      cards: [
        {
          label: "运行 Harness",
          title: "安装 OpenCorvus、连接工作区，几分钟内运行第一个任务。",
          note: "OpenCorvus 快速开始 →",
          href: "/start/quickstart/",
          primary: true,
        },
        {
          label: "贡献一个专家团",
          title: "通过开源路径封装、验证并贡献专业能力。",
          note: "专家团作者路径 →",
          href: "/publish/",
          primary: false,
        },
        {
          label: "加入讨论",
          title: "分享使用场景、审查提案，并一起建设社区。",
          note: "GitHub Discussions →",
          href: "https://github.com/yangheng95/opencorvus/discussions",
          primary: false,
        },
      ],
    },
  },
} as const
