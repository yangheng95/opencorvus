import path from "path"
import matter from "gray-matter"
import z from "zod"
import { ConfigMarkdown } from "@/config/markdown"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Skill } from "@/skill/skill"
import { Glob } from "@/util/glob"
import { Filesystem } from "@/util/filesystem"
import { builtinMissionSkillSources } from "./builtin-payload"
import { MissionSkillRoots } from "./roots"

export namespace MissionSkillCatalog {
  const PATTERN = "*/SKILL.md"
  const builtinMaterializations = new Map<string, Promise<string>>()

  export const Summary = z
    .object({
      name: z.string(),
      description: z.string(),
      required_tools: z.array(z.string()),
    })
    .strict()
  export type Summary = z.infer<typeof Summary>

  export const Issue = z
    .object({
      kind: z.enum([
        "invalid_mission_skill",
        "duplicate_mission_skill",
        "mission_skill_shadowed",
        "mission_skill_scan_failed",
      ]),
      source: z.enum(["built_in", "global", "project"]),
      path: z.string(),
      message: z.string(),
    })
    .strict()
  export type Issue = z.infer<typeof Issue>

  export const Response = z
    .object({
      mission_skills: z.array(Summary),
      issues: z.array(Issue),
    })
    .strict()
  export type Response = z.infer<typeof Response>

  export const SettingsSource = z.enum(["built_in", "global", "project"])
  export type SettingsSource = z.infer<typeof SettingsSource>

  export const SettingsItem = Summary.extend({
    source: SettingsSource,
    location: z.string().nullable(),
  }).strict()
  export type SettingsItem = z.infer<typeof SettingsItem>

  export const SettingsResponse = z
    .object({
      roots: z
        .object({
          global: z.string(),
          project: z.string(),
        })
        .strict(),
      mission_skills: z.array(SettingsItem),
      issues: z.array(Issue),
    })
    .strict()
  export type SettingsResponse = z.infer<typeof SettingsResponse>

  export const DirectoryRequest = z
    .object({
      source: z.enum(["global", "project"]),
    })
    .strict()
  export type DirectoryRequest = z.infer<typeof DirectoryRequest>

  export const DirectoryResponse = z
    .object({
      path: z.string(),
    })
    .strict()
  export type DirectoryResponse = z.infer<typeof DirectoryResponse>

  function builtinSource(name: string) {
    return builtinMissionSkillSources.find((source) => source.name === name)
  }

  function infoFromDefinition(input: {
    definition: Skill.Definition
    content: string
    location: string
    builtin: boolean
  }): Skill.Info {
    return {
      name: input.definition.name,
      description: input.definition.description,
      aliases: [...input.definition.aliases],
      license: input.definition.license,
      compatibility: input.definition.compatibility,
      metadata: input.definition.metadata,
      platforms: input.definition.platforms,
      builtin: input.builtin,
      location: input.location,
      content: input.content,
      auto_detect: input.definition.auto_detect,
      priority: input.definition.priority,
      required_tools: input.definition.required_tools,
      expires_at: input.definition.expires_at,
    }
  }

