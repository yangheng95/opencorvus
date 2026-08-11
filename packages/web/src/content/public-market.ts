import { generatedPublicMarketFacts } from "./public-market-facts.generated"

export type PublicLocale = "root" | "zh-cn"

export type LocalizedText = Record<PublicLocale, string>

export type PublicSquadRecord = {
  identity: {
    namespace: string
    id: string
    version: string
    digest: string
  }
  name: string
  label: string
  canonicalDescription: string
  canonicalSelectorSummary: string
  description: LocalizedText
  selectorSummary: LocalizedText
  pillars: readonly ("code" | "work")[]
  agents: readonly {
    id: string
    label: string
    description?: string
    baseRole: string
  }[]
  workflows: readonly {
    id: string
    label: string
    description: string
    nodes: readonly {
      id: string
      agentID: string
      description: string
      dependsOn: readonly string[]
    }[]
  }[]
  projectedCapabilities: {
    skills: number
    tools: number
    mcp: number
  }
  packageOwnedCapabilities: {
    skills: number
    tools: number
    mcp: number
  }
  configuration: {
    fields: number
    required: number
  }
}

const localizedCopyByIdentity: Record<string, { description: LocalizedText; selectorSummary: LocalizedText }> = {
  "builtin/frontend-replica": {
    description: {
      root: "Reproduce a source interface from a URL or reference screenshots, with a desktop surface ledger, rendered proof, and independent visual and integrity review.",
      "zh-cn": "依据来源网址或参考截图复刻桌面界面，并保留页面清单、真实渲染证据，以及独立的视觉与完整性审查。",
    },
    selectorSummary: {
      root: "Use for source-bound desktop interface parity.",
      "zh-cn": "用于必须忠实对齐明确来源的桌面界面复刻。",
    },
  },
  "builtin/frontend-innovate": {
    description: {
      root: "Turn a product brief into an original frontend direction, implementation, and rendered proof through a dedicated research, design, build, and review team.",
      "zh-cn": "把产品需求转化为原创前端方向、实现和真实渲染证据，由调查、设计、开发与审查角色完整协作。",
    },
    selectorSummary: {
      root: "Use for evidence-backed product redesign rather than source parity.",
      "zh-cn": "用于需要原创产品改版而不是复刻来源的任务。",
    },
  },
  "builtin/deep-research": {
    description: {
      root: "Investigate a broad or contested question through perspective mapping, source curation, grounded outlining, cited drafting, and independent citation review.",
      "zh-cn": "面向宽泛或有争议的问题，完成视角拆解、来源整理、证据大纲、带引文写作与独立引文审查。",
    },
    selectorSummary: {
      root: "Use when the answer requires discovering viewpoints before writing.",
      "zh-cn": "用于必须先发现不同视角、再形成完整报告的研究。",
    },
  },
  "builtin/equity-research": {
    description: {
      root: "Build a dated public-company evidence dossier, analyze fundamentals and valuation, reconcile a balanced thesis, and publish an audited investor-ready report.",
      "zh-cn": "围绕上市公司建立有日期边界的证据档案，完成基本面、估值、平衡投资论点与独立数值审查。",
    },
    selectorSummary: {
      root: "Use for source-backed public-equity analysis and valuation.",
      "zh-cn": "用于需要来源支撑的上市公司分析、估值与投资研究。",
    },
  },
  "builtin/review-debug": {
    description: {
      root: "Review an existing change or reproduce a concrete defect, prove the causal chain, repair the product source, and independently verify the result.",
      "zh-cn": "审查已有改动或复现明确缺陷，证明完整因果链，修复产品源码，并由独立角色复核结果。",
    },
    selectorSummary: {
      root: "Use when the repository, revision, and review target or defect evidence are concrete.",
      "zh-cn": "用于仓库、版本与审查目标或缺陷证据已经明确的任务。",
    },
  },
}

export const publicSquadRecords: PublicSquadRecord[] = generatedPublicMarketFacts.map((facts) => {
  const identity = `${facts.identity.namespace}/${facts.identity.id}`
  const localized = localizedCopyByIdentity[identity]
  const canonicalDescription = { root: facts.description, "zh-cn": facts.description }
  const canonicalSelectorSummary = { root: facts.selectorSummary, "zh-cn": facts.selectorSummary }
  return {
    identity: facts.identity,
    name: facts.name,
    label: facts.label,
    canonicalDescription: facts.description,
    canonicalSelectorSummary: facts.selectorSummary,
    description: localized?.description ?? canonicalDescription,
    selectorSummary: localized?.selectorSummary ?? canonicalSelectorSummary,
    pillars: facts.pillars,
    agents: facts.agents,
    workflows: facts.workflows,
    projectedCapabilities: facts.projectedCapabilities,
    packageOwnedCapabilities: facts.packageOwnedCapabilities,
    configuration: facts.configuration,
  }
})

export function publicPath(locale: PublicLocale, path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  const localePath = locale === "zh-cn" ? "/zh-cn" : ""
  return `${base}${localePath}${path || "/"}`
}

export function squadPath(locale: PublicLocale, record: PublicSquadRecord) {
  return publicPath(locale, `/market/${record.identity.namespace}/${record.identity.id}/`)
}
