import { Log } from "../util/log"
import { SkillReadDiagnostics } from "@/skill/read-diagnostics"
import { PackageInstallReceipt } from "@/bun/install-receipt"
import { CROSS_PROCESS_LOCK_RETRY, withProcessLock, withSharedJsonFactLock } from "@/util/process-lock"
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
import { type ParseError as JsoncParseError, applyEdits, modify, parse as parseJsonc } from "jsonc-parser"
import { createHash } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import { isDeepStrictEqual } from "node:util"
import { createInstanceState } from "../project/instance-state"
import { ProjectInstanceContext } from "../project/instance-context"
import { BunProc } from "@/bun"
import { Installation } from "@/installation"
import { ConfigMarkdown } from "./markdown"
import { constants, existsSync } from "fs"
import { GlobalBus } from "@/bus/global"
import { Glob } from "../util/glob"
import { PackageRegistry } from "@/bun/registry"
import { proxied } from "@/util/proxied"
import { ConfigPaths } from "./paths"
import { Filesystem } from "@/util/filesystem"
import { ChannelCatalog, buildChannelSchema } from "@/channel/catalog"
import { Lock } from "@/util/lock"
import { AgentRoleContract } from "@/agent/role-contract"
import { PromptProfileConfigSchema, PromptProfileOverlaySchema } from "@/agent/prompt-profile"
import { isModelReference } from "@/provider/model-ref"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { McpConfigSchema } from "./mcp-schema"
import { SkillMountOverlaySchema, SkillMountProjectConfigSchema } from "@/skill/mount-config"
import {
  ExpertSquadRuntimeOverridesSchema,
  ExpertSquadRuntimeOverlaysSchema,
  RuntimeTemplateOverridesSchema,
  RuntimeTemplateOverlaysSchema,
} from "@/agent/runtime-override"

export namespace Config {
  /** The one dependency a config tree is installed for. */
  const PLUGIN_DEPENDENCY = "@opencorvus-ai/plugin"

  /** The version spec this channel installs and reads back. One spelling, so
   *  the receipt key and the manifest entry cannot drift apart. */
  const installTargetVersion = () => (Installation.isLocal() ? "*" : Installation.VERSION)

