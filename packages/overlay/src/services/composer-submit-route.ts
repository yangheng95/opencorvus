export interface ComposerMissionDirectives {
  expertSquadIDs: readonly string[]
  missionSkillNames: readonly string[]
}

export type ComposerSubmitRoute = { kind: "conversation" } | { kind: "mission"; expertSquadIDs?: string[] }

export function resolveComposerSubmitRoute(directives: ComposerMissionDirectives): ComposerSubmitRoute {
  const expertSquadIDs = [...new Set(directives.expertSquadIDs.map((id) => id.trim()).filter(Boolean))]
  if (expertSquadIDs.length > 0) return { kind: "mission", expertSquadIDs }
  if (directives.missionSkillNames.length > 0) return { kind: "mission" }
  return { kind: "conversation" }
}
