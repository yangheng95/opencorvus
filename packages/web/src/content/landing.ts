export type LandingLocale = "root" | "zh-cn"

export const landingProductName = "OpenCorvus"

export const landingContent = {
  root: {
    language: { label: "简体中文", href: "/zh-cn/" },
    hero: {
      eyebrow: "Open Agent Harness",
      title: "Bring one outcome. Leave with a review-ready result.",
      description:
        "OpenCorvus gives an agent a real workspace, assembles the specialist team the work needs, and keeps decisions, tool results, files, and review evidence attached to the mission.",
      primary: "Explore Expert Squads",
      secondary: "Read the quickstart",
      videoLabel: "OpenCorvus desktop mission walkthrough",
      videoCaption: "One mission, one visible workspace, one evidence trail.",
    },
    proof: [
      ["Real work", "Agents operate on repositories, files, terminals, and connected tools."],
      ["Right-sized team", "Use one agent for a direct task or an Expert Squad for work that needs specialist review."],
      ["Reviewable delivery", "The result stays connected to the decisions and evidence that produced it."],
    ],
    modes: {
      eyebrow: "Choose the depth of work",
      title: "Start with the outcome, then choose the lightest mode that can finish it.",
      description:
        "Chat, Work, and Mission are not three products. They are three levels of coordination inside the same workspace.",
      items: [
        {
          index: "01",
          name: "Chat",
          use: "Clarify, inspect, and decide",
          description: "Use a conversation when you need an answer, a diagnosis, or a small decision before any larger execution begins.",
          output: "A clear answer or next action",
        },
        {
          index: "02",
          name: "Work",
          use: "Execute one bounded task",
          description: "Give one agent a concrete change, investigation, or artifact and keep its tools and evidence visible in the same thread.",
          output: "A finished task with evidence",
        },
        {
          index: "03",
          name: "Mission",
          use: "Coordinate a multi-step outcome",
          description: "Use a mission when planning, implementation, validation, and independent review need different roles and a shared goal.",
          output: "A coordinated, review-ready delivery",
        },
      ],
    },
    squads: {
      eyebrow: "Expert Squads",
      title: "Choose a team by the work it is designed to finish.",
      description:
        "Each Expert Squad is an inspectable package: its roles, workflow, skills, tools, selection guidance, version, and digest travel together.",
      capabilities: [
        ["Selection guidance", "Know when the team fits—and when it does not—before starting."],
        ["Named responsibilities", "Every specialist has a visible role instead of an anonymous pool of agents."],
        ["Evidence contract", "The workflow defines what must be inspected, produced, and reviewed."],
      ],
      catalogAlt: "OpenCorvus Expert Squad catalog",
      installedAlt: "Installed Expert Squad details in OpenCorvus",
      action: "Browse featured Expert Squads",
      buildAction: "Build an Expert Squad",
    },
    continuity: {
      eyebrow: "One runtime, several surfaces",
      title: "Keep the mission continuous when the surface changes.",
      description:
        "The desktop client is the visible control surface. Headless and connected-channel runtimes let the same mission continue without inventing a second source of truth.",
      facts: [
        ["Desktop", "Inspect the workspace, decisions, tools, and evidence directly."],
        ["Headless", "Run repository or scheduled work while retaining the same mission identity."],
        ["Connected channels", "Reach the mission from another surface without splitting its history."],
      ],
      imageAlt: "OpenCorvus mission continuing across desktop and headless runtime surfaces",
    },
    start: {
      eyebrow: "Start with a path you can verify",
      title: "Explore the team first. Install OpenCorvus when you are ready to run it.",
      description:
        "The public catalog explains what each Expert Squad contains. The quickstart covers the client and local workflow. Source and release artifacts remain available for inspection.",
      quickstart: "Open the quickstart",
      source: "Inspect the source",
      releases: "View releases",
      installer: "Download for",
      installerNote: "Native installer discovered from this release build.",
    },
  },
  "zh-cn": {
    language: { label: "English", href: "/" },
    hero: {
      eyebrow: "开放式 Agent Harness",
      title: "带来一个目标，带走一份可审查的交付。",
      description:
        "OpenCorvus 为 Agent 提供真实工作区，按任务需要组建专家团队，并让决策、工具结果、文件与审查证据始终归属于同一个任务。",
      primary: "浏览专家团",
      secondary: "阅读快速开始",
      videoLabel: "OpenCorvus 桌面任务演示",
      videoCaption: "一个任务、一个可见工作区、一条完整证据链。",
    },
    proof: [
      ["真实工作", "Agent 直接操作代码仓库、文件、终端和已连接工具。"],
      ["合适的团队", "直接任务使用单个 Agent；需要专业分工与复核时使用专家团。"],
      ["可审查交付", "结果始终关联产生它的决策过程和证据。"],
    ],
    modes: {
      eyebrow: "选择工作深度",
      title: "先明确结果，再选择足以完成它的最轻工作方式。",
      description: "对话、工作和任务不是三个产品，而是同一个工作区里的三种协作深度。",
      items: [
        {
          index: "01",
          name: "对话",
          use: "澄清、检查与决策",
          description: "当你需要答案、诊断或在执行前做一个小决策时，从对话开始。",
          output: "清晰的答案或下一步",
        },
        {
          index: "02",
          name: "工作",
          use: "完成一个边界明确的任务",
          description: "让一个 Agent 执行具体改动、调查或产物制作，并在同一任务中保留工具与证据。",
          output: "带证据的已完成任务",
        },
        {
          index: "03",
          name: "任务",
          use: "协调多步骤结果",
          description: "当规划、实现、验收和独立审查需要不同角色共同完成时，使用任务模式。",
          output: "经过协同和复核的交付",
        },
      ],
    },
    squads: {
      eyebrow: "专家团",
      title: "按团队能够完成的工作来选择，而不是按头像和口号。",
      description: "每个专家团都是可检查的能力包：角色、工作流、Skills、工具、选择说明、版本和摘要一起交付。",
      capabilities: [
        ["选择说明", "开始前就知道团队适合什么，也知道它不适合什么。"],
        ["明确职责", "每位专家都有可见责任，而不是匿名 Agent 池。"],
        ["证据契约", "工作流明确必须检查、产出和独立复核的内容。"],
      ],
      catalogAlt: "OpenCorvus 专家团目录",
      installedAlt: "OpenCorvus 中已安装专家团的详情",
      action: "浏览精选专家团",
      buildAction: "构建专家团",
    },
    continuity: {
      eyebrow: "一个运行时，多种工作界面",
      title: "工作界面变化时，任务仍然连续。",
      description: "桌面客户端是可见控制面；无头运行和外部频道让同一个任务继续执行，而不会产生第二份事实来源。",
      facts: [
        ["桌面端", "直接检查工作区、决策、工具和证据。"],
        ["无头运行", "执行仓库或计划任务，同时保留同一个任务身份。"],
        ["外部频道", "从其他界面触达任务，但不拆分它的历史。"],
      ],
      imageAlt: "OpenCorvus 任务在桌面和无头运行界面之间保持连续",
    },
    start: {
      eyebrow: "从可验证的路径开始",
      title: "先了解团队；准备实际运行时，再安装 OpenCorvus。",
      description: "公开目录解释每个专家团包含什么；快速开始说明客户端与本地工作流；源码和发行产物始终可供检查。",
      quickstart: "打开快速开始",
      source: "检查源代码",
      releases: "查看发行版本",
      installer: "下载",
      installerNote: "从当前发行构建中发现的原生安装包。",
    },
  },
} as const
