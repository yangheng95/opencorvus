export type ChecklistLocale = "root" | "zh-cn"

export type CandidateSkillSource = {
  name: string
  repository: string
  url: string
  license: string
  review: "ready_for_source_review" | "license_review" | "authored_required" | "runtime_blocked"
  targetPath: string
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

const marketingSkills = (name: string, targetPath: string): CandidateSkillSource => ({
  name,
  repository: "coreyhaines31/marketingskills",
  url: "https://github.com/coreyhaines31/marketingskills",
  license: "MIT",
  review: "ready_for_source_review",
  targetPath,
  revision: "7868cb9251fad80a73d26e488a5ad5f6c4a9f335",
})

const authored = (name: string, targetPath: string): CandidateSkillSource => ({
  name,
  repository: "OpenCorvus authored",
  url: "https://github.com/yangheng95/opencorvus",
  license: "MIT",
  review: "authored_required",
  targetPath,
})

export const expertSquadRoadmapCandidates: readonly ExpertSquadRoadmapCandidate[] = [
  {
    id: "browser-research-acceptance",
    label: { root: "Browser Research & Acceptance", "zh-cn": "浏览器调查与网页验收" },
    description: {
      root: "Operate real pages, collect screenshots and page evidence, and independently verify interactive delivery.",
      "zh-cn": "操作真实页面，收集截图与页面证据，并独立验收交互式交付。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Research lead", "Browser operator", "Evidence curator", "Acceptance reviewer"],
      "zh-cn": ["调查负责人", "浏览器操作员", "证据整理员", "验收复核员"],
    },
    parallelPlan: {
      root: "Page research and acceptance criteria may run in parallel; final interaction review waits for the exact delivered revision.",
      "zh-cn": "页面调查与验收标准可并行；最终交互复核必须等待精确交付版本。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "BrowserSkill",
        repository: "Tencent/BrowserSkill",
        url: "https://github.com/Tencent/BrowserSkill",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/browser-research-acceptance/skills/browser-evidence-acceptance/SKILL.md",
        revision: "610782698bb3229303ba243dec79e796bd46b574",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "office-delivery",
    label: { root: "Office Delivery Studio", "zh-cn": "办公报告交付" },
    description: {
      root: "Turn accepted research and data into reviewed documents, presentations, spreadsheets, and PDFs through one delivery chain.",
      "zh-cn": "把已验收的研究和数据转化为经过复核的文档、演示文稿、表格和 PDF。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Delivery planner", "Document author", "Presentation author", "Data workbook author", "Visual reviewer"],
      "zh-cn": ["交付规划", "文档作者", "演示作者", "表格作者", "视觉复核"],
    },
    parallelPlan: {
      root: "Format authors may work from one accepted brief in parallel; one delivery owner performs cross-format consistency and visual review.",
      "zh-cn": "各格式作者可基于同一份已验收 Brief 并行；最终由一名交付负责人统一检查跨格式一致性与视觉质量。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "office delivery method",
        "expert-squads/builtin/office-delivery/skills/office-delivery-method/SKILL.md",
      ),
    ],
    status: "authored_required",
    recommended: true,
  },
  {
    id: "product-management",
    label: { root: "Product Management", "zh-cn": "产品管理" },
    description: {
      root: "Convert product evidence into a bounded brief, decision record, prioritized roadmap, and acceptance-ready handoff.",
      "zh-cn": "把产品证据转化为明确 Brief、决策记录、优先级路线图和可验收交接。",
    },
    evidence: "market_inference",
    roles: {
      root: ["User researcher", "Product analyst", "Product manager", "Delivery planner", "Decision reviewer"],
      "zh-cn": ["用户研究", "产品分析", "产品经理", "交付规划", "决策复核"],
    },
    parallelPlan: {
      root: "User and market evidence may be collected in parallel; prioritization starts after both evidence sets are accepted.",
      "zh-cn": "用户与市场证据可并行收集；两组证据验收后再统一排定优先级。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "selected planning and review skills",
        repository: "obra/superpowers",
        url: "https://github.com/obra/superpowers",
        license: "MIT",
        review: "ready_for_source_review",
        targetPath: "expert-squads/builtin/product-management/skills/evidence-backed-product-planning/SKILL.md",
        revision: "44c9b2d6e889982ac18c27d05a19fefe335194e1",
      },
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "customer-success",
    label: { root: "Customer Success", "zh-cn": "客户成功" },
    description: {
      root: "Analyze customer signals, renewal risk, adoption gaps, and produce an evidence-backed success plan.",
      "zh-cn": "分析客户信号、续约风险和采用缺口，形成证据支撑的客户成功方案。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Account researcher", "Adoption analyst", "Risk analyst", "Success planner", "Quality reviewer"],
      "zh-cn": ["客户研究", "采用分析", "风险分析", "成功规划", "质量复核"],
    },
    parallelPlan: {
      root: "Adoption and commercial-risk analyses are independent branches; the success plan joins their accepted outputs.",
      "zh-cn": "采用分析与商业风险分析是独立分支；客户成功方案在两者验收后汇合。",
    },
    dependsOn: [],
    skillSources: [
      marketingSkills(
        "customer research and lifecycle methods",
        "expert-squads/builtin/customer-success/skills/method/SKILL.md",
      ),
    ],
    status: "source_review",
    recommended: true,
  },
  {
    id: "finance-operations",
    label: { root: "Finance Operations", "zh-cn": "财务运营" },
    description: {
      root: "Reconcile invoices, expenses, operating metrics, and controls into an auditable finance operations package.",
      "zh-cn": "对发票、费用、经营指标和控制证据进行核对，形成可审计的财务运营交付。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Evidence steward", "Expense analyst", "Invoice analyst", "Control reviewer", "Report owner"],
      "zh-cn": ["证据管理员", "费用分析", "发票分析", "控制复核", "报告负责人"],
    },
    parallelPlan: {
      root: "Invoice and expense analysis may overlap after evidence normalization; controls and reporting join both outputs.",
      "zh-cn": "证据标准化后，发票与费用分析可并行；控制复核和报告需汇合两者。",
    },
    dependsOn: [],
    skillSources: [
      authored("finance operations review method", "expert-squads/builtin/finance-operations/skills/method/SKILL.md"),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "meeting-knowledge",
    label: { root: "Meeting & Knowledge Operations", "zh-cn": "会议与知识运营" },
    description: {
      root: "Turn recordings and working notes into verified minutes, decisions, action items, and searchable knowledge.",
      "zh-cn": "把录音和工作笔记转化为已核验的会议纪要、决策、行动项和可搜索知识。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Transcript steward", "Decision extractor", "Action owner mapper", "Knowledge editor", "Verifier"],
      "zh-cn": ["转写管理员", "决策提取", "行动项映射", "知识编辑", "核验员"],
    },
    parallelPlan: {
      root: "Decision and action extraction may overlap from one frozen transcript; knowledge publication waits for verification.",
      "zh-cn": "决策与行动项可基于同一冻结转写并行提取；知识发布必须等待核验。",
    },
    dependsOn: [],
    skillSources: [
      authored(
        "meeting knowledge publication method",
        "expert-squads/builtin/meeting-knowledge/skills/method/SKILL.md",
      ),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "procurement-vendor",
    label: { root: "Procurement & Vendor Evaluation", "zh-cn": "采购与供应商评估" },
    description: {
      root: "Compare vendor evidence, commercial terms, security posture, and implementation risk in one decision package.",
      "zh-cn": "比较供应商证据、商业条款、安全姿态和实施风险，形成统一决策包。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Requirements analyst", "Vendor researcher", "Commercial analyst", "Security reviewer", "Decision owner"],
      "zh-cn": ["需求分析", "供应商调查", "商业分析", "安全复核", "决策负责人"],
    },
    parallelPlan: {
      root: "Commercial, security, and implementation-risk reviews may overlap against one requirements baseline.",
      "zh-cn": "商业、安全与实施风险可基于同一需求基线并行审查。",
    },
    dependsOn: [],
    skillSources: [
      authored("vendor evaluation method", "expert-squads/builtin/procurement-vendor/skills/method/SKILL.md"),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "localization-adaptation",
    label: { root: "Localization & Market Adaptation", "zh-cn": "本地化与市场改编" },
    description: {
      root: "Adapt approved content across languages and markets while preserving terminology, claims, and channel constraints.",
      "zh-cn": "在保持术语、事实主张和渠道约束的前提下完成多语言、多市场改编。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Source editor", "Terminology steward", "Locale adapter", "Market reviewer", "Release owner"],
      "zh-cn": ["源内容编辑", "术语管理员", "本地化改编", "市场复核", "发布负责人"],
    },
    parallelPlan: {
      root: "Locale adaptations may run in parallel after the source and terminology set are frozen; release review is serialized.",
      "zh-cn": "源内容与术语表冻结后，各语言版本可并行；最终发布复核串行收敛。",
    },
    dependsOn: [],
    skillSources: [
      authored("localization method", "expert-squads/builtin/localization-adaptation/skills/method/SKILL.md"),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "knowledge-base-operations",
    label: { root: "Knowledge Base Operations", "zh-cn": "知识库运营" },
    description: {
      root: "Curate source material into governed, deduplicated, searchable knowledge with provenance and maintenance decisions.",
      "zh-cn": "把来源资料整理为有治理、去重、可搜索并保留来源链的知识库。",
    },
    evidence: "official_workbuddy_capability",
    roles: {
      root: ["Source curator", "Taxonomy designer", "Deduplication analyst", "Knowledge editor", "Governance reviewer"],
      "zh-cn": ["来源整理", "分类设计", "去重分析", "知识编辑", "治理复核"],
    },
    parallelPlan: {
      root: "Source curation may be partitioned by collection; taxonomy and publication converge after duplicate analysis.",
      "zh-cn": "来源整理可按集合并行；分类与发布需在去重分析后统一收敛。",
    },
    dependsOn: [],
    skillSources: [
      authored("knowledge governance method", "expert-squads/builtin/knowledge-base-operations/skills/method/SKILL.md"),
    ],
    status: "authored_required",
    recommended: false,
  },
  {
    id: "product-video",
    label: { root: "Product Video Production", "zh-cn": "产品视频制作" },
    description: {
      root: "Produce a source-grounded brief, parallel narrative and visual plans, and a reviewed production handoff that fails closed when rendering capability is absent.",
      "zh-cn": "产出有来源依据的 Brief、并行叙事与视觉方案及复核后的制作交接；缺少渲染能力时明确失败关闭。",
    },
    evidence: "market_inference",
    roles: {
      root: ["Creative lead", "Script writer", "Storyboard artist", "Media producer", "Playback reviewer"],
      "zh-cn": ["创意负责人", "脚本作者", "分镜设计", "媒体制作", "播放复核"],
    },
    parallelPlan: {
      root: "Research and visual references may overlap; media production waits for the accepted script and storyboard.",
      "zh-cn": "调查与视觉参考可并行；媒体制作必须等待已验收脚本和分镜。",
    },
    dependsOn: [],
    skillSources: [
      {
        name: "product video production method",
        repository: "OpenCorvus authored",
        url: "https://github.com/yangheng95/opencorvus",
        license: "MIT",
        review: "authored_required",
        targetPath: "expert-squads/builtin/product-video/skills/method/SKILL.md",
      },
    ],
    status: "authored_required",
    recommended: false,
  },
] as const
