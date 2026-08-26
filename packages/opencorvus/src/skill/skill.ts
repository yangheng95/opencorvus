import z from "zod"
import path from "path"
import os from "os"
import { createHash } from "node:crypto"
import { rm } from "node:fs/promises"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { NamedError } from "@opencorvus-ai/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { Discovery } from "./discovery"
import { Glob } from "../util/glob"
import { SkillRequiredTools } from "./required-tools"
import { SkillNameSchema } from "./name"
import { builtinSkillSources } from "./builtin-payload"
import type { BuiltinSkillFile } from "./builtin-source"
import { SkillPlatform } from "./platform"
import { MissionSkillRoots } from "@/mission-skill/roots"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  const builtinMaterializations = new Map<string, Promise<string>>()
  const bundleMaterializations = new Map<string, Promise<string>>()
  export const BundleFile = z.union([
    z.string(),
    z
      .object({
        encoding: z.enum(["utf8", "base64"]),
        content: z.string(),
      })
      .strict(),
  ])
  export type BundleFile = z.infer<typeof BundleFile>
  export const Bundle = z
    .object({
      key: z.string().regex(/^[a-f0-9]{64}$/),
      skill: z.string(),
      files: z.record(z.string(), BundleFile),
    })
    .strict()
  export type Bundle = z.infer<typeof Bundle>
  const ExpirationTimestamp = z
    .preprocess(
      (value) => {
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : value.toISOString()
        if (typeof value === "number" && Number.isFinite(value)) {
          const date = new Date(value)
          return Number.isNaN(date.getTime()) ? value : date.toISOString()
        }
        if (typeof value === "string") return value.trim()
        return value
      },
      z.string().refine((value) => !Number.isNaN(Date.parse(value)), "expires_at must be a valid timestamp"),
    )
    .optional()

  const DescriptiveMetadata = z.record(z.string(), z.string())

  function projectDescriptiveMetadata(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return input
    const definition = input as Record<string, unknown>
    const metadata = definition.metadata
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return input
    const entries = Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    const { metadata: _, ...rest } = definition
    return entries.length ? { ...rest, metadata: Object.fromEntries(entries) } : rest
  }

  export const Info = z.object({
    name: SkillNameSchema,
    description: z.string(),
    aliases: z.array(z.string().trim().min(1)).optional().default([]),
    license: z.string().optional(),
    compatibility: z.string().min(1).max(500).optional(),
    metadata: DescriptiveMetadata.optional(),
    platforms: z.array(SkillPlatform.Schema).optional().default([]),
    builtin: z.boolean().optional().default(false),
    location: z.string(),
    content: z.string(),
    bundle: Bundle.optional(),
    /** Auto-detect conditions — skill is loaded when any condition matches the project
     *  OR the active task. File / deps scan the Instance directory; task_signals are
     *  derived from the current task's request, attachments, and scripts. Any single
     *  matching condition (across all three buckets) is sufficient. */
    auto_detect: z
      .object({
        files: z.array(z.string()).optional(),
        deps: z.array(z.string()).optional(),
        task_signals: z
          .object({
            has_attachment_image: z
              .boolean()
              .optional()
              .describe("True when the task carries a reference image attachment."),
            request_contains_url: z
              .boolean()
              .optional()
              .describe("True when the task request text contains an HTTP(S) URL, independent of provider."),
            package_has_script: z
              .array(z.string())
              .optional()
              .describe("Any of the listed npm/bun scripts exists in the project's package.json."),
            request_text_any: z
              .array(z.string())
              .optional()
              .describe("Any listed case-insensitive substring must appear in the task request text."),
          })
          .optional(),
      })
      .optional(),
    /** Priority for ordering when multiple skills match (higher = first). */
    priority: z.number().optional().default(0),
    /** Descriptive tool hints for agents that load this skill. Empty or
     *  omitted = no tool hints. */
    required_tools: SkillRequiredTools,
    expires_at: ExpirationTimestamp,
  })
  export type Info = z.infer<typeof Info>
  export const Summary = Info.pick({
    name: true,
    description: true,
  }).strict()
  export type Summary = z.infer<typeof Summary>

  const DefinitionFields = Info.pick({
    name: true,
    description: true,
    aliases: true,
    license: true,
    compatibility: true,
    metadata: true,
    platforms: true,
    auto_detect: true,
    priority: true,
    required_tools: true,
    expires_at: true,
  }).strip()
  export const Definition = z.preprocess(projectDescriptiveMetadata, DefinitionFields)
  export type Definition = z.infer<typeof Definition>

  export const PackageDefinition = z.preprocess(
    projectDescriptiveMetadata,
    DefinitionFields.extend({
      description: z.string().trim().min(1),
    }).strip(),
  )
  export type PackageDefinition = z.infer<typeof PackageDefinition>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const Warning = z
    .object({
      kind: z.enum([
        "invalid_external_skill",
        "duplicate_external_skill",
        "external_skill_shadowed",
        "external_skill_scan_failed",
        "invalid_explicit_skill",
        "duplicate_explicit_skill",
        "explicit_skill_shadowed",
        "explicit_skill_scan_failed",
        "skill_source_failed",
      ]),
      path: z.string(),
      message: z.string(),
    })
    .strict()
  export type Warning = z.infer<typeof Warning>

  export function parseDefinition(data: unknown, source: string): Definition {
    const parsed = Definition.safeParse(data)
    if (parsed.success) return parsed.data
    throw new InvalidError(
      {
        path: source,
        message: parsed.error.message,
        issues: parsed.error.issues,
      },
      { cause: parsed.error },
    )
  }

  // External skill directories to search for (project-level and global)
  // These follow the directory layout used by Claude Code, Codex, OpenCorvus, and other agents.
  const EXTERNAL_DIRS = [".claude", ".agents", ".codex"]
  const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  const OPENCORVUS_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  const SKILL_PATTERN = "**/SKILL.md"
  export function isMissionSkillLocation(location: string, projectDirectory = Instance.current()?.directory) {
    const target = path.resolve(location)
    const roots = [MissionSkillRoots.global()]
    if (projectDirectory) roots.push(path.join(projectDirectory, ".opencorvus", "mission-skills"))
    return roots.some((root) => Filesystem.contains(path.resolve(root), target))
  }

  function builtinPath() {
    return path.join(Global.Path.cache, "builtin-skills")
  }

  function builtins() {
    return builtinSkillSources
  }

  function builtinSource(name: string) {
    return builtins().find((source) => source.name === name)
  }

  export function hasBuiltin(name: string) {
    return builtinSource(name) !== undefined
  }

  export function isExpired(info: Pick<Info, "expires_at">) {
    return info.expires_at !== undefined && Date.parse(info.expires_at) <= Date.now()
  }

  export function registerStrict(skills: Record<string, Info>, skill: Info) {
    const existing = skills[skill.name]
    if (existing?.location === skill.location) return
    if (existing) {
      throw new InvalidError({
        path: skill.location,
        message: `Skill name ${JSON.stringify(skill.name)} is defined by both ${existing.location} and ${skill.location}.`,
      })
    }
    skills[skill.name] = skill
  }

  function decodeBundleFile(file: BundleFile | BuiltinSkillFile) {
    if (typeof file === "string") return file
    if (file.encoding === "base64") return Buffer.from(file.content, "base64")
    return file.content
  }

  export function supportingFilePathSegments(value: string) {
    const segments = value.split("/")
    if (
      !value ||
      value !== value.trim() ||
      value.includes("\\") ||
      value.includes(":") ||
      path.isAbsolute(value) ||
      path.win32.isAbsolute(value) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new InvalidError({ path: value, message: `Unsafe Skill supporting-file path ${JSON.stringify(value)}.` })
    }
    if (value.toLowerCase() === "skill.md") {
      throw new InvalidError({ path: value, message: "Bundled supporting files cannot replace SKILL.md." })
    }
    return segments
  }

  function validateBundleFiles(files: Readonly<Record<string, BundleFile>>) {
    const fileKeys = new Set<string>()
    const directoryKeys = new Set<string>()
    for (const relativePath of Object.keys(files).sort()) {
      const segments = supportingFilePathSegments(relativePath)
      const fileKey = relativePath.toLowerCase()
      if (fileKeys.has(fileKey)) {
        throw new InvalidError({ path: relativePath, message: "Duplicate bundled Skill path after normalization." })
      }
      if (directoryKeys.has(fileKey)) {
        throw new InvalidError({ path: relativePath, message: "Bundled Skill file collides with a directory." })
      }
      for (let index = 1; index < segments.length; index++) {
        const directoryKey = segments.slice(0, index).join("/").toLowerCase()
        if (fileKeys.has(directoryKey)) {
          throw new InvalidError({ path: relativePath, message: "Bundled Skill directory collides with a file." })
        }
        directoryKeys.add(directoryKey)
      }
      fileKeys.add(fileKey)
    }
  }

  /** SHA-256 means Secure Hash Algorithm with a 256-bit digest. The digest is storage-only; Skill identity remains frontmatter-owned. */
  export function builtinCacheKey(name: string) {
    return createHash("sha256").update(SkillNameSchema.parse(name), "utf8").digest("hex")
  }

  export async function materializeBuiltinSource(input: {
    source: {
      name: string
      skill: string
      files: Readonly<Record<string, BuiltinSkillFile>>
    }
    cacheRoot: string
    label: string
  }) {
    const { source } = input
    const dir = path.join(input.cacheRoot, builtinCacheKey(source.name))
    const skillPath = path.join(dir, "SKILL.md")
    const parsedSource = ConfigMarkdown.parseText(source.skill, `${input.label} ${source.name}`)
    const definition = parseDefinition(parsedSource.data, `${input.label} ${source.name}`)
    if (definition.name !== source.name) {
      throw new InvalidError({
        path: `${input.label} ${source.name}`,
        message: `Built-in Skill descriptor identity ${JSON.stringify(source.name)} does not match frontmatter name ${JSON.stringify(definition.name)}.`,
      })
    }
    await rm(dir, { recursive: true, force: true })
    const next = ConfigMarkdown.stringify(parsedSource.content, parsedSource.data)
    await Filesystem.write(skillPath, next)
    await Promise.all(
      Object.entries(source.files).map(([file, content]) => {
        const target = path.join(dir, ...supportingFilePathSegments(file))
        if (!Filesystem.contains(dir, target)) {
          throw new InvalidError({ path: file, message: "Built-in Skill path escapes materialization root." })
        }
        return Filesystem.write(target, decodeBundleFile(content))
      }),
    )
    return skillPath
  }

  async function installBundle(info: Pick<Info, "name" | "bundle">) {
    const bundle = info.bundle
    if (!bundle) throw new InvalidError({ path: info.name, message: "Skill has no bundled directory snapshot." })
    validateBundleFiles(bundle.files)
    const parsed = ConfigMarkdown.parseText(bundle.skill, `bundled skill ${info.name}`)
    const definition = parseDefinition(parsed.data, `bundled skill ${info.name}`)
    if (definition.name !== info.name) {
      throw new InvalidError({
        path: `bundled skill ${info.name}`,
        message: `Bundled Skill identity ${JSON.stringify(definition.name)} does not match projected name ${JSON.stringify(info.name)}.`,
      })
    }
    const dir = path.join(Global.Path.cache, "projected-skills", bundle.key)
    await rm(dir, { recursive: true, force: true })
    await Filesystem.write(path.join(dir, "SKILL.md"), bundle.skill)
    for (const [relativePath, content] of Object.entries(bundle.files)) {
      const target = path.join(dir, ...supportingFilePathSegments(relativePath))
      if (!Filesystem.contains(dir, target)) {
        throw new InvalidError({ path: relativePath, message: "Bundled Skill path escapes materialization root." })
      }
      await Filesystem.write(target, decodeBundleFile(content))
    }
    return path.join(dir, "SKILL.md")
  }

  export async function materializeBuiltin(name: string) {
    const source = builtinSource(name)
    if (!source)
      throw new InvalidError({ path: `builtin:${name}`, message: `Unknown built-in Skill ${JSON.stringify(name)}.` })
    const current = builtinMaterializations.get(source.name)
    if (current) return current
    const materialized = materializeBuiltinSource({
      source,
      cacheRoot: builtinPath(),
      label: "builtin skill",
    })
    builtinMaterializations.set(source.name, materialized)
    try {
      return await materialized
    } catch (error) {
      if (builtinMaterializations.get(source.name) === materialized) builtinMaterializations.delete(source.name)
      throw error
    }
  }

  export async function refreshBuiltin(name: string) {
    if (!builtinSource(name)) {
      throw new InvalidError({ path: `builtin:${name}`, message: `Unknown built-in Skill ${JSON.stringify(name)}.` })
    }
    builtinMaterializations.delete(name)
    return materializeBuiltin(name)
  }

  export async function materialize(info: Info) {
    if (info.builtin) return materializeBuiltin(info.name)
    if (!info.bundle) {
      const directory = path.dirname(info.location)
      if (Filesystem.contains(path.resolve(Discovery.dir()), path.resolve(directory))) {
        await Discovery.requirePublishedSnapshot(directory, { skill: info.name })
      }
      return info.location
    }
    const current = bundleMaterializations.get(info.bundle.key)
    if (current) return current
    const materialized = installBundle(info)
    bundleMaterializations.set(info.bundle.key, materialized)
    try {
      return await materialized
    } catch (error) {
      if (bundleMaterializations.get(info.bundle.key) === materialized) bundleMaterializations.delete(info.bundle.key)
      throw error
    }
  }

  export function builtinRisk(name: string) {
    const source = builtinSource(name)
    if (!source)
      throw new InvalidError({ path: `builtin:${name}`, message: `Unknown built-in Skill ${JSON.stringify(name)}.` })
    const files = Object.keys(source.files)
    const under = (roots: readonly string[]) =>
      files.some((file) => roots.some((root) => file === root || file.startsWith(`${root}/`)))
    const hasScripts =
      under(["script", "scripts"]) ||
      files.some((file) =>
        [".bash", ".cjs", ".js", ".mjs", ".ps1", ".py", ".sh", ".ts"].includes(path.extname(file).toLowerCase()),
      )
    const hasAgents = under(["agent", "agents"])
    const hasReferences = under(["reference", "references"])
    const hasTemplates = under(["template", "templates", "asset", "assets"])
    return {
      level: hasScripts ? "high" : hasAgents || hasReferences ? "medium" : "low",
      has_scripts: hasScripts,
      has_agents: hasAgents,
      has_references: hasReferences,
      has_templates: hasTemplates,
    } as const
  }

  export function bundleRisk(bundle: Bundle) {
    const files = Object.keys(bundle.files)
    const under = (roots: readonly string[]) =>
      files.some((file) => roots.some((root) => file === root || file.startsWith(`${root}/`)))
    const hasScripts =
      under(["script", "scripts"]) ||
      files.some((file) =>
        [".bash", ".cjs", ".js", ".mjs", ".ps1", ".py", ".sh", ".ts"].includes(path.extname(file).toLowerCase()),
      )
    const hasAgents = under(["agent", "agents"])
    const hasReferences = under(["reference", "references"])
    const hasTemplates = under(["template", "templates", "asset", "assets"])
    return {
      level: hasScripts ? "high" : hasAgents || hasReferences ? "medium" : "low",
      has_scripts: hasScripts,
      has_agents: hasAgents,
      has_references: hasReferences,
      has_templates: hasTemplates,
    } as const
  }

  interface CatalogProjectScope {
    directory: string
    worktree: string
  }

  async function loadCatalogState(projectScope?: CatalogProjectScope) {
    const skills: Record<string, Info> = {}
    const dirs = new Set<string>()
    const warnings: Warning[] = []
    const externalLocations = new Map<string, string>()
    const quarantinedExternalLocations = new Map<string, string[]>()
    const explicitLocations = new Map<string, string>()
    const quarantinedExplicitLocations = new Map<string, string[]>()

    const warn = (warning: Warning) => {
      const parsed = Warning.parse(warning)
      warnings.push(parsed)
      log.warn("ignored automatically discovered Skill", parsed)
    }

    // Register immutable descriptor content without filesystem work. Supporting files materialize only on exact load.
    for (const raw of builtins()) {
      const md = ConfigMarkdown.parseText(raw.skill, `builtin skill ${raw.name}`)
      const parsed = parseDefinition(md.data, "builtin skill")
      if (parsed.name !== raw.name) {
        throw new InvalidError({
          path: `builtin:${raw.name}`,
          message: `Built-in Skill descriptor identity ${JSON.stringify(raw.name)} does not match frontmatter name ${JSON.stringify(parsed.name)}.`,
        })
      }
      if (isExpired(parsed)) continue
      registerStrict(skills, {
        name: parsed.name,
        description: parsed.description,
        aliases: [...parsed.aliases],
        license: parsed.license,
        compatibility: parsed.compatibility,
        metadata: parsed.metadata,
        platforms: parsed.platforms,
        builtin: true,
        location: `builtin:${parsed.name}`,
        content: md.content,
        auto_detect: parsed.auto_detect,
        priority: parsed.priority,
        required_tools: parsed.required_tools,
        expires_at: parsed.expires_at,
      })
    }

    const readSkill = async (match: string): Promise<Info | undefined> => {
      if (isMissionSkillLocation(match, projectScope?.directory)) return
      const md = await ConfigMarkdown.parse(match)
      const parsed = parseDefinition(md.data, match)
      if (isExpired(parsed)) return

      return {
        name: parsed.name,
        description: parsed.description,
        aliases: [...parsed.aliases],
        license: parsed.license,
        compatibility: parsed.compatibility,
        metadata: parsed.metadata,
        platforms: parsed.platforms,
        builtin: false,
        location: match,
        content: md.content,
        auto_detect: parsed.auto_detect,
        priority: parsed.priority,
        required_tools: parsed.required_tools,
        expires_at: parsed.expires_at,
      }
    }

    const addSkill = async (match: string) => {
      let skill: Info | undefined
      try {
        skill = await readSkill(match)
      } catch (error) {
        const invalidPath = InvalidError.isInstance(error) ? error.data.path : match
        const detail =
          InvalidError.isInstance(error) && error.data.message
            ? error.data.message
            : error instanceof Error
              ? error.message
              : String(error)
        warn({
          kind: "invalid_explicit_skill",
          path: invalidPath,
          message: `Explicit Skill at ${invalidPath} was ignored: ${detail}`,
        })
        return
      }
      if (!skill) return
      const externalLocation = externalLocations.get(skill.name)
      if (externalLocation) {
        delete skills[skill.name]
        externalLocations.delete(skill.name)
        if (externalLocation !== skill.location) {
          warn({
            kind: "external_skill_shadowed",
            path: externalLocation,
            message: `Automatically discovered Skill ${JSON.stringify(skill.name)} at ${externalLocation} was ignored because explicit Skill source ${skill.location} is authoritative.`,
          })
        }
      }
      const duplicateLocations = quarantinedExplicitLocations.get(skill.name)
      if (duplicateLocations) {
        duplicateLocations.push(skill.location)
        warn({
          kind: "duplicate_explicit_skill",
          path: skill.location,
          message: `Explicit Skill name ${JSON.stringify(skill.name)} is duplicated by ${duplicateLocations.join(" and ")}. Every explicit definition was ignored.`,
        })
        return
      }
      const existing = skills[skill.name]
      if (existing?.builtin) {
        warn({
          kind: "explicit_skill_shadowed",
          path: skill.location,
          message: `Explicit Skill ${JSON.stringify(skill.name)} at ${skill.location} was ignored because built-in Skill ${existing.location} is authoritative.`,
        })
        return
      }
      const previousLocation = explicitLocations.get(skill.name)
      if (previousLocation && previousLocation !== skill.location) {
        delete skills[skill.name]
        explicitLocations.delete(skill.name)
        const locations = [previousLocation, skill.location]
        quarantinedExplicitLocations.set(skill.name, locations)
        warn({
          kind: "duplicate_explicit_skill",
          path: skill.location,
          message: `Explicit Skill name ${JSON.stringify(skill.name)} is duplicated by ${locations.join(" and ")}. Every explicit definition was ignored.`,
        })
        return
      }
      registerStrict(skills, skill)
      explicitLocations.set(skill.name, skill.location)
    }

    const addExternalSkill = async (match: string) => {
      let skill: Info | undefined
      try {
        skill = await readSkill(match)
      } catch (error) {
        const invalidPath = Skill.InvalidError.isInstance(error) ? error.data.path : match
        const detail =
          Skill.InvalidError.isInstance(error) && error.data.message
            ? error.data.message
            : error instanceof Error
              ? error.message
              : String(error)
        warn({
          kind: "invalid_external_skill",
          path: invalidPath,
          message: `Automatically discovered Skill at ${invalidPath} was ignored: ${detail}`,
        })
        return
      }
      if (!skill) return

      const duplicateLocations = quarantinedExternalLocations.get(skill.name)
      if (duplicateLocations) {
        duplicateLocations.push(skill.location)
        warn({
          kind: "duplicate_external_skill",
          path: skill.location,
          message: `Automatically discovered Skill name ${JSON.stringify(skill.name)} is duplicated by ${duplicateLocations.join(" and ")}. Every automatic definition was ignored.`,
        })
        return
      }

      const previousLocation = externalLocations.get(skill.name)
      if (previousLocation) {
        if (previousLocation === skill.location) return
        delete skills[skill.name]
        externalLocations.delete(skill.name)
        const locations = [previousLocation, skill.location]
        quarantinedExternalLocations.set(skill.name, locations)
        warn({
          kind: "duplicate_external_skill",
          path: skill.location,
          message: `Automatically discovered Skill name ${JSON.stringify(skill.name)} is duplicated by ${locations.join(" and ")}. Every automatic definition was ignored.`,
        })
        return
      }

      const canonical = skills[skill.name]
      if (canonical) {
        warn({
          kind: "external_skill_shadowed",
          path: skill.location,
          message: `Automatically discovered Skill ${JSON.stringify(skill.name)} at ${skill.location} was ignored because canonical Skill ${canonical.location} is authoritative.`,
        })
        return
      }

      skills[skill.name] = skill
      externalLocations.set(skill.name, skill.location)
    }

    const scanExternal = async (root: string, scope: "global" | "project") => {
      let matches: string[]
      try {
        matches = await Glob.scan(EXTERNAL_SKILL_PATTERN, {
          cwd: root,
          absolute: true,
          include: "file",
          dot: true,
          symlink: true,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        warn({
          kind: "external_skill_scan_failed",
          path: root,
          message: `Automatic ${scope} Skill discovery at ${root} was ignored: ${detail}`,
        })
        return
      }
      for (const match of matches.sort()) await addExternalSkill(match)
    }

    // Scan compatibility directories owned by other agents. They are optional inputs:
    // invalid or ambiguous definitions remain warnings and never become catalog authority.
    if (!Flag.OPENCORVUS_DISABLE_EXTERNAL_SKILLS) {
      for (const dir of EXTERNAL_DIRS) {
        const root = path.join(Global.Path.home, dir)
        if (!(await Filesystem.isDir(root))) continue
        await scanExternal(root, "global")
      }

      if (projectScope) {
        for await (const root of Filesystem.up({
          targets: EXTERNAL_DIRS,
          start: projectScope.directory,
          stop: projectScope.worktree,
        })) {
          await scanExternal(root, "project")
        }
      }
    }

    // Scan .opencorvus/skill/ directories
    const configDirectories = projectScope
      ? await Config.directories()
      : [Global.Path.config, ...(Flag.OPENCORVUS_CONFIG_DIR ? [Flag.OPENCORVUS_CONFIG_DIR] : [])]
    for (const dir of configDirectories) {
      let matches: string[]
      try {
        matches = await Glob.scan(OPENCORVUS_SKILL_PATTERN, {
          cwd: dir,
          absolute: true,
          include: "file",
          symlink: true,
        })
      } catch (error) {
        warn({
          kind: "explicit_skill_scan_failed",
          path: dir,
          message: `Explicit OpenCorvus Skill discovery at ${dir} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
        continue
      }
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Scan additional skill paths from config
    const config = projectScope ? await Config.get() : await Config.getGlobal()
    for (const skillPath of config.skills?.paths ?? []) {
      const expanded = skillPath.startsWith("~/") ? path.join(os.homedir(), skillPath.slice(2)) : skillPath
      const resolved = path.isAbsolute(expanded)
        ? expanded
        : path.join(projectScope?.directory ?? Global.Path.config, expanded)
      if (!(await Filesystem.isDir(resolved))) {
        warn({
          kind: "explicit_skill_scan_failed",
          path: resolved,
          message: `Configured Skill path was ignored because it is not a directory: ${resolved}`,
        })
        continue
      }
      let matches: string[]
      try {
        matches = await Glob.scan(SKILL_PATTERN, {
          cwd: resolved,
          absolute: true,
          include: "file",
          dot: true,
          symlink: true,
        })
      } catch (error) {
        warn({
          kind: "explicit_skill_scan_failed",
          path: resolved,
          message: `Configured Skill discovery at ${resolved} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
        continue
      }
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Download and load skills from URLs
    for (const url of config.skills?.urls ?? []) {
      let list: string[]
      try {
        list = await Discovery.pull(url, (message) =>
          warn({
            kind: "skill_source_failed",
            path: url,
            message,
          }),
        )
      } catch (error) {
        warn({
          kind: "skill_source_failed",
          path: url,
          message: `Remote Skill source ${url} was ignored: ${error instanceof Error ? error.message : String(error)}`,
        })
        continue
      }
      for (const dir of list) {
        dirs.add(dir)
        let matches: string[]
        try {
          matches = await Glob.scan(SKILL_PATTERN, {
            cwd: dir,
            absolute: true,
            include: "file",
            dot: true,
            symlink: true,
          })
        } catch (error) {
          warn({
            kind: "explicit_skill_scan_failed",
            path: dir,
            message: `Remote Skill directory ${dir} was ignored: ${error instanceof Error ? error.message : String(error)}`,
          })
          continue
        }
        for (const match of matches) {
          await addSkill(match)
        }
      }
    }

    return {
      skills,
      dirs: Array.from(
        new Set([
          ...dirs,
          ...Object.values(skills)
            .filter((skill) => !skill.builtin)
            .map((skill) => path.dirname(skill.location)),
        ]),
      ),
      warnings,
    }
  }

  async function publicationRevision() {
    const { SkillManager } = await import("./manager")
    return SkillManager.prepareCatalogProjection()
  }

  async function withPublicationProjection<T>(project: (revision: string) => Promise<T>) {
    const { SkillManager } = await import("./manager")
    return SkillManager.withCatalogProjection(project)
  }

  export const state = createInstanceState(
    async () => {
      const revision = await publicationRevision()
      return {
        ...(await loadCatalogState({
          directory: Instance.directory,
          worktree: Instance.worktree,
        })),
        publicationRevision: revision,
      }
    },
    undefined,
    "skill",
  )

  async function catalogState() {
    return withPublicationProjection(async (revision) => {
      const current = await state()
      if (current.publicationRevision === revision) return current
      await state.reset()
      return state()
    })
  }

  export async function get(name: string) {
    return catalogState().then((x) => x.skills[name])
  }

  export async function all() {
    return catalogState().then((x) => Object.values(x.skills))
  }

  export async function globalSummaries(): Promise<{ skills: Summary[]; issues: Warning[] }> {
    return withPublicationProjection(async () => {
      const snapshot = await loadCatalogState()
      return {
        skills: Object.values(snapshot.skills)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((skill) =>
            Summary.parse({
              name: skill.name,
              description: skill.description,
            }),
          ),
        issues: snapshot.warnings,
      }
    })
  }

  export async function dirs() {
    return catalogState().then((x) => x.dirs)
  }

  export async function warnings() {
    return catalogState().then((x) => x.warnings)
  }
}
