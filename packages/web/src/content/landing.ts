export type LandingLocale = "root" | "zh-cn"

export const landingProductName = "OpenCorvus"

export const landingContent = {
  root: {
    language: { label: "简体中文", href: "/zh-cn/" },
    hero: {
      eyebrow: "Open-source Agent Workbench for long-horizon work",
      titleLines: ["Build your Workbench.", "Run Missions."],
      description:
        "Connect a real workspace, choose tools and permission rules, configure an Expert Squad, and keep its collaboration, files, decisions, and evidence connected through one Task.",
      primary: "Set up your Workbench",
      secondary: "Explore Expert Squads",
      boundary:
        "You choose what connects, which Squad runs, and the permission rules. OpenCorvus keeps the Task and its evidence visible.",
      mediaAlt:
        "Animated OpenCorvus concept flow from the open platform through Skills, MCP, tools, one Agent, an Expert Squad, a Mission of fixed-squad Tasks, long-horizon work, and community contributions.",
      mediaCaption:
        "Platform → Skills, MCP, and tools → Agent → Expert Squad → Mission → long-horizon work → open community.",
      playAnimation: "Play concept animation",
      stopAnimation: "Stop animation",
    },
    proof: [
      ["Your Agent Workbench", "Workspace, tools, capabilities, and permission rules shaped around your work."],
      [
        "Configurable experts",
        "Choose or build an inspectable Expert Squad instead of accepting an anonymous Agent pool.",
      ],
      [
        "Long-horizon delivery",
        "Keep the team, handoffs, Artifacts, and evidence connected from instruction to acceptance.",
      ],
    ],
    workbench: {
      eyebrow: "01 · Make it yours",
      title: "Shape an Agent Workbench around the way you work.",
      description:
        "Your Agent Workbench brings the working directory, capabilities, permission rules, and review surface into one visible setup. It describes the surface you configure, not a second runtime object.",
      items: [
        {
          index: "01",
          name: "Connect real work",
          use: "Ground the work",
          description:
            "Bring repositories, files, terminals, and connected systems into the same visible working context.",
          output: "A real working context",
        },
        {
          index: "02",
          name: "Choose capabilities",
          use: "Fit the capability set",
          description: "Select the Skills, tools, models, and connected services the work actually needs.",
          output: "Only the capabilities you chose",
        },
        {
          index: "03",
          name: "Set the rules",
          use: "Keep authority explicit",
          description: "Choose which capabilities are available, then select Full access or Ask me for execution authority.",
          output: "Inspectable capabilities and authority",
        },
      ],
    },
    squads: {
      eyebrow: "02 · Configure your experts",
      title: "Choose or build the Expert Squad that fits the work.",
      description:
        "Each Expert Squad is a configurable, inspectable package: roles, workflow, Skills, tools, selection guidance, version, and digest travel together.",
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
      eyebrow: "03 · Run the long arc",
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
      eyebrow: "04 · Join us",
      title: "Contribute your experts. Expand what everyone can accomplish.",
      description:
        "Package specialist knowledge as an inspectable Expert Squad, validate it with the open SDK, and contribute it through the source repository. Self-service listing is not open yet; community review remains part of publication.",
      cards: [
        {
          label: "Set up your Workbench",
          title: "Install, connect a workspace, and shape your first Agent setup.",
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
      eyebrow: "面向长程任务的开源 Agent 工作台",
      titleLines: ["定制你的工作台，", "运行 Mission。"],
      description: "连接真实工作区，选择工具与权限规则，配置专家团，并让协作、文件、决策与证据贯穿同一个任务。",
      primary: "开始定制工作台",
      secondary: "探索专家团",
      boundary: "由你决定连接什么、启用哪个专家团以及权限规则；OpenCorvus 让任务与证据保持可见。",
      mediaAlt:
        "OpenCorvus 动画概念流程：从开放平台、Skills、MCP 与工具，到 Agent、专家团、由固定专家团任务组成的 Mission、长程任务和社区贡献。",
      mediaCaption: "平台 → Skills、MCP 与工具 → Agent → 专家团 → Mission → 长程任务 → 开放社区。",
      playAnimation: "播放概念动画",
      stopAnimation: "停止动画",
    },
    proof: [
      ["你的 Agent 工作台", "围绕你的工作组织工作区、工具、能力与权限规则。"],
      ["可配置专家团", "选择或构建可检查的专家团，而不是接受匿名 Agent 池。"],
      ["长程交付", "让团队、交接、产物与证据从指令到验收始终关联。"],
    ],
    workbench: {
      eyebrow: "01 · 定制你的工作方式",
      title: "围绕你的工作方式，定制 Agent 工作台。",
      description:
        "Agent 工作台把工作目录、能力、权限规则与审查界面组织在一套可见配置中。它描述的是你定制的工作界面，而不是第二套运行时对象。",
      items: [
        {
          index: "01",
          name: "连接真实工作",
          use: "让工作落地",
          description: "把代码仓库、文件、终端与已连接系统带进同一个可见工作环境。",
          output: "一个真实工作环境",
        },
        {
          index: "02",
          name: "选择能力",
          use: "匹配所需能力",
          description: "选择任务真正需要的 Skills、工具、模型与已连接服务。",
          output: "只使用你选择的能力",
        },
        {
          index: "03",
          name: "设定规则",
          use: "明确保留权限",
          description: "配置允许、询问或拒绝规则，并让审查界面保持可见。",
          output: "可检查的规则与审查",
        },
      ],
    },
    squads: {
      eyebrow: "02 · 配置你的专家团",
      title: "选择或构建真正适合任务的专家团。",
      description: "每个专家团都是可配置、可检查的能力包：角色、工作流、Skills、工具、选择说明、版本与摘要一起交付。",
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
      eyebrow: "03 · 推进长程任务",
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
      eyebrow: "04 · 加入我们",
      title: "贡献你的专家能力，让每个人都能完成更多。",
      description:
        "把专业知识封装成可检查的专家团，用开放 SDK 完成验证，再通过源码仓库贡献。自助上架尚未开放，社区审查仍是发布路径的一部分。",
      cards: [
        {
          label: "开始定制工作台",
          title: "安装 OpenCorvus、连接工作区，并完成第一套 Agent 配置。",
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
