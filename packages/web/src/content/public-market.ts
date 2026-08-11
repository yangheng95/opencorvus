import { publicMarketZhTranslations01To35 } from "./public-market-zh-01-35"
import { publicMarketZhTranslations36To67 } from "./public-market-zh-36-67"
import { publicMarketZhTranslations68To99 } from "./public-market-zh-68-99"
import { publicMarketZhTranslationsTenthBatch } from "./public-market-zh-tenth-batch"
import type { PublicSquadZhTranslationMap } from "./public-market-zh-types"
import type { ExpertSquadFacts } from "../lib/expert-squad-facts"
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
  displayLabel: LocalizedText
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
    displayLabel: LocalizedText
    localizedDescription: Record<PublicLocale, string | undefined>
  }[]
  workflows: readonly {
    id: string
    label: string
    description: string
    displayLabel: LocalizedText
    localizedDescription: LocalizedText
    nodes: readonly {
      id: string
      agentID: string
      description: string
      dependsOn: readonly string[]
      localizedDescription: LocalizedText
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

const publicMarketZhTranslations: PublicSquadZhTranslationMap = {
  ...publicMarketZhTranslations01To35,
  ...publicMarketZhTranslations36To67,
  ...publicMarketZhTranslations68To99,
  ...publicMarketZhTranslationsTenthBatch,
}

function assertExactKeys(context: string, expected: readonly string[], actual: readonly string[]) {
  const expectedKeys = [...expected].sort()
  const actualKeys = [...actual].sort()
  if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) {
    throw new Error(
      `[public-market] ${context} translation keys differ: expected ${expectedKeys.join(", ")}; received ${actualKeys.join(", ")}`,
    )
  }
}

function requireText(context: string, value: string | undefined) {
  if (!value?.trim()) throw new Error(`[public-market] ${context} translation is empty`)
  return value
}

function requireChineseText(context: string, value: string | undefined) {
  const text = requireText(context, value)
  if (!/\p{Script=Han}/u.test(text)) throw new Error(`[public-market] ${context} translation contains no Chinese text`)
  return text
}

export type PublicSquadFactInput = ExpertSquadFacts

export function projectPublicSquadRecord(facts: PublicSquadFactInput): PublicSquadRecord {
  const identity = `${facts.identity.namespace}/${facts.identity.id}`
  const localized = publicMarketZhTranslations[identity]
  if (!localized) throw new Error(`[public-market] ${identity} has no complete Chinese translation`)
  assertExactKeys(
    `${identity} Agents`,
    facts.agents.map((agent) => agent.id),
    Object.keys(localized.agents),
  )
  assertExactKeys(
    `${identity} workflows`,
    facts.workflows.map((workflow) => workflow.id),
    Object.keys(localized.workflows),
  )
  const agents = facts.agents.map((agent) => {
    const translatedAgent = localized.agents[agent.id]!
    if (agent.description) requireChineseText(`${identity} Agent ${agent.id} description`, translatedAgent.description)
    return {
      ...agent,
      displayLabel: {
        root: agent.label,
        "zh-cn": requireText(`${identity} Agent ${agent.id} label`, translatedAgent.label),
      },
      localizedDescription: {
        root: agent.description,
        "zh-cn": agent.description
          ? requireChineseText(`${identity} Agent ${agent.id} description`, translatedAgent.description)
          : undefined,
      },
    }
  })
  const workflows = facts.workflows.map((workflow) => {
    const translatedWorkflow = localized.workflows[workflow.id]!
    assertExactKeys(
      `${identity} workflow ${workflow.id} nodes`,
      workflow.nodes.map((node) => node.id),
      Object.keys(translatedWorkflow.nodes),
    )
    return {
      ...workflow,
      displayLabel: {
        root: workflow.label,
        "zh-cn": requireText(`${identity} workflow ${workflow.id} label`, translatedWorkflow.label),
      },
      localizedDescription: {
        root: workflow.description,
        "zh-cn": requireChineseText(`${identity} workflow ${workflow.id} description`, translatedWorkflow.description),
      },
      nodes: workflow.nodes.map((node) => ({
        ...node,
        localizedDescription: {
          root: node.description,
          "zh-cn": requireChineseText(
            `${identity} workflow ${workflow.id} node ${node.id} description`,
            translatedWorkflow.nodes[node.id],
          ),
        },
      })),
    }
  })
  return {
    identity: facts.identity,
    name: facts.name,
    label: facts.label,
    displayLabel: { root: facts.label, "zh-cn": requireText(`${identity} label`, localized.label) },
    canonicalDescription: facts.description,
    canonicalSelectorSummary: facts.selectorSummary,
    description: {
      root: facts.description,
      "zh-cn": requireChineseText(`${identity} description`, localized.description),
    },
    selectorSummary: {
      root: facts.selectorSummary,
      "zh-cn": requireChineseText(`${identity} selector summary`, localized.selectorSummary),
    },
    pillars: facts.pillars,
    agents,
    workflows,
    projectedCapabilities: facts.projectedCapabilities,
    packageOwnedCapabilities: facts.packageOwnedCapabilities,
    configuration: facts.configuration,
  }
}

export function publicPath(locale: PublicLocale, path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  const localePath = locale === "zh-cn" ? "/zh-cn" : ""
  return `${base}${localePath}${path || "/"}`
}

export function squadPath(locale: PublicLocale, record: PublicSquadRecord) {
  return publicPath(locale, `/market/${record.identity.namespace}/${record.identity.id}/`)
}

export type PublicMarketTextSegment = {
  text: string
  lang?: "en"
}

export function segmentPublicMarketText(locale: PublicLocale, value: string): PublicMarketTextSegment[] {
  if (locale !== "zh-cn") return [{ text: value }]

  const segments: PublicMarketTextSegment[] = []
  const englishRun = /[A-Za-z][A-Za-z0-9]*(?:[ +./_-][A-Za-z0-9]+)*/g
  let cursor = 0
  for (const match of value.matchAll(englishRun)) {
    const index = match.index
    if (index > cursor) segments.push({ text: value.slice(cursor, index) })
    segments.push({ text: match[0], lang: "en" })
    cursor = index + match[0].length
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor) })
  return segments
}
