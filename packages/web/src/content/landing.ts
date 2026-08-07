export type LandingLocale = "root" | "zh-cn"

export const landingProductName = "OpenCorvus"
const publicBase = import.meta.env.BASE_URL.replace(/\/$/, "")

type LandingLink = {
  label: string
  href: string
}

type LandingSurface = {
  title: string
  description: string
}

type LandingStory = {
  label: string
  title: string
  description: string
  bullets: string[]
}

type LandingContent = {
  language: LandingLink
  imageViewer: {
    open: string
    close: string
    dialog: string
  }
  nav: {
    download: string
    features: string
    expertSquads: string
  }
  hero: {
    title: string
    description: string
    videoLabel: string
    videoCaption: string
  }
  download: {
    eyebrow: string
    title: string
    description: string
    systemLabel: string
    architectureLabel: string
    packageLabel: string
    actions: {
      "windows-x64": string
      "darwin-arm64": string
      "linux-x64": string
    }
    web: {
      platformName: string
      action: string
      system: string
      architecture: string
      packageType: string
    }
  }
  features: {
    eyebrow: string
    title: string
    description: string
    items: LandingStory[]
  }
  expertSquads: {
    title: string
    description: string
    capabilities: Array<{ label: string; description: string }>
    flowLabel: string
    flowAlt: string
    media: Array<{ alt: string }>
  }
  surfaces: {
    eyebrow: string
    title: string
    description: string
    items: LandingSurface[]
  }
  cta: {
    title: string
    description: string
  }
}

