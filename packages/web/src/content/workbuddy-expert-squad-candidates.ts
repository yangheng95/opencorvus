export type ChecklistLocale = "root" | "zh-cn"

export type CandidateSkillSource = {
  name: string
  repository: string
  url: string
  license: string
  review: "pinned_open_source" | "license_review" | "authored_draft" | "runtime_blocked"
  targetPath: string
  assets: readonly string[]
  revision?: string
}

export type ExpertSquadRoadmapCandidate = {
  id: string
  label: Record<ChecklistLocale, string>
  description: Record<ChecklistLocale, string>
  evidence: "official_workbuddy" | "official_workbuddy_capability" | "market_inference"
  roles: Record<ChecklistLocale, readonly string[]>
  parallelPlan: Record<ChecklistLocale, string>
  dependsOn: readonly string[]
  skillSources: readonly CandidateSkillSource[]
  status: "pinned_open_source" | "license_review" | "authored_draft" | "blocked"
  generationState: "pending_confirmation" | "implementing"
  recommended: boolean
}

export const researchVerifiedAt = "2026-08-11"

export const workbuddyTeamEvidence = [
  {
    id: "marketing-campaign",
    label: { root: "Marketing Campaign Team", "zh-cn": "营销战役团队" },
    confidence: "official_preset",
    source:
      "https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Knowledge-Base/IMA%20Knowledge%20Base/03-OPC-One-Day",
    coveredBy: ["marketing-growth", "seo-geo", "viral-content"],
  },
  {
    id: "software-development",
    label: { root: "Software Development Team", "zh-cn": "软件开发团队" },
    confidence: "official_representative_task",
    source: "https://www.workbuddy.cn/work/",
    coveredBy: ["advanced", "review-debug"],
  },
  {
    id: "content-creation",
    label: { root: "Content Creation Team", "zh-cn": "内容创作团队" },
    confidence: "official_representative_task",
    source: "https://www.workbuddy.cn/work/",
    coveredBy: ["viral-content", "omnichannel-distribution"],
  },
] as const

const authored = (name: string, targetPath: string, assets: readonly string[]): CandidateSkillSource => ({
  name,
  repository: "OpenCorvus authored",
  url: "https://github.com/yangheng95/opencorvus",
  license: "MIT",
  review: "authored_draft",
  targetPath,
  assets,
})

