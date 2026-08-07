import type { ExpertSquadCatalog, ExpertSquadOption } from "./expert-squad"
import type { ChatCapabilitySettings, MissionSkillCatalogResponse } from "@opencorvus-ai/sdk"
import type { GlobalComposerReferencesResponse } from "./global-composer-references"

interface ComposerSkillOption {
  name: string
  description?: string
}

export interface ComposerExpertSquadCatalogSnapshot {
  requestKey: string
  squads: ExpertSquadOption[]
  skills: ComposerSkillOption[]
  chatSkills: ComposerSkillOption[]
  missionSkills: ComposerSkillOption[]
  activeID: string
  error: string
}

const EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG: ComposerExpertSquadCatalogSnapshot = {
  requestKey: "",
  squads: [],
  skills: [],
  chatSkills: [],
  missionSkills: [],
  activeID: "",
  error: "",
}

export function createComposerExpertSquadCatalogSnapshot(
  requestKey: string,
  catalog: ExpertSquadCatalog,
  missionSkillCatalog: MissionSkillCatalogResponse,
  chatCapability: ChatCapabilitySettings,
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("composer expert-squad catalog requires a request key")
  const activeID = catalog.active.effective.trim()
  if (!catalog.squads.some((squad) => squad.id === activeID)) {
    throw new Error(`active expert squad is absent from catalog: ${activeID}`)
  }
  const uniqueSkills = new Map<string, ComposerSkillOption>()
  for (const grant of catalog.active_skill_projection.production_grants) {
    if (uniqueSkills.has(grant.skill.name)) continue
    uniqueSkills.set(grant.skill.name, {
      name: grant.skill.name,
      description: grant.skill.description,
    })
  }
  return {
    requestKey: key,
    squads: catalog.squads,
    skills: [...uniqueSkills.values()],
    chatSkills: chatCapability.skills.installed.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    missionSkills: missionSkillCatalog.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    activeID,
    error: "",
  }
}

export function createComposerReferenceCatalogSnapshotFromSettled(
  requestKey: string,
  previous: ComposerExpertSquadCatalogSnapshot,
  results: {
    catalog: PromiseSettledResult<ExpertSquadCatalog>
    missionSkills: PromiseSettledResult<MissionSkillCatalogResponse>
    chatCapability: PromiseSettledResult<ChatCapabilitySettings>
  },
): ComposerExpertSquadCatalogSnapshot {
  const key = requestKey.trim()
  if (!key) throw new Error("composer reference catalog requires a request key")
  const current = previous.requestKey === key ? previous : { ...EMPTY_COMPOSER_EXPERT_SQUAD_CATALOG, requestKey: key }
  const errors: string[] = []
  let squads = current.squads
  let skills = current.skills
  let activeID = current.activeID
  let missionSkills = current.missionSkills
  let chatSkills = current.chatSkills

  if (results.catalog.status === "fulfilled") {
    try {
      const catalog = results.catalog.value
      const projected = createComposerExpertSquadCatalogSnapshot(key, catalog, { mission_skills: [], issues: [] }, {
        skills: { assigned_refs: [], installed: [] },
      } as ChatCapabilitySettings)
      squads = projected.squads
      skills = projected.skills
      activeID = projected.activeID
    } catch (error) {
      squads = []
      skills = []
      activeID = ""
      errors.push(`expert squads: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    squads = []
    skills = []
    activeID = ""
    errors.push(
      `expert squads: ${
        results.catalog.reason instanceof Error ? results.catalog.reason.message : String(results.catalog.reason)
      }`,
    )
  }

  if (results.missionSkills.status === "fulfilled") {
    missionSkills = results.missionSkills.value.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    }))
  } else {
    missionSkills = []
    errors.push(
      `mission skills: ${
        results.missionSkills.reason instanceof Error
          ? results.missionSkills.reason.message
          : String(results.missionSkills.reason)
      }`,
    )
  }

  if (results.chatCapability.status === "fulfilled") {
    chatSkills = results.chatCapability.value.skills.installed.map((skill) => ({
      name: skill.name,
      description: skill.description,
    }))
  } else {
    chatSkills = []
    errors.push(
      `chat skills: ${
        results.chatCapability.reason instanceof Error
          ? results.chatCapability.reason.message
          : String(results.chatCapability.reason)
      }`,
    )
  }

  return {
    requestKey: key,
    squads,
    skills,
    chatSkills,
    missionSkills,
    activeID,
    error: errors.join("; "),
  }
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
    squads: catalog.expert_squads.squads,
    skills,
    chatSkills: skills,
    missionSkills: catalog.mission_skills.mission_skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    activeID: "",
    error: [...catalog.skills.issues, ...catalog.expert_squads.issues, ...catalog.mission_skills.issues]
      .map((issue) => issue.message)
      .join("; "),
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
    error: error.trim() || "Composer reference catalog unavailable",
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
