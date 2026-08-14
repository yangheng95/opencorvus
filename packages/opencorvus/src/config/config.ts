import { Log } from "../util/log"
import path from "path"
import { pathToFileURL } from "url"
import os from "os"
import z from "zod"
import { ModelsDev } from "../provider/models"
import { mergeDeep, pipe, unique } from "remeda"
import { Global } from "../global"
import fs from "fs/promises"
import { lazy } from "../util/lazy"
import { NamedError } from "@opencorvus-ai/util/error"
import { Flag } from "../flag/flag"
import { Auth } from "../auth"
import { parseEnvJson } from "./parse-env-json"
import {
  type ParseError as JsoncParseError,
  applyEdits,
  modify,
  parse as parseJsonc,
  printParseErrorCode,
} from "jsonc-parser"
import { createInstanceState } from "../project/instance-state"
import { ProjectInstanceContext } from "../project/instance-context"
import { LSP_BUILTIN_SERVER_IDS } from "../lsp/catalog"
import { BunProc } from "@/bun"
import { Installation } from "@/installation"
import { ConfigMarkdown } from "./markdown"
import { constants, existsSync } from "fs"
import { GlobalBus } from "@/bus/global"
import { Glob } from "../util/glob"
import { PackageRegistry } from "@/bun/registry"
import { proxied } from "@/util/proxied"
import { iife } from "@/util/iife"
import { ConfigPaths } from "./paths"
import { Filesystem } from "@/util/filesystem"
import { ChannelCatalog, buildChannelSchema } from "@/channel/catalog"
import { withKeyedLock } from "@/util/lock"
import { AgentRoleContract } from "@/agent/role-contract"
import { PromptProfileConfigSchema, PromptProfileOverlaySchema } from "@/agent/prompt-profile"
import { isModelReference } from "@/provider/model-ref"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { McpConfigSchema } from "./mcp-schema"
import { hostGit as git } from "@/util/git"
import { SkillMountOverlaySchema, SkillMountProjectConfigSchema } from "@/skill/mount-config"
import {
  ExpertSquadRuntimeOverridesSchema,
  ExpertSquadRuntimeOverlaysSchema,
  RuntimeTemplateOverridesSchema,
  RuntimeTemplateOverlaysSchema,
} from "@/agent/runtime-override"
import lockfile from "proper-lockfile"