const expertSquadRoadmapCandidateDefinitions: readonly Omit<ExpertSquadRoadmapCandidate, "generationState">[] = [
  {
    id: "insurance-claims-operations",
    label: { root: "Insurance Claims Operations", "zh-cn": "保险理赔运营" },
    description: {
      root: "Join claim evidence, policy traceability, and process controls into a human-reviewed evidence pack.",
      "zh-cn": "把理赔证据、保单追溯与流程控制汇合为供人工复核的证据包。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Claim evidence analyst",
        "Policy traceability analyst",
        "Control and risk analyst",
        "Evidence pack owner",
      ],
      "zh-cn": ["理赔证据分析", "保单追溯分析", "控制与风险分析", "证据包负责人"],
    },
    parallelPlan: {
      root: "Claim evidence, policy traceability, and control-risk reviews run independently before one evidence join.",
      "zh-cn": "理赔证据、保单追溯、控制与风险三路独立推进，之后统一汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded process-mapper adaptation",
        repository: "alirezarezvani/claude-skills",
        url: "https://github.com/alirezarezvani/claude-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/insurance-claims-operations/skills/method/SKILL.md",
        assets: ["expert-squads/builtin/insurance-claims-operations/skills/method/assets/claims-evidence-register.md"],
        revision: "aa8d778811a557a2c28ccadda4cf3d0bd028a4cc",
      },
    ],
    status: "pinned_open_source",
    recommended: true,
  },
  {
    id: "energy-utilities-planning",
    label: { root: "Energy and Utilities Planning", "zh-cn": "能源与公用事业规划" },
    description: {
      root: "Compare demand, supply, reliability, cost, and emissions scenarios without operational authority.",
      "zh-cn": "比较需求、供给、可靠性、成本与排放情景，不承担运行操作权限。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Demand and supply analyst", "Reliability analyst", "Cost and emissions analyst", "Utility plan owner"],
      "zh-cn": ["需求与供给分析", "可靠性分析", "成本与排放分析", "规划负责人"],
    },
    parallelPlan: {
      root: "Demand/supply, reliability, and cost/emissions branches run independently before scenario integration.",
      "zh-cn": "需求与供给、可靠性、成本与排放三路并行，最后统一形成情景方案。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "energy-utilities-planning method",
        "expert-squads/builtin/energy-utilities-planning/skills/method/SKILL.md",
        ["expert-squads/builtin/energy-utilities-planning/skills/method/assets/utility-scenario-register.md"],
      ),
    ],
    status: "authored_draft",
    recommended: true,
  },
  {
    id: "agriculture-food-systems",
    label: { root: "Agriculture and Food Systems", "zh-cn": "农业与食品系统" },
    description: {
      root: "Build a seasonal system plan from production, resource, market, and biosecurity evidence.",
      "zh-cn": "从生产、资源、市场与生物安全证据形成季节性系统方案。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Production analyst",
        "Resource and input analyst",
        "Market and biosecurity analyst",
        "Food-system plan owner",
      ],
      "zh-cn": ["生产分析", "资源与投入分析", "市场与生物安全分析", "食品系统方案负责人"],
    },
    parallelPlan: {
      root: "Production, resource/input, and market/biosecurity branches run independently before the seasonal join.",
      "zh-cn": "生产、资源与投入、市场与生物安全三路独立分析，之后汇合为季节方案。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "agriculture-food-systems method",
        "expert-squads/builtin/agriculture-food-systems/skills/method/SKILL.md",
        ["expert-squads/builtin/agriculture-food-systems/skills/method/assets/season-system-plan.md"],
      ),
    ],
    status: "authored_draft",
    recommended: true,
  },
  {
    id: "construction-project-controls",
    label: { root: "Construction Project Controls", "zh-cn": "建设项目控制" },
    description: {
      root: "Join scope, schedule, cost, procurement, site-risk, and quality evidence into a controls register.",
      "zh-cn": "把范围、进度、成本、采购、现场风险与质量证据汇合为项目控制登记册。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Scope and schedule analyst",
        "Cost and procurement analyst",
        "Site risk and quality analyst",
        "Controls owner",
      ],
      "zh-cn": ["范围与进度分析", "成本与采购分析", "现场风险与质量分析", "项目控制负责人"],
    },
    parallelPlan: {
      root: "Scope/schedule, cost/procurement, and site-risk/quality reviews run independently before control integration.",
      "zh-cn": "范围与进度、成本与采购、现场风险与质量三路独立评估，最后汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded senior-pm adaptation",
        repository: "alirezarezvani/claude-skills",
        url: "https://github.com/alirezarezvani/claude-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/construction-project-controls/skills/method/SKILL.md",
        assets: [
          "expert-squads/builtin/construction-project-controls/skills/method/assets/project-controls-register.md",
        ],
        revision: "aa8d778811a557a2c28ccadda4cf3d0bd028a4cc",
      },
    ],
    status: "pinned_open_source",
    recommended: true,
  },
  {
    id: "telecom-network-assurance",
    label: { root: "Telecom Network Assurance", "zh-cn": "电信网络保障" },
    description: {
      root: "Map demand, topology, service levels, capacity, and change risk into a non-operational assurance plan.",
      "zh-cn": "把需求、拓扑、服务水平、容量与变更风险汇合为非操作性的保障方案。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Demand and topology analyst",
        "Service-level analyst",
        "Capacity and change-risk analyst",
        "Assurance owner",
      ],
      "zh-cn": ["需求与拓扑分析", "服务水平分析", "容量与变更风险分析", "保障负责人"],
    },
    parallelPlan: {
      root: "Demand/topology, service-level, and capacity/change-risk branches run independently before assurance integration.",
      "zh-cn": "需求与拓扑、服务水平、容量与变更风险三路并行，之后统一汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded slo-architect adaptation",
        repository: "alirezarezvani/claude-skills",
        url: "https://github.com/alirezarezvani/claude-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/telecom-network-assurance/skills/method/SKILL.md",
        assets: ["expert-squads/builtin/telecom-network-assurance/skills/method/assets/network-assurance-register.md"],
        revision: "aa8d778811a557a2c28ccadda4cf3d0bd028a4cc",
      },
    ],
    status: "pinned_open_source",
    recommended: true,
  },
  {
    id: "public-sector-service-delivery",
    label: { root: "Public Sector Service Delivery", "zh-cn": "公共服务交付" },
    description: {
      root: "Join resident needs, process and accessibility evidence, and policy-delivery risk into an outcome register.",
      "zh-cn": "把居民需求、流程与无障碍证据、政策交付风险汇合为成果登记册。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Resident needs analyst",
        "Process and accessibility analyst",
        "Policy delivery-risk analyst",
        "Service plan owner",
      ],
      "zh-cn": ["居民需求分析", "流程与无障碍分析", "政策交付风险分析", "服务方案负责人"],
    },
    parallelPlan: {
      root: "Resident, process/accessibility, and policy-risk branches run independently before service-plan synthesis.",
      "zh-cn": "居民、流程与无障碍、政策风险三路独立推进，之后统一形成服务方案。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "public-sector-service-delivery method",
        "expert-squads/builtin/public-sector-service-delivery/skills/method/SKILL.md",
        [
          "expert-squads/builtin/public-sector-service-delivery/skills/method/assets/service-delivery-outcome-register.md",
        ],
      ),
    ],
    status: "authored_draft",
    recommended: true,
  },
  {
    id: "nonprofit-grant-operations",
    label: { root: "Nonprofit Grant Operations", "zh-cn": "非营利资助运营" },
    description: {
      root: "Join funder fit, program evidence, budget, compliance, and delivery readiness without submission authority.",
      "zh-cn": "把资助方匹配、项目证据、预算、合规与交付准备度汇合，不承担提交权限。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Funder-fit analyst", "Program evidence analyst", "Budget and compliance analyst", "Grant pack owner"],
      "zh-cn": ["资助方匹配分析", "项目证据分析", "预算与合规分析", "资助包负责人"],
    },
    parallelPlan: {
      root: "Funder-fit, program-evidence, and budget/compliance branches run independently before grant-pack integration.",
      "zh-cn": "资助方匹配、项目证据、预算与合规三路独立分析，之后统一汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded research-grants adaptation",
        repository: "K-Dense-AI/scientific-agent-skills",
        url: "https://github.com/K-Dense-AI/scientific-agent-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/nonprofit-grant-operations/skills/method/SKILL.md",
        assets: ["expert-squads/builtin/nonprofit-grant-operations/skills/method/assets/grant-delivery-plan.md"],
        revision: "7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a",
      },
    ],
    status: "pinned_open_source",
    recommended: false,
  },
  {
    id: "hospitality-service-operations",
    label: { root: "Hospitality Service Operations", "zh-cn": "酒店服务运营" },
    description: {
      root: "Join guest journey, revenue and capacity, workforce, safety, and recovery evidence into a reversible plan.",
      "zh-cn": "把宾客旅程、收益与容量、人员、安全和服务恢复证据汇合为可回滚方案。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Guest journey analyst",
        "Revenue and capacity analyst",
        "Workforce and safety analyst",
        "Hospitality plan owner",
      ],
      "zh-cn": ["宾客旅程分析", "收益与容量分析", "人员与安全分析", "酒店运营方案负责人"],
    },
    parallelPlan: {
      root: "Guest, revenue/capacity, and workforce/safety branches run independently before operations integration.",
      "zh-cn": "宾客、收益与容量、人员与安全三路并行，之后统一形成运营方案。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "hospitality-service-operations method",
        "expert-squads/builtin/hospitality-service-operations/skills/method/SKILL.md",
        ["expert-squads/builtin/hospitality-service-operations/skills/method/assets/guest-service-operations-plan.md"],
      ),
    ],
    status: "authored_draft",
    recommended: false,
  },
  {
    id: "life-sciences-regulatory",
    label: { root: "Life Sciences Regulatory Readiness", "zh-cn": "生命科学监管准备" },
    description: {
      root: "Join product, evidence, pathway, market, quality, and risk inputs into a draft readiness register.",
      "zh-cn": "把产品、证据、路径、市场、质量与风险输入汇合为监管准备登记册草案。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Product and evidence analyst",
        "Pathway and market analyst",
        "Quality and risk analyst",
        "Readiness owner",
      ],
      "zh-cn": ["产品与证据分析", "路径与市场分析", "质量与风险分析", "准备度负责人"],
    },
    parallelPlan: {
      root: "Product/evidence, pathway/market, and quality/risk branches run independently before readiness synthesis.",
      "zh-cn": "产品与证据、路径与市场、质量与风险三路独立分析，之后统一形成准备度结论。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded regulatory-affairs-head adaptation",
        repository: "alirezarezvani/claude-skills",
        url: "https://github.com/alirezarezvani/claude-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/life-sciences-regulatory/skills/method/SKILL.md",
        assets: [
          "expert-squads/builtin/life-sciences-regulatory/skills/method/assets/regulatory-readiness-register.md",
        ],
        revision: "aa8d778811a557a2c28ccadda4cf3d0bd028a4cc",
      },
    ],
    status: "pinned_open_source",
    recommended: false,
  },
  {
    id: "academic-paper-review",
    label: { root: "Academic Paper Review", "zh-cn": "学术论文审阅" },
    description: {
      root: "Review manuscripts through literature positioning, novelty, logic, methods and facts, hallucination checks, presentation quality, and integrated revision guidance.",
      "zh-cn": "从文献定位、创新性、逻辑、方法与事实、幻觉检查、表达质量到整合修订建议，对论文做完整审阅。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Review-charter planner",
        "Literature-landscape reviewer",
        "Novelty and contribution reviewer",
        "Logic and argument reviewer",
        "Methods, statistics, and facts reviewer",
        "Presentation and figure reviewer",
        "Citation and hallucination auditor",
        "Review integration editor",
      ],
      "zh-cn": [
        "审阅章程规划",
        "文献版图审阅",
        "创新性与贡献审阅",
        "逻辑与论证审阅",
        "方法、统计与事实审阅",
        "表达与图表审阅",
        "引用与幻觉审计",
        "审阅整合编辑",
      ],
    },
    parallelPlan: {
      root: "After the charter, literature, logic, methods/facts, presentation, and citation/hallucination branches run independently; novelty follows literature, then one editor joins all evidence.",
      "zh-cn":
        "章程冻结后，文献、逻辑、方法/事实、表达、引用/幻觉五路独立推进；创新性承接文献结果，最后由整合编辑汇合全部证据。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded peer-review, literature-review, scholar-evaluation, and scientific-visualization adaptation",
        repository: "K-Dense-AI/scientific-agent-skills",
        url: "https://github.com/K-Dense-AI/scientific-agent-skills",
        license: "MIT",
        review: "pinned_open_source",
        targetPath: "expert-squads/builtin/academic-paper-review/skills/academic-paper-review-method/SKILL.md",
        assets: [
          "expert-squads/builtin/academic-paper-review/skills/academic-paper-review-method/assets/review-evidence-register.md",
          "expert-squads/builtin/academic-paper-review/skills/academic-paper-review-method/assets/novelty-prior-art-matrix.md",
          "expert-squads/builtin/academic-paper-review/skills/academic-paper-review-method/assets/claim-citation-hallucination-ledger.md",
          "expert-squads/builtin/academic-paper-review/skills/academic-paper-review-method/assets/presentation-quality-checklist.md",
        ],
        revision: "7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a",
      },
    ],
    status: "pinned_open_source",
    recommended: true,
  },
] as const

export const expertSquadRoadmapCandidates: readonly ExpertSquadRoadmapCandidate[] =
  expertSquadRoadmapCandidateDefinitions.map((candidate) => ({
    ...candidate,
    generationState: "pending_confirmation",
  }))
