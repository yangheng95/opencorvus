import type { Skill } from "./skill"

export type SkillSurfaceFamily = "production" | "mission"
export type SkillSurfaceToolID = "skill" | "mission_skill"

export type ResolvedSkillSurfaceRow = {
  name: string
  description: string
  location: string
  enabled: boolean
  reason?: string
  skill: Skill.Info
}

type ResolvedSkillSurfaceBase = {
  agent: string
  base_role: string
  scope: "project" | "session"
  tool_available: boolean
  unmounted_pool_count: number
  skills: ResolvedSkillSurfaceRow[]
}

export type ResolvedSkillSurface =
  | (ResolvedSkillSurfaceBase & {
      family: "production"
      tool_id: "skill"
    })
  | (ResolvedSkillSurfaceBase & {
      family: "mission"
      tool_id: "mission_skill"
    })
