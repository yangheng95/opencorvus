import type {
  ExpertSquadCatalog,
  ExpertSquadCatalogPage,
  ExpertSquadInspection,
  ExpertSquadOption,
} from "./expert-squad"
import type { ChatCapabilitySettings, MissionSkillCatalogResponse } from "@opencorvus-ai/sdk"
import type { GlobalComposerReferencesResponse } from "./global-composer-references"

export interface ComposerExpertSquadPackage {
  readonly name: string
  readonly revision: ExpertSquadCatalog["active"]["package_revision"]
}

interface ComposerSkillOption {
  name: string
  description?: string
}

export interface ComposerReferenceCatalogProblem {
  source:
    | "load"
    | "expert-squads"
    | "squad-page"
    | "active-inspection"
    | "skills"
    | "mission-skills"
    | "chat-skills"
    | "squad-search"
  kind: "request-failed" | "catalog-issue"
  message: string
}

export interface ComposerExpertSquadCatalogSnapshot {
  requestKey: string
  squads: ExpertSquadOption[]
  skills: ComposerSkillOption[]
  chatSkills: ComposerSkillOption[]
  missionSkills: ComposerSkillOption[]
  activeID: string
  activePackage: ComposerExpertSquadPackage | null
  problems: readonly ComposerReferenceCatalogProblem[]
}

const EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG: ComposerExpertSquadCatalogSnapshot = {
  requestKey: "",
  squads: [],
  skills: [],
  chatSkills: [],
  missionSkills: [],
  activeID: "",
  activePackage: null,
  problems: [],
}

function requestProblem(
  source: ComposerReferenceCatalogProblem["source"],
  reason: unknown,
): ComposerReferenceCatalogProblem {
  return { source, kind: "request-failed", message: reason instanceof Error ? reason.message : String(reason) }
}

export function composerReferenceCatalogError(snapshot: ComposerExpertSquadCatalogSnapshot): string {
  const labels: Record<ComposerReferenceCatalogProblem["source"], string> = {
    load: "reference catalog",
    "expert-squads": "expert squads",
    "squad-page": "expert squad page",
    "active-inspection": "active expert squad",
    skills: "skills",
    "mission-skills": "mission skills",
    "chat-skills": "chat skills",
    "squad-search": "expert squad search",
  }
  return snapshot.problems.map((problem) => `${labels[problem.source]}: ${problem.message}`).join("; ")
}

function activeCatalogFacts(catalog: ExpertSquadCatalog) {
  const uniqueSkills = new Map<string, ComposerSkillOption>()
  for (const grant of catalog.active_skill_projection.production_grants) {
    if (uniqueSkills.has(grant.skill.name)) continue
    uniqueSkills.set(grant.skill.name, { name: grant.skill.name, description: grant.skill.description })
  }
  return {
    activeID: catalog.active.effective.trim(),
    activePackage: { name: catalog.active.name, revision: { ...catalog.active.package_revision } },
    skills: [...uniqueSkills.values()],
  }
}

export function createComposerExpertSquadCatalogSnapshot(
  requestKey: string,
  catalog: ExpertSquadCatalog,
  squadPage: ExpertSquadCatalogPage,
  missionSkillCatalog: MissionSkillCatalogResponse,
  chatCapability: ChatCapabilitySettings,
  activeInspection?: ExpertSquadInspection,
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("composer expert-squad catalog requires a request key")
  const facts = activeCatalogFacts(catalog)
  return {
    requestKey: key,
    squads: mergeComposerExpertSquadOptions(squadPage.entries, activeInspection ? [activeInspection] : [], [
      facts.activeID,
    ]),
    ...facts,
    chatSkills: chatCapability.skills.installed.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    missionSkills: missionSkillCatalog.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    problems: missionSkillCatalog.issues.map((issue) => ({
      source: "mission-skills",
      kind: "catalog-issue",
      message: issue.message,
    })),
  }
}