export namespace Config {
  export const ModelId = z
    .string()
    .refine(isModelReference, {
      message: 'Model must be in the format "provider/model".',
    })
    .meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })
  export const DEFAULT_MODEL = "openai/gpt-5.5"
  const log = Log.create({ service: "config" })
  const dependencyInstallLocks = new Map<string, Promise<unknown>>()
  type LoadStateOptions = {
    readOnly?: boolean
    directory?: string
    worktree?: string
    projectFileOverride?: {
      filepath: string
      config: Info
    }
    globalFileOverride?: {
      filepath: string
      config: Info
    }
  }

  type ConfigLoadOptions = {
    writeSchema?: boolean
    projectOwnedSource?: "project" | "non-project"
  }

  export type LegacyPermissionMigration = Readonly<{
    sourceFields: readonly ("permission" | "tool_permissions")[]
    permissionMode: "full_access" | "ask"
    reason: "all_allow" | "restricted_or_mixed" | "explicit_mode"
  }>

  function legacyPermissionActions(value: unknown, path: string): ("allow" | "ask" | "deny")[] {
    if (value === undefined) return []
    if (value === "allow" || value === "ask" || value === "deny") return [value]
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Legacy permission configuration at ${path} is malformed`)
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      legacyPermissionActions(item, `${path}.${key}`),
    )
  }

  /** One-time cutover transform. Callers must persist the returned canonical object. */
  export function migrateLegacyPermissionConfig(input: unknown): {
    config: unknown
    migration?: LegacyPermissionMigration
  } {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { config: input }
    const source = input as Record<string, unknown>
    const sourceFields = (["permission", "tool_permissions"] as const).filter((key) =>
      Object.prototype.hasOwnProperty.call(source, key),
    )
    if (sourceFields.length === 0) return { config: input }
    const explicit = source.permission_mode
    if (explicit !== undefined && explicit !== "full_access" && explicit !== "ask") {
      throw new Error("permission_mode must be either full_access or ask")
    }
    const actions = sourceFields.flatMap((field) => legacyPermissionActions(source[field], field))
    const permissionMode: "full_access" | "ask" =
      explicit === "full_access" || explicit === "ask"
        ? explicit
        : actions.every((action) => action === "allow")
          ? "full_access"
          : "ask"
    const migration: LegacyPermissionMigration = {
      sourceFields,
      permissionMode,
      reason:
        explicit !== undefined
          ? ("explicit_mode" as const)
          : actions.every((action) => action === "allow")
            ? ("all_allow" as const)
            : ("restricted_or_mixed" as const),
    }
    const config: Record<string, unknown> = {
      ...source,
      permission_mode: permissionMode,
      permission_migration: {
        version: 1,
        source_fields: [...sourceFields],
        permission_mode: permissionMode,
        reason: migration.reason,
      },
    }
    delete config.permission
    delete config.tool_permissions
    return {
      config,
      migration,
    }
  }

  const NonProjectOwnedConfigBoundary = z
    .object({
      skill_mounts: z.never().optional(),
      primary_assistant_capabilities: z.never().optional(),
      local_environment: z.never().optional(),
    })
    .passthrough()

  function assertProjectOwnedConfigSource(data: unknown, source: string, loadOptions?: ConfigLoadOptions) {
    if (loadOptions?.projectOwnedSource === "project") return
    const parsed = NonProjectOwnedConfigBoundary.safeParse(data)
    if (parsed.success) return
    throw new InvalidError({ path: source, issues: parsed.error.issues })
  }

  // Managed settings directory for enterprise deployments (highest priority, admin-controlled)
  // These settings override all user and project settings
  function systemManagedConfigDir(): string {
    switch (process.platform) {
      case "darwin":
        return "/Library/Application Support/opencorvus"
      case "win32":
        return path.join(process.env.ProgramData || "C:\\ProgramData", "opencorvus")
      default:
        return "/etc/opencorvus"
    }
  }

  export function managedConfigDir() {
    return process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR || systemManagedConfigDir()
  }

  const managedDir = managedConfigDir()

  // Configuration-owned extension lists are additive across precedence layers.
  // A layer can remove only entries it owns; replacing a higher-layer list must
  // never hide a Skill source declared by a lower owner.
  function mergeConfigConcatArrays(target: Info, source: Info): Info {
    const merged = mergeDeep(target, source)
    if (target.plugin && source.plugin) {
      merged.plugin = Array.from(new Set([...target.plugin, ...source.plugin]))
    }
    if (target.instructions && source.instructions) {
      merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]))
    }
    if (target.skills?.paths && source.skills?.paths) {
      merged.skills = merged.skills || {}
      merged.skills.paths = Array.from(new Set([...target.skills.paths, ...source.skills.paths]))
    }
    if (target.skills?.urls && source.skills?.urls) {
      merged.skills = merged.skills || {}
      merged.skills.urls = Array.from(new Set([...target.skills.urls, ...source.skills.urls]))
    }
    return merged
  }

  async function loadState(options: LoadStateOptions = {}) {
    const loadOptions: ConfigLoadOptions = {
      writeSchema: options.readOnly !== true,
      projectOwnedSource: "non-project",
    }
    const directory = options.directory ?? ProjectInstanceContext.use().directory
    const worktree = options.worktree ?? ProjectInstanceContext.use().worktree
    const canonicalProjectFile = !Flag.OPENCORVUS_DISABLE_PROJECT_CONFIG
      ? await ConfigPaths.assertCanonicalProject(directory, worktree)
      : undefined
    const auth = await Auth.all()
    const loadStateFile = (filepath: string, fileOptions?: ConfigLoadOptions) => {
      if (
        options.globalFileOverride &&
        Filesystem.resolve(filepath) === Filesystem.resolve(options.globalFileOverride.filepath)
      ) {
        return Promise.resolve(structuredClone(options.globalFileOverride.config))
      }
      if (
        options.projectFileOverride &&
        Filesystem.resolve(filepath) === Filesystem.resolve(options.projectFileOverride.filepath)
      ) {
        return Promise.resolve(structuredClone(options.projectFileOverride.config))
      }
      return loadFile(filepath, fileOptions)
    }

    // Config loading order (low -> high precedence): https://opencorvus.ai/docs/config#precedence-order
    // 1) Remote .well-known/opencorvus (org defaults)
    // 2) Global config (<runtime-root>/config/opencorvus.jsonc)
    // 3) Custom config (OPENCORVUS_CONFIG)
    // 4) Project config (.opencorvus/opencorvus.jsonc)
    // 5) Other local config directory resources (.opencorvus/*)
    // 6) Inline config (OPENCORVUS_CONFIG_CONTENT)
    // Managed config directory is enterprise-only and always overrides everything above.
    let result: Info = Info.parse({})
    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        process.env[value.key] = value.token
        log.debug("fetching remote config", { url: `${key}/.well-known/opencorvus` })
        const response = await fetch(`${key}/.well-known/opencorvus`)
        if (!response.ok) {
          throw new Error(`failed to fetch remote config from ${key}: ${response.status}`)
        }
        const wellknown = (await response.json()) as any
        const remoteConfig = wellknown.config ?? {}
        // Add $schema to prevent load() from trying to write back to a non-existent file
        if (!remoteConfig.$schema) remoteConfig.$schema = "https://opencorvus.ai/config.json"
        result = mergeConfigConcatArrays(
          result,
          await load(
            JSON.stringify(remoteConfig),
            {
              dir: path.dirname(`${key}/.well-known/opencorvus`),
              source: `${key}/.well-known/opencorvus`,
            },
            loadOptions,
          ),
        )
        log.debug("loaded remote config from well-known", { url: key })
      }
    }

    for (const plugin of await loadPackagedPlugins()) {
      result.plugin = [...(result.plugin ?? []), plugin]
    }

    // Global user config overrides remote config.
    result = mergeConfigConcatArrays(result, await loadGlobalConfig(loadOptions, loadStateFile))

    // Custom config path overrides global config.
    if (Flag.OPENCORVUS_CONFIG) {
      result = mergeConfigConcatArrays(result, await loadStateFile(Flag.OPENCORVUS_CONFIG, loadOptions))
      log.debug("loaded custom config", { path: Flag.OPENCORVUS_CONFIG })
    }

    result.agent = result.agent || {}
    result.plugin = result.plugin || []
    result.experimental = {
      auto_question: true,
      ...(result.experimental ?? {}),
    }

    const directories = await ConfigPaths.directories(directory, worktree)

    // .opencorvus directory config overrides (project and global) config sources.
    if (Flag.OPENCORVUS_CONFIG_DIR) {
      log.debug("loading config from OPENCORVUS_CONFIG_DIR", { path: Flag.OPENCORVUS_CONFIG_DIR })
    }

    type DependencyOutcome = { ok: true } | { ok: false; error: unknown }
    const deps: Promise<DependencyOutcome>[] = []

    for (const dir of unique(directories)) {
      const isProjectResourceDir = dir.endsWith(".opencorvus")
      const isExactProjectConfigDir =
        canonicalProjectFile !== undefined &&
        Filesystem.resolve(dir) === Filesystem.resolve(path.dirname(canonicalProjectFile))
      const isNonProjectConfigDir = dir === Flag.OPENCORVUS_CONFIG_DIR || dir === Global.Path.config
      const loadsConfig = isExactProjectConfigDir || isNonProjectConfigDir
      if (loadsConfig) {
        const filepath = await ConfigPaths.assertCanonicalDirectory(dir)
        const projectOwnedSource = isExactProjectConfigDir ? "project" : "non-project"
        log.debug(`loading config from ${filepath}`)
        result = mergeConfigConcatArrays(result, await loadStateFile(filepath, { ...loadOptions, projectOwnedSource }))
        // to satisfy the type checker
        result.agent ??= {}
        result.plugin ??= []
      }

      // The plugin manifest install (`@opencorvus-ai/plugin` written as
      // `package.json` + node_modules) MUST stay inside opencorvus-owned
      // directories: the global config root, the project's `.opencorvus/`,
      // or an explicit `OPENCORVUS_CONFIG_DIR`. Writing it into a directory
      // walked-to from the active project directory (e.g. the project root itself,
      // when a `.opencorvus/` sibling sits one level up) would drop an
      // untracked `package.json` into the user's primary worktree — which
      // then collides with build-agent commits at `git merge --ff-only`
      // time. Those collisions were the root cause of the 2026-04-29
      // gemini-task scaffold merge failure.
      const localPlugins = await loadPlugin(dir)
      if (!options.readOnly && (isProjectResourceDir || isNonProjectConfigDir) && localPlugins.length > 0) {
        const operation = iife(async () => {
          const shouldInstall = await needsInstall(dir)
          if (shouldInstall) await installDependencies(dir)
        })
        deps.push(
          operation.then<DependencyOutcome, DependencyOutcome>(
            () => ({ ok: true }),
            (error) => ({ ok: false, error }),
          ),
        )
      }

      result.command = mergeDeep(result.command ?? {}, await loadCommand(dir))
      result.plugin.push(...localPlugins)
    }

    // Inline config content overrides all non-managed config sources.
    if (process.env.OPENCORVUS_CONFIG_CONTENT) {
      result = mergeConfigConcatArrays(
        result,
        await load(
          process.env.OPENCORVUS_CONFIG_CONTENT,
          {
            dir: directory,
            source: "OPENCORVUS_CONFIG_CONTENT",
          },
          loadOptions,
        ),
      )
      log.debug("loaded custom config from OPENCORVUS_CONFIG_CONTENT")
    }

    // Load managed config files last (highest priority) - enterprise admin-controlled
    // Kept separate from directories array to avoid write operations when installing plugins
    // which would fail on system directories requiring elevated permissions
    // This way it only loads config file and not skills/plugins/commands
    const managedLoadOptions = { ...loadOptions, writeSchema: false }
    const managedFile = await ConfigPaths.assertCanonicalDirectory(managedDir)
    result = mergeConfigConcatArrays(result, await loadStateFile(managedFile, managedLoadOptions))

    if (!result.username) result.username = os.userInfo().username
    // Apply flag overrides for compaction settings
    if (Flag.OPENCORVUS_DISABLE_AUTOCOMPACT) {
      result.compaction = { ...result.compaction, auto: false }
    }
    if (Flag.OPENCORVUS_DISABLE_PRUNE) {
      result.compaction = { ...result.compaction, prune: false }
    }

    result.plugin = deduplicatePlugins(result.plugin ?? [])
    result = materializeBuiltinMcp(result)

    // NOTE: first-load auto-write of resolved config to the project directory
    // was removed (spec §6-2, rule 7/8). It wrote `result.model ??= DEFAULT_MODEL`
    // AND a frozen copy of the global-merged config into the project file, so
    // the project file permanently shadowed global config — the root cause of
    // "model 反复覆盖". Config now resolves in-memory only; a project config
    // file exists ONLY when explicitly created. With no model configured
    // anywhere, resolveAgentModel throws MissingModelConfigError (strict,
    // explicit — no DEFAULT_MODEL fallback).

    return {
      config: result,
      directories,
      deps,
    }
  }

  export const state = createInstanceState(async () => loadState(), undefined, "config")

  export async function waitForDependencies() {
    const deps = await state().then((x) => x.deps)
    const outcomes = await Promise.all(deps)
    const errors = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.error]))
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, "Multiple config dependency installations failed")
  }

  export async function installDependencies(dir: string) {
    const key = Filesystem.normalizePath(Filesystem.resolve(dir))
    return withKeyedLock(dependencyInstallLocks, key, async () => {
      await fs.mkdir(dir, { recursive: true })
      const release = await lockfile.lock(dir, { realpath: false })
      try {
        // A second project Instance may have completed the shared installation
        // while this owner waited. Re-check under both the process-local and
        // cross-process directory owner before changing canonical files.
        if (!(await needsInstall(dir))) return

        const pkg = path.join(dir, "package.json")
        const gitignore = path.join(dir, ".gitignore")
        const targetVersion = Installation.isLocal() ? "*" : Installation.VERSION
        const packageSchema = z.object({ dependencies: z.record(z.string(), z.string()).optional() }).passthrough()
        const previousPackage = await Filesystem.readText(pkg).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return undefined
          throw error
        })
        const json =
          previousPackage === undefined ? { dependencies: {} } : packageSchema.parse(JSON.parse(previousPackage))
        json.dependencies = {
          ...json.dependencies,
          "@opencorvus-ai/plugin": targetVersion,
        }
        await Filesystem.writeAtomic(pkg, JSON.stringify(json, null, 2))
        const createdGitignore = await Filesystem.writeAtomicIfAbsent(
          gitignore,
          ["node_modules", "package.json", "bun.lock", ".gitignore"].join("\n"),
        )

        try {
          // Install any additional dependencies defined in package.json so
          // local plugins can use their declared external packages.
          await BunProc.run(
            [
              "install",
              // TODO: get rid of this case (see: https://github.com/oven-sh/bun/issues/19936)
              ...(proxied() || process.env.CI ? ["--no-cache"] : []),
            ],
            { cwd: dir },
          )
        } catch (cause) {
          const rollbackFailures: unknown[] = []
          try {
            if (previousPackage === undefined) await fs.rm(pkg, { force: true })
            else await Filesystem.writeAtomic(pkg, previousPackage)
          } catch (rollbackFailure) {
            rollbackFailures.push(rollbackFailure)
          }
          if (createdGitignore) {
            try {
              await fs.rm(gitignore, { force: true })
            } catch (rollbackFailure) {
              rollbackFailures.push(rollbackFailure)
            }
          }
          if (rollbackFailures.length > 0) {
            throw new AggregateError(
              [cause, ...rollbackFailures],
              `Config dependency installation failed and canonical metadata rollback was incomplete for ${dir}`,
              { cause },
            )
          }
          throw cause
        }
      } finally {
        await release()
      }
    })
  }

  async function isWritable(dir: string) {
    try {
      await fs.access(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  export async function needsInstall(dir: string) {
    const nodeModules = path.join(dir, "node_modules")
    const pkg = path.join(dir, "package.json")
    const pkgExists = await Filesystem.exists(pkg)
    let required = !existsSync(nodeModules) || !pkgExists
    if (!required) {
      const parsed = z
        .object({ dependencies: z.record(z.string(), z.string()).optional() })
        .passthrough()
        .parse(await Filesystem.readJson(pkg))
      const depVersion = parsed.dependencies?.["@opencorvus-ai/plugin"]
      if (!depVersion) required = true
      else {
        const targetVersion = Installation.isLocal() ? "latest" : Installation.VERSION
        if (targetVersion === "latest") {
          required = await PackageRegistry.isOutdated("@opencorvus-ai/plugin", depVersion, dir)
          if (required) {
            log.info("Cached version is outdated, proceeding with install", {
              pkg: "@opencorvus-ai/plugin",
              cachedVersion: depVersion,
            })
          }
        } else {
          required = depVersion !== targetVersion
        }
      }
    }
    if (!required) return false
    if (!(await isWritable(dir))) {
      throw new Error(`Config dependency installation is required but the directory is not writable: ${dir}`)
    }
    return true
  }

  function rel(item: string, patterns: string[]) {
    const normalizedItem = item.replaceAll("\\", "/")
    for (const pattern of patterns) {
      const index = normalizedItem.indexOf(pattern)
      if (index === -1) continue
      return normalizedItem.slice(index + pattern.length)
    }
  }

  function trim(file: string) {
    const ext = path.extname(file)
    return ext.length ? file.slice(0, -ext.length) : file
  }

  function materializeBuiltinMcp(config: Info): Info {
    const browser = config.mcp?.[BrowserMCPBuiltin.ServerName]
    const computer = config.mcp?.[ComputerMCPBuiltin.ServerName]
    if (browser && computer) return config
    return {
      ...config,
      mcp: {
        ...(config.mcp ?? {}),
        ...(browser ? {} : { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() }),
        ...(computer ? {} : { [ComputerMCPBuiltin.ServerName]: { enabled: false as const } }),
      },
    }
  }

  async function loadCommand(dir: string) {
    const result: Record<string, Command> = {}
    for (const item of await Glob.scan("{command,commands}/**/*.md", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      const md = await ConfigMarkdown.parse(item)

      const patterns = ["/.opencorvus/command/", "/.opencorvus/commands/", "/command/", "/commands/"]
      const file = rel(item, patterns) ?? path.basename(item)
      const name = trim(file)

      const config = {
        name,
        ...md.data,
        template: md.content.trim(),
      }
      const parsed = Command.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
    }
    return result
  }

  function packagedPluginRoots() {
    const explicit = (process.env.OPENCORVUS_PACKAGED_PLUGIN_DIR ?? "")
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean)
    return unique([...explicit, path.dirname(process.execPath)])
  }

  async function loadPackagedPlugins() {
    const plugins: string[] = []
    for (const dir of packagedPluginRoots()) {
      plugins.push(...(await loadPlugin(dir)))
    }
    return plugins
  }

  async function loadPlugin(dir: string) {
    const plugins: string[] = []

    for (const item of await Glob.scan("{plugin,plugins}/**/*.{ts,js,json}", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      plugins.push(pathToFileURL(item).href)
    }
    return plugins
  }

  /**
   * Extracts a canonical plugin name from a plugin specifier.
   * - For file:// URLs: extracts filename without extension
   * - For npm packages: extracts package name without version
   *
   * @example
   * getPluginName("file:///path/to/plugin/foo.js") // "foo"
   * getPluginName("oh-my-opencorvus@2.4.3") // "oh-my-opencorvus"
   * getPluginName("@scope/pkg@1.0.0") // "@scope/pkg"
   */
  export function getPluginName(plugin: string): string {
    if (plugin.startsWith("file://")) {
      return path.parse(new URL(plugin).pathname).name
    }
    const lastAt = plugin.lastIndexOf("@")
    if (lastAt > 0) {
      return plugin.substring(0, lastAt)
    }
    return plugin
  }

  /**
   * Deduplicates plugins by name, with later entries (higher priority) winning.
   * Priority order (highest to lowest):
   * 1. Local plugin/ directory
   * 2. Local opencorvus.jsonc
   * 3. Global plugin/ directory
   * 4. Global opencorvus.jsonc
   *
   * Since plugins are added in low-to-high priority order,
   * we reverse, deduplicate (keeping first occurrence), then restore order.
   */
  export function deduplicatePlugins(plugins: string[]): string[] {
    // seenNames: canonical plugin names for duplicate detection
    // e.g., "oh-my-opencorvus", "@scope/pkg"
    const seenNames = new Set<string>()

    // uniqueSpecifiers: full plugin specifiers to return
    // e.g., "oh-my-opencorvus@2.4.3", "file:///path/to/plugin.js"
    const uniqueSpecifiers: string[] = []

    for (const specifier of plugins.toReversed()) {
      const name = getPluginName(specifier)
      if (!seenNames.has(name)) {
        seenNames.add(name)
        uniqueSpecifiers.push(specifier)
      }
    }

    return uniqueSpecifiers.toReversed()
  }

  export const McpLocal = McpConfigSchema.McpLocal
  export const McpOAuth = McpConfigSchema.McpOAuth
  export type McpOAuth = McpConfigSchema.McpOAuth
  export const McpStaticCredential = McpConfigSchema.McpStaticCredential
  export type McpStaticCredential = McpConfigSchema.McpStaticCredential
  export const McpRemote = McpConfigSchema.McpRemote
  export const Mcp = McpConfigSchema.Mcp
  export type Mcp = McpConfigSchema.Mcp

  export const PermissionAction = z.enum(["allow", "deny"]).meta({
    ref: "PermissionActionConfig",
  })
  export type PermissionAction = z.infer<typeof PermissionAction>

  export const PermissionObject = z.record(z.string(), PermissionAction).meta({
    ref: "PermissionObjectConfig",
  })
  export type PermissionObject = z.infer<typeof PermissionObject>

  export const PermissionRule = z.union([PermissionAction, PermissionObject]).meta({
    ref: "PermissionRuleConfig",
  })
  export type PermissionRule = z.infer<typeof PermissionRule>

  export const Permission = z
    .union([
      z
        .object({
          read: PermissionRule.optional(),
          edit: PermissionRule.optional(),
          glob: PermissionRule.optional(),
          search_code: PermissionRule.optional(),
          list: PermissionRule.optional(),
          bash: PermissionRule.optional(),
          task: PermissionRule.optional(),
          external_directory: PermissionRule.optional(),
          todowrite: PermissionAction.optional(),
          todoread: PermissionAction.optional(),
          question: PermissionAction.optional(),
          webfetch: PermissionAction.optional(),
          websearch: PermissionAction.optional(),
          external_code_search: PermissionAction.optional(),
          lsp: PermissionRule.optional(),
          doom_loop: PermissionAction.optional(),
          skill: PermissionRule.optional(),
        })
        .catchall(PermissionRule),
      PermissionAction,
    ])
    .meta({
      ref: "PermissionConfig",
    })
  export type Permission = z.infer<typeof Permission>

  export const PrimaryAssistantID = z.enum(["coding", "chat", "control", "mission"])

  export const Command = z.object({
    template: z.string(),
    description: z.string().optional(),
    agent: PrimaryAssistantID.optional(),
    model: ModelId.optional(),
  })
  export type Command = z.infer<typeof Command>

  export const Skills = z.object({
    paths: z.array(z.string()).optional().describe("Additional paths to skill folders"),
    urls: z
      .array(z.string())
      .optional()
      .describe("URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)"),
  })
  export type Skills = z.infer<typeof Skills>

  export const PackageUpdates = z
    .object({
      server_url: z
        .string()
        .url()
        .refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol), {
          message: "package_updates.server_url must use http:// or https://.",
        })
        .describe("Base URL for the OpenCorvus Expert Squad and Skill update service"),
    })
    .strict()
  export type PackageUpdates = z.infer<typeof PackageUpdates>

  export const NativeAgentOverride = z
    .object({
      model: ModelId.optional(),
      variant: z
        .string()
        .optional()
        .describe("Default model variant for this agent (applies only when using the agent's configured model)."),
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      prompt: z.string().optional(),
      prompt_append: z
        .string()
        .optional()
        .describe("Additional instructions appended after a code-owned stage-agent core prompt."),
      description: z.string().optional().describe("Description of when to use the agent"),
      options: z.record(z.string(), z.any()).optional(),
      color: z
        .union([
          z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format"),
          z.enum(["primary", "secondary", "accent", "success", "warning", "error", "info"]),
        ])
        .optional()
        .describe("Hex color code (e.g., #FF5733) or theme color (e.g., primary)"),
      steps: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of agentic iterations before forcing text-only response"),
      permission: Permission.optional(),
    })
    .strict()
    .meta({
      ref: "NativeAgentOverride",
    })
  export type NativeAgentOverride = z.infer<typeof NativeAgentOverride>

  // Session overlay: the EXACT subset of config a session may override
  // (decision §6-1, widest set). `.strict()` is the pinned-invariant guard
  // (design principle 5): any key NOT listed here — permission, tools, mcp,
  // provider creds, paths — is rejected at the schema boundary, so a session
  // can never weaken project security/cost boundaries.
  // Every overlay value is `.nullable()`: a session overlay is an RFC 7396
  // merge-patch, so `null` is a first-class, schema-validated "delete this
  // override" signal (NOT an out-of-band `as never`). This keeps the gate
  // (Overlay) and the merge API (mergeOverlay) in lockstep.
  const OverlayAgent = z
    .object({
      // ModelId reused from the single source so model format stays in sync.
      model: ModelId.nullable().optional(),
      // variant selects a model variant for the agent's configured model — it
      // is part of the model-selection family opened by decision §6-1.
      variant: z.string().nullable().optional(),
      temperature: z.number().nullable().optional(),
      top_p: z.number().nullable().optional(),
      prompt: z.string().nullable().optional(),
      prompt_append: z.string().nullable().optional(),
    })
    .strict()

  // Exact session-overridable surface (decision §6-1 "widest"; spec §5/§13):
  // model + variant + temperature + top_p + agent prompt/prompt_append, plus
  // the system-scope prompt record (same shape as Info.prompt by design — a
  // session may override any prompt slot; prompts carry no security/cost
  // boundary, unlike the .strict()-excluded permission/tools/mcp/provider).
  export const Overlay = z
    .object({
      model: ModelId.nullable().optional(),
      prompt: z.record(z.string(), z.string().nullable()).nullable().optional(),
      prompt_profile: z
        .lazy(() => PromptProfileOverlaySchema)
        .nullable()
        .optional(),
      skill_mounts: SkillMountOverlaySchema.nullable().optional(),
      runtime_templates: RuntimeTemplateOverlaysSchema.nullable().optional(),
      expert_squads: ExpertSquadRuntimeOverlaysSchema.nullable().optional(),
      agent: z
        .object({
          coding: OverlayAgent.nullable().optional(),
          chat: OverlayAgent.nullable().optional(),
          control: OverlayAgent.nullable().optional(),
          mission: OverlayAgent.nullable().optional(),
          title: OverlayAgent.nullable().optional(),
          summary: OverlayAgent.nullable().optional(),
          compaction: OverlayAgent.nullable().optional(),
          orchestrator: OverlayAgent.nullable().optional(),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict()
    .superRefine((overlay, ctx) => {
      for (const [agentID, agentConfig] of Object.entries(overlay.agent ?? {})) {
        if (!agentConfig) continue
        const role = AgentRoleContract.get(agentID)
        if (role.promptConfigMode === "append" && agentConfig.prompt !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["agent", agentID, "prompt"],
            message: `configOverlay.agent.${agentID}.prompt is invalid for append-mode agents; use prompt_append.`,
          })
        }
        if (
          role.promptConfigMode === "none" &&
          (agentConfig.prompt !== undefined || agentConfig.prompt_append !== undefined)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["agent", agentID],
            message: `configOverlay.agent.${agentID} prompt configuration is not editable.`,
          })
        }
      }
    })
  export type Overlay = z.output<typeof Overlay>

  export const PrimaryAssistantCapabilities = z
    .object({
      chat: z
        .object({
          skill_refs: z.array(z.string().trim().min(1)).default([]),
          mcp_server_refs: z.array(z.string().trim().min(1)).default([]),
        })
        .strict()
        .optional(),
      work: z
        .object({
          skill_refs: z.array(z.string().trim().min(1)).default([]),
          mcp_server_refs: z.array(z.string().trim().min(1)).default([]),
        })
        .strict()
        .optional(),
    })
    .strict()
  export type PrimaryAssistantCapabilities = z.output<typeof PrimaryAssistantCapabilities>

  export const Keybinds = z
    .object({
      leader: z.string().optional().default("ctrl+x").describe("Leader key for keybind combinations"),
      app_exit: z.string().optional().default("ctrl+c,ctrl+d,<leader>q").describe("Exit the application"),
      editor_open: z.string().optional().default("<leader>e").describe("Open external editor"),
      theme_list: z.string().optional().default("<leader>t").describe("List available themes"),
      sidebar_toggle: z.string().optional().default("<leader>b").describe("Toggle sidebar"),
      scrollbar_toggle: z.string().optional().default("none").describe("Toggle session scrollbar"),
      username_toggle: z.string().optional().default("none").describe("Toggle username visibility"),
      status_view: z.string().optional().default("<leader>s").describe("View status"),
      session_export: z.string().optional().default("<leader>x").describe("Export session to editor"),
      session_new: z.string().optional().default("<leader>n").describe("Create a new session"),
      session_list: z.string().optional().default("<leader>l").describe("List all sessions"),
      session_timeline: z.string().optional().default("<leader>g").describe("Show session timeline"),
      session_fork: z.string().optional().default("none").describe("Fork session from message"),
      session_rename: z.string().optional().default("ctrl+r").describe("Rename session"),
      session_delete: z.string().optional().default("ctrl+d").describe("Delete session"),
      stash_delete: z.string().optional().default("ctrl+d").describe("Delete stash entry"),
      model_provider_list: z.string().optional().default("ctrl+a").describe("Open provider list from model dialog"),
      model_favorite_toggle: z.string().optional().default("ctrl+f").describe("Toggle model favorite status"),
      session_share: z.string().optional().default("none").describe("Share current session"),
      session_unshare: z.string().optional().default("none").describe("Unshare current session"),
      session_interrupt: z.string().optional().default("escape").describe("Interrupt current session"),
      session_compact: z.string().optional().default("<leader>c").describe("Compact the session"),
      messages_page_up: z.string().optional().default("pageup,ctrl+alt+b").describe("Scroll messages up by one page"),
      messages_page_down: z
        .string()
        .optional()
        .default("pagedown,ctrl+alt+f")
        .describe("Scroll messages down by one page"),
      messages_line_up: z.string().optional().default("ctrl+alt+y").describe("Scroll messages up by one line"),
      messages_line_down: z.string().optional().default("ctrl+alt+e").describe("Scroll messages down by one line"),
      messages_half_page_up: z.string().optional().default("ctrl+alt+u").describe("Scroll messages up by half page"),
      messages_half_page_down: z
        .string()
        .optional()
        .default("ctrl+alt+d")
        .describe("Scroll messages down by half page"),
      messages_first: z.string().optional().default("ctrl+g,home").describe("Navigate to first message"),
      messages_last: z.string().optional().default("ctrl+alt+g,end").describe("Navigate to last message"),
      messages_next: z.string().optional().default("none").describe("Navigate to next message"),
      messages_previous: z.string().optional().default("none").describe("Navigate to previous message"),
      messages_last_user: z.string().optional().default("none").describe("Navigate to last user message"),
      messages_copy: z.string().optional().default("<leader>y").describe("Copy message"),
      messages_undo: z.string().optional().default("<leader>u").describe("Undo message"),
      messages_redo: z.string().optional().default("<leader>r").describe("Redo message"),
      messages_toggle_conceal: z
        .string()
        .optional()
        .default("<leader>h")
        .describe("Toggle code block concealment in messages"),
      tool_details: z.string().optional().default("none").describe("Toggle tool details visibility"),
      model_list: z.string().optional().default("<leader>m").describe("List available models"),
      model_cycle_recent: z.string().optional().default("f2").describe("Next recently used model"),
      model_cycle_recent_reverse: z.string().optional().default("shift+f2").describe("Previous recently used model"),
      model_cycle_favorite: z.string().optional().default("none").describe("Next favorite model"),
      model_cycle_favorite_reverse: z.string().optional().default("none").describe("Previous favorite model"),
      command_list: z.string().optional().default("ctrl+p").describe("List available commands"),
      agent_list: z.string().optional().default("<leader>a").describe("List agents"),
      agent_cycle: z.string().optional().default("tab").describe("Next agent"),
      agent_cycle_reverse: z.string().optional().default("shift+tab").describe("Previous agent"),
      variant_cycle: z.string().optional().default("ctrl+t").describe("Cycle model variants"),
      input_clear: z.string().optional().default("ctrl+c").describe("Clear input field"),
      input_paste: z.string().optional().default("ctrl+v").describe("Paste from clipboard"),
      input_submit: z.string().optional().default("return").describe("Submit input"),
      input_newline: z
        .string()
        .optional()
        .default("shift+return,ctrl+return,alt+return,ctrl+j")
        .describe("Insert newline in input"),
      input_move_left: z.string().optional().default("left,ctrl+b").describe("Move cursor left in input"),
      input_move_right: z.string().optional().default("right,ctrl+f").describe("Move cursor right in input"),
      input_move_up: z.string().optional().default("up").describe("Move cursor up in input"),
      input_move_down: z.string().optional().default("down").describe("Move cursor down in input"),
      input_select_left: z.string().optional().default("shift+left").describe("Select left in input"),
      input_select_right: z.string().optional().default("shift+right").describe("Select right in input"),
      input_select_up: z.string().optional().default("shift+up").describe("Select up in input"),
      input_select_down: z.string().optional().default("shift+down").describe("Select down in input"),
      input_line_home: z.string().optional().default("ctrl+a").describe("Move to start of line in input"),
      input_line_end: z.string().optional().default("ctrl+e").describe("Move to end of line in input"),
      input_select_line_home: z
        .string()
        .optional()
        .default("ctrl+shift+a")
        .describe("Select to start of line in input"),
      input_select_line_end: z.string().optional().default("ctrl+shift+e").describe("Select to end of line in input"),
      input_visual_line_home: z.string().optional().default("alt+a").describe("Move to start of visual line in input"),
      input_visual_line_end: z.string().optional().default("alt+e").describe("Move to end of visual line in input"),
      input_select_visual_line_home: z
        .string()
        .optional()
        .default("alt+shift+a")
        .describe("Select to start of visual line in input"),
      input_select_visual_line_end: z
        .string()
        .optional()
        .default("alt+shift+e")
        .describe("Select to end of visual line in input"),
      input_buffer_home: z.string().optional().default("home").describe("Move to start of buffer in input"),
      input_buffer_end: z.string().optional().default("end").describe("Move to end of buffer in input"),
      input_select_buffer_home: z
        .string()
        .optional()
        .default("shift+home")
        .describe("Select to start of buffer in input"),
      input_select_buffer_end: z.string().optional().default("shift+end").describe("Select to end of buffer in input"),
      input_delete_line: z.string().optional().default("ctrl+shift+d").describe("Delete line in input"),
      input_delete_to_line_end: z.string().optional().default("ctrl+k").describe("Delete to end of line in input"),
      input_delete_to_line_start: z.string().optional().default("ctrl+u").describe("Delete to start of line in input"),
      input_backspace: z.string().optional().default("backspace,shift+backspace").describe("Backspace in input"),
      input_delete: z.string().optional().default("ctrl+d,delete,shift+delete").describe("Delete character in input"),
      input_undo: z.string().optional().default("ctrl+-,super+z").describe("Undo in input"),
      input_redo: z.string().optional().default("ctrl+.,super+shift+z").describe("Redo in input"),
      input_word_forward: z
        .string()
        .optional()
        .default("alt+f,alt+right,ctrl+right")
        .describe("Move word forward in input"),
      input_word_backward: z
        .string()
        .optional()
        .default("alt+b,alt+left,ctrl+left")
        .describe("Move word backward in input"),
      input_select_word_forward: z
        .string()
        .optional()
        .default("alt+shift+f,alt+shift+right")
        .describe("Select word forward in input"),
      input_select_word_backward: z
        .string()
        .optional()
        .default("alt+shift+b,alt+shift+left")
        .describe("Select word backward in input"),
      input_delete_word_forward: z
        .string()
        .optional()
        .default("alt+d,alt+delete,ctrl+delete")
        .describe("Delete word forward in input"),
      input_delete_word_backward: z
        .string()
        .optional()
        .default("ctrl+w,ctrl+backspace,alt+backspace")
        .describe("Delete word backward in input"),
      history_previous: z.string().optional().default("up").describe("Previous history item"),
      history_next: z.string().optional().default("down").describe("Next history item"),
      session_child_first: z.string().optional().default("<leader>down").describe("Go to first child session"),
      session_child_cycle: z.string().optional().default("right").describe("Go to next child session"),
      session_child_cycle_reverse: z.string().optional().default("left").describe("Go to previous child session"),
      session_parent: z.string().optional().default("up").describe("Go to parent session"),
      terminal_suspend: z.string().optional().default("ctrl+z").describe("Suspend terminal"),
      terminal_title_toggle: z.string().optional().default("none").describe("Toggle terminal title"),
      tips_toggle: z.string().optional().default("<leader>h").describe("Toggle tips on home screen"),
      display_thinking: z.string().optional().default("none").describe("Toggle thinking blocks visibility"),
    })
    .strict()
    .meta({
      ref: "KeybindsConfig",
    })

  export const Server = z
    .object({
      port: z.number().int().positive().optional().describe("Port to listen on"),
      hostname: z.string().optional().describe("Hostname to listen on"),
      publicUrl: z.string().optional().describe("Public base URL used for externally visible attachment links"),
      mdns: z.boolean().optional().describe("Enable mDNS service discovery"),
      mdnsDomain: z.string().optional().describe("Custom domain name for mDNS service"),
      cors: z.array(z.string()).optional().describe("Additional domains to allow for CORS"),
    })
    .strict()
    .meta({
      ref: "ServerConfig",
    })

  const ChannelShape = Object.fromEntries(
    ChannelCatalog.map((channel) => [
      channel.id,
      buildChannelSchema(channel.id, `${channel.schemaName}ChannelConfig`).optional(),
    ]),
  ) as Record<(typeof ChannelCatalog)[number]["id"], z.ZodOptional<ReturnType<typeof buildChannelSchema>>>

  export const Channel = z.object(ChannelShape).strict().meta({
    ref: "ChannelConfig",
  })

  export const Provider = ModelsDev.Provider.partial()
    .extend({
      whitelist: z.array(z.string()).optional(),
      blacklist: z.array(z.string()).optional(),
      models: z
        .record(
          z.string(),
          ModelsDev.Model.partial().extend({
            status: z.enum(["alpha", "beta"]).optional(),
            variants: z
              .record(
                z.string(),
                z
                  .object({
                    disabled: z.boolean().optional().describe("Disable this variant for the model"),
                  })
                  .catchall(z.any()),
              )
              .optional()
              .describe("Variant-specific configuration"),
          }),
        )
        .optional(),
      options: z
        .object({
          apiKey: z.string().optional(),
          baseURL: z.string().optional(),
          setCacheKey: z.boolean().optional().describe("Enable promptCacheKey for this provider (default false)"),
          timeout: z
            .union([
              z
                .number()
                .int()
                .positive()
                .describe(
                  "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                ),
              z.literal(false).describe("Disable timeout for this provider entirely."),
            ])
            .optional()
            .describe(
              "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
            ),
        })
        .catchall(z.any())
        .optional(),
    })
    .strict()
    .meta({
      ref: "ProviderConfig",
    })
  export type Provider = z.infer<typeof Provider>

  export const TerminalProfile = z
    .object({
      label: z.string().min(1).describe("Human-readable terminal profile label"),
      command: z.string().min(1).describe("Executable path or command resolved by the configured environment"),
      args: z.array(z.string()).optional().default([]).describe("Executable arguments, not shell-split from a string"),
      env: z
        .record(z.string(), z.string())
        .optional()
        .default({})
        .describe("Profile-owned terminal environment variables"),
      icon: z
        .enum(["terminal", "powershell", "command-prompt", "bash"])
        .optional()
        .describe("Terminal profile icon hint surfaced by Overlay launch controls"),
    })
    .strict()
    .meta({
      ref: "TerminalProfileConfig",
    })
  export type TerminalProfile = z.infer<typeof TerminalProfile>

  export const Terminal = z
    .object({
      default_profile_id: z.string().min(1).optional().describe("Default terminal profile id used by Overlay"),
      profiles: z.record(z.string(), TerminalProfile).optional().describe("Server-owned terminal profiles"),
    })
    .strict()
    .meta({
      ref: "TerminalConfig",
    })
  export type Terminal = z.infer<typeof Terminal>

  export const NetworkProxy = z
    .object({
      llmProvider: z
        .boolean()
        .optional()
        .describe("Route LLM provider HTTP requests through the configured HTTP(S) proxy"),
      webResearch: z
        .boolean()
        .optional()
        .describe("Route websearch and webfetch HTTP requests through the configured HTTP(S) proxy"),
      url: z.string().trim().min(1).optional().describe("HTTP(S) proxy URL, e.g. http://127.0.0.1:7890"),
      username: z.string().trim().min(1).optional().describe("Proxy authentication username"),
      password: z.string().trim().min(1).optional().describe("Proxy authentication password"),
    })
    .strict()
    .superRefine((proxy, ctx) => {
      const proxyEnabled = proxy.llmProvider === true || proxy.webResearch === true
      if (proxyEnabled && !proxy.url) {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "network.proxy.url is required when network.proxy.llmProvider or network.proxy.webResearch is true.",
        })
        return
      }
      if (proxy.password && !proxy.username) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "network.proxy.username is required when network.proxy.password is set.",
        })
      }
      if (!proxy.url) return
      let parsed: URL
      try {
        parsed = new URL(proxy.url)
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "network.proxy.url must be a valid URL.",
        })
        return
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "network.proxy.url must use http:// or https://.",
        })
      }
      if (parsed.username || parsed.password) {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message:
            "network.proxy.url must not include credentials; use network.proxy.username and network.proxy.password.",
        })
      }
    })
    .meta({
      ref: "NetworkProxyConfig",
    })
  export type NetworkProxy = z.infer<typeof NetworkProxy>

  export const Network = z
    .object({
      proxy: NetworkProxy.optional().describe("HTTP proxy configuration for provider and web research traffic"),
    })
    .strict()
    .meta({
      ref: "NetworkConfig",
    })
  export type Network = z.infer<typeof Network>

  export const LocalEnvironment = z
    .object({
      name: z.string().trim().min(1).describe("Display name for this project-local environment"),
      variables: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables for Bash and session shell commands"),
      setup_script: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Shell source executed before each Bash and session shell command"),
    })
    .strict()
    .meta({ ref: "LocalEnvironmentConfig" })
  export type LocalEnvironment = z.infer<typeof LocalEnvironment>

  export const Info = z
    .object({
      $schema: z.string().optional().describe("JSON schema reference for configuration validation"),
      logLevel: Log.Level.optional().describe("Log level"),
      server: Server.optional().describe("Server configuration for opencorvus serve"),
      network: Network.optional().describe("Network transport configuration"),
      local_environment: LocalEnvironment.optional().describe(
        "Project-owned environment variables and shell setup source applied to OpenCorvus Bash and session shell commands.",
      ),
      channel: Channel.optional().describe("Channel integration configuration"),
      command: z
        .record(z.string(), Command)
        .optional()
        .describe("Command configuration, see https://opencorvus.ai/docs/commands"),
      skills: Skills.optional().describe("Additional skill folder paths"),
      package_updates: PackageUpdates.optional().describe("Expert Squad and Skill update service configuration"),
      watcher: z
        .object({
          ignore: z.array(z.string()).optional(),
        })
        .optional(),
      plugin: z.string().array().optional(),
      snapshot: z
        .boolean()
        .optional()
        .describe("Enable file snapshot capture for /undo and patch evidence. Default false."),
      share: z
        .enum(["manual", "auto", "disabled"])
        .optional()
        .describe(
          "Control sharing behavior:'manual' allows manual sharing via commands, 'auto' enables automatic sharing, 'disabled' disables all sharing",
        ),
      autoupdate: z
        .union([z.boolean(), z.literal("notify")])
        .optional()
        .describe(
          "Automatically update to the latest version. Set to true to auto-update, false to disable, or 'notify' to show update notifications",
        ),
      disabled_providers: z.array(z.string()).optional().describe("Disable providers that are loaded automatically"),
      enabled_providers: z
        .array(z.string())
        .optional()
        .describe("When set, ONLY these providers will be enabled. All other providers will be ignored"),
      model: ModelId.describe(`Model to use in the format of provider/model, eg ${DEFAULT_MODEL}`).optional(),
      small_model: ModelId.describe(
        "Small model to use for tasks like title generation in the format of provider/model",
      ).optional(),
      default_agent: PrimaryAssistantID.optional().describe(
        "Default agent to use when none is specified. Must be a primary agent. When omitted, the built-in default is 'coding'; an invalid configured agent is an error.",
      ),
      username: z
        .string()
        .optional()
        .describe("Custom username to display in conversations instead of system username"),
      locale: z
        .enum(["en-US", "zh-CN"])
        .optional()
        .describe("Operator-selected system language used for assistant replies and Overlay localization."),
      agent: z
        .object({
          coding: NativeAgentOverride.optional(),
          chat: NativeAgentOverride.optional(),
          control: NativeAgentOverride.optional(),
          mission: NativeAgentOverride.optional(),
          title: NativeAgentOverride.optional(),
          summary: NativeAgentOverride.optional(),
          compaction: NativeAgentOverride.optional(),
          memory: NativeAgentOverride.optional(),
          orchestrator: NativeAgentOverride.optional(),
        })
        .strict()
        .optional()
        .describe("Overrides for fixed native Primary, Helper, and Host identities."),
      runtime_templates: RuntimeTemplateOverridesSchema.optional().describe(
        "Execution overrides for code-owned worker runtime templates.",
      ),
      expert_squads: ExpertSquadRuntimeOverridesSchema.optional().describe(
        "Execution overrides keyed by exact expert-squad and projected dynamic-agent identity.",
      ),
      provider: z
        .record(z.string(), Provider)
        .optional()
        .describe("Custom provider configurations and model overrides"),
      mcp: z
        .record(
          z.string(),
          z.union([
            Mcp,
            z
              .object({
                enabled: z.literal(false),
              })
              .strict(),
          ]),
        )
        .optional()
        .describe("MCP (Model Context Protocol) server configurations"),
      formatter: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.object({
              disabled: z.boolean().optional(),
              command: z.array(z.string()).optional(),
              environment: z.record(z.string(), z.string()).optional(),
              extensions: z.array(z.string()).optional(),
              timeout: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Maximum formatter probe and execution time in milliseconds."),
            }),
          ),
        ])
        .optional(),
      lsp: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.union([
              z.object({
                disabled: z.literal(true),
              }),
              z.object({
                command: z.array(z.string()),
                extensions: z.array(z.string()).optional(),
                disabled: z.boolean().optional(),
                env: z.record(z.string(), z.string()).optional(),
                initialization: z.record(z.string(), z.any()).optional(),
              }),
            ]),
          ),
        ])
        .optional()
        .refine(
          (data) => {
            if (!data) return true
            if (typeof data === "boolean") return true
            return Object.entries(data).every(([id, config]) => {
              if (config.disabled) return true
              if (LSP_BUILTIN_SERVER_IDS.has(id)) return true
              return Boolean(config.extensions)
            })
          },
          {
            error: "For custom LSP servers, 'extensions' array is required.",
          },
        )
        .describe(
          "Deprecated compatibility field. Language Server Protocol runtimes are disabled and this value is ignored.",
        ),
      prompt: z
        .record(z.string(), z.string())
        .optional()
        .describe("System-scope prompt overrides keyed by prompt identifier (e.g. core_header)"),
      prompt_profile: z
        .lazy(() => PromptProfileConfigSchema)
        .describe("Active package-backed expert-squad prompt profile selection."),
      skill_mounts: SkillMountProjectConfigSchema.optional().describe(
        "Project-owned operator skill overrides qualified by expert squad, dynamic agent, and default skill ref.",
      ),
      skill_policy: z
        .record(z.string(), PermissionAction)
        .optional()
        .describe(
          "Capability projection for installed Skills. Operator invocation authorization is controlled separately.",
        ),
      primary_assistant_capabilities: PrimaryAssistantCapabilities.optional().describe(
        "Project-owned Skill and MCP server assignments for fixed native primary assistants.",
      ),
      instructions: z.array(z.string()).optional().describe("Additional instruction files or patterns to include"),
      permission_mode: z
        .enum(["full_access", "ask"])
        .default("full_access")
        .describe(
          "Operator authorization mode. Full access is the default; Ask me pauses permission-bearing invocations for an operator decision.",
        ),
      permission_migration: z
        .object({
          version: z.literal(1),
          source_fields: z.array(z.enum(["permission", "tool_permissions"])).min(1),
          permission_mode: z.enum(["full_access", "ask"]),
          reason: z.enum(["all_allow", "restricted_or_mixed", "explicit_mode"]),
        })
        .strict()
        .optional()
        .describe("Durable, idempotent audit record for the one-time legacy permission configuration cutover."),
      terminal: Terminal.optional().describe("Server-owned Overlay terminal configuration."),
      compaction: z
        .object({
          auto: z.boolean().optional().describe("Enable automatic compaction when context is full"),
          prune: z.boolean().optional().describe("Enable pruning of old tool outputs"),
          reserved: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Token buffer for compaction. Leaves enough window to avoid overflow during compaction."),
          threshold: z
            .number()
            .min(0.1)
            .max(1)
            .optional()
            .describe(
              "Fraction of usable context (after reserved buffer) that must be consumed before auto-compaction triggers. Defaults to 0.9 — compact late enough to use more of the available prompt window while still preserving reserved reply headroom.",
            ),
          tail_turns: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Number of most recent real user turns to preserve verbatim after compaction. Defaults to 2."),
          preserve_recent_tokens: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Token budget for the verbatim recent-tail retained after compaction."),
        })
        .optional(),
      assistant: z
        .object({
          activity: z
            .object({
              session_llm_idle_ms: z
                .number()
                .int()
                .min(1000)
                .optional()
                .describe("Max idle (no stream chunk) window for session LLM streams, ms"),
              task_queue_run_timeout_ms: z
                .number()
                .int()
                .min(1000)
                .optional()
                .describe("Max idle window without queue task progress, ms"),
            })
            .optional()
            .describe("Chunk-driven inactivity thresholds for session LLM streams and provider execution work."),
          max_executor_groups: z.number().int().min(1).optional().describe("Maximum parallel projected agent sessions"),
        })
        .strict()
        .optional()
        .describe("Shared assistant runtime activity and parallelism configuration"),
      experimental: z
        .object({
          disable_paste_summary: z.boolean().optional(),
          batch_tool: z.boolean().optional().describe("Enable the batch tool"),
          openTelemetry: z
            .boolean()
            .optional()
            .describe("Enable OpenTelemetry spans for AI SDK calls (using the 'experimental_telemetry' flag)"),
          primary_tools: z
            .array(z.string())
            .optional()
            .describe("Tools that should only be available to primary agents."),
          continue_loop_on_deny: z.boolean().optional().describe("Continue the agent loop when a tool call is denied"),
          auto_question: z
            .boolean()
            .optional()
            .default(true)
            .describe(
              "Expire unanswered question interactions at the five-minute automatic deadline without attributing an operator decision. Independent fine-grained switch. When false, questions wait indefinitely for an operator reply.",
            ),
          mcp_timeout: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              "Timeout in milliseconds for model context protocol (MCP) requests. Defaults to 30000 (30 seconds).",
            ),
          memory: z
            .object({
              enabled: z.boolean().optional().describe("Enable persistent memory store"),
              auto_inject: z.boolean().optional().describe("Auto-inject relevant memories into system prompt"),
              token_budget: z
                .number()
                .int()
                .min(100)
                .optional()
                .describe("Max tokens for auto-injected memory context"),
              document_token_limit: z
                .number()
                .int()
                .min(100)
                .max(10_000)
                .optional()
                .default(10_000)
                .describe("Fixed maximum estimated token count of Project MEMORY.MD"),
              organizer_input_token_budget: z
                .number()
                .int()
                .min(12_000)
                .max(100_000)
                .optional()
                .default(32_000)
                .describe("Maximum estimated input tokens for one Memory Organizer run"),
              pending_availability_limit: z
                .number()
                .int()
                .min(10)
                .max(10_000)
                .optional()
                .default(500)
                .describe("Maximum pending occurrences retained while the Memory Organizer is unavailable"),
            })
            .superRefine((memory, ctx) => {
              const documentLimit = memory.document_token_limit ?? 10_000
              const inputBudget = memory.organizer_input_token_budget ?? 32_000
              if (inputBudget <= documentLimit + 2_000) {
                ctx.addIssue({
                  code: "custom",
                  path: ["organizer_input_token_budget"],
                  message:
                    "organizer_input_token_budget must exceed document_token_limit plus the 2000-token Organizer protocol reserve",
                })
              }
            })
            .optional()
            .describe("Persistent memory configuration"),
        })
        .optional(),
    })
    .strict()
    .superRefine((config, ctx) => {
      for (const [agentID, agentConfig] of Object.entries(config.agent ?? {})) {
        if (!agentConfig) continue
        const role = AgentRoleContract.get(agentID)
        if (role.promptConfigMode === "append" && agentConfig.prompt !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["agent", agentID, "prompt"],
            message: `config.agent.${agentID}.prompt is invalid for append-mode agents; use prompt_append.`,
          })
        }
        if (
          role.promptConfigMode === "none" &&
          (agentConfig.prompt !== undefined || agentConfig.prompt_append !== undefined)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["agent", agentID],
            message: `config.agent.${agentID} prompt configuration is not editable.`,
          })
        }
      }
    })
    .meta({
      ref: "Config",
    })

  export type Info = z.output<typeof Info>

  async function loadGlobalConfig(
    options?: ConfigLoadOptions,
    loader: (filepath: string, options?: ConfigLoadOptions) => Promise<Info> = loadFile,
  ) {
    const canonical = await ConfigPaths.assertCanonicalDirectory(Global.Path.config, ["config.json"])
    return loader(canonical, options)
  }

  export const global = lazy(async () => {
    return loadGlobalConfig()
  })

  export const { readFile } = ConfigPaths

  async function loadFile(filepath: string, options?: ConfigLoadOptions): Promise<Info> {
    log.info("loading", { path: filepath })
    const text = await readFile(filepath)
    if (!text || text.trim().length === 0) return {} as Info
    return load(text, { path: filepath }, options)
  }

  async function load(
    text: string,
    options: { path: string } | { dir: string; source: string },
    loadOptions?: ConfigLoadOptions,
  ) {
    let original = text
    const source = "path" in options ? options.path : options.source
    const isFile = "path" in options
    let data = await ConfigPaths.parseText(
      text,
      "path" in options ? options.path : { source: options.source, dir: options.dir },
    )

    const legacy = migrateLegacyPermissionConfig(data)
    data = legacy.config
    if (legacy.migration) {
      log.info("legacy permission configuration migrated", {
        source,
        sourceFields: legacy.migration.sourceFields,
        permissionMode: legacy.migration.permissionMode,
        reason: legacy.migration.reason,
      })
      if (isFile && loadOptions?.writeSchema !== false) {
        original = applyEdits(
          original,
          modify(original, ["permission_mode"], legacy.migration.permissionMode, {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
          }),
        )
        original = applyEdits(
          original,
          modify(original, ["permission_migration"], (data as Record<string, unknown>).permission_migration, {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
          }),
        )
        for (const field of legacy.migration.sourceFields) {
          original = applyEdits(
            original,
            modify(original, [field], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
          )
        }
        await Bun.write(options.path, original)
      }
    }

    assertProjectOwnedConfigSource(data, source, loadOptions)

    const parsed = Info.safeParse(data)
    if (parsed.success) {
      if (!parsed.data.$schema && isFile && loadOptions?.writeSchema !== false) {
        parsed.data.$schema = "https://opencorvus.ai/config.json"
        const updated = original.replace(/^\s*\{/, '{\n  "$schema": "https://opencorvus.ai/config.json",')
        await Bun.write(options.path, updated)
      }
      return parsed.data
    }

    throw new InvalidError({
      path: source,
      issues: parsed.error.issues,
    })
  }
  export const { JsonError, InvalidError } = ConfigPaths

  export const ConfigDirectoryTypoError = NamedError.create(
    "ConfigDirectoryTypoError",
    z.object({
      path: z.string(),
      dir: z.string(),
      suggestion: z.string(),
    }),
  )

  export const GlobalConfigInheritedValueError = NamedError.create(
    "GlobalConfigInheritedValueError",
    z.object({ path: z.string(), message: z.string() }),
  )

  export class GlobalConfigCommittedReconcileError extends AggregateError {
    readonly committed = true
    constructor(
      errors: readonly unknown[],
      readonly config: Info,
    ) {
      super(errors, "Global configuration committed, but one or more project runtime projections did not fully settle")
      this.name = "GlobalConfigCommittedReconcileError"
    }
  }

  export class ProjectConfigCommittedReconcileError extends AggregateError {
    readonly committed = true
    constructor(
      errors: readonly unknown[],
      readonly config: Info,
    ) {
      super(errors, "Project configuration committed, but its runtime projection did not fully settle")
      this.name = "ProjectConfigCommittedReconcileError"
    }
  }

  export function committedMutationReceipt(
    error: GlobalConfigCommittedReconcileError | ProjectConfigCommittedReconcileError,
  ) {
    return {
      name: error.name,
      data: {
        committed: true as const,
        message: error.message,
        config: error.config,
        failures: error.errors.map((failure) => (failure instanceof Error ? failure.message : String(failure))),
      },
    }
  }

  export async function get() {
    return state().then((x) => x.config)
  }

  async function readOnlyWorktreeBoundary(directory: string) {
    const resolvedDirectory = Filesystem.resolve(directory)
    const result = await git(["rev-parse", "--show-toplevel"], {
      cwd: resolvedDirectory,
      timeoutProfile: "fast",
    })
    if (result.exitCode !== 0) return resolvedDirectory
    const topLevel = result.text().trim()
    return topLevel ? Filesystem.resolve(topLevel) : resolvedDirectory
  }

  export async function snapshotForProject(directory: string, globalConfigOverride?: Info) {
    const resolvedDirectory = Filesystem.resolve(directory)
    const worktree = await readOnlyWorktreeBoundary(resolvedDirectory)
    return structuredClone(
      (
        await loadState({
          readOnly: true,
          directory: resolvedDirectory,
          worktree,
          ...(globalConfigOverride
            ? {
                globalFileOverride: {
                  filepath: globalConfigFile(),
                  config: globalConfigOverride,
                },
              }
            : {}),
        })
      ).config,
    ) as Info
  }

  export async function getGlobal() {
    return global()
  }

  /** Returns only the project-owned writable config, without inherited global values. */
  export async function getProject() {
    const target = await assertCanonicalProjectConfig()
    return loadFile(target, { writeSchema: false, projectOwnedSource: "project" })
  }

  async function resolveProjectCandidate(projectConfig: Info) {
    return (
      await loadState({
        readOnly: true,
        projectFileOverride: {
          filepath: projectConfigFile(),
          config: projectConfig,
        },
      })
    ).config
  }

  async function resolveGlobalCandidate(globalConfig: Info) {
    const target = globalConfigFile()
    return loadGlobalConfig({ writeSchema: false }, (filepath, options) =>
      Filesystem.resolve(filepath) === Filesystem.resolve(target)
        ? Promise.resolve(structuredClone(globalConfig))
        : loadFile(filepath, options),
    )
  }

  export function projectConfigDirectory() {
    return path.join(ProjectInstanceContext.use().directory, ".opencorvus")
  }

  export function projectConfigFile() {
    return ConfigPaths.projectFile(ProjectInstanceContext.use().directory)
  }

  export async function resolveMcpConfigFile(input: { baseDirectory: string; worktree?: string; global?: boolean }) {
    if (input.global) return ConfigPaths.assertCanonicalDirectory(input.baseDirectory, ["config.json"])
    if (!input.worktree) {
      throw new Error("Project MCP config resolution requires the project worktree")
    }
    return ConfigPaths.assertCanonicalProject(input.baseDirectory, input.worktree)
  }

  export async function writeMcpConfigEntry(name: string, mcpConfig: Mcp, configPath: string) {
    const text = await Filesystem.readText(configPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "{}"
      throw error
    })
    const edits = modify(text, ["mcp", name], mcpConfig, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    })
    await Filesystem.write(configPath, applyEdits(text, edits))
    return configPath
  }

  async function assertCanonicalProjectConfig() {
    const context = ProjectInstanceContext.use()
    return ConfigPaths.assertCanonicalProject(context.directory, context.worktree)
  }

  export type ProjectMergePatch = Record<string, unknown>

  async function writeProjectPatch(
    patch: ProjectMergePatch | ((currentProject: Info) => ProjectMergePatch | Promise<ProjectMergePatch>),
  ) {
    const projectDirectory = ProjectInstanceContext.use().directory
    const [{ withConversationCapabilityReferenceMutation }, { withSkillCatalogMutation }] = await Promise.all([
      import("@/conversation/capability-transaction"),
      import("@/skill/reference-lock"),
    ])
    const target = await assertCanonicalProjectConfig()
    return withSkillCatalogMutation(() =>
      withConversationCapabilityReferenceMutation(async () => {
        let transition: { before: Info; after: Info } | undefined
        await fs.mkdir(path.dirname(target), { recursive: true })
        return writeConfigFile(target, patch, {
          async commit(merged, _appliedPatch, persist) {
            await state.reset()
            const before = structuredClone(await get())
            const candidate = await resolveProjectCandidate(merged)
            const { validateConfigCandidate } = await import("@/config/candidate-validation")
            await validateConfigCandidate({
              config: candidate,
              root: "config",
              projectDirectory,
              projectOwnedCapabilities: true,
            })
            await persist()
            transition = { before, after: candidate }
          },
          async onWritten(merged) {
            await state.reset()
            global.reset()
            const committedTransition = transition
            if (!committedTransition) {
              throw new Error("Project configuration post-commit reconciliation is missing its committed transition")
            }
            const projections = await Promise.allSettled([
              GlobalBus.emitAndWait("event", {
                directory: projectDirectory,
                payload: {
                  type: "config.changed",
                  properties: merged,
                },
              }),
              import("@/mcp").then(({ MCP }) => MCP.reconcileProjectConfig(committedTransition)),
            ])
            const failures = projections.flatMap((result) =>
              result.status === "rejected" ? [result.reason] : [],
            )
            if (failures.length > 0) {
              throw new ProjectConfigCommittedReconcileError(failures, committedTransition.after)
            }
          },
        })
      }),
    )
  }

  export async function updateProjectPatch(patch: ProjectMergePatch) {
    return writeProjectPatch(patch)
  }

  export async function updateProjectPatchAtomic(
    resolve: (currentProject: Info) => ProjectMergePatch | Promise<ProjectMergePatch>,
  ) {
    return writeProjectPatch(resolve)
  }

  export async function update(config: Info) {
    return updateProjectPatch(config as ProjectMergePatch)
  }

  function globalConfigFile() {
    return path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
  }

  function patchJsonc(input: string, patch: unknown, path: string[] = []): string {
    if (!isRecord(patch)) {
      // RFC 7396: a null value in the patch signals deletion of that key.
      // jsonc-parser's modify() removes the key when the value is undefined.
      if (patch === null) {
        let current: unknown = parseJsonc(input)
        for (const segment of path) {
          if (!isRecord(current) || !Object.hasOwn(current, segment)) return input
          current = current[segment]
        }
      }
      const valueToWrite = patch === null ? undefined : patch
      const edits = modify(input, path, valueToWrite, {
        formattingOptions: {
          insertSpaces: true,
          tabSize: 2,
        },
      })
      return applyEdits(input, edits)
    }

    return Object.entries(patch).reduce((result, [key, value]) => {
      if (value === undefined) return result
      return patchJsonc(result, value, [...path, key])
    }, input)
  }

  function parseConfig(text: string, filepath: string): Info {
    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const lines = text.split("\n")
      const errorDetails = errors
        .map((e) => {
          const beforeOffset = text.substring(0, e.offset).split("\n")
          const line = beforeOffset.length
          const column = beforeOffset[beforeOffset.length - 1].length + 1
          const problemLine = lines[line - 1]

          const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
          if (!problemLine) return error

          return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
        })
        .join("\n")

      throw new JsonError({
        path: filepath,
        message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${errorDetails}\n--- End ---`,
      })
    }

    const migrated = migrateLegacyPermissionConfig(data)
    const parsed = Info.safeParse(migrated.config)
    if (parsed.success) return parsed.data

    throw new InvalidError({
      path: filepath,
      issues: parsed.error.issues,
    })
  }

  // RFC 7396-compatible deep merge: null values in the source delete the
  // corresponding key from the target, matching patchJsonc's behavior.
  function mergeWithNullDelete(target: any, source: any): any {
    if (!isRecord(target) || !isRecord(source)) return source
    const result: Record<string, unknown> = { ...target }
    for (const [k, v] of Object.entries(source)) {
      if (v === null) {
        delete result[k]
      } else if (isRecord(v) && isRecord(result[k])) {
        result[k] = mergeWithNullDelete(result[k], v)
      } else {
        result[k] = v
      }
    }
    return result
  }

  function assertNoInheritedGlobalDeletes(
    effective: unknown,
    currentWritable: unknown,
    patch: unknown,
    path: string[] = [],
  ) {
    if (patch === null) {
      if (effective !== undefined && currentWritable === undefined) {
        const field = path.join(".")
        throw new GlobalConfigInheritedValueError({
          path: field,
          message: `Global config field ${field} is owned by a lower-priority file and cannot be deleted from the active writable layer.`,
        })
      }
      return
    }
    if (!isRecord(patch)) return
    for (const [key, value] of Object.entries(patch)) {
      assertNoInheritedGlobalDeletes(
        isRecord(effective) ? effective[key] : undefined,
        isRecord(currentWritable) ? currentWritable[key] : undefined,
        value,
        [...path, key],
      )
    }
  }

  // THE single API for applying a sparse session overlay onto a base config.
  // A session overlay is exactly an RFC 7396 merge-patch (sparse delta, null
  // deletes a key), so this reuses the existing mergeWithNullDelete primitive
  // rather than reimplementing deep/null-delete merge (single source — the
  // overlay schema forbids array keys, so the file-load concat-array layering
  // in mergeConfigConcatArrays is a different operation, not a parallel impl).
  // `base` (the Instance-cached project config) MUST stay immutable: callers
  // hold the resolved config and may mutate nested objects. mergeWithNullDelete
  // only shallow-clones each touched level, so unpatched nested subtrees would
  // alias `base` and a later mutation would silently pollute the shared cache
  // (the exact §8.3 pollution this design exists to prevent). structuredClone
  // fully de-aliases the result from `base`.
  export function mergeOverlay(base: Info, patch: Overlay): Info {
    return structuredClone(mergeWithNullDelete(base, patch)) as Info
  }

  export function previewOverlayUpdate(base: Info, current: Overlay, patch: Overlay) {
    const nextOverlay = Overlay.parse(structuredClone(mergeWithNullDelete(current, patch)))
    const effective = Info.parse(structuredClone(mergeWithNullDelete(base, nextOverlay)))
    return { nextOverlay, effective }
  }

  export function mergePatch(base: Info, patch: ProjectMergePatch): Record<string, unknown> {
    return structuredClone(mergeWithNullDelete(base, patch)) as Record<string, unknown>
  }

  // Serializes read-modify-write of each config file. Two concurrent
  // PATCH /config requests (e.g. user picks build=A then integrity=B in the
  // overlay panel before the first save returns) would otherwise both
  // readText() against the same "before" snapshot and the second write would
  // clobber the first agent's override. Keyed by absolute filepath so the
  // project file and the global file get independent locks.
  const writeConfigLocks = new Map<string, Promise<unknown>>()

  async function writeConfigFile(
    filepath: string,
    config: unknown | ((existing: Info) => unknown | Promise<unknown>),
    hooks?: {
      validate?(merged: Info, appliedPatch: unknown): Promise<void>
      commit?(merged: Info, appliedPatch: unknown, persist: () => Promise<void>): Promise<void>
      onWritten?(merged: Info): Promise<void>
    },
  ) {
    return withKeyedLock(writeConfigLocks, filepath, async () => {
      const before = await Filesystem.readText(filepath).catch((err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return "{}"
        throw new JsonError({ path: filepath }, { cause: err })
      })

      const existing = parseConfig(before, filepath)
      const appliedPatch = typeof config === "function" ? await config(existing) : config
      if (filepath.endsWith(".jsonc")) {
        const updated = patchJsonc(before, appliedPatch)
        const merged = parseConfig(updated, filepath)
        const persist = () => Filesystem.writeAtomic(filepath, updated)
        if (hooks?.commit) await hooks.commit(merged, appliedPatch, persist)
        else {
          await hooks?.validate?.(merged, appliedPatch)
          await persist()
        }
        await hooks?.onWritten?.(merged)
        return merged
      }
      const serialized = JSON.stringify(mergeWithNullDelete(existing, appliedPatch), null, 2)
      const merged = parseConfig(serialized, filepath)
      const persist = () => Filesystem.writeAtomic(filepath, serialized)
      if (hooks?.commit) await hooks.commit(merged, appliedPatch, persist)
      else {
        await hooks?.validate?.(merged, appliedPatch)
        await persist()
      }
      await hooks?.onWritten?.(merged)
      return merged
    })
  }

  type GlobalProjectTransition = {
    directory: string
    before: Info
    after: Info
  }

  async function globalProjectDirectories(): Promise<string[]> {
    const [{ Instance }, { Project }] = await Promise.all([import("@/project/instance"), import("@/project/project")])
    const directories = [...Project.registeredDirectories()]
    await Instance.forEachActive({
      fn() {
        directories.push(Instance.directory)
      },
    })
    return [...new Set(directories.map((directory) => Filesystem.resolve(directory)))]
  }

  async function removedGlobalSkillNames(candidate: Info, directory: string): Promise<Set<string>> {
    const [{ SkillManager }, { Instance }] = await Promise.all([
      import("@/skill/manager"),
      import("@/project/instance"),
    ])
    const candidatePaths = (candidate.skills?.paths ?? []).map((source) => Filesystem.resolve(source))
    const candidateUrls = new Set(candidate.skills?.urls ?? [])
    const removed = new Set<string>()
    const installed = await Instance.provideProjectIdentity({
      directory,
      fn: () => SkillManager.installed(),
    })
    for (const skill of installed) {
      if (skill.builtin) continue
      const stillConfigured =
        (skill.source_type === "config_url" && !!skill.source && candidateUrls.has(skill.source)) ||
        (!!skill.dir && candidatePaths.some((source) => Filesystem.contains(source, skill.dir!)))
      if (!stillConfigured) removed.add(skill.name)
    }
    return removed
  }

  async function commitGlobalCandidate(merged: Info, persist: () => Promise<void>) {
    const effectiveGlobal = await resolveGlobalCandidate(merged)
    const { SkillManager } = await import("@/skill/manager")
    const managedSkillRoot = SkillManager.managedRoot()
    for (const configuredPath of effectiveGlobal.skills?.paths ?? []) {
      const expanded = configuredPath.startsWith("~/")
        ? path.join(Global.Path.home, configuredPath.slice(2))
        : configuredPath
      const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(Global.Path.config, expanded)
      if (Filesystem.contains(managedSkillRoot, resolved) && !(await Filesystem.isDir(resolved))) {
        const { ConfigCandidateValidationError } = await import("@/config/candidate-validation")
        throw new ConfigCandidateValidationError({
          message: `Managed Skill path does not exist: ${resolved}`,
        })
      }
    }
    const directories = await globalProjectDirectories()
    const removedSkillsByDirectory = new Map<string, Set<string>>()
    for (const directory of directories) {
      removedSkillsByDirectory.set(directory, await removedGlobalSkillNames(effectiveGlobal, directory))
    }
    const { validateConfigCandidate } = await import("@/config/candidate-validation")
    const { ConversationCapability } = await import("@/conversation/capability")
    const { Instance } = await import("@/project/instance")
    const transitions: GlobalProjectTransition[] = []
    for (const directory of directories) {
      const before = await snapshotForProject(directory)
      const after = await snapshotForProject(directory, merged)
      const removedProjectSkills = removedSkillsByDirectory.get(directory) ?? new Set<string>()
      const assignedRemovedSkills = (["chat", "work"] as const).flatMap((agentID) =>
        ConversationCapability.assignment(after, agentID)
          .skill_refs.filter((name) => removedProjectSkills.has(name))
          .map((name) => `${agentID}:${name}`),
      )
      if (assignedRemovedSkills.length > 0) {
        throw new ConversationCapability.InvalidAssignmentError({
          message:
            `Conversation skill_refs references Skills removed from global configuration: ` +
            `${assignedRemovedSkills.join(", ")} (project ${directory})`,
        })
      }
      await Instance.provideProjectIdentity({
        directory,
        fn: () =>
          validateConfigCandidate({
            config: after,
            root: "global config",
            projectDirectory: directory,
            projectOwnedCapabilities: true,
          }),
      })
      transitions.push({ directory, before, after })
    }
    await validateConfigCandidate({
      config: effectiveGlobal,
      root: "global config",
      providerScope: "global",
    })
    await persist()
    global.reset()
    await state.resetAll()
    const { Skill } = await import("@/skill/skill")
    await Skill.state.resetAll()
    return transitions
  }

  async function reconcileGlobalProjectTransitions(transitions: readonly GlobalProjectTransition[]) {
    const [{ Instance }, { MCP }] = await Promise.all([import("@/project/instance"), import("@/mcp")])
    const settled = await Promise.allSettled(
      transitions.map((transition) =>
        Instance.provideProjectIdentity({
          directory: transition.directory,
          fn: () => MCP.reconcileProjectConfig(transition),
        }),
      ),
    )
    const failures = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new GlobalConfigCommittedReconcileError(
        failures.map((failure) => failure.reason),
        await getGlobal(),
      )
    }
  }

  async function writeGlobalMutation(patch: unknown | ((existing: Info) => unknown | Promise<unknown>)) {
    await ConfigPaths.assertCanonicalDirectory(Global.Path.config, ["config.json"])
    const [{ withConversationCapabilityReferenceMutation }, { withSkillCatalogMutation }] = await Promise.all([
      import("@/conversation/capability-transaction"),
      import("@/skill/reference-lock"),
    ])
    return withSkillCatalogMutation(() =>
      withConversationCapabilityReferenceMutation(async () => {
        let transitions: GlobalProjectTransition[] = []
        return writeConfigFile(globalConfigFile(), patch, {
          async commit(merged, _appliedPatch, persist) {
            transitions = await commitGlobalCandidate(merged, persist)
          },
          async onWritten() {
            await reconcileGlobalProjectTransitions(transitions)
          },
        })
      }),
    )
  }

  export function assertNoProjectOwnedConfig(input: Record<string, unknown>) {
    for (const key of ["skill_mounts", "primary_assistant_capabilities", "local_environment"] as const) {
      if (Object.hasOwn(input, key)) {
        throw new Error(`${key} is project-owned and cannot be written to global configuration.`)
      }
    }
  }

  export async function writeGlobal(config: Info) {
    assertNoProjectOwnedConfig(config)
    return writeGlobalMutation(config)
  }

  export async function updateGlobalPatch(patch: ProjectMergePatch) {
    assertNoProjectOwnedConfig(patch)
    return updateGlobalPatchAtomic(() => patch)
  }

  export async function updateGlobalPatchAtomic(
    resolve: (currentGlobal: Info, currentWritable: Info) => ProjectMergePatch | Promise<ProjectMergePatch>,
  ) {
    return writeGlobalMutation(async (currentWritable) => {
      const effective = structuredClone(await loadGlobalConfig({ writeSchema: false }))
      const patch = await resolve(effective, structuredClone(currentWritable))
      assertNoProjectOwnedConfig(patch)
      assertNoInheritedGlobalDeletes(effective, currentWritable, patch)
      return patch
    })
  }

  export async function directories() {
    return state().then((x) => x.directories)
  }
}