export const landingContent = {
  root: {
    language: { label: "简体中文", href: `${publicBase}/zh-cn/` },
    imageViewer: {
      open: "View full-size image",
      close: "Close image preview",
      dialog: "Product screenshot preview",
    },
    nav: {
      download: "Download",
      features: "Use cases",
      expertSquads: "Expert Squads",
    },
    hero: {
      title: "From an idea to a review-ready delivery.",
      description:
        `${landingProductName} keeps investigation, implementation, evidence, and long-running work in one project context—so you can stay in flow without becoming your own full engineering department.`,
      videoLabel: "Play the 01:36 local client walkthrough",
      videoCaption: "Real OpenCorvus client · durable Mission execution with visible evidence · 01:36",
    },
    download: {
      eyebrow: `${landingProductName} access`,
      title: `Run ${landingProductName} where you work.`,
      description:
        "Choose a native package for your system or enter the Web application directly. Every path keeps your work attached to one durable project context.",
      systemLabel: "System",
      architectureLabel: "Architecture",
      packageLabel: "Installer",
      actions: {
        "windows-x64": "Download Windows x64",
        "darwin-arm64": "Download for Apple Silicon",
        "linux-x64": "Download Linux x64",
      },
      web: {
        platformName: "Web",
        action: "Open Web application",
        system: "Modern browser",
        architecture: "Cloud",
        packageType: "Web application",
      },
    },
    features: {
      eyebrow: "Built for the way solo developers actually work",
      title: "One project context. Three practical use cases.",
      description:
        "Move from a quick investigation to a complete change or durable delegation without reconstructing the work at every step.",
      items: [
        {
          label: "Investigate & unblock",
          title: "Find the cause while the code is still in your head.",
          description:
            "Use Chat for fast repository exploration, questions, and iterative debugging in a streaming conversation attached to the current project.",
          bullets: [
            "Repository context, attachments, Skills, and tools stay together",
            "Tool activity and reasoning progress remain visible",
            "Follow-up questions continue from the same evidence",
          ],
        },
        {
          label: "Build a complete change",
          title: "Turn a request into something you can actually review.",
          description:
            "Use Work for the deeper production pass: research, implementation, and finished artifacts that stay inspectable beside their source conversation.",
          bullets: [
            "Longer research and implementation passes",
            "Interactive documents, tables, presentations, and sites",
            "Reviewable output stays connected to its evidence",
          ],
        },
        {
          label: "Delegate durable work",
          title: "Keep complex work moving after you step away.",
          description:
            "Use Mission when an outcome needs decomposition, specialized Agents, Goals, evidence, and resumable progress over a longer execution horizon.",
          bullets: [
            "Mission-owned Tasks and Goal-level progress",
            "Specialists coordinate through visible contracts",
            "Durable local evidence supports inspection and continuation",
          ],
        },
      ],
    },
    expertSquads: {
      title: "Choose a complete expert team—not a pile of disconnected Agents.",
      description:
        "An Expert Squad is a self-contained capability package. Selecting one projects the right Agent roster, Skills, tools, Model Context Protocol (MCP) access, and binding workflow into the task as one coherent operating contract.",
      capabilities: [
        { label: "Agents", description: "A task-specific roster with explicit responsibilities." },
        { label: "Skills", description: "Domain instructions travel with the selected team." },
        { label: "Tools + MCP", description: "Only the required tool and Model Context Protocol access is projected." },
        { label: "Binding workflows", description: "Evidence dependencies stay visible and reviewable." },
      ],
      flowLabel: "OpenCorvus / complete Mission workflow",
      flowAlt:
        "A complete Mission workflow branching through two schedulers, investigators, planners, developers, reviewers, and handoffs.",
      media: [
        { alt: "Expert Squad catalog and installation options" },
        { alt: "Installed Expert Squads overview and selected package details" },
      ],
    },
    surfaces: {
      eyebrow: "The runtime behind 24/7 operation",
      title: "Your work does not depend on one open window.",
      description:
        "Desktop, headless runtime, messaging channels, and repository automation keep the same project work reachable and resumable.",
      items: [
        {
          title: "Desktop continuity",
          description: "Chat, Work, Mission, and Scheduled share one project ledger with visible state and evidence.",
        },
        {
          title: "Headless runtime",
          description:
            "Keep task APIs, durable state, and event streams available without depending on the desktop interface.",
        },
        {
          title: "Channel reach",
          description:
            `Start and follow ${landingProductName} work through supported messaging channels and their permission flow.`,
        },
        {
          title: "Scheduled repository automation",
          description: "Wake work from recurring schedules, issue or pull-request events, and manual workflows.",
        },
      ],
    },
    cta: {
      title: "Keep your context. Bring in the right team. Ship the result.",
      description:
        `Start with one repository and one request. ${landingProductName} helps you investigate, produce a complete deliverable, and keep complex work moving with visible evidence.`,
    },
  },
  "zh-cn": {
    language: { label: "English", href: `${publicBase}/` },
    imageViewer: {
      open: "查看大图",
      close: "关闭图片预览",
      dialog: "产品截图预览",
    },
    nav: {
      download: "下载",
      features: "使用场景",
      expertSquads: "专家团",
    },
    hero: {
      title: "从一个想法，到可审查的完整交付。",
      description:
        `${landingProductName} 把调查、实现、证据与长程工作留在同一个项目上下文中，让独立开发者保持专注，也拥有一支完整工程团队的交付能力。`,
      videoLabel: "播放 01:36 本地客户端实录",
      videoCaption: "OpenCorvus 真实客户端 · 带可见证据的长程 Mission 执行 · 01:36",
    },
    download: {
      eyebrow: `${landingProductName} 使用入口`,
      title: `选择适合你的 ${landingProductName} 运行方式。`,
      description: "下载适合当前系统的原生安装包，或直接进入网页版。每一种入口都让工作持续留在同一个可回看的项目上下文中。",
      systemLabel: "系统",
      architectureLabel: "架构",
      packageLabel: "安装包",
      actions: {
        "windows-x64": "下载 Windows x64 版",
        "darwin-arm64": "下载 Apple Silicon 版",
        "linux-x64": "下载 Linux x64 版",
      },
      web: {
        platformName: "网页版",
        action: "进入网页版",
        system: "现代浏览器",
        architecture: "云端",
        packageType: "Web 应用",
      },
    },
    features: {
      eyebrow: "为独立开发者的真实工作方式而生",
      title: "一个项目上下文，覆盖三种高频场景。",
      description: "从快速调查到完整改动，再到长程委托，无需在每一步重新拼装上下文。",
      items: [
        {
          label: "快速排障",
          title: "沿着当前上下文，把问题一次查清。",
          description: "在与当前项目绑定的流式 Chat 中探索仓库、连续追问并迭代排障。",
          bullets: [
            "项目上下文、附件、Skill 与工具保持在同一对话",
            "工具活动与推进过程持续可见",
            "后续追问沿用同一份证据",
          ],
        },
        {
          label: "完整交付",
          title: "把一个需求变成真正可以审查的成果。",
          description: "用 Work 完成更深入的研究、实现和成品输出，交付物始终与来源对话和证据保持连接。",
          bullets: ["更长的研究与实现过程", "交互式文档、表格、演示文稿与网站", "可审查产物与证据保持连接"],
        },
        {
          label: "长程推进",
          title: "离开电脑后，复杂工作仍然可以继续。",
          description: "当目标需要拆解、专业 Agent、Goal、证据与更长执行周期时，把它交给 Mission 持续推进。",
          bullets: ["Mission 持有 Task 与 Goal 级进度", "专业 Agent 按可见契约协作", "本地持久证据支持检查与续跑"],
        },
      ],
    },
    expertSquads: {
      title: "选择一支完整专家团队，而不是堆叠更多 Agent。",
      description:
        "Expert Squad（专家团）是自包含的能力包。选择专家团后，Agent 阵容、Skill、工具、MCP（Model Context Protocol，模型上下文协议）访问与绑定工作流会作为一份一致的执行契约投影到任务中。",
      capabilities: [
        { label: "Agent 阵容", description: "针对任务配置职责清晰的专业角色。" },
        { label: "Skill", description: "领域方法与约束随专家团一起生效。" },
        { label: "工具与 MCP", description: "只投影当前团队需要的工具和协议访问。" },
        { label: "绑定工作流", description: "证据依赖与协作顺序持续可见、可审查。" },
      ],
      flowLabel: "OpenCorvus / 完整 Mission 工作流",
      flowAlt: "一条完整 Mission 工作流，分为两条调度链，依次经过调查、规划、开发、审查与交接。",
      media: [
        { alt: "专家团目录与安装选项" },
        { alt: "已安装专家团总览与所选能力包详情" },
      ],
    },
    surfaces: {
      eyebrow: "支撑 7×24 小时运行的基础能力",
      title: "你的工作不依赖一个始终打开的窗口。",
      description: "桌面端、无界面运行时、消息通道与仓库自动化让同一个项目持续可达、随时可续跑。",
      items: [
        {
          title: "桌面连续性",
          description: "Chat、Work、Mission 与定时任务共用一个项目账本，状态和证据始终可见。",
        },
        {
          title: "无界面运行时",
          description: "无需依赖桌面界面，也能持续提供任务 API、持久状态与事件流。",
        },
        {
          title: "消息通道触达",
          description: `通过受支持的消息通道发起并跟进 ${landingProductName} 工作，同时保留权限流程。`,
        },
        {
          title: "定时与仓库自动化",
          description: "通过周期计划、Issue 或合并请求事件以及手动工作流唤醒工作。",
        },
      ],
    },
    cta: {
      title: "保留上下文，带上合适的团队，交付最终结果。",
      description: `从一个仓库和一个需求开始。${landingProductName} 帮你调查问题、完成可审查交付，并用可见证据持续推进复杂工作。`,
    },
  },
} satisfies Record<LandingLocale, LandingContent>
