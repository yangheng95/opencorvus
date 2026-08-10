export type ChecklistLocale = "root" | "zh-cn"

export type CandidateSkillSource = {
  name: string
  repository: string
  url: string
  license: string
  review: "ready_for_source_review" | "license_review" | "authored_required" | "runtime_blocked"
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
  status: "source_review" | "license_review" | "authored_required" | "blocked"
  recommended: boolean
}

export const researchVerifiedAt = "2026-08-10"

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
  review: "authored_required",
  targetPath,
  assets,
})

export const expertSquadRoadmapCandidates: readonly ExpertSquadRoadmapCandidate[] = [
  {
    id: "cybersecurity-assurance",
    label: { root: "Cybersecurity Assurance", "zh-cn": "网络安全保障" },
    description: {
      root: "Map threat evidence, control coverage, and incident readiness into an accountable assurance register.",
      "zh-cn": "把威胁证据、控制覆盖与事件响应准备度汇合为可问责的安全保障登记册。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Threat analyst", "Control analyst", "Readiness analyst", "Assurance integrator"],
      "zh-cn": ["威胁分析", "控制分析", "响应准备分析", "保障汇总"],
    },
    parallelPlan: {
      root: "Threat, control, and readiness reviews run independently; the assurance register joins all three.",
      "zh-cn": "威胁、控制和响应准备三路独立开展；保障登记册等待三路结果后汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded agent-owasp-compliance adaptation",
        repository: "github/awesome-copilot",
        url: "https://github.com/github/awesome-copilot",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/cybersecurity-assurance/skills/method/SKILL.md",
        assets: [
          "expert-squads/builtin/cybersecurity-assurance/skills/method/assets/security-assurance-register.md",
        ],
        revision: "3f0bba475ec40b9680e1d0311b9caffeec5ad4c3",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "cloud-platform-architecture",
    label: { root: "Cloud Platform Architecture", "zh-cn": "云平台架构" },
    description: {
      root: "Turn workload, reliability, cost, and operations evidence into a bounded cloud architecture decision record.",
      "zh-cn": "把工作负载、可靠性、成本与运维证据汇合为边界明确的云架构决策记录。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Workload analyst", "Reliability analyst", "FinOps analyst", "Architecture owner"],
      "zh-cn": ["负载分析", "可靠性分析", "云成本分析", "架构负责人"],
    },
    parallelPlan: {
      root: "Workload, reliability, and cost/operations branches run in parallel before one architecture join.",
      "zh-cn": "负载、可靠性、成本与运维分支并行，最后由架构负责人统一汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded cloud-design-patterns adaptation",
        repository: "github/awesome-copilot",
        url: "https://github.com/github/awesome-copilot",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/cloud-platform-architecture/skills/method/SKILL.md",
        assets: ["expert-squads/builtin/cloud-platform-architecture/skills/method/assets/cloud-decision-record.md"],
        revision: "3f0bba475ec40b9680e1d0311b9caffeec5ad4c3",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "data-engineering-reliability",
    label: { root: "Data Engineering Reliability", "zh-cn": "数据工程可靠性" },
    description: {
      root: "Join data contracts, pipeline resilience, and observability into a reviewable data-product release pack.",
      "zh-cn": "把数据契约、流水线韧性和可观测性汇合为可复核的数据产品发布包。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Contract analyst", "Resilience analyst", "Observability analyst", "Release integrator"],
      "zh-cn": ["契约分析", "韧性分析", "可观测性分析", "发布汇总"],
    },
    parallelPlan: {
      root: "Contract, resilience, and observability reviews run independently before release integration.",
      "zh-cn": "契约、韧性和可观测性三路独立评估，之后统一汇入发布决策。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded data-quality-and-contract-testing adaptation",
        repository: "vaquarkhan/data-engineering-agent-skills",
        url: "https://github.com/vaquarkhan/data-engineering-agent-skills",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/data-engineering-reliability/skills/method/SKILL.md",
        assets: ["expert-squads/builtin/data-engineering-reliability/skills/method/assets/data-product-contract.md"],
        revision: "421ef57e8d42c464b29339193c18dd5bd2946bc2",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "scientific-research-design",
    label: { root: "Scientific Research Design", "zh-cn": "科学研究设计" },
    description: {
      root: "Build a research decision register from evidence landscape, competing hypotheses, rigor, and ethics.",
      "zh-cn": "从证据版图、竞争性假设、严谨性与伦理分析形成研究决策登记册。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Evidence analyst", "Hypothesis analyst", "Rigor and ethics reviewer", "Research integrator"],
      "zh-cn": ["证据分析", "假设分析", "严谨性与伦理复核", "研究汇总"],
    },
    parallelPlan: {
      root: "Evidence, hypotheses, and rigor/ethics run independently; the research decision waits for all three.",
      "zh-cn": "证据、假设、严谨性与伦理三路独立推进；研究决策等待全部完成后汇合。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "bounded scientific-brainstorming adaptation",
        repository: "K-Dense-AI/scientific-agent-skills",
        url: "https://github.com/K-Dense-AI/scientific-agent-skills",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/scientific-research-design/skills/method/SKILL.md",
        assets: [
          "expert-squads/builtin/scientific-research-design/skills/method/assets/research-decision-register.md",
        ],
        revision: "7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "healthcare-operations",
    label: { root: "Healthcare Operations", "zh-cn": "医疗运营" },
    description: {
      root: "Analyze de-identified service flow, capacity and access, safety, and privacy without clinical authority.",
      "zh-cn": "基于去标识化证据分析服务流程、容量与可及性、安全和隐私，不承担临床决策。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Service-flow analyst", "Capacity analyst", "Safety and privacy analyst", "Improvement owner"],
      "zh-cn": ["服务流程分析", "容量分析", "安全与隐私分析", "改进负责人"],
    },
    parallelPlan: {
      root: "Flow, capacity/access, and safety/privacy reviews run independently before an accountable operations join.",
      "zh-cn": "流程、容量与可及性、安全与隐私三路独立分析，之后统一汇入运营改进包。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "healthcare operations method",
        "expert-squads/builtin/healthcare-operations/skills/method/SKILL.md",
        ["expert-squads/builtin/healthcare-operations/skills/method/assets/healthcare-operations-register.md"],
      ),
    ],
    status: "authored_required",
    recommended: true,
  },
  {
    id: "education-program-design",
    label: { root: "Education Program Design", "zh-cn": "教育项目设计" },
    description: {
      root: "Align learner evidence, curriculum structure, assessment, and accessibility in one measurable blueprint.",
      "zh-cn": "把学习者证据、课程结构、评估与无障碍要求对齐为可衡量的学习方案。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Learner analyst", "Curriculum architect", "Assessment and accessibility analyst", "Program integrator"],
      "zh-cn": ["学习者分析", "课程架构", "评估与无障碍分析", "项目汇总"],
    },
    parallelPlan: {
      root: "Learner, curriculum, and assessment/accessibility branches run independently before blueprint integration.",
      "zh-cn": "学习者、课程、评估与无障碍分支并行，最后统一形成学习方案。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "education program design method",
        "expert-squads/builtin/education-program-design/skills/method/SKILL.md",
        ["expert-squads/builtin/education-program-design/skills/method/assets/learning-program-blueprint.md"],
      ),
    ],
    status: "authored_required",
    recommended: true,
  },
  {
    id: "supply-chain-logistics",
    label: { root: "Supply Chain Logistics", "zh-cn": "供应链与物流" },
    description: {
      root: "Join demand and inventory, transport constraints, and disruption risk into a logistics control-tower plan.",
      "zh-cn": "把需求与库存、运输约束和中断风险汇合为物流控制塔方案。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Demand analyst", "Transport analyst", "Disruption analyst", "Logistics plan owner"],
      "zh-cn": ["需求分析", "运输分析", "中断风险分析", "物流方案负责人"],
    },
    parallelPlan: {
      root: "Demand/inventory, transport, and disruption branches run independently before scenario integration.",
      "zh-cn": "需求与库存、运输、中断风险三路独立推进，之后统一进行情景整合。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "supply-chain logistics method",
        "expert-squads/builtin/supply-chain-logistics/skills/method/SKILL.md",
        ["expert-squads/builtin/supply-chain-logistics/skills/method/assets/logistics-control-tower.md"],
      ),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "manufacturing-quality",
    label: { root: "Manufacturing Quality", "zh-cn": "制造质量" },
    description: {
      root: "Combine process evidence, defect analysis, and control verification into a traceable nonconformance pack.",
      "zh-cn": "把过程证据、缺陷分析和控制验证汇合为可追溯的不合格处置包。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Process analyst", "Defect specialist", "Control verifier", "Disposition owner"],
      "zh-cn": ["过程分析", "缺陷分析", "控制验证", "处置负责人"],
    },
    parallelPlan: {
      root: "Process, defect, and control-verification branches run in parallel before disposition review.",
      "zh-cn": "过程、缺陷和控制验证三路并行，之后进入统一处置复核。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "manufacturing quality method",
        "expert-squads/builtin/manufacturing-quality/skills/method/SKILL.md",
        ["expert-squads/builtin/manufacturing-quality/skills/method/assets/nonconformance-register.md"],
      ),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "real-estate-due-diligence",
    label: { root: "Real Estate Due Diligence", "zh-cn": "房地产尽职调查" },
    description: {
      root: "Join property documents, market and financial evidence, and physical and regulatory risks for professional review.",
      "zh-cn": "把房产文件、市场与财务证据、实体与监管风险汇合，供专业人员复核。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Document analyst", "Market and financial analyst", "Physical and regulatory analyst", "Diligence owner"],
      "zh-cn": ["文件分析", "市场与财务分析", "实体与监管分析", "尽调负责人"],
    },
    parallelPlan: {
      root: "Document, market/financial, and physical/regulatory branches run independently before the diligence join.",
      "zh-cn": "文件、市场与财务、实体与监管三路独立分析，之后汇合为尽调包。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "property diligence method",
        "expert-squads/builtin/real-estate-due-diligence/skills/method/SKILL.md",
        ["expert-squads/builtin/real-estate-due-diligence/skills/method/assets/property-diligence-register.md"],
      ),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "ecommerce-merchandising",
    label: { root: "Ecommerce Merchandising", "zh-cn": "电商商品运营" },
    description: {
      root: "Turn catalog, demand and pricing, and experience and operations evidence into a reversible test plan.",
      "zh-cn": "把商品目录、需求与定价、体验与运营证据转化为可回滚的测试方案。",
    },
    evidence: "market_inference",
    roles: {
      root: [
        "Catalog analyst",
        "Demand and pricing analyst",
        "Experience and operations analyst",
        "Merchandising owner",
      ],
      "zh-cn": ["目录分析", "需求与定价分析", "体验与运营分析", "商品运营负责人"],
    },
    parallelPlan: {
      root: "Catalog, demand/pricing, and experience/operations branches run independently before test-plan integration.",
      "zh-cn": "目录、需求与定价、体验与运营三路独立推进，之后统一形成测试计划。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "ecommerce merchandising method",
        "expert-squads/builtin/ecommerce-merchandising/skills/method/SKILL.md",
        ["expert-squads/builtin/ecommerce-merchandising/skills/method/assets/merchandising-test-plan.md"],
      ),
    ],
    status: "authored_required",
    recommended: false,
  },
] as const