  async function loadCatalogState(projectRoot?: string) {
    const skills: Record<string, Skill.Info> = {}
    const sources: Record<string, SettingsSource> = {}
    const issues: Issue[] = []
    const externalLocations = new Map<string, string>()
    const quarantinedLocations = new Map<string, string[]>()

    const issue = (value: Issue) => {
      issues.push(Issue.parse(value))
    }

    for (const raw of builtinMissionSkillSources) {
      try {
        const markdown = matter(raw.skill)
        const definition = Skill.parseDefinition(markdown.data, `builtin mission skill ${raw.name}`)
        if (definition.name !== raw.name) {
          throw new Skill.InvalidError({
            path: `builtin mission skill ${raw.name}`,
            message: `Built-in Mission Skill identity ${JSON.stringify(raw.name)} does not match frontmatter name ${JSON.stringify(definition.name)}.`,
          })
        }
        if (Skill.isExpired(definition)) continue
        Skill.registerStrict(
          skills,
          infoFromDefinition({
            definition,
            content: markdown.content,
            location: `mission-builtin:${definition.name}`,
            builtin: true,
          }),
        )
        sources[definition.name] = "built_in"
      } catch (error) {
        issue({
          kind: "invalid_mission_skill",
          source: "built_in",
          path: `mission-builtin:${raw.name}`,
          message: `Built-in Mission Skill ${JSON.stringify(raw.name)} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    }

    const addSkill = async (match: string, source: MissionSkillRoots.Source) => {
      let markdown: Awaited<ReturnType<typeof ConfigMarkdown.parse>>
      let definition: Skill.Definition
      try {
        markdown = await ConfigMarkdown.parse(match)
        definition = Skill.parseDefinition(markdown.data, match)
      } catch (error) {
        issue({
          kind: "invalid_mission_skill",
          source,
          path: match,
          message: `Mission Skill at ${match} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
        return
      }
      if (Skill.isExpired(definition)) return
      const existing = skills[definition.name]
      if (existing?.builtin) {
        issue({
          kind: "mission_skill_shadowed",
          source,
          path: match,
          message: `Mission Skill ${JSON.stringify(definition.name)} at ${match} was ignored because built-in Mission Skill ${existing.location} is authoritative.`,
        })
        return
      }
      const quarantined = quarantinedLocations.get(definition.name)
      if (quarantined) {
        quarantined.push(match)
        issue({
          kind: "duplicate_mission_skill",
          source,
          path: match,
          message: `Mission Skill name ${JSON.stringify(definition.name)} is duplicated by ${quarantined.join(" and ")}. Every external definition was ignored.`,
        })
        return
      }
      const previous = externalLocations.get(definition.name)
      if (previous && previous !== match) {
        delete skills[definition.name]
        delete sources[definition.name]
        externalLocations.delete(definition.name)
        const locations = [previous, match]
        quarantinedLocations.set(definition.name, locations)
        issue({
          kind: "duplicate_mission_skill",
          source,
          path: match,
          message: `Mission Skill name ${JSON.stringify(definition.name)} is duplicated by ${locations.join(" and ")}. Every external definition was ignored.`,
        })
        return
      }
      Skill.registerStrict(
        skills,
        infoFromDefinition({
          definition,
          content: markdown.content,
          location: match,
          builtin: false,
        }),
      )
      externalLocations.set(definition.name, match)
      sources[definition.name] = source
    }

    const scan = async (root: string, source: MissionSkillRoots.Source) => {
      if (!(await Filesystem.isDir(root))) return
      let matches: string[]
      try {
        matches = await Glob.scan(PATTERN, {
          cwd: root,
          absolute: true,
          include: "file",
          dot: true,
          symlink: true,
        })
      } catch (error) {
        issue({
          kind: "mission_skill_scan_failed",
          source,
          path: root,
          message: `Mission Skill discovery at ${root} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
        return
      }
      for (const match of matches.sort()) await addSkill(match, source)
    }

    const globalRoot = path.resolve(MissionSkillRoots.global())
    const resolvedProjectRoot = projectRoot ? path.resolve(projectRoot) : undefined
    if (resolvedProjectRoot && Filesystem.overlaps(globalRoot, resolvedProjectRoot)) {
      issue({
        kind: "mission_skill_scan_failed",
        source: "project",
        path: resolvedProjectRoot,
        message: `Canonical Mission Skill roots overlap; external Mission Skills were ignored: global=${JSON.stringify(globalRoot)}, project=${JSON.stringify(resolvedProjectRoot)}`,
      })
    } else {
      await scan(globalRoot, "global")
      if (resolvedProjectRoot) await scan(resolvedProjectRoot, "project")
    }

    return { skills, sources, issues }
  }

  export const state = createInstanceState(
    () => loadCatalogState(MissionSkillRoots.project()),
    undefined,
    "mission-skill",
  )

  export async function all(options?: { refresh?: boolean }) {
    if (options?.refresh) await state.reset()
    return state().then((value) =>
      Object.values(value.skills).sort((left, right) => left.name.localeCompare(right.name)),
    )
  }

  export async function get(name: string) {
    return state().then((value) => value.skills[name])
  }

  export async function issues() {
    return state().then((value) => value.issues)
  }

  export async function summaries(options?: { refresh?: boolean }): Promise<Response> {
    const skills = await all(options)
    return {
      mission_skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        required_tools: [...skill.required_tools],
      })),
      issues: await issues(),
    }
  }

  export async function globalSummaries(): Promise<Response> {
    const snapshot = await loadCatalogState()
    const skills = Object.values(snapshot.skills).sort((left, right) => left.name.localeCompare(right.name))
    return {
      mission_skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        required_tools: [...skill.required_tools],
      })),
      issues: snapshot.issues,
    }
  }

  export async function settings(options?: { refresh?: boolean }): Promise<SettingsResponse> {
    if (options?.refresh) await state.reset()
    const snapshot = await state()
    const skills = Object.values(snapshot.skills).sort((left, right) => left.name.localeCompare(right.name))
    return {
      roots: {
        global: MissionSkillRoots.global(),
        project: MissionSkillRoots.project(),
      },
      mission_skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        required_tools: [...skill.required_tools],
        source: snapshot.sources[skill.name] ?? "built_in",
        location: skill.builtin ? null : skill.location,
      })),
      issues: snapshot.issues,
    }
  }

  export async function materialize(info: Skill.Info) {
    if (!info.builtin) return info.location
    const source = builtinSource(info.name)
    if (!source) {
      throw new Skill.InvalidError({
        path: info.location,
        message: `Unknown built-in Mission Skill ${JSON.stringify(info.name)}.`,
      })
    }
    const current = builtinMaterializations.get(source.name)
    if (current) return current
    const materialized = Skill.materializeBuiltinSource({
      source,
      cacheRoot: path.join(Global.Path.cache, "builtin-mission-skills"),
      label: "builtin mission skill",
    })
    builtinMaterializations.set(source.name, materialized)
    try {
      return await materialized
    } catch (error) {
      if (builtinMaterializations.get(source.name) === materialized) builtinMaterializations.delete(source.name)
      throw error
    }
  }
}
