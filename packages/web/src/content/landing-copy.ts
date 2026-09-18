import type { PublicLocale } from "./public-market"

/** Product story and code-native execution artwork share this bilingual source. */
export const landingCopy = {
  "zh-cn": {
    meta: {
      title: "OpenCorvus — 复杂任务，协同推进",
      description:
        "为长程、复杂、重型任务组织 AI 专家协作。从调研、实现到独立复核与返工，让每一步有衔接，让交付有据可查。开源，可自托管。",
    },
    hero: {
      eyebrow: "OpenCorvus",
      titleLines: ["复杂任务。", "协同推进。"],
      description: "面向长程、复杂任务的多智能体调度系统。",
      secondary: "探索执行过程",
      note: "开源 · 可自托管",
      download: {
        label: "下载 OpenCorvus",
        verb: "下载",
        menuLabel: "选择系统与安装包",
        allPlatforms: "所有平台",
        releaseNote: "来自当前发布清单",
      },
    },
    map: {
      label: "从一个目标，展开一场协作。",
      badge: "坦克大战 · 执行关系",
      owner: "OpenCorvus 编排器",
      ownerNote: "目标 · 分工 · 交接 · 复核",
      stages: [
        {
          id: "scope",
          title: "澄清与调研",
          roles: ["意图解析", "需求工程", "来源调研"],
          output: "需求与证据",
          detail: "先把目标拆成可检查的要求，查清资料来源与限制。后续工作据此展开。",
        },
        {
          id: "plan",
          title: "方案与分工",
          roles: ["架构设计", "工作量复核", "界面设计"],
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
      disclaimer: "角色与修正主题来自任务记录，连线采用工作流示意；返工起点不代表事件归因。非原始界面或精确时序。",
    },
    case: {
      eyebrow: "实际案例 · 2026 年 9 月 18 日",
      title: "从一句需求，\n到一款游戏。",
      request: "帮我创建一个坦克大战的网页游戏，要求还原全部的原版游戏体验。",
      lead: "坦克大战网页游戏：一个交付专家团组织调研、设计、实现与独立复核，并完成两轮修正。",
      stats: [
        {
          value: "19",
          label: "项可验收要求",
        },
        {
          value: "35",
          label: "关数据溯源",
        },
        {
          value: "2",
          label: "轮修正回流",
        },
      ],
      revisions: [
        {
          label: "01 · 计分修正",
          title: "让计分跟上关卡。",
          body: "修复跨关累计分与结算呈现，再检查跨关后分数是否保留。",
        },
        {
          label: "02 · 数据替换",
          title: "35 关，逐关有据。",
          body: "按操作者裁定替换 35 关地图与敌坦编成，登记公开来源，再交由独立角色核对。",
        },
      ],
      screenshot: "任务留存的双人游戏画面",
      caption: "案例中的交付物；并非 OpenCorvus 操作界面。",
      link: "查看完整执行记录",
      caveat: "本次任务包含人工裁定。测试报告差异、原版还原与实拍缺口详见案例记录。",
    },
    start: {
      eyebrow: "开始使用 OpenCorvus",
      title: "下一个任务，由你定义。",
      lead: "连接模型，选择项目与专家团，给出目标和验收标准。",
      docs: "开始使用",
      market: "探索专家团",
      boundaries:
        "运行时需保持在线，模型服务需可用。结果、耗时与成本取决于任务、模型和可获得的证据。重要决定及必要授权由你掌握。",
      research: "研究与实验",
      paper: "阅读概念验证论文（英文 PDF · 研究中）",
    },
    capabilities: {
      eyebrow: "为长程任务而设计",
      title: "每一部分，\n都通向同一个目标。",
      lead: "把专业工作交给合适的角色，让需求、方案、产物与复核彼此衔接。",
      chapters: [
        {
          id: "coordination",
          kicker: "专业分工",
          title: "各有所长。\n彼此相连。",
          body: "研究、设计、实现，各自专注。编排器按依赖组织工作，把上游产物交给下一位专家。跨领域项目还可以组合不同专家团。",
          link: "了解专家团组合",
          href: "/concepts/squad-composition/",
        },
        {
          id: "continuity",
          kicker: "持续推进",
          title: "任务继续。\n上下文也继续。",
          body: "目标、阶段和产物随任务保留。中途补充决定，或在交付后继续修改，都可以在同一个任务中展开。执行需要运行时在线。",
          link: "了解长程执行",
          href: "/concepts/long-horizon/",
        },
        {
          id: "review",
          kicker: "独立复核",
          title: "完成之后，\n再看一遍。",
          body: "选择含独立复核的专家团，让不同角色检查实现与证据。发现的问题返回实现，修正后再次复核，交付时保留仍未解决的限制。",
          link: "查看软件交付专家团",
          href: "/market/builtin/advanced/",
        },
      ],
      handoff: ["需求与证据", "方案与契约", "可运行产物"],
      continuity: ["初始目标", "新增决定", "继续执行"],
      review: ["实现", "独立复核", "修正"],
      visualNote: "能力示意 · 实际流程由所选专家团决定",
      artifactLabel: "产物交接",
      contextLabel: "同一任务内",
      reviewLabel: "修正与复核",
    },
  },
  root: {
    meta: {
      title: "OpenCorvus — Complex work. Coordinated.",
      description:
        "Open-source orchestration for long-running, complex, demanding AI work. Coordinate research, implementation, independent review and revision, with deliverables you can inspect.",
    },
    hero: {
      eyebrow: "OpenCorvus",
      titleLines: ["Complex work.", "Coordinated."],
      description: "Multi-agent orchestration for long-running, demanding work.",
      secondary: "Explore the workflow",
      note: "Open source · Self-hostable",
      download: {
        label: "Download OpenCorvus",
        verb: "Download",
        menuLabel: "Choose your platform and installer",
        allPlatforms: "All platforms",
        releaseNote: "From the current release manifest",
      },
    },
    map: {
      label: "One goal. A coordinated effort.",
      badge: "TANK BATTLE · EXECUTION MAP",
      owner: "OpenCorvus orchestrator",
      ownerNote: "Scope · Assign · Connect · Review",
      stages: [
        {
          id: "scope",
          title: "Understand",
          roles: ["Intent analysis", "Requirements", "Source research"],
          output: "Scope & evidence",
          detail:
            "Turn the goal into checkable requirements. Establish sources and limits before the next stage builds on them.",
        },
        {
          id: "plan",
          title: "Design",
          roles: ["Architecture", "Workload review", "Interface design"],
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
      disclaimer: "Recorded roles and repairs; illustrative workflow edges. Repair origins are not event attribution. Not the product interface or exact timing.",
    },
    case: {
      eyebrow: "CASE STUDY · 18 SEPTEMBER 2026",
      title: "From a request\nto a playable game.",
      request: "Create a browser-based tank battle game that recreates the full original experience.",
      lead: "A browser tank game. One delivery squad coordinated research, design, implementation and independent review, with two rounds of correction.",
      stats: [
        {
          value: "19",
          label: "acceptance requirements",
        },
        {
          value: "35",
          label: "stages with source records",
        },
        {
          value: "2",
          label: "revision loops",
        },
      ],
      revisions: [
        {
          label: "01 · SCORING",
          title: "Scores that carry forward.",
          body: "Repair cross-stage score persistence and results rendering, then check that the score carries into the next stage.",
        },
        {
          label: "02 · STAGE DATA",
          title: "35 stages. Recorded sources.",
          body: "Following an operator decision, replace 35 maps and enemy rosters with public-source data, record provenance and send them for independent checks.",
        },
      ],
      screenshot: "Retained two-player game screenshot",
      caption: "The case deliverable, not the OpenCorvus interface.",
      link: "Explore the execution record",
      caveat:
        "This task included an operator decision. Test-report differences, fidelity limits and gaps in live-play evidence are detailed in the case record.",
    },
    start: {
      eyebrow: "GET STARTED WITH OPENCORVUS",
      title: "Your next task starts here.",
      lead: "Connect a model. Choose a project and squad. Define the goal and acceptance criteria.",
      docs: "Get started",
      market: "Explore squads",
      boundaries:
        "The runtime must remain online and the model provider reachable. Results, time and cost depend on the task, models and available evidence. Important decisions and required permissions remain yours.",
      research: "Research & experiments",
      paper: "Read the proof-of-concept paper (PDF · work in progress)",
    },
    capabilities: {
      eyebrow: "BUILT FOR THE LONG RUN",
      title: "Every part.\nOne shared goal.",
      lead: "Specialist work, connected through requirements, plans, artifacts and review.",
      chapters: [
        {
          id: "coordination",
          kicker: "SPECIALIZATION",
          title: "Different expertise.\nConnected work.",
          body: "Research, design and implementation each have a focus. The orchestrator connects dependencies and passes artifacts to the next specialist. Cross-domain projects can combine squads.",
          link: "Explore squad composition",
          href: "/concepts/squad-composition/",
        },
        {
          id: "continuity",
          kicker: "CONTINUITY",
          title: "The work continues.\nSo does the context.",
          body: "Goals, stages and artifacts stay with the task. Add a decision midway through, or request changes after delivery, in the same task. Execution requires an online runtime.",
          link: "Explore long-horizon execution",
          href: "/concepts/long-horizon/",
        },
        {
          id: "review",
          kicker: "INDEPENDENT REVIEW",
          title: "Built.\nThen examined.",
          body: "Choose a squad with independent review. Separate roles inspect implementation and evidence, return findings for correction, and review again. Remaining limits accompany the delivery.",
          link: "Explore the delivery squad",
          href: "/market/builtin/advanced/",
        },
      ],
      handoff: ["Scope & evidence", "Plan & contracts", "Working artifacts"],
      continuity: ["Original goal", "New decision", "Continue the task"],
      review: ["Implement", "Review", "Revise"],
      visualNote: "Capability illustration · Workflows vary by squad",
      artifactLabel: "ARTIFACT HANDOFF",
      contextLabel: "WITHIN ONE TASK",
      reviewLabel: "REVISE & REVIEW",
    },
  },
} satisfies Record<PublicLocale, unknown>