  export const ModelId = z
    .string()
    .refine(isModelReference, {
      message: 'Model must be in the format "provider/model".',
    })
    .meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })
  export const DEFAULT_MODEL = "openai/gpt-5.5"
  const log = Log.create({ service: "config" })
  type LoadStateOptions = {
    readOnly?: boolean
    directory?: string
    worktree?: string
    projectFileOverride?: {
      filepath: string
      config: Source
    }
    globalFileOverride?: {
      filepath: string
      config: Source
    }
  }

  type ConfigLoadOptions = {
    persistMigrations?: boolean
    projectOwnedSource?: "project" | "non-project"
    base?: Info
  }

  export namespace TestHooks {
    export let beforeGlobalPersist: (() => Promise<void>) | undefined
    export let afterSourceSnapshotRead: ((input: { path: string }) => Promise<void>) | undefined
    export let afterSourceSnapshotParsed: ((input: { path: string }) => Promise<void>) | undefined
    export let afterProjectConfigAdmission: ((input: { directory: string }) => Promise<void>) | undefined
    export let beforeProjectRuntimeSettlement:
      | ((input: { directory: string; config: Info }) => Promise<void>)
      | undefined
    export let beforeGlobalRuntimeSettlement:
      | ((input: { transitions: readonly RuntimeTransition[] }) => Promise<void>)
      | undefined
  }

  const CONFIG_SCHEMA_URL = "https://opencorvus.ai/config.json"
  const LEGACY_PERMISSION_FIELDS = ["permission", "tool_permissions"] as const

  function legacyPermissionFields(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return []
    return LEGACY_PERMISSION_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(input, key))
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
    const sourceFields = legacyPermissionFields(source)
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

  const ProjectWritableConfigBoundary = z
    .object({
      execution_capacity: z.never().optional(),
    })
    .passthrough()

  function assertProjectOwnedConfigSource(data: unknown, source: string, loadOptions?: ConfigLoadOptions) {
    const parsed =
      loadOptions?.projectOwnedSource === "project"
        ? ProjectWritableConfigBoundary.safeParse(data)
        : NonProjectOwnedConfigBoundary.safeParse(data)
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
  function mergeConfigConcatArrays(target: Info, source: Source): Info {
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
    return merged as Info
  }

  type SourceRevision = Readonly<{
    path: string
    digest: string
  }>

  type SourceSnapshot = Readonly<{
    revision: SourceRevision
    text?: string
  }>

  type LoadedState = Awaited<ReturnType<typeof loadStateOnce>>

  const MISSING_SOURCE_DIGEST = createHash("sha256").update("opencorvus.config-source.missing.v1\0").digest("hex")
  const GLOBAL_PROJECT_GENERATION_LOCK = "config-global-project-generation"
  type ConfigGenerationToken = {
    active: boolean
    pending: Set<Promise<unknown>>
  }

  const configGenerationOwner = new AsyncLocalStorage<ConfigGenerationToken>()

  export class ConfigGenerationReentrantMutationError extends Error {
    constructor() {
      super("A Config mutation cannot start inside another Config generation settlement")
      this.name = "ConfigGenerationReentrantMutationError"
    }
  }

  async function runWithinConfigGeneration<T>(token: ConfigGenerationToken, fn: () => Promise<T>): Promise<T> {
    const operation = Promise.resolve().then(fn)
    token.pending.add(operation)
    try {
      return await operation
    } finally {
      token.pending.delete(operation)
    }
  }

  /** Admit configuration-dependent initialization before publishing its shared promise. */
  export async function withConfigGenerationRead<T>(fn: () => Promise<T>): Promise<T> {
    const token = configGenerationOwner.getStore()
    if (token?.active) return runWithinConfigGeneration(token, fn)
    await using _owner = await Lock.read(GLOBAL_PROJECT_GENERATION_LOCK)
    const owned: ConfigGenerationToken = { active: true, pending: new Set() }
    try {
      return await configGenerationOwner.run(owned, fn)
    } finally {
      while (owned.pending.size > 0) await Promise.allSettled([...owned.pending])
      owned.active = false
    }
  }

  async function withConfigGenerationWrite<T>(fn: () => Promise<T>): Promise<T> {
    const inherited = configGenerationOwner.getStore()
    if (inherited?.active) throw new ConfigGenerationReentrantMutationError()
    await using _owner = await Lock.write(GLOBAL_PROJECT_GENERATION_LOCK)
    const token: ConfigGenerationToken = { active: true, pending: new Set() }
    try {
      return await configGenerationOwner.run(token, fn)
    } finally {
      while (token.pending.size > 0) await Promise.allSettled([...token.pending])
      token.active = false
    }
  }

  function sourceDigest(text: string | undefined): string {
    if (text === undefined) return MISSING_SOURCE_DIGEST
    return createHash("sha256").update("opencorvus.config-source.bytes.v1\0").update(text).digest("hex")
  }

  async function readSourceSnapshot(filepath: string): Promise<SourceSnapshot> {
    const canonical = Filesystem.resolve(filepath)
    const text = await readFile(canonical)
    return {
      revision: {
        path: canonical,
        digest: sourceDigest(text ?? undefined),
      },
      text: text ?? undefined,
    }
  }

  async function readSourceRevision(filepath: string): Promise<SourceRevision> {
    return (await readSourceSnapshot(filepath)).revision
  }

  async function loadSourceSnapshot(snapshot: SourceSnapshot, options?: ConfigLoadOptions): Promise<Source> {
    const text = snapshot.text
    if (!text || text.trim().length === 0) return {}
    return load(text, { path: snapshot.revision.path }, options)
  }

  async function sourceRevisionsAreCurrent(revisions: readonly SourceRevision[]): Promise<boolean> {
    const current = await Promise.all(revisions.map((revision) => readSourceRevision(revision.path)))
    return current.every((revision, index) => revision.digest === revisions[index]?.digest)
  }

  async function loadStateOnce(options: LoadStateOptions = {}) {
    const loadOptions: ConfigLoadOptions = {
      persistMigrations: options.readOnly !== true,
      projectOwnedSource: "non-project",
    }
    const directory = options.directory ?? ProjectInstanceContext.use().directory
    const worktree = options.worktree ?? ProjectInstanceContext.use().worktree
    const canonicalProjectFile = !Flag.OPENCORVUS_DISABLE_PROJECT_CONFIG
      ? await ConfigPaths.assertCanonicalProject(directory, worktree)
      : undefined
    const auth = await Auth.all()
    const sourceRevisions = new Map<string, SourceRevision>()
    const loadStateFile = async (filepath: string, fileOptions?: ConfigLoadOptions) => {
      if (
        options.globalFileOverride &&
        Filesystem.resolve(filepath) === Filesystem.resolve(options.globalFileOverride.filepath)
      ) {
        return parseSourceLayer(options.globalFileOverride.config, filepath, fileOptions?.base)
      }
      if (
        options.projectFileOverride &&
        Filesystem.resolve(filepath) === Filesystem.resolve(options.projectFileOverride.filepath)
      ) {
        return parseSourceLayer(options.projectFileOverride.config, filepath, fileOptions?.base)
      }
      const snapshot = await readSourceSnapshot(filepath)
      sourceRevisions.set(snapshot.revision.path, snapshot.revision)
      await TestHooks.afterSourceSnapshotRead?.({ path: snapshot.revision.path })
      const config = await loadSourceSnapshot(snapshot, fileOptions)
      await TestHooks.afterSourceSnapshotParsed?.({ path: snapshot.revision.path })
      return config
    }

    if (canonicalProjectFile) {
      const projectRevision = await readSourceRevision(canonicalProjectFile)
      sourceRevisions.set(projectRevision.path, projectRevision)
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
        result = mergeConfigConcatArrays(
          result,
          await load(
            JSON.stringify(remoteConfig),
            {
              dir: path.dirname(`${key}/.well-known/opencorvus`),
              source: `${key}/.well-known/opencorvus`,
            },
            { ...loadOptions, base: result },
          ),
        )
        log.debug("loaded remote config from well-known", { url: key })
      }
    }

    for (const plugin of await loadPackagedPlugins()) {
      result.plugin = [...(result.plugin ?? []), plugin]
    }

    // Global user config overrides remote config.
    result = mergeConfigConcatArrays(result, await loadGlobalConfig({ ...loadOptions, base: result }, loadStateFile))

    // Custom config path overrides global config.
    if (Flag.OPENCORVUS_CONFIG) {
      result = mergeConfigConcatArrays(
        result,
        await loadStateFile(Flag.OPENCORVUS_CONFIG, { ...loadOptions, base: result }),
      )
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
      // The global file was already merged before the custom-file layer.
      // Keep its directory for resources without promoting its values again.
      const isGlobalConfigDir =
        Filesystem.normalizeForCompare(Filesystem.resolve(dir)) ===
        Filesystem.normalizeForCompare(Filesystem.resolve(Global.Path.config))
      const loadsConfig =
        isExactProjectConfigDir || (isNonProjectConfigDir && !isGlobalConfigDir)
      if (loadsConfig) {
        const filepath = await ConfigPaths.assertCanonicalDirectory(dir)
        const projectOwnedSource = isExactProjectConfigDir ? "project" : "non-project"
        log.debug(`loading config from ${filepath}`)
        result = mergeConfigConcatArrays(
          result,
          await loadStateFile(filepath, { ...loadOptions, projectOwnedSource, base: result }),
        )
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
        // Readiness is meaningful only while holding the directory generation
        // owner. Always join it; the owned reader decides whether this caller
        // installs or observes the generation another backend just published.
        const operation = installDependencies(dir)
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
          { ...loadOptions, base: result },
        ),
      )
      log.debug("loaded custom config from OPENCORVUS_CONFIG_CONTENT")
    }

    // Load managed config files last (highest priority) - enterprise admin-controlled
    // Kept separate from directories array to avoid write operations when installing plugins
    // which would fail on system directories requiring elevated permissions
    // This way it only loads config file and not skills/plugins/commands
    const managedLoadOptions = { ...loadOptions, persistMigrations: false, base: result }
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
    result = materializeBuiltinMcp(parseEffectiveConfig(result, managedFile))

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
      sourceRevisions: [...sourceRevisions.values()].sort((left, right) => left.path.localeCompare(right.path)),
    }
  }

  async function loadState(options: LoadStateOptions = {}): Promise<LoadedState> {
    while (true) {
      const loaded = await SkillReadDiagnostics.phase("config.load", () => loadStateOnce(options))
      if (await SkillReadDiagnostics.phase("config.verify", () => sourceRevisionsAreCurrent(loaded.sourceRevisions)))
        return loaded
    }
  }

  const stateSource = createInstanceState(
    () => SkillReadDiagnostics.initialize("config", () => loadState()),
    undefined,
    "config",
  )

  async function resetProjectState(): Promise<void> {
    await using _owner = await Lock.write("config-peer-state-lifecycle")
    await stateSource.reset()
  }

  async function resetAllProjectStates(): Promise<void> {
    await using _owner = await Lock.write("config-peer-state-lifecycle")
    for (const entry of stateSource.inspectAll()) loadedProjectConfigs.add(Filesystem.resolve(entry.key))
    await stateSource.resetAll()
  }

  export const state = Object.assign(
    () =>
      withConfigGenerationRead(async () => {
        await using _lifecycleOwner = await Lock.read("config-peer-state-lifecycle")
        return SkillReadDiagnostics.readState("config", stateSource)
      }),
    {
      async reset() {
        await resetProjectState()
      },
      async resetAll() {
        await resetAllProjectStates()
      },
      inspectAll: () => stateSource.inspectAll(),
    },
  )

  export async function waitForDependencies() {
    const deps = await state().then((x) => x.deps)
    const outcomes = await SkillReadDiagnostics.phase("config.dependencies", () => Promise.all(deps))
    const errors = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.error]))
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, "Multiple config dependency installations failed")
  }

  async function withDependencyInstallOwner<T>(dir: string, fn: (ownedDirectory: string) => Promise<T>): Promise<T> {
    const ownedDirectory = Filesystem.resolve(dir)
    const key = `config-dependency-install:${Filesystem.normalizePath(ownedDirectory)}`
    await fs.mkdir(ownedDirectory, { recursive: true })
    // Dependency installation has no fixed wall-clock bound: registry access,
    // extraction and lifecycle scripts may all make legitimate progress for
    // longer than the generic keyed mutex's 30-second queue. Join the current
    // directory owner without inventing a shorter admission timeout, then use
    // the same retrying process lock as the other shared installation owners.
    using _directoryOwner = await Lock.write(key)
    return await withProcessLock(ownedDirectory, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, () =>
      fn(ownedDirectory),
    )
  }

  export async function installDependencies(dir: string) {
    return withDependencyInstallOwner(dir, async (dir) => {
      // A second project Instance may have completed the shared installation
      // while this owner waited. Re-check under both the process-local and
      // cross-process directory owner before changing canonical files.
      if (!(await needsInstallOwned(dir))) return
      const pkg = path.join(dir, "package.json")
      const gitignore = path.join(dir, ".gitignore")
      const targetVersion = installTargetVersion()
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

      // Open the target generation before any canonical mutation. This
      // retires a historical target receipt first, so a crash can never pair
      // that receipt with bytes from this attempt and report them Ready.
      const installOccurrenceID = await PackageInstallReceipt.begin({
        root: dir,
        package: PLUGIN_DEPENDENCY,
        requestedVersion: targetVersion,
      })

      try {
        // Once the occurrence is open, advance the selector to the desired
        // generation and never roll it back independently of the physical
        // tree. A failed `bun install` may already have rewritten node_modules;
        // retaining the target selector beside a rolled-back/unsettled target
        // receipt makes the next owner reinstall. Restoring an old selector
        // would let its historical committed receipt bless that partial tree.
        await Filesystem.writeAtomic(pkg, JSON.stringify(json, null, 2))
        await Filesystem.writeAtomicIfAbsent(
          gitignore,
          ["node_modules", "package.json", "bun.lock", ".gitignore"].join("\n"),
        )
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
        // Readiness is published only after the resolved tree verifies, so a
        // killed install can never be read back as an installed one.
        const installedVersion = z
          .object({ version: z.string().min(1) })
          .passthrough()
          .parse(await Filesystem.readJson(path.join(dir, "node_modules", PLUGIN_DEPENDENCY, "package.json"))).version
        await PackageInstallReceipt.verifyAndPublish({
          occurrenceID: installOccurrenceID,
          root: dir,
          package: PLUGIN_DEPENDENCY,
          requestedVersion: targetVersion,
          resolvedVersion: installedVersion,
          moduleDirectory: path.join(dir, "node_modules", PLUGIN_DEPENDENCY),
          // `bun install` installed everything this config declares, so the
          // receipt has to certify all of it: a tree whose user-declared
          // extra dependency never completed must not read as installed.
          additionalDependencies: Object.keys(json.dependencies ?? {}),
        })
      } catch (cause) {
        await PackageInstallReceipt.rollback(
          installOccurrenceID,
          cause instanceof Error ? cause.message : String(cause),
        ).catch(() => undefined)
        throw cause
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

  async function needsInstallOwned(dir: string) {
    const nodeModules = path.join(dir, "node_modules")
    const pkg = path.join(dir, "package.json")
    const pkgExists = await Filesystem.exists(pkg)
    // Physical existence is not readiness. A killed `bun install` leaves a
    // node_modules tree and a package.json naming the right version behind,
    // and reading those as proof made every later load use an incomplete tree
    // forever. The completeness receipt for this exact tree and revision is
    // the authority, exactly as it is for the shared registry cache.
    let required = !existsSync(nodeModules) || !pkgExists
    if (!required) {
      const parsed = z
        .object({ dependencies: z.record(z.string(), z.string()).optional() })
        .passthrough()
        .parse(await Filesystem.readJson(pkg))
      const depVersion = parsed.dependencies?.["@opencorvus-ai/plugin"]
      if (!depVersion) required = true
      else {
        // The spec the install writes is the spec this compares against — one
        // spelling of the channel's target, so the receipt key and the manifest
        // entry cannot drift apart. The local channel's spec is a wildcard, and
        // every version satisfies a wildcard, so asking the registry whether it
        // was outdated was a network round trip whose only possible answer was
        // the one this comparison already gives.
        required = depVersion !== installTargetVersion()
      }
      if (!required) {
        const published = await PackageInstallReceipt.isPublished({
          root: dir,
          package: PLUGIN_DEPENDENCY,
          version: depVersion!,
        })
        if (!published) {
          log.info("config dependency tree has no completeness receipt, reinstalling", { dir, depVersion })
          required = true
        }
      }
    }
    if (!required) return false
    if (!(await isWritable(dir))) {
      throw new Error(`Config dependency installation is required but the directory is not writable: ${dir}`)
    }
    return true
  }

  export async function needsInstall(dir: string) {
    return withDependencyInstallOwner(dir, needsInstallOwned)
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
        ...(computer ? {} : { [ComputerMCPBuiltin.ServerName]: ComputerMCPBuiltin.localConfig() }),
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
          todo: PermissionAction.optional(),
          question: PermissionAction.optional(),
          webfetch: PermissionAction.optional(),
          websearch: PermissionAction.optional(),
          external_code_search: PermissionAction.optional(),
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

  export const MemoryAgentOverride = NativeAgentOverride.omit({ model: true }).meta({ ref: "MemoryAgentOverride" })
  export type MemoryAgentOverride = z.infer<typeof MemoryAgentOverride>

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
      username: z.string().min(1).optional().describe("Proxy authentication username"),
      password: z.string().min(1).optional().describe("Proxy authentication password"),
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

  export const ExecutionCapacity = z
    .object({
      scheduler_message: z.number().int().min(1).max(64).optional(),
      automation: z.number().int().min(1).max(64).optional(),
      event: z.number().int().min(1).max(64).optional(),
      provider: z.number().int().min(1).max(64).optional(),
    })
    .strict()
    .meta({ ref: "ExecutionCapacityConfig" })
  export type ExecutionCapacity = z.infer<typeof ExecutionCapacity>

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
      execution_capacity: ExecutionCapacity.optional().describe(
        "Global physical execution limits. These bound resource use without owning scheduling, retry, or completion state.",
      ),
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
          memory: MemoryAgentOverride.optional(),
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
      prompt: z
        .record(z.string(), z.string())
        .optional()
        .describe("System-scope prompt overrides keyed by prompt identifier (e.g. core_header)"),
      prompt_profile: z
        .lazy(() => PromptProfileConfigSchema)
        .describe("Active package-backed expert-squad prompt profile selection."),
      skill_mounts: SkillMountProjectConfigSchema.optional().describe(
        "Project-owned operator skill overrides qualified by expert squad, projected Skill owner, and default skill ref.",
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
          max_context_tokens: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              "Maximum prompt-context tokens for streamed requests and automatic compaction. Defaults to 256000; explicitly set a larger value to use a longer context. Model input capacity and output reservation may lower this ceiling.",
            ),
          reserved: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              "Minimum combined-window output reservation. The actual request output cap is always reserved; an independent input limit is intersected without subtracting it again.",
            ),
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
            .describe(
              "Maximum recent conversation units (user messages or completed assistant steps) considered for verbatim retention. Defaults to 2; tool call/result pairs remain intact.",
            ),
          preserve_recent_tokens: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              "Token budget for verbatim recent-tail retention. Defaults to 25% of usable prompt capacity, bounded by the compaction trigger; explicit zero retains no tail.",
            ),
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
              session_tool_idle_ms: z
                .number()
                .int()
                .min(1000)
                .optional()
                .describe("Max idle window without a committed Tool progress fact, ms"),
              execution_progress_idle_ms: z
                .number()
                .int()
                .min(1000)
                .optional()
                .describe("Max idle window without durable execution progress, ms"),
            })
            .optional()
            .describe(
              "Inactivity thresholds for session LLM chunks, durable live Tool progress, and provider execution work.",
            ),
          max_executor_groups: z.number().int().min(1).optional().describe("Maximum parallel projected agent sessions"),
        })
        .strict()
        .optional()
        .describe("Shared assistant runtime activity and parallelism configuration"),
      experimental: z
        .object({
          disable_paste_summary: z.boolean().optional(),
          openTelemetry: z
            .boolean()
            .optional()
            .describe("Enable OpenTelemetry spans for AI SDK calls (using the 'telemetry' flag)"),
          primary_tools: z
            .array(z.string())
            .optional()
            .describe("Tools that should only be available to primary agents."),
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
      const browser = config.mcp?.[BrowserMCPBuiltin.ServerName]
      if (browser) {
        try {
          BrowserMCPBuiltin.configuredDeclaration(browser)
        } catch (error) {
          if (!BrowserMCPBuiltin.ConfigurationError.isInstance(error)) throw error
          ctx.addIssue({
            code: "custom",
            path: ["mcp", BrowserMCPBuiltin.ServerName, error.data.providerType === "local" ? "command" : "type"],
            message: error.data.message,
          })
        }
      }
      const computer = config.mcp?.[ComputerMCPBuiltin.ServerName]
      if (computer) {
        try {
          ComputerMCPBuiltin.configuredDeclaration(computer)
        } catch (error) {
          if (!ComputerMCPBuiltin.ConfigurationError.isInstance(error)) throw error
          ctx.addIssue({
            code: "custom",
            path: ["mcp", ComputerMCPBuiltin.ServerName, "type"],
            message: error.data.message,
          })
        }
      }
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

  type DeclaredFields<T> = unknown extends T
    ? T
    : T extends readonly unknown[]
      ? T
      : T extends object
        ? string extends keyof T
          ? { [K in keyof T]: DeclaredFields<T[K]> }
          : { [K in keyof T]?: DeclaredFields<T[K]> }
        : T
  /** A canonical file owns only its declared values, not schema defaults. */
  export type Source = DeclaredFields<z.input<typeof Info>>

  function parseEffectiveConfig(value: unknown, source: string): Info {
    const parsed = Info.safeParse(value)
    if (parsed.success) return parsed.data
    throw new InvalidError({ path: source, issues: parsed.error.issues })
  }

  function declaredValues(source: unknown, effective: unknown): unknown {
    if (!isRecord(source) || !isRecord(effective)) return structuredClone(effective)
    return Object.fromEntries(
      Object.keys(source)
        .filter((key) => Object.hasOwn(effective, key))
        .map((key) => [key, declaredValues(source[key], effective[key])]),
    )
  }

  function parseSourceLayer(value: unknown, source: string, base: Info = Info.parse({})): Source {
    // Normalize each declared array as its own value. Extension-list accumulation
    // belongs to the actual layer merge, not the source's writable projection.
    const effective = parseEffectiveConfig(isRecord(value) ? mergeDeep(base, value) : value, source)
    return declaredValues(value, effective) as Source
  }

  async function loadGlobalConfig(
    options?: ConfigLoadOptions,
    loader: (filepath: string, options?: ConfigLoadOptions) => Promise<Source> = loadFile,
  ) {
    const canonical = await ConfigPaths.assertCanonicalDirectory(Global.Path.config, ["config.json"])
    return loader(canonical, options)
  }

  let globalState: Promise<{ config: Info; revision: SourceRevision }> | undefined
  let globalConfigLoaded = false
  let globalObservedRevision: SourceRevision | undefined
  let pendingGlobalSettlementEvent = false

  async function loadStableGlobalState(): Promise<{ config: Info; revision: SourceRevision }> {
    const filepath = await ConfigPaths.assertCanonicalDirectory(Global.Path.config, ["config.json"])
    while (true) {
      const snapshot = await readSourceSnapshot(filepath)
      // File layers stay sparse; published global configuration is effective Info,
      // including schema defaults when the canonical file is absent or blank.
      const config = parseEffectiveConfig(await loadSourceSnapshot(snapshot), filepath)
      if (await sourceRevisionsAreCurrent([snapshot.revision])) return { config, revision: snapshot.revision }
    }
  }

  async function currentGlobalState() {
    const cached = await globalState
    if (cached && (await sourceRevisionsAreCurrent([cached.revision]))) return cached
    await using _owner = await Lock.write("config-global-source-cache")
    const current = await globalState
    if (current && (await sourceRevisionsAreCurrent([current.revision]))) return current
    const next = loadStableGlobalState()
    globalState = next
    try {
      return await next
    } catch (error) {
      if (globalState === next) globalState = undefined
      throw error
    }
  }

  export const global = Object.assign(() => withConfigGenerationRead(async () => (await currentGlobalState()).config), {
    reset() {
      globalState = undefined
    },
  })

  export const { readFile } = ConfigPaths

  async function loadFile(filepath: string, options?: ConfigLoadOptions): Promise<Source> {
    log.info("loading", { path: filepath })
    const text = await readFile(filepath)
    if (!text || text.trim().length === 0) return {}
    return load(text, { path: filepath }, options)
  }

  async function load(
    text: string,
    options: { path: string } | { dir: string; source: string },
    loadOptions?: ConfigLoadOptions,
  ) {
    const source = "path" in options ? options.path : options.source
    const data = await ConfigPaths.parseText(
      text,
      "path" in options ? options.path : { source: options.source, dir: options.dir },
    )

    const legacy = migrateLegacyPermissionConfig(data)
    if (legacy.migration && "path" in options && loadOptions?.persistMigrations !== false) {
      await ensurePermissionMigration(options.path)
    }

    // Parse this exact snapshot, even if its migration just changed the file.
    // The enclosing source-revision check reloads any changed generation.
    assertProjectOwnedConfigSource(legacy.config, source, loadOptions)
    return parseSourceLayer(legacy.config, source, loadOptions?.base)
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

  type RuntimeTransition = Readonly<{
    directory: string
    before: Info
    after: Info
  }>

  function runtimeConfigsEqual(left: Info, right: Info): boolean {
    return isDeepStrictEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)))
  }

  const pendingPeerTransitions = new Map<string, RuntimeTransition>()
  const queuedPeerTargets = new Map<string, Info>()
  const pendingPeerSettlements = new Map<string, Promise<void>>()
  const writerRetryDirectories = new Set<string>()
  const loadedProjectConfigs = new Set<string>()
  let peerConvergenceMonitor: ReturnType<typeof setInterval> | undefined
  let peerConvergenceRunning = false

  export async function publishGlobalConfigSettlement(): Promise<void> {
    const { Event } = await import("@/server/event")
    await GlobalBus.emit("event", {
      directory: "global",
      payload: {
        type: Event.Disposed.type,
        properties: {},
      },
    })
  }

  async function observeGlobalPeerState(): Promise<void> {
    await withConfigGenerationRead(async () => {
      if (!globalConfigLoaded) return
      const cached = await globalState
      const observed = cached?.revision ?? globalObservedRevision
      if (!observed || (await sourceRevisionsAreCurrent([observed]))) return
      const current = await currentGlobalState()
      globalObservedRevision = current.revision
      pendingGlobalSettlementEvent = true
    })
  }

  function projectRuntimeSettlementKey(directory: string): string {
    return `config-runtime-settlement:${Filesystem.normalizePath(directory)}`
  }

  async function applyProjectRuntimeTransition(
    transition: RuntimeTransition,
    options: { resetDerivedCaches?: boolean } = {},
  ): Promise<void> {
    const [{ MCP }, { Provider }, { NativeAgentRegistryLifecycle }, { ChannelSupervisor }] = await Promise.all([
      import("@/mcp"),
      import("@/provider/provider"),
      import("@/agent/native-agent-registry-lifecycle"),
      import("@/channel/supervisor"),
    ])
    const resetDerivedCaches = options.resetDerivedCaches !== false
    const settled = await Promise.allSettled([
      MCP.reconcileProjectConfig({ before: transition.before, after: transition.after }),
      ...(resetDerivedCaches ? [Provider.reset(), NativeAgentRegistryLifecycle.reset()] : []),
      ChannelSupervisor.sync(transition.after),
    ])
    const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length > 0) throw new ProjectConfigCommittedReconcileError(failures, transition.after)
    const { CapabilityCatalogCache } = await import("@/capability/catalog")
    await CapabilityCatalogCache.invalidate([
      "project-config",
      "mcp-config",
      "skill-manager",
      "mission-skill-registry",
      "expert-squad-registry",
      "tool-registry",
    ])
    try {
      await GlobalBus.emitAndWait("event", {
        directory: transition.directory,
        payload: {
          type: "config.changed",
          properties: transition.after,
        },
      })
    } catch (error) {
      throw new ProjectConfigCommittedReconcileError([error], transition.after)
    }
  }

  function advancePendingPeerTransition(directory: string, pending: RuntimeTransition): boolean {
    if (pendingPeerTransitions.get(directory) !== pending) return false
    const target = queuedPeerTargets.get(directory)
    if (!target) {
      pendingPeerTransitions.delete(directory)
      writerRetryDirectories.delete(directory)
      return false
    }
    queuedPeerTargets.delete(directory)
    pendingPeerTransitions.set(directory, {
      directory,
      before: pending.after,
      after: target,
    })
    return true
  }

  function queueCurrentConfigAfterPending(directory: string, config: Info): void {
    const pending = pendingPeerTransitions.get(directory)
    if (!pending || runtimeConfigsEqual(pending.after, config)) return
    queuedPeerTargets.set(directory, structuredClone(config) as Info)
  }

  async function settleProjectRuntimeTransition(
    transition: RuntimeTransition,
    options: { resetDerivedCaches?: boolean } = {},
  ): Promise<void> {
    await using _owner = await Lock.write(projectRuntimeSettlementKey(transition.directory))
    while (true) {
      const pending = pendingPeerTransitions.get(transition.directory)
      if (!pending) break
      try {
        await applyProjectRuntimeTransition(pending)
      } catch (error) {
        queuedPeerTargets.set(transition.directory, transition.after)
        writerRetryDirectories.add(transition.directory)
        ensurePeerConvergenceMonitor()
        schedulePendingPeerTransition(transition.directory)
        throw new ProjectConfigCommittedReconcileError([error], transition.after)
      }
      advancePendingPeerTransition(transition.directory, pending)
    }
    pendingPeerTransitions.set(transition.directory, transition)
    try {
      await applyProjectRuntimeTransition(transition, options)
    } catch (error) {
      writerRetryDirectories.add(transition.directory)
      ensurePeerConvergenceMonitor()
      schedulePendingPeerTransition(transition.directory)
      throw error
    }
    advancePendingPeerTransition(transition.directory, transition)
  }

  function schedulePendingPeerTransition(directory: string): void {
    const pending = pendingPeerTransitions.get(directory)
    if (!pending) return
    if (pendingPeerSettlements.has(directory)) return
    let reschedulePending = false
    const runtimeOwner = Lock.reserveWrite(projectRuntimeSettlementKey(directory))
    const settlement = Promise.all([import("@/project/instance"), import("@/storage/db")])
      .then(([{ Instance, runOutsideInstanceContext }, { Database }]) => {
        const settle = async () => {
          await using _owner = await runtimeOwner.acquired
          if (pendingPeerTransitions.get(directory) !== pending) return false
          await applyProjectRuntimeTransition(pending)
          reschedulePending = advancePendingPeerTransition(directory, pending)
          return true
        }
        return Database.runOutsideContext(() =>
          runOutsideInstanceContext(async () =>
            writerRetryDirectories.has(directory)
              ? await Instance.provideProjectIdentity({ directory, fn: settle })
              : await Instance.tryProvideActive({ directory, fn: settle }),
          ),
        )
      })
      .then(async (settled) => {
        if (pendingPeerTransitions.get(directory) !== pending) return
        if (!settled) {
          // An identity-only writer can still be applying this transition.
          // Its reserved runtime turn decides whether this is inactive peer
          // work or the same writer's exact failed projection to retry.
          await using _owner = await runtimeOwner.acquired
          if (pendingPeerTransitions.get(directory) !== pending) return
          if (writerRetryDirectories.has(directory)) {
            reschedulePending = true
            return
          }
          pendingPeerTransitions.delete(directory)
          queuedPeerTargets.delete(directory)
          writerRetryDirectories.delete(directory)
        }
      })
      .catch((error) => {
        log.warn("peer configuration runtime projection failed", {
          directory,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        runtimeOwner.cancel()
        if (pendingPeerSettlements.get(directory) === settlement) pendingPeerSettlements.delete(directory)
        if (reschedulePending) schedulePendingPeerTransition(directory)
      })
    pendingPeerSettlements.set(directory, settlement)
  }

  async function currentProjectStateUnderGenerationOwner(): Promise<LoadedState> {
    await using _lifecycleOwner = await Lock.read("config-peer-state-lifecycle")
    const directory = ProjectInstanceContext.use().directory
    await TestHooks.afterProjectConfigAdmission?.({ directory })
    const cached = await SkillReadDiagnostics.readState("config", stateSource)
    ensurePeerConvergenceMonitor()
    if (await sourceRevisionsAreCurrent(cached.sourceRevisions)) {
      loadedProjectConfigs.add(Filesystem.resolve(directory))
      queueCurrentConfigAfterPending(directory, cached.config)
      schedulePendingPeerTransition(directory)
      return cached
    }
    await using _owner = await Lock.write(`config-source-cache:${Filesystem.normalizePath(directory)}`)
    const owned = await SkillReadDiagnostics.readState("config", stateSource)
    if (await sourceRevisionsAreCurrent(owned.sourceRevisions)) {
      loadedProjectConfigs.add(Filesystem.resolve(directory))
      queueCurrentConfigAfterPending(directory, owned.config)
      schedulePendingPeerTransition(directory)
      return owned
    }
    const before = structuredClone(owned.config) as Info
    await stateSource.reset()
    const next = await SkillReadDiagnostics.readState("config", stateSource)
    ensurePeerConvergenceMonitor()
    const transition: RuntimeTransition = {
      directory,
      before,
      after: structuredClone(next.config) as Info,
    }
    loadedProjectConfigs.add(Filesystem.resolve(directory))
    if (!runtimeConfigsEqual(transition.before, transition.after)) {
      if (pendingPeerTransitions.has(directory)) queueCurrentConfigAfterPending(directory, transition.after)
      else pendingPeerTransitions.set(directory, transition)
      schedulePendingPeerTransition(directory)
    }
    return next
  }

  async function currentProjectState(): Promise<LoadedState> {
    return withConfigGenerationRead(() => currentProjectStateUnderGenerationOwner())
  }

  async function convergeLoadedPeerStates(): Promise<void> {
    if (peerConvergenceRunning) return
    peerConvergenceRunning = true
    try {
      await observeGlobalPeerState()
      const { Instance } = await import("@/project/instance")
      const activeDirectories = new Set<string>()
      await Instance.forEachActive({
        fn: async () => {
          const directory = Filesystem.resolve(ProjectInstanceContext.use().directory)
          activeDirectories.add(directory)
          if (!loadedProjectConfigs.has(directory)) return
          try {
            await currentProjectState()
          } catch (error) {
            log.warn("peer configuration convergence failed", {
              directory,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        },
      })
      for (const directory of [...loadedProjectConfigs]) {
        if (!activeDirectories.has(directory)) loadedProjectConfigs.delete(directory)
      }
      for (const directory of writerRetryDirectories) schedulePendingPeerTransition(directory)
      await Promise.all([...pendingPeerSettlements.values()])
      if (
        pendingGlobalSettlementEvent &&
        pendingPeerTransitions.size === 0 &&
        queuedPeerTargets.size === 0 &&
        pendingPeerSettlements.size === 0
      ) {
        await publishGlobalConfigSettlement()
        pendingGlobalSettlementEvent = false
      }
    } finally {
      peerConvergenceRunning = false
    }
  }

  function ensurePeerConvergenceMonitor(): void {
    if (peerConvergenceMonitor) return
    peerConvergenceMonitor = setInterval(() => {
      if (
        loadedProjectConfigs.size === 0 &&
        !globalConfigLoaded &&
        !pendingGlobalSettlementEvent &&
        pendingPeerTransitions.size === 0 &&
        queuedPeerTargets.size === 0 &&
        pendingPeerSettlements.size === 0
      ) {
        clearInterval(peerConvergenceMonitor)
        peerConvergenceMonitor = undefined
        return
      }
      void Promise.all([import("@/project/instance"), import("@/storage/db")])
        .then(([{ runOutsideInstanceContext }, { Database }]) =>
          Database.runOutsideContext(() => runOutsideInstanceContext(() => convergeLoadedPeerStates())),
        )
        .catch((error) => {
          log.warn("peer configuration monitor failed", {
            error: error instanceof Error ? error.message : String(error),
          })
        })
    }, 250)
    peerConvergenceMonitor.unref()
  }

  export async function get() {
    return (await currentProjectState()).config
  }

  export async function snapshotForProject(directory: string, globalConfigOverride?: Source) {
    const resolvedDirectory = Filesystem.resolve(directory)
    const { Project } = await import("@/project/project")
    const worktree = await SkillReadDiagnostics.phase("config.snapshot.worktree", () =>
      Project.worktreeBoundary(resolvedDirectory),
    )
    return readOnlyProjectSnapshot(resolvedDirectory, worktree, globalConfigOverride)
  }

  async function readOnlyProjectSnapshot(directory: string, worktree: string, globalConfigOverride?: Source) {
    return structuredClone(
      (
        await loadState({
          readOnly: true,
          directory,
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
    return withConfigGenerationRead(async () => {
      const current = await currentGlobalState()
      globalConfigLoaded = true
      globalObservedRevision = current.revision
      ensurePeerConvergenceMonitor()
      return current.config
    })
  }

  /** Returns only the project-owned writable config, without inherited global values. */
  export async function getProject() {
    const target = await assertCanonicalProjectConfig()
    return withConfigGenerationRead(async () => {
      while (true) {
        const resolved = await loadState({ readOnly: true })
        const source = await readSourceSnapshot(target)
        const config = await loadSourceSnapshot(source, {
          persistMigrations: false,
          projectOwnedSource: "project",
          base: resolved.config,
        })
        if (await sourceRevisionsAreCurrent([...resolved.sourceRevisions, source.revision])) return config
      }
    })
  }

  async function resolveProjectCandidate(projectConfig: Source) {
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

  async function resolveGlobalCandidate(globalConfig: Source) {
    const target = globalConfigFile()
    const source = await loadGlobalConfig({ persistMigrations: false }, (filepath, options) =>
      Filesystem.resolve(filepath) === Filesystem.resolve(target)
        ? Promise.resolve(parseSourceLayer(globalConfig, target))
        : loadFile(filepath, options),
    )
    return parseEffectiveConfig(source, target)
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
    // A read-modify-write of the same file `writeConfigFile` owns, so it takes
    // the same lock and replaces the file atomically. A global MCP write must
    // first converge and own the Skill catalog: global config is part of a
    // Skill replacement occurrence, so every global writer shares the exact
    // catalog-owner -> config-file-owner order.
    const write = () =>
      withConfigFileLock(configPath, async () => {
        const text = await Filesystem.readText(configPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return "{}"
          throw error
        })
        let updated = applyEdits(
          text,
          modify(text, ["mcp", name], mcpConfig, {
            formattingOptions: { tabSize: 2, insertSpaces: true },
          }),
        )
        if (!parseConfig(updated, configPath).$schema) {
          updated = applyEdits(
            updated,
            modify(updated, ["$schema"], CONFIG_SCHEMA_URL, {
              formattingOptions: { tabSize: 2, insertSpaces: true },
            }),
          )
        }
        await Filesystem.writeAtomic(configPath, updated)
      })
    if (Filesystem.resolve(configPath) === Filesystem.resolve(globalConfigFile())) {
      const { SkillManager } = await import("@/skill/manager")
      await SkillManager.withCatalogMutationOwner(write)
    } else {
      await write()
    }
    return configPath
  }

  async function assertCanonicalProjectConfig() {
    const context = ProjectInstanceContext.use()
    return ConfigPaths.assertCanonicalProject(context.directory, context.worktree)
  }

  export type ProjectMergePatch = Record<string, unknown>

  // Catalog/reference readers may read Config while retaining their owners.
  // A writer must acquire those owners before excluding Config readers, or a
  // Skill projection and a concurrent Project initialization form a cycle.
  async function withConfigMutationAuthority<T>(mutate: () => Promise<T>): Promise<T> {
    if (configGenerationOwner.getStore()?.active) throw new ConfigGenerationReentrantMutationError()
    const [{ withConversationCapabilityReferenceMutation }, { withSkillCatalogMutation }, { SkillManager }] =
      await Promise.all([
        import("@/conversation/capability-transaction"),
        import("@/skill/reference-lock"),
        import("@/skill/manager"),
      ])
    return withSkillCatalogMutation(() =>
      withConversationCapabilityReferenceMutation(() =>
        SkillManager.withCatalogMutationOwner(() => withConfigGenerationWrite(mutate)),
      ),
    )
  }

  async function writeProjectPatch(
    patch: ProjectMergePatch | ((currentProject: Source) => ProjectMergePatch | Promise<ProjectMergePatch>),
  ) {
    return withConfigMutationAuthority(async () => {
      const projectDirectory = ProjectInstanceContext.use().directory
      const target = await assertCanonicalProjectConfig()
      let transition: { before: Info; after: Info } | undefined
      await fs.mkdir(path.dirname(target), { recursive: true })
      return writeConfigFile(target, patch, {
        resolve: resolveProjectCandidate,
        async commit(merged, _appliedPatch, persist) {
          assertProjectOwnedConfigSource(merged, target, { projectOwnedSource: "project" })
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
          await resetProjectState()
          global.reset()
          const committedTransition = transition
          if (!committedTransition) {
            throw new Error("Project configuration post-commit reconciliation is missing its committed transition")
          }
          await TestHooks.beforeProjectRuntimeSettlement?.({
            directory: projectDirectory,
            config: committedTransition.after,
          })
          await settleProjectRuntimeTransition({
            directory: projectDirectory,
            before: committedTransition.before,
            after: committedTransition.after,
          })
          // Project Config writers already own the exact project identity
          // required by assertCanonicalProjectConfig(). Re-entering the
          // Instance here is both redundant and invalid while Project open
          // is preparing that same Instance. Reread the source generation
          // under the current identity so a peer write that won after our
          // commit still receives one ordered runtime transition.
          const current = await currentProjectState()
          if (!runtimeConfigsEqual(current.config, committedTransition.after)) {
            await settleProjectRuntimeTransition({
              directory: projectDirectory,
              before: committedTransition.after,
              after: current.config,
            })
          }
        },
      })
    })
  }

  export async function updateProjectPatch(patch: ProjectMergePatch) {
    return writeProjectPatch(patch)
  }

  export async function updateProjectPatchAtomic(
    resolve: (currentProject: Source) => ProjectMergePatch | Promise<ProjectMergePatch>,
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

    let current: unknown = parseJsonc(input)
    for (const segment of path) {
      current = isRecord(current) && Object.hasOwn(current, segment) ? current[segment] : undefined
    }
    if (!isRecord(current)) {
      input = applyEdits(input, modify(input, path, {}, { formattingOptions: { insertSpaces: true, tabSize: 2 } }))
    }

    return Object.entries(patch).reduce((result, [key, value]) => {
      if (value === undefined) return result
      return patchJsonc(result, value, [...path, key])
    }, input)
  }

  function parseConfigData(text: string, filepath: string): unknown {
    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      throw new JsonError({
        path: filepath,
        message: ConfigPaths.jsonErrorMessage(text, errors),
      })
    }

    return data
  }

  function parseConfig(text: string, filepath: string): Source {
    return migrateLegacyPermissionConfig(parseConfigData(text, filepath)).config as Source
  }

  async function migratePermissionText(text: string, filepath: string) {
    const legacy = migrateLegacyPermissionConfig(await ConfigPaths.parseText(text, filepath))
    if (!legacy.migration) return { text }
    const canonical = legacy.config as Record<string, unknown>
    let updated = text
    for (const field of ["permission_mode", "permission_migration"] as const) {
      updated = applyEdits(
        updated,
        modify(updated, [field], canonical[field], {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      )
    }
    for (const field of legacy.migration.sourceFields) {
      updated = applyEdits(
        updated,
        modify(updated, [field], undefined, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      )
    }
    return { text: updated, migration: legacy.migration }
  }

  // RFC 7396-compatible deep merge: null values in the source delete the
  // corresponding key from the target, matching patchJsonc's behavior.
  function mergeWithNullDelete(target: any, source: any): any {
    if (!isRecord(source)) return source
    const result: Record<string, unknown> = isRecord(target) ? { ...target } : {}
    for (const [k, v] of Object.entries(source)) {
      if (v === null) {
        delete result[k]
      } else if (isRecord(v)) {
        result[k] = mergeWithNullDelete(result[k], v)
      } else {
        result[k] = v
      }
    }
    return result
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
  type ConfigFileOwner = { key: string; active: boolean; parent?: ConfigFileOwner }
  const configFileOwner = new AsyncLocalStorage<ConfigFileOwner>()

  async function ensurePermissionMigration(filepath: string) {
    const key = Filesystem.normalizeForCompare(filepath)
    for (let owner = configFileOwner.getStore(); owner; owner = owner.parent) {
      if (owner.active && owner.key === key) return
    }
    await withConfigFileLock(filepath, async () => undefined, "expanded")
  }

  /** Every writer of a config file takes the same cross-process lock. */
  function withConfigFileLock<T>(
    filepath: string,
    run: () => Promise<T>,
    sourceSyntax: "literal" | "expanded" = "literal",
  ): Promise<T> {
    filepath = Filesystem.resolve(filepath)
    return withSharedJsonFactLock({
      locks: writeConfigLocks,
      filepath,
      // Exactly what `loadFile` synthesizes for a missing file.
      empty: "{}",
      run: async () => {
        const owner: ConfigFileOwner = {
          key: Filesystem.normalizeForCompare(filepath),
          active: true,
          parent: configFileOwner.getStore(),
        }
        return configFileOwner.run(owner, async () => {
          try {
            // Normalize this target before a commit hook can read any source.
            // Migration owns only these bytes; it never enters a Config/cache
            // owner or acquires another file lock.
            const current = await Filesystem.readText(filepath)
            if (current.trim()) {
              // Explicit writers diagnose their authored JSONC before any
              // substitution. Reader-triggered migration has the reader's
              // expanded syntax contract, including unquoted env values.
              if (sourceSyntax === "literal") parseConfigData(current, filepath)
              const migrated = await migratePermissionText(current, filepath)
              if (migrated.migration) {
                await Filesystem.writeAtomic(filepath, migrated.text)
                log.info("legacy permission configuration migrated", {
                  source: filepath,
                  sourceFields: migrated.migration.sourceFields,
                  permissionMode: migrated.migration.permissionMode,
                  reason: migrated.migration.reason,
                })
              }
            }
            return await run()
          } finally {
            owner.active = false
          }
        })
      },
    })
  }

  async function writeConfigFile(
    filepath: string,
    config: unknown | ((existing: Source) => unknown | Promise<unknown>),
    hooks: {
      resolve(source: Source): Promise<Info>
      validate?(merged: Source, appliedPatch: unknown): Promise<void>
      commit?(merged: Source, appliedPatch: unknown, persist: () => Promise<void>): Promise<void>
      onWritten?(merged: Source): Promise<void>
    },
  ) {
    // The read has to happen inside the cross-process lock. Two backends over
    // one data root would otherwise read the same "before" snapshot, patch
    // different keys, and let the later atomic replacement discard the
    // earlier override — the same lost update the in-process queue already
    // prevents between two requests to this process.
    return withConfigFileLock(filepath, async () => {
      const before = await Filesystem.readText(filepath).catch((err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return "{}"
        throw new JsonError({ path: filepath }, { cause: err })
      })

      const normalize = async (text: string) => {
        const source = parseConfig(text, filepath)
        return parseSourceLayer(source, filepath, await hooks.resolve(source))
      }
      const existing = await normalize(before)
      const appliedPatch = typeof config === "function" ? await config(existing) : config
      if (filepath.endsWith(".jsonc")) {
        let updated = (await migratePermissionText(patchJsonc(before, appliedPatch), filepath)).text
        let merged = await normalize(updated)
        if (Object.keys(merged).length > 0 && !merged.$schema) {
          updated = applyEdits(
            updated,
            modify(updated, ["$schema"], CONFIG_SCHEMA_URL, {
              formattingOptions: { tabSize: 2, insertSpaces: true },
            }),
          )
          merged = await normalize(updated)
        }
        const persist = () => Filesystem.writeAtomic(filepath, updated)
        if (hooks?.commit) await hooks.commit(merged, appliedPatch, persist)
        else {
          await hooks?.validate?.(merged, appliedPatch)
          await persist()
        }
        await hooks?.onWritten?.(merged)
        return merged
      }
      const writable = mergeWithNullDelete(existing, appliedPatch)
      if (Object.keys(writable).length > 0 && !writable.$schema) writable.$schema = CONFIG_SCHEMA_URL
      const serialized = (await migratePermissionText(JSON.stringify(writable, null, 2), filepath)).text
      const merged = await normalize(serialized)
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
    rewarm: boolean
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

  async function commitGlobalCandidate(merged: Source, persist: () => Promise<void>) {
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
    const directories = await SkillReadDiagnostics.phase("config.global.projects", globalProjectDirectories)
    log.debug("global mutation project inventory", {
      projects: directories.length,
      loaded: stateSource.inspectAll().length,
    })
    const { Instance } = await import("@/project/instance")
    await Instance.withRetainedProjectIdentities({
      directories,
      fn: async () => {
        const transitions = await commitGlobalProjectCandidates(effectiveGlobal, merged, persist, directories)
        await SkillReadDiagnostics.phase("config.global.reconcile", () =>
          reconcileGlobalProjectTransitions(transitions),
        )
      },
    })
  }

  async function commitGlobalProjectCandidates(
    effectiveGlobal: Info,
    merged: Source,
    persist: () => Promise<void>,
    directories: readonly string[],
  ) {
    const { validateConfigCandidate } = await import("@/config/candidate-validation")
    const { Instance } = await import("@/project/instance")
    const loadedDirectories = new Set(stateSource.inspectAll().map((entry) => Filesystem.resolve(entry.key)))
    const { ProjectDirectoryAdmission } = await import("@/project/directory-admission")
    const outcomes = await ProjectDirectoryAdmission.registrationBatch({
      concurrency: os.availableParallelism(),
      items: directories,
      run: async (directory) =>
        await Instance.provideProjectIdentity({
          directory,
          fn: async (): Promise<GlobalProjectTransition> => {
            const worktree = Instance.worktree
            const before = await SkillReadDiagnostics.phase("config.global.before", () =>
              readOnlyProjectSnapshot(directory, worktree),
            )
            const after = await SkillReadDiagnostics.phase("config.global.after", () =>
              readOnlyProjectSnapshot(directory, worktree, merged),
            )
            await validateConfigCandidate({
              config: after,
              root: "global config",
              projectDirectory: directory,
              projectOwnedCapabilities: true,
            })
            return {
              directory,
              before,
              after,
              rewarm: loadedDirectories.has(Filesystem.resolve(directory)),
            }
          },
        }),
    })
    const transitions: GlobalProjectTransition[] = []
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") throw outcome.reason
      transitions.push(outcome.value)
    }
    await validateConfigCandidate({
      config: effectiveGlobal,
      root: "global config",
      providerScope: "global",
    })
    await TestHooks.beforeGlobalPersist?.()
    await SkillReadDiagnostics.phase("config.global.persist", persist)
    global.reset()
    if (globalConfigLoaded) {
      const current = await currentGlobalState()
      globalObservedRevision = current.revision
    }
    await SkillReadDiagnostics.phase("config.global.reset", async () => {
      await resetAllProjectStates()
      const { Skill } = await import("@/skill/skill")
      await Skill.state.resetAll()
    })
    return transitions
  }

  async function reconcileGlobalProjectTransitions(transitions: readonly GlobalProjectTransition[]) {
    const [{ Instance }, { Provider }, { NativeAgentRegistryLifecycle }] = await Promise.all([
      import("@/project/instance"),
      import("@/provider/provider"),
      import("@/agent/native-agent-registry-lifecycle"),
    ])
    const cacheSettlements = await Promise.allSettled([Provider.resetAll(), NativeAgentRegistryLifecycle.resetAll()])
    await TestHooks.beforeGlobalRuntimeSettlement?.({
      transitions: transitions.map((transition) => ({
        directory: transition.directory,
        before: transition.before,
        after: transition.after,
      })),
    })
    const settled = await Promise.allSettled(
      transitions.map((transition) =>
        (async () => {
          await Instance.provideProjectIdentity({
            directory: transition.directory,
            fn: async () => {
              await settleProjectRuntimeTransition(
                {
                  directory: transition.directory,
                  before: transition.before,
                  after: transition.after,
                },
                { resetDerivedCaches: false },
              )
            },
          })
          if (transition.rewarm) {
            await Instance.tryProvideActive({
              directory: transition.directory,
              fn: async () => {
                const current = await currentProjectState()
                if (runtimeConfigsEqual(current.config, transition.after)) return
                await settleProjectRuntimeTransition({
                  directory: transition.directory,
                  before: transition.after,
                  after: current.config,
                })
              },
            })
          }
        })(),
      ),
    )
    const failures = [...cacheSettlements, ...settled].filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    if (failures.length > 0) {
      throw new GlobalConfigCommittedReconcileError(
        failures.map((failure) => failure.reason),
        await getGlobal(),
      )
    }
  }

  async function writeGlobalMutation(patch: unknown | ((existing: Source) => unknown | Promise<unknown>)) {
    await ConfigPaths.assertCanonicalDirectory(Global.Path.config, ["config.json"])
    return SkillReadDiagnostics.phase("config.global.write", () =>
      withConfigMutationAuthority(async () => {
        const written = await writeConfigFile(globalConfigFile(), patch, {
          resolve: resolveGlobalCandidate,
          async commit(merged, _appliedPatch, persist) {
            await commitGlobalCandidate(merged, persist)
          },
        })
        return parseEffectiveConfig(written, globalConfigFile())
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
    resolve: (currentGlobal: Info, currentWritable: Source) => ProjectMergePatch | Promise<ProjectMergePatch>,
  ) {
    return writeGlobalMutation(async (currentWritable) => {
      const effective = await resolveGlobalCandidate(currentWritable)
      const patch = await resolve(effective, structuredClone(currentWritable))
      assertNoProjectOwnedConfig(patch)
      return patch
    })
  }

  export async function directories() {
    return state().then((x) => x.directories)
  }
}