export function createComposerReferenceCatalogSnapshotFromSettled(
  requestKey: string,
  previous: ComposerExpertSquadCatalogSnapshot,
  results: {
    catalog: PromiseSettledResult<ExpertSquadCatalog>
    squads: PromiseSettledResult<ExpertSquadCatalogPage>
    missionSkills: PromiseSettledResult<MissionSkillCatalogResponse>
    chatCapability: PromiseSettledResult<ChatCapabilitySettings>
    activeInspection: PromiseSettledResult<ExpertSquadInspection>
  },
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("composer reference catalog requires a request key")
  const current = previous.requestKey === key ? previous : { ...EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG, requestKey: key }
  const problems: ComposerReferenceCatalogProblem[] = []
  let squads = current.squads
  let skills = current.skills
  let activeID = current.activeID
  let activePackage: ComposerExpertSquadPackage | null = null
  let missionSkills = current.missionSkills
  let chatSkills = current.chatSkills

  if (results.catalog.status === "fulfilled") {
    try {
      const catalog = results.catalog.value
      const facts = activeCatalogFacts(catalog)
      activePackage = facts.activePackage
      skills = facts.skills
      activeID = facts.activeID
      squads = mergeComposerExpertSquadOptions(
        results.squads.status === "fulfilled" ? results.squads.value.entries : [],
        results.activeInspection.status === "fulfilled" ? [results.activeInspection.value] : [],
        [activeID],
      )
    } catch (error) {
      squads = []
      skills = []
      activeID = ""
      activePackage = null
      problems.push(requestProblem("expert-squads", error))
    }
  } else {
    squads = []
    skills = []
    activeID = ""
    activePackage = null
    problems.push(requestProblem("expert-squads", results.catalog.reason))
  }
  if (results.squads.status === "rejected") problems.push(requestProblem("squad-page", results.squads.reason))
  if (results.catalog.status === "fulfilled" && results.activeInspection.status === "rejected") {
    problems.push(requestProblem("active-inspection", results.activeInspection.reason))
  }

  if (results.missionSkills.status === "fulfilled") {
    missionSkills = results.missionSkills.value.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    }))
    problems.push(
      ...results.missionSkills.value.issues.map(
        (issue): ComposerReferenceCatalogProblem => ({
          source: "mission-skills",
          kind: "catalog-issue",
          message: issue.message,
        }),
      ),
    )
  } else {
    missionSkills = []
    problems.push(requestProblem("mission-skills", results.missionSkills.reason))
  }

  if (results.chatCapability.status === "fulfilled") {
    chatSkills = results.chatCapability.value.skills.installed.map((skill) => ({
      name: skill.name,
      description: skill.description,
    }))
  } else {
    chatSkills = []
    problems.push(requestProblem("chat-skills", results.chatCapability.reason))
  }

  return {
    requestKey: key,
    squads,
    skills,
    chatSkills,
    missionSkills,
    activeID,
    activePackage,
    problems,
  }
}

export function updateComposerExpertSquadSearch(
  snapshot: ComposerExpertSquadCatalogSnapshot,
  requestKey: string,
  result: PromiseSettledResult<ExpertSquadCatalogPage>,
  selectedExpertSquadIDs: readonly string[] = [],
): ComposerExpertSquadCatalogSnapshot {
  if (snapshot.requestKey !== requestKey) return snapshot
  const problems = snapshot.problems.filter((problem) => problem.source !== "squad-search")
  if (result.status === "rejected") {
    return { ...snapshot, problems: [...problems, requestProblem("squad-search", result.reason)] }
  }
  return {
    ...snapshot,
    squads: mergeComposerExpertSquadOptions(result.value.entries, snapshot.squads, [
      snapshot.activeID,
      ...selectedExpertSquadIDs,
    ]),
    problems,
  }
}

export function mergeComposerExpertSquadOptions(
  page: readonly ExpertSquadOption[],
  current: readonly ExpertSquadOption[],
  preservedIDs: readonly string[],
): ExpertSquadOption[] {
  const preserved = new Set(preservedIDs.map((id) => id.trim()).filter(Boolean))
  const merged = new Map(page.map((entry) => [entry.id, entry]))
  for (const entry of current) {
    if (preserved.has(entry.id) && !merged.has(entry.id)) merged.set(entry.id, entry)
  }
  return [...merged.values()]
}

export function createGlobalComposerReferenceCatalogSnapshot(
  requestKey: string,
  catalog: GlobalComposerReferencesResponse,
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("global composer reference catalog requires a request key")
  const skills = catalog.skills.skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
  }))
  return {
    requestKey: key,
    squads: catalog.expert_squads.page.entries,
    skills,
    chatSkills: skills,
    missionSkills: catalog.mission_skills.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    activeID: "",
    activePackage: null,
    problems: [
      ...catalog.skills.issues.map(
        (issue): ComposerReferenceCatalogProblem => ({
          source: "skills",
          kind: "catalog-issue",
          message: issue.message,
        }),
      ),
      ...catalog.mission_skills.issues.map(
        (issue): ComposerReferenceCatalogProblem => ({
          source: "mission-skills",
          kind: "catalog-issue",
          message: issue.message,
        }),
      ),
    ],
  }
}

export function failedComposerReferenceCatalogSnapshot(
  requestKey: string,
  error: string,
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("composer reference catalog failure requires a request key")
  return {
    requestKey: key,
    squads: [],
    skills: [],
    chatSkills: [],
    missionSkills: [],
    activeID: "",
    activePackage: null,
    problems: [requestProblem("load", error.trim() || "Composer reference catalog unavailable")],
  }
}

export function composerExpertSquadCatalogForRequest(
  snapshot: ComposerExpertSquadCatalogSnapshot,
  requestKey: string,
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  return key && snapshot.requestKey === key ? snapshot : EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG
}

export function selectComposerExpertSquad(
  snapshot: ComposerExpertSquadCatalogSnapshot,
  requestKey: string,
  expertSquadID: string,
): ComposerExpertSquadCatalogSnapshot {
  const current = composerExpertSquadCatalogForRequest(snapshot, requestKey)
  const id = expertSquadID.trim()
  if (!id || !current.squads.some((squad) => squad.id === id)) return current
  return current.activeID === id ? current : { ...current, activeID: id }
}

export function emptyComposerExpertSquadCatalog(): ComposerExpertSquadCatalogSnapshot {
  return EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG
}
