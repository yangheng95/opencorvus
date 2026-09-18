import type { PublicLocale } from "./public-market"

/** Homepage copy and the inspectable collaboration map share one bilingual source. */
export const landingCopy = {
  "zh-cn": {
    meta: {
      title: "OpenCorvus — 让复杂任务持续推进",
      description:
        "为长程、复杂、重型任务组织 AI 专家协作。从调研、实现到独立复核与返工，让每一步有衔接，让交付有据可查。开源，可自托管。",
    },
    hero: {
      eyebrow: "长程 · 复杂 · 重型任务调度",
      titleLines: ["任务很复杂。", "别把协调也", "留给自己。"],
      description:
        "你定目标与边界。OpenCorvus 组织 AI 专家分工，把调研、实现、复核和返工接起来，持续推进到可检查的交付。",
      secondary: "看一次真实交付",
      note: "开源 · 可自托管 · 使用你配置的模型",
      download: {
        label: "下载 OpenCorvus",
        verb: "下载",
        menuLabel: "选择系统与安装包",
        allPlatforms: "所有平台",
        releaseNote: "来自当前发布清单",
      },
    },
    map: {
      label: "从目标到交付，谁来接下一步？",
      badge: "协作示意",
      owner: "OpenCorvus 编排器",
      ownerNote: "分派 · 衔接 · 跟进 · 汇总",
      stages: [
        {
          id: "scope",
          title: "澄清与调研",
          roles: ["需求工程", "来源调研"],
          output: "需求与证据",
          detail: "先把目标拆成可检查的要求，查清资料来源与限制。后续工作据此展开。",
        },
        {
          id: "plan",
          title: "方案与分工",
          roles: ["架构设计", "界面设计"],
          output: "方案与契约",
          detail: "明确模块、交付物与依赖关系。能独立推进的工作分开处理，有依赖的工作按产物衔接。",
        },
        {
          id: "build",
          title: "实现与集成",
          roles: ["实现工程师"],
          output: "可运行的产物",
          detail: "让负责实现的专家读取需求和方案，产出代码或文件。把各部分接成真实可用的结果。",
        },
        {
          id: "review",
          title: "独立复核",
          roles: ["测试", "界面复核", "系统审查"],
          output: "证据与发现",
          detail: "由独立角色检查实现、真实页面与交付证据。发现问题后回到实现，再检查修复结果。",
        },
        {
          id: "deliver",
          title: "交付收敛",
          roles: ["编排器汇总"],
          output: "结果与已知限制",
          detail: "汇总交付物、验证证据和未解决项。你可以查看过程，也可以在同一任务里继续提出修改。",
        },
      ],
      loop: "发现问题 → 返回实现 → 再复核",
      hint: "点击阶段，查看它交给下一步什么。",
      disclaimer: "按任务与所选专家团组织；本图不是实时运行界面。",
    },
    pains: {
      eyebrow: "工作一复杂，真正累的是这些",
      title: "少一点盯进度，多一点做决定。",
      cards: [
        {
          tag: "长程",
          title: "跑到一半，还得你催下一步。",
          body: "目标、阶段和产物留在任务里。查看进度、补充要求、继续推进，不必在多个对话之间重新交代。",
          result: "过程可追踪，修改有上下文。",
        },
        {
          tag: "复杂",
          title: "每个专家都做了，结果却接不上。",
          body: "为工作明确负责人和依赖，让下游读取上游产物。跨专业任务可由不同专家团分别负责阶段。",
          result: "分工之后，也有人负责衔接。",
        },
        {
          tag: "重型",
          title: "写了“完成”，你还得从头验一遍。",
          body: "选择含独立复核的专家团，让测试、界面与完整性审查进入交付过程。问题带着证据返回实现。",
          result: "结果、复核和缺口一起交给你。",
        },
      ],
    },
    case: {
      eyebrow: "一项真实任务 · 2026.09.18",
      title: "一句“做个坦克大战”，\n背后发生了什么？",
      request: "帮我创建一个坦克大战的网页游戏，要求还原全部的原版游戏体验。",
      lead: "这次任务由一个交付专家团负责。调研、设计、实现和多方复核在同一任务中衔接，检查发现的问题又进入下一轮修正。",
      stats: [
        { value: "19", label: "项可验收要求" },
        { value: "35", label: "关数据溯源" },
        { value: "2", label: "轮修正回流" },
      ],
      revisions: [
        {
          label: "回流 01",
          title: "计分与结算，需要回到真实游玩。",
          body: "修复跨关累计分与结算呈现，再检查跨关后分数是否保留。",
        },
        {
          label: "回流 02",
          title: "关卡不能只“看起来像”。",
          body: "按操作者裁定替换 35 关地图与敌坦编成，登记公开来源，再交由独立角色核对。",
        },
      ],
      screenshot: "任务留存的双人游戏画面",
      caption: "案例中的交付物；并非 OpenCorvus 操作界面。",
      link: "查看执行记录与证据边界",
      caveat:
        "这是一次有人工裁定的案例，不是成功率或成本基准。原版逐格等价性与部分实拍仍有缺口，留存测试报告与收尾报告也存在差异。",
    },
    uses: {
      eyebrow: "把需要来回协调的工作交进来",
      title: "适合一条提示词装不下的过程。",
      note: "以下是任务示例，不是已完成案例；实际流程由所选专家团与可用工具决定。",
      cards: [
        {
          title: "从需求到可用软件",
          body: "调研规则、设计方案、实现功能、真实页面复核，再修正发现的问题。",
          href: "/market/builtin/advanced/",
          link: "查看软件交付专家团",
        },
        {
          title: "从资料到有依据的报告",
          body: "收集多方来源、核查引用、分析分歧，让结论能追溯到证据。",
          href: "/market/builtin/deep-research/",
          link: "查看深度研究专家团",
        },
        {
          title: "跨专业的复杂项目",
          body: "研究、分析、写作与交付分别归属合适的团队，按阶段产物衔接。",
          href: "/concepts/squad-composition/",
          link: "了解专家团组合",
        },
      ],
    },
    start: {
      eyebrow: "从你手头的一个任务开始",
      title: "给出目标，也说清怎样才算做好。",
      lead: "安装 OpenCorvus，配置可用的模型与提供商，在项目里选择合适的专家团。先跑一个边界清晰、你能检查结果的任务。",
      steps: ["选择项目与专家团", "说明目标、范围与验收标准", "查看产物，补充反馈"],
      docs: "打开上手指南",
      market: "选择专家团",
      exampleLabel: "试着这样描述任务",
      example:
        "检查这个项目的导入流程，复现我提供的问题，修复根因并验证真实操作路径。交付改动文件、验证证据和剩余限制；不要发布上线。",
      boundaries:
        "长程不等于无限运行：执行需要运行时在线、模型服务可用。结果与耗时取决于任务、模型和证据；重要决定与必要授权仍由你掌握。",
      research: "研究与实验",
      paper: "阅读概念验证论文（英文 PDF · 研究中）",
    },
  },
  root: {
    meta: {
      title: "OpenCorvus — Keep complex work moving",
      description:
        "Open-source orchestration for long-running, complex, demanding AI work. Coordinate research, implementation, independent review and revision, with deliverables you can inspect.",
    },
    hero: {
      eyebrow: "LONG-RUNNING. COMPLEX. DEMANDING.",
      titleLines: ["Big tasks.", "Fewer handoffs", "on your plate."],
      description:
        "Set the goal and the boundaries. OpenCorvus coordinates AI specialists across research, implementation, review and revision, working toward a delivery you can inspect.",
      secondary: "See a real delivery",
      note: "Open source · Self-hostable · Your configured models",
      download: {
        label: "Download OpenCorvus",
        verb: "Download",
        menuLabel: "Choose your platform and installer",
        allPlatforms: "All platforms",
        releaseNote: "From the current release manifest",
      },
    },
    map: {
      label: "Who takes the next step?",
      badge: "COLLABORATION MAP",
      owner: "OpenCorvus orchestrator",
      ownerNote: "Assign · Connect · Follow through",
      stages: [
        {
          id: "scope",
          title: "Understand",
          roles: ["Requirements", "Research"],
          output: "Scope & evidence",
          detail:
            "Turn the goal into checkable requirements. Establish sources and limits before the next stage builds on them.",
        },
        {
          id: "plan",
          title: "Design",
          roles: ["Architecture", "Interface design"],
          output: "Plan & contracts",
          detail:
            "Define responsibilities, deliverables and dependencies. Independent work can proceed separately; dependent work connects through artifacts.",
        },
        {
          id: "build",
          title: "Implement",
          roles: ["Implementation"],
          output: "Working artifacts",
          detail:
            "The implementation specialist reads the requirements and design, produces code or files, and integrates the pieces into a working result.",
        },
        {
          id: "review",
          title: "Review",
          roles: ["Testing", "Visual review", "Integrity review"],
          output: "Evidence & findings",
          detail:
            "Independent roles inspect the implementation, real pages and delivery evidence. Findings return to implementation, then the corrections are reviewed.",
        },
        {
          id: "deliver",
          title: "Deliver",
          roles: ["Orchestrator"],
          output: "Results & limits",
          detail:
            "Bring together deliverables, verification evidence and unresolved limits. Inspect the work or request another change in the same task.",
        },
      ],
      loop: "Find an issue → Revise → Review again",
      hint: "Select a stage to see what it hands on.",
      disclaimer: "Workflow depends on the task and selected squad. Not a live product screen.",
    },
    pains: {
      eyebrow: "THE WORK AROUND THE WORK",
      title: "Less chasing progress. More making decisions.",
      cards: [
        {
          tag: "LONG-RUNNING",
          title: "You keep asking it to continue.",
          body: "Goals, stages and artifacts stay with the task. Check progress, add requirements and keep working without briefing a new conversation each time.",
          result: "A traceable process. Context for the next change.",
        },
        {
          tag: "COMPLEX",
          title: "Everyone did their part. Nothing fits.",
          body: "Assign ownership and dependencies so downstream specialists read upstream outputs. Different squads can own stages that need different expertise.",
          result: "Someone coordinates the handoffs, too.",
        },
        {
          tag: "DEMANDING",
          title: "It says done. You still have to check.",
          body: "Choose a squad with independent testing, visual review and integrity checks. Findings return to implementation with the evidence to act on them.",
          result: "Deliverables, review evidence and known limits.",
        },
      ],
    },
    case: {
      eyebrow: "ONE REAL TASK · 18 SEPTEMBER 2026",
      title: "“Build a tank game.”\nWhat happened next?",
      request: "Create a browser-based tank battle game that recreates the full original experience.",
      lead: "One delivery squad owned this task. Research, design, implementation and independent reviews connected within it. Findings fed back into two rounds of correction.",
      stats: [
        { value: "19", label: "acceptance requirements" },
        { value: "35", label: "stages with source records" },
        { value: "2", label: "revision loops" },
      ],
      revisions: [
        {
          label: "REVISION 01",
          title: "Scoring had to survive actual play.",
          body: "Repair cross-stage score persistence and results rendering, then check that the score carries into the next stage.",
        },
        {
          label: "REVISION 02",
          title: "The maps needed a source.",
          body: "Following an operator decision, replace 35 maps and enemy rosters with public-source data, record provenance and send them for independent checks.",
        },
      ],
      screenshot: "Retained two-player game screenshot",
      caption: "The case deliverable, not the OpenCorvus interface.",
      link: "Read the execution record and its limits",
      caveat:
        "A case with an operator decision, not a success-rate or cost benchmark. Original-game equivalence and some live-play evidence remain incomplete; a retained test report also differs from the closing report.",
    },
    uses: {
      eyebrow: "BRING THE WORK THAT NEEDS COORDINATION",
      title: "For the process behind a big request.",
      note: "Task examples, not completed cases. Actual workflows depend on the selected squads and available tools.",
      cards: [
        {
          title: "From requirements to working software",
          body: "Research the rules, design the solution, implement, inspect real pages and correct the findings.",
          href: "/market/builtin/advanced/",
          link: "Explore the delivery squad",
        },
        {
          title: "From sources to a defensible report",
          body: "Gather perspectives, check citations and examine disagreements so conclusions can be traced to evidence.",
          href: "/market/builtin/deep-research/",
          link: "Explore the research squad",
        },
        {
          title: "Projects that cross specialties",
          body: "Give research, analysis, writing and delivery to suitable teams, connected through their stage outputs.",
          href: "/concepts/squad-composition/",
          link: "See how squads combine",
        },
      ],
    },
    start: {
      eyebrow: "START WITH SOMETHING ON YOUR DESK",
      title: "Describe the result. Define what good looks like.",
      lead: "Install OpenCorvus, configure a reachable model provider, and choose a suitable squad in your project. Start with a bounded task whose result you can check.",
      steps: [
        "Choose a project and squad",
        "Set the goal, scope and acceptance criteria",
        "Inspect the artifacts and give feedback",
      ],
      docs: "Open the quickstart",
      market: "Choose a squad",
      exampleLabel: "A task you could give it",
      example:
        "Inspect this project's import flow, reproduce the issue I provide, fix the root cause and verify the real interaction path. Deliver the changes, verification evidence and remaining limits. Do not deploy.",
      boundaries:
        "Long-running does not mean unlimited: your runtime must stay online and your model provider reachable. Quality, time and cost depend on the task, models and evidence. Important decisions and required permissions remain yours.",
      research: "Research & experiments",
      paper: "Read the proof-of-concept paper (PDF · work in progress)",
    },
  },
} satisfies Record<PublicLocale, unknown>
