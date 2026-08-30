import { lstat, mkdir, readFile, rename, rm } from "fs/promises"
import { createHash, randomUUID } from "node:crypto"
import path from "path"
import z from "zod"
import { Config } from "@/config/config"
import { ConfigMarkdown } from "@/config/markdown"
import { ConfigPaths } from "@/config/paths"
import { updateGlobalConfigPatchAtomic } from "@/config/update-global"
import { Global } from "@/global"
import { CapabilityRules } from "@/capability/rules"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { Glob } from "@/util/glob"
import { gitProcessArgs } from "@/util/git"
import { Process } from "@/util/process"
import { Discovery } from "./discovery"
import { SkillNameSchema } from "./name"
import { Skill } from "./skill"
import { which } from "@/util/which"
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { PackageUpdateClient } from "@/package-update/client"
import { withSkillCatalogMutation, withSkillSourceMutation, withSkillSourceMutations } from "./reference-lock"
import { Log } from "@/util/log"
import { createInstanceState } from "@/project/instance-state"
import { Context } from "@/util/context"
import { SkillMarket } from "./market"
import { SkillCatalogConfigurationEffect, SkillReplacementPublication } from "./replacement-publication"

const MANIFEST = ".opencorvus-skill-source.json"
const log = Log.create({ service: "skill-manager" })
const replacementContext = Context.create<boolean>("skill-catalog-replacement")
type SkillReplacementCut =
  | "intent-published"
  | "target-backed-up"
  | "target-installed"
  | "catalog-published"
  | "configuration-published"
let replacementCutHook: ((cut: SkillReplacementCut, targetIndex?: number) => void | Promise<void>) | undefined

async function replacementCut(cut: SkillReplacementCut, targetIndex?: number) {
  await replacementCutHook?.(cut, targetIndex)
}

export namespace SkillManager {
  /** Test-only process-death injection for exact catalog publication cuts. */
  export namespace ReplacementTestHooks {
    export function setCutHook(hook?: (cut: SkillReplacementCut, targetIndex?: number) => void | Promise<void>): void {
      replacementCutHook = hook
    }
  }

  export const Policy = CapabilityRules.Action
  export const Trust = z.enum(["builtin", "official", "curated", "community", "local", "external", "unknown"])
  export const Risk = z.object({
    level: z.enum(["low", "medium", "high"]),
    has_scripts: z.boolean(),
    has_agents: z.boolean(),
    has_references: z.boolean(),
    has_templates: z.boolean(),
  })

  export const Installed = Skill.Info.extend({
    dir: z.string().optional(),
    source_type: z.enum([
      "builtin",
      "managed_market",
      "managed_git",
      "config_path",
      "config_url",
      "external",
      "unknown",
    ]),
    source: z.string().optional(),
    market_id: z.string().optional(),
    market_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    trust: Trust,
    risk: Risk,
    recommended_policy: Policy,
    policy: Policy,
    managed: z.boolean(),
    writable: z.boolean(),
  })
  export type Installed = z.infer<typeof Installed>

  export const MarketProvider = SkillMarket.Provider
  export const MarketSearchInput = SkillMarket.SearchInput

  export const MarketEntry = SkillMarket.Candidate.extend({
    installed: z.boolean(),
  })

  export const MarketDetail = z
    .object({
      id: z.string(),
      skill_id: z.string(),
      name: SkillNameSchema,
      description: z.string(),
      source: z.string(),
      homepage: z.string().url(),
      repository: z.string().url(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      upstream_hash: z.string().optional(),
      files: z.object({ path: z.string(), size: z.number().int().nonnegative() }).array(),
      trust: Trust,
      risk: Risk,
      recommended_policy: Policy,
      installed: z.boolean(),
    })
    .strict()

  export const MarketInstallInput = z
    .object({
      id: SkillMarket.Identity,
      expected_hash: z.string().regex(/^[a-f0-9]{64}$/),
      policy: Policy.optional(),
    })
    .strict()

  export const MarketInspectInput = z.object({ id: SkillMarket.Identity }).strict()

  export const MarketInstallResult = z
    .object({
      id: z.string(),
      name: SkillNameSchema,
      source: z.string(),
      path: z.string(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      policy: Policy,
      available: z.literal("next_turn"),
    })
    .strict()

  export const Directories = z.object({
    global_config: z.string(),
    managed_skills: z.string(),
    remote_cache: z.string(),
  })

  export const InstallInput = z.object({
    kind: z.enum(["path", "url", "git"]),
    value: z.string().min(1),
    policy: Policy.optional(),
  })

  export const ImportBundleFile = z
    .object({
      path: z.string().min(1),
      content: z.string().optional(),
      contentBase64: z.string().optional(),
    })
    .refine((item) => item.content !== undefined || item.contentBase64 !== undefined, {
      message: "Import file requires content or contentBase64",
    })

  export const ImportFileInput = z
    .object({
      filename: z.string().min(1).optional(),
      content: z.string().optional(),
      sourceName: z.string().min(1).optional(),
      files: ImportBundleFile.array().optional(),
      archiveBase64: z.string().optional(),
      policy: Policy.optional(),
    })
    .refine((input) => input.content !== undefined || input.files?.length || input.archiveBase64, {
      message: "Import requires a SKILL.md file, a directory file list, or a zip archive",
    })

  export const RemoveInput = z.object({
    source: z.string().min(1),
    kind: z.enum(["path", "url", "git", "market"]).optional(),
  })

  export const PolicyInput = z.object({
    name: z.string().min(1),
    action: Policy,
  })

  export const UpdateInput = z
    .object({
      name: SkillNameSchema,
      source: PackageUpdateClient.Source,
    })
    .strict()

  export const UpdateResult = z
    .object({
      name: SkillNameSchema,
      source: PackageUpdateClient.Source,
      version: z.string().optional(),
      location: z.string(),
    })
    .strict()

  export function managedRoot() {
    return path.join(Global.Path.config, "skills-market")
  }

  export function directories() {
    return Directories.parse({
      global_config: Global.Path.config,
      managed_skills: managedRoot(),
      remote_cache: Discovery.dir(),
    })
  }

  /** Returns the single current Skill Market provider authority. */
  export async function market() {
    return [SkillMarket.provider()]
  }

  export async function searchMarket(raw: z.input<typeof SkillMarket.SearchInput>) {
    const candidates = await SkillMarket.search(raw)
    const installedIDs = await installedMarketIDs()
    return MarketEntry.array().parse(
      candidates.map((candidate) => ({ ...candidate, installed: installedIDs.has(candidate.id) })),
    )
  }

  export async function inspectMarket(raw: z.input<typeof MarketInspectInput>) {
    const input = MarketInspectInput.parse(raw)
    const inspected = await inspectMarketBundle(input.id)
    const installedIDs = await installedMarketIDs()
    return MarketDetail.parse({ ...inspected.detail, installed: installedIDs.has(inspected.detail.id) })
  }

  export async function installMarket(raw: z.input<typeof MarketInstallInput>) {
    const input = MarketInstallInput.parse(raw)
    const identity = SkillMarket.identity(input.id)
    const target = managedMarketTarget(identity.id)
    return withSkillCatalogMutation(() =>
      withSkillSourceMutation(`market:${identity.id}`, async () => {
        const inspected = await inspectMarketBundle(identity.id)
        if (inspected.detail.hash !== input.expected_hash) {
          throw new Error(
            `Skill Market bundle changed after inspection: expected ${input.expected_hash}, received ${inspected.detail.hash}`,
          )
        }
        await assertMarketTargetOwnership(target, identity.id)
        const policy = input.policy ?? inspected.detail.recommended_policy
        Config.global.reset()
        await Config.state.resetAll()
        await resetInstalledDiscoveryState()
        const targetSkillFile = path.join(path.resolve(target), "SKILL.md")
        const existing = await configuredGlobalSkillDefinition(inspected.root.info.name, target)
        if (existing) {
          throw new Skill.InvalidError({
            path: targetSkillFile,
            message: `Skill name ${JSON.stringify(inspected.root.info.name)} is already defined by ${existing}.`,
          })
        }

        const manifest = {
          kind: "market",
          market_id: identity.id,
          hash: inspected.detail.hash,
          upstream_hash: inspected.detail.upstream_hash,
          source: inspected.detail.repository,
          installed_at: Date.now(),
        }
        const root: ParsedSkillRoot = {
          ...inspected.root,
          files: [
            ...inspected.root.files,
            {
              sourcePath: MANIFEST,
              relativePath: MANIFEST,
              bytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
            },
          ],
        }
        await replaceSkillDirectories([{ targetDir: target, root }], false, {
          kind: "market_install",
          target,
          names: [root.info.name],
          policy,
        })
        return MarketInstallResult.parse({
          id: identity.id,
          name: root.info.name,
          source: inspected.detail.repository,
          path: target,
          hash: inspected.detail.hash,
          policy,
          available: "next_turn",
        })
      }),
    )
  }

  const installedInventoryState = createInstanceState(
    async () => {
      const global = await Config.getGlobal()
      const configuredPaths = (global.skills?.paths ?? []).map(resolveSource)
      const configuredUrls = global.skills?.urls ?? []
      const root = managedRoot()
      const cache = Discovery.dir()

      return await Promise.all(
        (await Skill.all()).map(async (skill) => {
          const dir = skill.builtin ? undefined : path.dirname(skill.location)
          const remoteSource = dir ? await Discovery.publishedSnapshotSource(dir) : undefined
          const manifest = !skill.builtin && dir ? await readManifest(dir, root, cache) : undefined
          const sourceType = skill.builtin
            ? "builtin"
            : remoteSource
              ? "config_url"
              : dir
                ? sourceTypeFor(dir, configuredPaths, cache, manifest?.kind)
                : "builtin"
          const trust = trustFor(skill, remoteSource ?? manifest?.source)
          const risk = skill.builtin
            ? Skill.builtinRisk(skill.name)
            : dir
              ? await riskFor(dir, trust)
              : {
                  level: "low" as const,
                  has_scripts: false,
                  has_agents: false,
                  has_references: false,
                  has_templates: false,
                }
          return {
            ...skill,
            dir,
            source_type:
              manifest?.kind === "market"
                ? ("managed_market" as const)
                : manifest?.kind === "git"
                  ? ("managed_git" as const)
                  : manifest?.kind === "url"
                    ? ("config_url" as const)
                    : sourceType,
            source:
              (manifest?.kind === "market" ? manifest.market_id : undefined) ??
              remoteSource ??
              manifest?.source ??
              (sourceType === "config_path"
                ? configuredPaths.find((item) => Filesystem.contains(item, dir!))
                : undefined) ??
              (sourceType === "config_url" && configuredUrls.length === 1 ? configuredUrls[0] : undefined),
            market_id: manifest?.kind === "market" ? manifest.market_id : undefined,
            market_hash: manifest?.kind === "market" ? manifest.hash : undefined,
            trust,
            risk,
            recommended_policy: recommendedPolicy(trust, risk),
            managed: !!dir && Filesystem.contains(root, dir),
            writable: !remoteSource && !skill.builtin && !!dir && (await Filesystem.isDir(dir)),
          }
        }),
      )
    },
    undefined,
    "installed-skill-inventory",
  )
  let installedPublicationRevision: string | undefined
  let observedCatalogPublicationRevision: string | undefined

  async function resetInstalledDiscoveryState() {
    await Skill.state.resetAll()
    await installedInventoryState.resetAll()
  }

  async function installedAtPublication(publicationRevision: string) {
    if (installedPublicationRevision !== publicationRevision) {
      await installedInventoryState.resetAll()
      installedPublicationRevision = publicationRevision
    }
    const global = await Config.getGlobal()
    const rules = CapabilityRules.fromConfig({ skill: global.skill_policy ?? {} })
    return Installed.array().parse(
      (await installedInventoryState()).map((skill) => ({
        ...skill,
        policy: CapabilityRules.evaluate("skill", skill.name, rules).action,
      })),
    )
  }

  export async function installedCatalogSnapshot(): Promise<{
    revision: string
    skills: readonly Installed[]
  }> {
    return withCatalogProjection(async (revision) =>
      Object.freeze({
        revision,
        skills: Object.freeze(await installedAtPublication(revision)),
      }),
    )
  }

  export async function installed() {
    return [...(await installedCatalogSnapshot()).skills]
  }

  export async function refreshDiscoveryState() {
    Config.global.reset()
    await Config.state.resetAll()
    await resetInstalledDiscoveryState()
  }

  /** The global-config writer and Skill replacement share this exact lock
   * order: catalog owner, then config-file owner. Open replacement recovery
   * runs before a later global config mutation can inspect or change Skills. */
  export async function withCatalogMutationOwner<T>(mutate: () => Promise<T>): Promise<T> {
    if (replacementContext.tryUse()) return mutate()
    return SkillReplacementPublication.withCatalogOwner(() =>
      replacementContext.provide(true, async () => {
        await recoverOpenSkillReplacement()
        return mutate()
      }),
    )
  }

  async function observeCatalogPublicationRevision(revision: string) {
    if (observedCatalogPublicationRevision !== revision) {
      Config.global.reset()
      await Config.state.resetAll()
      observedCatalogPublicationRevision = revision
    }
    return revision
  }

  /** Converge the one cross-process Skill catalog publication and keep its
   * owner through the reader's complete filesystem/config projection. */
  export async function withCatalogProjection<T>(project: (revision: string) => Promise<T>): Promise<T> {
    if (replacementContext.tryUse()) {
      return project(await observeCatalogPublicationRevision(await SkillReplacementPublication.revision()))
    }
    return SkillReplacementPublication.withCatalogOwner(() =>
      replacementContext.provide(true, async () => {
        await recoverOpenSkillReplacement()
        const revision = await observeCatalogPublicationRevision(await SkillReplacementPublication.revision())
        return project(revision)
      }),
    )
  }

  /** Return the terminal catalog revision after recovery. Callers that read
   * catalog bytes must use withCatalogProjection so the owner spans the read. */
  export function prepareCatalogProjection(): Promise<string> {
    return withCatalogProjection(async (revision) => revision)
  }

  export async function install(raw: z.input<typeof InstallInput>) {
    const input = InstallInput.parse(raw)
    const sourceKey =
      input.kind === "git"
        ? managedGitTarget(normalizeGit(input.value))
        : input.kind === "url"
          ? normalizeUrl(input.value)
          : resolveSource(input.value)
    return withSkillCatalogMutation(() => withSkillSourceMutation(sourceKey, () => installResolved(input)))
  }

  async function installResolved(input: z.output<typeof InstallInput>) {
    if (input.kind === "path") {
      const resolved = resolveSource(input.value)
      const definitions = await validateSkillDirectory(resolved)
      await patchGlobal((next) => {
        next.skills = next.skills || {}
        next.skills.paths = dedupe([...(next.skills.paths ?? []), resolved])
        if (input.policy) {
          applyPolicyToConfig(
            next,
            definitions.map((definition) => definition.name),
            input.policy,
          )
        }
      })
      await resetInstalledDiscoveryState()
      return { source: resolved, kind: input.kind }
    }

    if (input.kind === "url") {
      const value = normalizeUrl(input.value)
      const pulled = await Discovery.pull(value)
      if (pulled.length === 0) {
        throw new Error(`No skills discovered from ${value}`)
      }
      const definitions = (await Promise.all(pulled.map(validateSkillDirectory))).flat()
      await patchGlobal((next) => {
        next.skills = next.skills || {}
        next.skills.urls = dedupe([...(next.skills.urls ?? []), value])
        if (input.policy) {
          applyPolicyToConfig(
            next,
            definitions.map((definition) => definition.name),
            input.policy,
          )
        }
      })
      await resetInstalledDiscoveryState()
      return { source: value, kind: input.kind }
    }

    const source = normalizeGit(input.value)
    const target = managedGitTarget(source)
    await ensureManagedRepo(source, target)
    const definitions = await validateSkillDirectory(target)
    await Filesystem.writeJson(path.join(target, MANIFEST), {
      kind: "git",
      source,
      installed_at: Date.now(),
    })
    await patchGlobal((next) => {
      next.skills = next.skills || {}
      next.skills.paths = dedupe([...(next.skills.paths ?? []), target])
      if (input.policy) {
        applyPolicyToConfig(
          next,
          definitions.map((definition) => definition.name),
          input.policy,
        )
      }
    })
    await resetInstalledDiscoveryState()
    return { source, path: target, kind: input.kind }
  }

  export async function previewImportFile(raw: z.input<typeof ImportFileInput>) {
    const input = ImportFileInput.parse(raw)
    const skillRoots = await readImportSkillRoots(input)
    return {
      names: skillRoots.map((root) => root.info.name),
      skills: skillRoots.map((root) => root.info),
    }
  }

  export async function importFile(raw: z.input<typeof ImportFileInput>) {
    const input = ImportFileInput.parse(raw)
    const projectConfigDir = Config.projectConfigDirectory()
    const skillRoots = await readImportSkillRoots(input)
    const targets = skillRoots.map((root) => {
      const dirName = slug(root.info.name)
      if (!dirName) throw new Error(`Invalid skill name: ${root.info.name}`)
      const targetDir = path.join(projectConfigDir, "skill", dirName)
      if (!Filesystem.contains(projectConfigDir, targetDir)) {
        throw new Error(`Refusing to write skill outside project config directory: ${root.info.name}`)
      }
      return { targetDir, root }
    })
    if (new Set(targets.map((item) => item.targetDir)).size !== targets.length) {
      throw new Error("Skill import contains duplicate identities")
    }

    return withSkillCatalogMutation(() =>
      withSkillSourceMutations(
        targets.map((item) => item.targetDir),
        async () => {
          await Config.state.reset()
          await resetInstalledDiscoveryState()
          const discovered = await Skill.all()
          for (const { targetDir, root } of targets) {
            const existing = discovered.find((definition) => definition.name === root.info.name)
            const targetSkillFile = path.join(path.resolve(targetDir), "SKILL.md")
            if (existing && path.resolve(existing.location) !== targetSkillFile) {
              throw new Skill.InvalidError({
                path: targetSkillFile,
                message: `Skill name ${JSON.stringify(root.info.name)} is already defined by ${existing.location}.`,
              })
            }
          }
          await replaceSkillDirectories(
            targets,
            false,
            input.policy
              ? {
                  kind: "policy",
                  names: targets.map((item) => item.root.info.name),
                  policy: input.policy,
                }
              : { kind: "none" },
          )
          const imported = targets.map(({ targetDir, root }) => ({
            name: root.info.name,
            source: path.join(targetDir, "SKILL.md"),
          }))
          await Config.state.reset()
          await resetInstalledDiscoveryState()
          return {
            name: imported[0]!.name,
            source: imported[0]!.source,
            kind: "path" as const,
            names: imported.map((item) => item.name),
            sources: imported.map((item) => item.source),
          }
        },
      ),
    )
  }

  export async function remove(raw: z.input<typeof RemoveInput>) {
    const input = RemoveInput.parse(raw)
    const marketID = input.kind === "market" ? SkillMarket.identity(input.source).id : undefined
    const source = marketID
      ? managedMarketTarget(marketID)
      : input.kind === "git"
        ? managedGitTarget(normalizeGit(input.source))
        : input.kind === "url"
          ? input.source
          : resolveSource(input.source)

    return withSkillCatalogMutation(() =>
      withSkillSourceMutation(source, async () => {
        if (marketID) await assertMarketTargetOwnership(source, marketID)
        const configuredPath = (value: string) =>
          input.kind === "market" || input.kind === "git" ? resolveGlobalConfiguredPath(value) : resolveSource(value)
        await patchGlobal((next) => {
          next.skills = next.skills || {}
          next.skills.paths = (next.skills.paths ?? []).filter((item) => configuredPath(item) !== source)
          next.skills.urls = (next.skills.urls ?? []).filter((item) => item !== input.source)
        })
        const effective = await Config.getGlobal()
        const stillConfigured =
          (effective.skills?.paths ?? []).some((item) => configuredPath(item) === source) ||
          (effective.skills?.urls ?? []).includes(input.source)
        if (stillConfigured) {
          throw new Error(`Skill source is owned by a lower-priority global config file: ${input.source}`)
        }

        if (Filesystem.contains(managedRoot(), source)) {
          await rm(source, { recursive: true, force: true })
        }

        await Config.state.resetAll()
        await resetInstalledDiscoveryState()

        return true
      }),
    )
  }

  export async function setPolicy(raw: z.input<typeof PolicyInput>) {
    const input = PolicyInput.parse(raw)
    await patchGlobal((next) => {
      applyPolicyToConfig(next, [input.name], input.action)
    })
    return true
  }

  export async function update(raw: z.input<typeof UpdateInput>) {
    const input = UpdateInput.parse(raw)
    return withSkillCatalogMutation(() => updateLocked(input))
  }

  async function updateLocked(input: z.output<typeof UpdateInput>) {
    const item = (await installed()).find((candidate) => candidate.name === input.name)
    if (!item) throw new Error(`Skill is not installed: ${input.name}`)

    if (input.source === "builtin") {
      if (!item.builtin || !Skill.hasBuiltin(input.name)) {
        throw new Error(`Built-in Skill update not found: ${input.name}`)
      }
      const location = await Skill.refreshBuiltin(input.name)
      await resetInstalledDiscoveryState()
      return UpdateResult.parse({ name: input.name, source: input.source, location })
    }

    if (item.builtin || !item.writable || !item.dir) {
      throw new Error(`Skill is not writable for server update: ${input.name}`)
    }
    const itemDir = item.dir
    return withSkillSourceMutation(itemDir, async () => {
      const archive = await PackageUpdateClient.fetchArchive({ kind: "skill", identity: input.name })
      const roots = await readImportSkillRoots({
        filename: `${input.name}.zip`,
        archiveBase64: Buffer.from(archive.bytes).toString("base64"),
      })
      if (roots.length !== 1 || roots[0]!.info.name !== input.name) {
        const identities = roots.map((root) => root.info.name).join(", ") || "none"
        throw new Error(`Skill update must contain exactly ${JSON.stringify(input.name)}; received ${identities}`)
      }
      await replaceSkillDirectory(itemDir, roots[0]!)
      await Config.state.reset()
      await resetInstalledDiscoveryState()
      return UpdateResult.parse({
        name: input.name,
        source: input.source,
        version: archive.version,
        location: path.join(itemDir, "SKILL.md"),
      })
    })
  }
}

async function installedMarketIDs() {
  const config = await Config.getGlobal()
  const result = new Set<string>()
  for (const configured of config.skills?.paths ?? []) {
    const expanded = configured.startsWith("~/") ? path.join(Global.Path.home, configured.slice(2)) : configured
    if (!path.isAbsolute(expanded)) continue
    const dir = path.normalize(expanded)
    if (!Filesystem.contains(SkillManager.managedRoot(), dir) || !(await Filesystem.isDir(dir))) continue
    const manifest = await readManifest(dir, SkillManager.managedRoot())
    if (manifest?.kind === "market" && manifest.market_id) result.add(manifest.market_id)
  }
  return result
}

function resolveGlobalConfiguredPath(configured: string) {
  const expanded = configured.startsWith("~/") ? path.join(Global.Path.home, configured.slice(2)) : configured
  return path.isAbsolute(expanded) ? path.normalize(expanded) : undefined
}

async function configuredGlobalSkillDefinition(name: string, target: string) {
  if (Skill.hasBuiltin(name)) return "builtin"
  const config = await Config.getGlobal()
  for (const configured of config.skills?.paths ?? []) {
    const expanded = configured.startsWith("~/") ? path.join(Global.Path.home, configured.slice(2)) : configured
    if (!path.isAbsolute(expanded)) continue
    const dir = path.normalize(expanded)
    if (path.resolve(dir) === path.resolve(target) || !(await Filesystem.isDir(dir))) continue
    const definitions = await validateSkillDirectory(dir)
    const existing = definitions.find((definition) => definition.name === name)
    if (existing) return dir
  }
  return undefined
}

function resolveSource(value: string) {
  const expanded = value.startsWith("~/") ? path.join(Global.Path.home, value.slice(2)) : value
  return path.isAbsolute(expanded) ? expanded : path.resolve(Instance.directory, expanded)
}

function dedupe(list: string[]) {
  return [...new Set(list.filter(Boolean))]
}

function normalizeUrl(value: string) {
  const url = new URL(value)
  return url.toString().replace(/\/+$/, "") + "/"
}

function normalizeGit(value: string) {
  const trimmed = value.trim()
  if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.startsWith("git@")) return trimmed
  if (/^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?$/.test(trimmed)) {
    const parts = trimmed.split("/")
    return `https://github.com/${parts[0]}/${parts[1]}.git`
  }
  return trimmed
}

async function inspectMarketBundle(rawID: string) {
  const identity = SkillMarket.identity(rawID)
  const bundle = await SkillMarket.download(identity.id)
  try {
    const roots = await readImportSkillRoots({
      sourceName: identity.id,
      files: bundle.files.map((file) => ({ path: file.path, content: file.content })),
    })
    if (roots.length !== 1) throw new Error(`Skill Market bundle must define exactly one Skill: ${identity.id}`)
    const root = roots[0]!
    const repository = `https://github.com/${identity.source}`
    const trust = trustForSource(repository)
    const risk = riskForMarketFiles(root.files, trust)
    return {
      root,
      detail: {
        id: identity.id,
        skill_id: identity.skillID,
        name: root.info.name,
        description: root.info.description,
        source: identity.source,
        homepage: `${SkillMarket.ORIGIN}/${identity.id}`,
        repository,
        hash: bundle.hash,
        upstream_hash: bundle.upstream_hash,
        files: bundle.files.map((file) => ({ path: file.path, size: Buffer.byteLength(file.content, "utf8") })),
        trust,
        risk,
        recommended_policy: recommendedPolicy(trust, risk),
      },
    }
  } catch (error) {
    throw SkillMarket.invalidBundleError(identity.id, error)
  }
}

function riskForMarketFiles(
  files: readonly ParsedSkillRoot["files"][number][],
  trust: z.infer<typeof SkillManager.Trust>,
) {
  const paths = files.map((file) => file.relativePath.toLowerCase())
  const inDirectory = (names: readonly string[]) =>
    paths.some((file) => names.some((name) => file === name || file.startsWith(`${name}/`)))
  const hasScripts = inDirectory(["script", "scripts"])
  const hasAgents = inDirectory(["agent", "agents"])
  const hasReferences = inDirectory(["reference", "references"])
  const hasTemplates = inDirectory(["template", "templates", "asset", "assets"])
  const level = hasScripts
    ? "high"
    : trust === "community" || trust === "unknown" || trust === "external"
      ? "medium"
      : hasAgents || hasReferences
        ? "medium"
        : "low"
  return {
    level,
    has_scripts: hasScripts,
    has_agents: hasAgents,
    has_references: hasReferences,
    has_templates: hasTemplates,
  } as const
}

function slug(value: string) {
  return value
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/\.git$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function managedGitTarget(source: string) {
  const root = SkillManager.managedRoot()
  const name = slug(source)
  if (
    !name ||
    name === "." ||
    name === ".." ||
    path.basename(name) !== name ||
    path.isAbsolute(name) ||
    path.win32.isAbsolute(name)
  ) {
    throw new Error(`Invalid git skill source slug: ${source}`)
  }
  const target = path.resolve(root, name)
  if (target === path.resolve(root) || !Filesystem.contains(root, target)) {
    throw new Error(`Invalid git skill source slug: ${source}`)
  }
  return target
}

function managedMarketTarget(rawID: string) {
  const identity = SkillMarket.identity(rawID)
  const root = path.join(SkillManager.managedRoot(), SkillMarket.ID)
  const target = path.resolve(root, identity.owner, identity.repository, identity.skillID)
  if (target === path.resolve(root) || !Filesystem.contains(root, target)) {
    throw new Error(`Invalid Skill Market target identity: ${rawID}`)
  }
  return target
}

async function assertMarketTargetOwnership(target: string, expectedID: string) {
  if (!(await Filesystem.isDir(target))) return
  const manifest = await Filesystem.readJson<{
    kind?: string
    market_id?: string
  }>(path.join(target, MANIFEST)).catch(() => undefined)
  let observedID: string | undefined
  if (manifest?.kind === "market" && manifest.market_id) {
    try {
      observedID = SkillMarket.identity(manifest.market_id).id
    } catch {
      observedID = undefined
    }
  }
  if (observedID !== expectedID) {
    throw new Error(
      `Skill Market target ownership mismatch: expected ${expectedID}, received ${observedID ?? "unowned"}`,
    )
  }
}

async function ensureManagedRepo(source: string, dest: string) {
  const git = which("git")
  if (!git) throw new Error("git is required to install skills from repositories")
  await Filesystem.write(path.join(dest, ".keep"), "")
  await rm(path.join(dest, ".keep"), { force: true })

  if (await Filesystem.isDir(path.join(dest, ".git"))) {
    await Process.runHost(gitProcessArgs(["-C", dest, "pull", "--ff-only"], git))
    return
  }

  if (await Filesystem.isDir(dest)) {
    await rm(dest, { recursive: true, force: true })
  }

  await Process.runHost(gitProcessArgs(["clone", "--depth", "1", source, dest], git))
}

async function validateSkillDirectory(dir: string): Promise<Skill.Definition[]> {
  if (!(await Filesystem.isDir(dir))) {
    throw new Error(`Skill directory not found: ${dir}`)
  }
  const matches = await Glob.scan("**/SKILL.md", {
    cwd: dir,
    absolute: true,
    include: "file",
    dot: true,
    symlink: true,
  })
  if (matches.length === 0) {
    throw new Error(`No SKILL.md files found in ${dir}`)
  }
  const definitions: Skill.Definition[] = []
  for (const file of matches.sort()) {
    const parsed = ConfigMarkdown.parseText(await Filesystem.readText(file), file)
    definitions.push(Skill.parseDefinition(parsed.data, file))
  }
  return definitions
}

async function patchGlobal(mutator: (next: z.infer<typeof Config.Info>) => void) {
  await updateGlobalConfigPatchAtomic((_effective, currentWritable) => {
    const next = structuredClone(currentWritable)
    mutator(next)
    return {
      skills: next.skills,
      skill_policy: next.skill_policy,
    }
  })
}

function applyPolicyToConfig(
  next: z.infer<typeof Config.Info>,
  names: string[],
  policy: z.infer<typeof SkillManager.Policy>,
) {
  const table: Record<string, Config.PermissionAction> = { ...(next.skill_policy ?? {}) }
  for (const name of new Set(names)) {
    table[name] = policy
  }
  next.skill_policy = table
}

function sourceTypeFor(dir: string, configuredPaths: string[], _cache: string, kind?: string) {
  if (kind === "market") return "managed_market"
  if (kind === "git") return "managed_git"
  if (kind === "url") return "config_url"
  if (Filesystem.contains(SkillManager.managedRoot(), dir)) return "managed_git"
  if (configuredPaths.some((item) => Filesystem.contains(item, dir))) return "config_path"
  if (
    dir.includes(`${path.sep}.claude${path.sep}`) ||
    dir.includes(`${path.sep}.agents${path.sep}`) ||
    dir.includes(`${path.sep}.codex${path.sep}`) ||
    dir.includes(`${path.sep}.opencorvus${path.sep}skill${path.sep}`) ||
    dir.includes(`${path.sep}.opencorvus${path.sep}skills${path.sep}`)
  )
    return "external"
  return "unknown"
}

function trustFor(skill: Skill.Info, source?: string) {
  if (skill.builtin) return "builtin" as const
  if (source !== undefined) return trustForSource(source)
  if (
    skill.location.includes(`${path.sep}.claude${path.sep}`) ||
    skill.location.includes(`${path.sep}.agents${path.sep}`) ||
    skill.location.includes(`${path.sep}.codex${path.sep}`) ||
    skill.location.includes(`${path.sep}.opencorvus${path.sep}skill${path.sep}`) ||
    skill.location.includes(`${path.sep}.opencorvus${path.sep}skills${path.sep}`)
  ) {
    return "external" as const
  }
  if (skill.location !== "builtin") return "local" as const
  return "unknown" as const
}

const TRUSTED_GITHUB_REPOSITORIES: ReadonlyMap<string, "official"> = new Map([
  ["openai/skills", "official"],
  ["anthropics/skills", "official"],
] as const)

const TRUSTED_HTTPS_HOSTS: ReadonlyMap<string, "curated" | "community"> = new Map([
  ["skills.sh", "curated"],
  ["skillstore.io", "curated"],
  ["skills.pub", "community"],
] as const)

function trustForSource(source: string): z.infer<typeof SkillManager.Trust> {
  if (source !== source.trim()) return "unknown"

  const scp = /^git@github\.com:([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(source)
  if (scp) return trustForGitHubRepository(scp[1]!, scp[2]!)

  const authorityStart = source.indexOf("://") + 3
  const authorityEnd = [
    source.indexOf("/", authorityStart),
    source.indexOf("?", authorityStart),
    source.indexOf("#", authorityStart),
  ]
    .filter((index) => index !== -1)
    .sort((left, right) => left - right)[0]
  const authority = source.slice(authorityStart, authorityEnd)
  const exactGitHubSshAuthority = /^git@github\.com(?::22)?$/i.test(authority)
  if (source.includes("?") || source.includes("#") || (authority.includes("@") && !exactGitHubSshAuthority)) {
    return "unknown"
  }
  const rawPath = authorityEnd === undefined ? "" : source.slice(authorityEnd).split(/[?#]/, 1)[0]!
  try {
    if (rawPath.split("/").some((segment) => [".", ".."].includes(decodeURIComponent(segment)))) return "unknown"
  } catch {
    return "unknown"
  }

  let url: URL
  try {
    url = new URL(source)
  } catch {
    return "unknown"
  }
  if (url.password || url.search || url.hash) return "unknown"

  if (url.protocol === "ssh:") {
    if (url.username !== "git" || url.hostname.toLowerCase() !== "github.com" || (url.port && url.port !== "22")) {
      return "unknown"
    }
    const repository = githubRepositoryFromPath(url.pathname)
    return repository ? trustForGitHubRepository(repository.owner, repository.repo) : "unknown"
  }

  if (url.protocol !== "https:" || url.username || url.port) return "unknown"
  const hostname = url.hostname.toLowerCase()
  if (hostname === "github.com") {
    const repository = githubRepositoryFromPath(url.pathname)
    return repository ? trustForGitHubRepository(repository.owner, repository.repo) : "unknown"
  }
  return TRUSTED_HTTPS_HOSTS.get(hostname) ?? "unknown"
}

function githubRepositoryFromPath(pathname: string) {
  const match = /^\/([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(pathname)
  if (!match) return undefined
  return { owner: match[1]!, repo: match[2]! }
}

function trustForGitHubRepository(owner: string, repo: string): z.infer<typeof SkillManager.Trust> {
  return TRUSTED_GITHUB_REPOSITORIES.get(`${owner.toLowerCase()}/${repo.toLowerCase()}`) ?? "unknown"
}

async function riskFor(dir: string, trust: z.infer<typeof SkillManager.Trust>) {
  const [scripts, agents, references, templates] = await Promise.all([
    Glob.scan("{script,scripts}/**/*", { cwd: dir, absolute: true, include: "file", dot: true, symlink: true }).catch(
      () => [],
    ),
    Glob.scan("{agent,agents}/**/*", { cwd: dir, absolute: true, include: "file", dot: true, symlink: true }).catch(
      () => [],
    ),
    Glob.scan("{reference,references}/**/*", {
      cwd: dir,
      absolute: true,
      include: "file",
      dot: true,
      symlink: true,
    }).catch(() => []),
    Glob.scan("{template,templates,asset,assets}/**/*", {
      cwd: dir,
      absolute: true,
      include: "file",
      dot: true,
      symlink: true,
    }).catch(() => []),
  ])
  const hasScripts = scripts.length > 0
  const hasAgents = agents.length > 0
  const hasReferences = references.length > 0
  const hasTemplates = templates.length > 0
  const level = hasScripts
    ? "high"
    : trust === "community" || trust === "unknown" || trust === "external"
      ? "medium"
      : hasAgents || hasReferences
        ? "medium"
        : "low"
  return {
    level,
    has_scripts: hasScripts,
    has_agents: hasAgents,
    has_references: hasReferences,
    has_templates: hasTemplates,
  } as const
}

function recommendedPolicy(trust: z.infer<typeof SkillManager.Trust>, risk: z.infer<typeof SkillManager.Risk>) {
  if (trust === "builtin") return "allow" as const
  if (risk.level === "high") return "deny" as const
  if (trust === "community" || trust === "unknown" || trust === "external") return "deny" as const
  return "deny" as const
}

async function readManifest(dir: string, ...roots: string[]) {
  let current = dir
  while (true) {
    const file = path.join(current, MANIFEST)
    const manifest = await Filesystem.readJson<{
      kind?: string
      source?: string
      market_id?: string
      hash?: string
      upstream_hash?: string
    }>(file).catch(() => undefined)
    if (manifest) return manifest
    const parent = path.dirname(current)
    if (parent === current) return undefined
    if (roots.some((root) => current === root)) return undefined
    current = parent
  }
}

async function listSkillNamesInDir(dir: string) {
  return dedupe((await validateSkillDirectory(dir)).map((definition) => definition.name))
}

type SkillImportFileInput = z.infer<typeof SkillManager.ImportBundleFile>
type NormalizedSkillFile = {
  path: string
  bytes: Uint8Array
}
type ParsedSkillRoot = {
  info: Pick<z.infer<typeof Skill.Info>, "name" | "description" | "platforms" | "required_tools">
  files: Array<{
    sourcePath: string
    relativePath: string
    bytes: Uint8Array
  }>
}

async function replaceSkillDirectory(targetDir: string, root: ParsedSkillRoot) {
  await replaceSkillDirectories([{ targetDir, root }], true)
}

type SkillDirectoryReplacement = {
  root: ParsedSkillRoot
} & SkillReplacementPublication.Target

type SkillTreeState = { kind: "absent" } | { kind: "directory"; digest: string }

async function skillTreeState(target: string): Promise<SkillTreeState> {
  let stat
  try {
    stat = await lstat(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent" }
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Skill replacement path is not a regular directory: ${target}`)
  }
  return { kind: "directory", digest: await SkillReplacementPublication.digest(target) }
}

function stateHasDigest(state: SkillTreeState, digest: string | null): boolean {
  return digest === null ? state.kind === "absent" : state.kind === "directory" && state.digest === digest
}

function replacementStaging(target: string, operationID: string, index: number) {
  return path.join(path.dirname(target), `.skill-update-${operationID}-${index}`)
}

function replacementBackup(target: string, operationID: string, index: number) {
  return path.join(path.dirname(target), `.skill-replace-${operationID}-${index}`)
}

function assertReplacementEntryPaths(entry: SkillReplacementPublication.Entry) {
  const targets = new Set<string>()
  entry.targets.forEach((item, index) => {
    const target = path.resolve(item.target)
    if (target !== item.target || targets.has(Filesystem.normalizePath(target))) {
      throw new Error(`Skill replacement ${entry.operationID} has a non-canonical or duplicate target`)
    }
    targets.add(Filesystem.normalizePath(target))
    if (
      item.staging !== replacementStaging(target, entry.operationID, index) ||
      item.backup !== replacementBackup(target, entry.operationID, index)
    ) {
      throw new Error(`Skill replacement ${entry.operationID} scratch paths do not match their occurrence identity`)
    }
    for (const owned of [item.staging, item.backup]) {
      if (!Filesystem.contains(path.dirname(target), owned) || Filesystem.overlaps(target, owned)) {
        throw new Error(`Skill replacement ${entry.operationID} contains an unsafe scratch path`)
      }
    }
  })
  for (let left = 0; left < entry.targets.length; left++) {
    for (let right = left + 1; right < entry.targets.length; right++) {
      if (Filesystem.overlaps(entry.targets[left]!.target, entry.targets[right]!.target)) {
        throw new Error(`Skill replacement ${entry.operationID} contains overlapping catalog targets`)
      }
    }
  }
}

async function globalConfigRevision() {
  const file = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
  try {
    return createHash("sha256")
      .update(await readFile(file))
      .digest("hex")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent"
    throw error
  }
}

function configurationEffectSatisfied(effect: SkillCatalogConfigurationEffect, config: z.infer<typeof Config.Info>) {
  if (effect.kind === "none") return true
  if (effect.kind === "market_install") {
    const configured = (config.skills?.paths ?? []).some(
      (candidate) => resolveGlobalConfiguredPath(candidate) === path.normalize(effect.target),
    )
    if (!configured) return false
  }
  return effect.names.every((name) => config.skill_policy?.[name] === effect.policy)
}

async function readConfigurationEffect(effect: SkillCatalogConfigurationEffect) {
  Config.global.reset()
  await Config.state.resetAll()
  const config = await Config.getGlobal()
  return {
    revision: await globalConfigRevision(),
    satisfied: configurationEffectSatisfied(effect, config),
  }
}

async function applyConfigurationEffect(effect: SkillCatalogConfigurationEffect) {
  if (effect.kind === "none") return
  await patchGlobal((next) => {
    next.skills = next.skills || {}
    if (effect.kind === "market_install") {
      next.skills.paths = dedupe([...(next.skills.paths ?? []), effect.target])
    }
    applyPolicyToConfig(next, effect.names, effect.policy)
  })
  await SkillManager.refreshDiscoveryState()
}

async function validatePublishedReplacement(entry: SkillReplacementPublication.Entry) {
  for (const target of entry.targets) {
    const definitions = await validateSkillDirectory(target.target)
    if (definitions.length !== 1 || definitions[0]!.name !== target.name) {
      throw new Error(`Skill replacement target identity changed: ${target.name}`)
    }
  }
}

async function convergeSkillReplacement(entry: SkillReplacementPublication.Entry): Promise<"forward" | "backward"> {
  assertReplacementEntryPaths(entry)
  const states = await Promise.all(
    entry.targets.map(async (target) => ({
      target: await skillTreeState(target.target),
      staging: await skillTreeState(target.staging),
      backup: await skillTreeState(target.backup),
    })),
  )
  const allAfter = states.every((state, index) => stateHasDigest(state.target, entry.targets[index]!.afterDigest))
  if (entry.published && !allAfter) {
    throw new Error(`Published Skill replacement ${entry.operationID} no longer has its complete target set`)
  }
  if (allAfter) {
    await validatePublishedReplacement(entry)
    if (!entry.published) {
      await SkillReplacementPublication.markPublished(entry.operationID, entry.targets.length)
      await replacementCut("catalog-published")
    }
    let configuredRevision = entry.configuredRevision
    let configuration = await readConfigurationEffect(entry.configuration)
    if (configuredRevision) {
      if (configuration.revision !== configuredRevision || !configuration.satisfied) {
        throw new Error(`Skill replacement ${entry.operationID} configured revision no longer matches its effect`)
      }
    } else {
      if (!configuration.satisfied) {
        if (configuration.revision !== entry.globalConfigBeforeRevision) {
          throw new Error(`Skill replacement ${entry.operationID} global config changed before its effect committed`)
        }
        await applyConfigurationEffect(entry.configuration)
        configuration = await readConfigurationEffect(entry.configuration)
      }
      if (!configuration.satisfied) {
        throw new Error(`Skill replacement ${entry.operationID} configuration effect did not commit`)
      }
      configuredRevision = configuration.revision
      await SkillReplacementPublication.markConfigured(entry.operationID, configuredRevision)
      await replacementCut("configuration-published")
    }
    configuration = await readConfigurationEffect(entry.configuration)
    if (configuration.revision !== configuredRevision || !configuration.satisfied) {
      throw new Error(`Skill replacement ${entry.operationID} lost its exact configured revision`)
    }
    for (const [index, target] of entry.targets.entries()) {
      const staging = await skillTreeState(target.staging)
      if (!stateHasDigest(staging, null) && !stateHasDigest(staging, target.afterDigest)) {
        throw new Error(`Skill replacement ${entry.operationID} staging content changed`)
      }
      if (staging.kind === "directory") await rm(target.staging, { recursive: true, force: false })
      const backup = await skillTreeState(target.backup)
      if (!stateHasDigest(backup, null) && !stateHasDigest(backup, target.beforeDigest)) {
        throw new Error(`Skill replacement ${entry.operationID} backup content changed at target ${index}`)
      }
      if (backup.kind === "directory") await rm(target.backup, { recursive: true, force: false })
    }
    await SkillReplacementPublication.settle(entry.operationID, "committed")
    await SkillManager.refreshDiscoveryState()
    return "forward"
  }

  const configuration = await readConfigurationEffect(entry.configuration)
  if (configuration.revision !== entry.globalConfigBeforeRevision) {
    throw new Error(`Skill replacement ${entry.operationID} global config changed before catalog rollback`)
  }
  for (let index = entry.targets.length - 1; index >= 0; index--) {
    const target = entry.targets[index]!
    const currentTarget = await skillTreeState(target.target)
    const currentBackup = await skillTreeState(target.backup)
    if (target.beforeDigest === null) {
      if (!stateHasDigest(currentBackup, null)) {
        throw new Error(`New Skill replacement ${entry.operationID} unexpectedly owns a backup`)
      }
      if (stateHasDigest(currentTarget, target.afterDigest)) {
        await rm(target.target, { recursive: true, force: false })
      } else if (!stateHasDigest(currentTarget, null)) {
        throw new Error(`New Skill replacement ${entry.operationID} target content changed`)
      }
    } else if (stateHasDigest(currentTarget, target.beforeDigest) && stateHasDigest(currentBackup, null)) {
      // This target had not moved yet, or was already restored by an earlier recovery.
    } else if (
      (stateHasDigest(currentTarget, null) || stateHasDigest(currentTarget, target.afterDigest)) &&
      stateHasDigest(currentBackup, target.beforeDigest)
    ) {
      if (currentTarget.kind === "directory") await rm(target.target, { recursive: true, force: false })
      await rename(target.backup, target.target)
    } else {
      throw new Error(`Skill replacement ${entry.operationID} cannot prove rollback ownership for ${target.target}`)
    }
    const staging = await skillTreeState(target.staging)
    if (stateHasDigest(staging, target.afterDigest)) {
      await rm(target.staging, { recursive: true, force: false })
    } else if (!stateHasDigest(staging, null)) {
      throw new Error(`Skill replacement ${entry.operationID} staging content changed`)
    }
  }
  await SkillReplacementPublication.settle(entry.operationID, "rolled_back")
  await SkillManager.refreshDiscoveryState()
  return "backward"
}

async function recoverOpenSkillReplacement() {
  const entry = await SkillReplacementPublication.open()
  return entry ? convergeSkillReplacement(entry) : "absent"
}

async function replaceSkillDirectories(
  entries: readonly { targetDir: string; root: ParsedSkillRoot }[],
  requireExisting = false,
  configuration: SkillCatalogConfigurationEffect = { kind: "none" },
) {
  return SkillReplacementPublication.withCatalogOwner(() =>
    replacementContext.provide(true, async () => {
      await recoverOpenSkillReplacement()
      const operationID = randomUUID()
      const replacements: SkillDirectoryReplacement[] = []
      const preparedScratch: string[] = []
      try {
        for (const [index, { targetDir, root }] of entries.entries()) {
          const target = path.resolve(targetDir)
          const parent = path.dirname(target)
          await mkdir(parent, { recursive: true })
          const staging = replacementStaging(target, operationID, index)
          const backup = replacementBackup(target, operationID, index)
          const before = await skillTreeState(target)
          if (requireExisting && before.kind === "absent") {
            throw new Error(`Skill update target is not a regular directory: ${target}`)
          }
          if (before.kind === "directory") {
            const definitions = await validateSkillDirectory(target)
            if (definitions.length !== 1 || definitions[0]!.name !== root.info.name) {
              throw new Error(`Skill import target identity differs from ${JSON.stringify(root.info.name)}`)
            }
          }
          await mkdir(staging, { recursive: false })
          preparedScratch.push(staging)
          for (const file of root.files) {
            const destination = path.join(staging, ...file.relativePath.split("/"))
            if (!Filesystem.contains(staging, destination)) {
              throw new Error(`Skill update file escapes staging directory: ${file.relativePath}`)
            }
            await Filesystem.write(destination, file.bytes)
          }
          const definitions = await validateSkillDirectory(staging)
          if (definitions.length !== 1 || definitions[0]!.name !== root.info.name) {
            throw new Error(`Skill update staging identity changed: ${root.info.name}`)
          }
          replacements.push({
            target,
            root,
            staging,
            backup,
            name: root.info.name,
            beforeDigest: before.kind === "directory" ? before.digest : null,
            afterDigest: await SkillReplacementPublication.digest(staging),
          })
        }
        await SkillReplacementPublication.record({
          operationID,
          timeCreated: Date.now(),
          targets: replacements.map(({ root: _root, ...replacement }) => replacement),
          requireExisting,
          configuration: SkillCatalogConfigurationEffect.parse(configuration),
          globalConfigBeforeRevision: await globalConfigRevision(),
        })
        await replacementCut("intent-published")
      } catch (error) {
        await Promise.all(preparedScratch.map((staging) => rm(staging, { recursive: true, force: true })))
        throw error
      }

      try {
        for (const [index, replacement] of replacements.entries()) {
          if (replacement.beforeDigest !== null) {
            await rename(replacement.target, replacement.backup)
            await replacementCut("target-backed-up", index)
          }
          await rename(replacement.staging, replacement.target)
          await replacementCut("target-installed", index)
        }
        const entry = await SkillReplacementPublication.open()
        if (!entry || entry.operationID !== operationID) {
          throw new Error(`Skill replacement lost its exact durable occurrence ${operationID}`)
        }
        await convergeSkillReplacement(entry)
      } catch (error) {
        const entry = await SkillReplacementPublication.open()
        if (!entry || entry.operationID !== operationID) throw error
        const outcome = await convergeSkillReplacement(entry).catch((recoveryError) => {
          throw new AggregateError([error, recoveryError], "Skill replacement and recovery both failed", {
            cause: error,
          })
        })
        if (outcome === "backward" || error instanceof Config.GlobalConfigCommittedReconcileError) throw error
      }
    }),
  )
}

async function readImportSkillRoots(input: z.infer<typeof SkillManager.ImportFileInput>): Promise<ParsedSkillRoot[]> {
  const files = input.archiveBase64
    ? await readZipSkillFiles(input.filename ?? input.sourceName ?? "skill.zip", input.archiveBase64)
    : input.files?.length
      ? input.files
      : [
          {
            path: input.filename ?? "SKILL.md",
            content: input.content ?? "",
          },
        ]
  return parseSkillRoots(normalizeBundleFiles(files))
}

async function readZipSkillFiles(filename: string, archiveBase64: string): Promise<SkillImportFileInput[]> {
  const archive = Uint8Array.from(Buffer.from(archiveBase64, "base64"))
  const reader = new ZipReader(new Uint8ArrayReader(archive))
  try {
    const entries = await reader.getEntries()
    const files: SkillImportFileInput[] = []
    for (const entry of entries) {
      if (entry.directory) continue
      const data = await entry.getData?.(new Uint8ArrayWriter())
      if (!data) continue
      files.push({
        path: entry.filename,
        contentBase64: Buffer.from(data).toString("base64"),
      })
    }
    if (files.length === 0) throw new Error(`No files found in ${filename}`)
    return files
  } finally {
    await reader.close()
  }
}

function normalizeBundleFiles(files: SkillImportFileInput[]): NormalizedSkillFile[] {
  return files.map((file) => {
    const relativePath = normalizeImportPath(file.path)
    return {
      path: relativePath,
      bytes:
        file.contentBase64 !== undefined
          ? Uint8Array.from(Buffer.from(file.contentBase64, "base64"))
          : new TextEncoder().encode(file.content ?? ""),
    }
  })
}

function normalizeImportPath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "")
  const segments = normalized.split("/").filter(Boolean)
  if (segments.length === 0) throw new Error(`Invalid empty skill import path: ${value}`)
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Refusing unsafe skill import path: ${value}`)
  }
  if (/^[a-zA-Z]:/.test(segments[0]!)) {
    throw new Error(`Refusing absolute skill import path: ${value}`)
  }
  return segments.join("/")
}

function parseSkillRoots(files: NormalizedSkillFile[]): ParsedSkillRoot[] {
  const skillFiles = files.filter((file) => path.posix.basename(file.path).toLowerCase() === "skill.md")
  if (skillFiles.length === 0) {
    throw new Error("No SKILL.md files found in dropped skill source")
  }

  return skillFiles.map((skillFile) => {
    const rootPath = path.posix.dirname(skillFile.path)
    const root = rootPath === "." ? "" : rootPath
    const siblingSkillRoots = skillFiles
      .filter((file) => file.path !== skillFile.path)
      .map((file) => {
        const dir = path.posix.dirname(file.path)
        return dir === "." ? "" : dir
      })
      .filter(Boolean)
    const parsed = ConfigMarkdown.parseText(new TextDecoder().decode(skillFile.bytes), skillFile.path)
    const definition = Skill.parseDefinition(parsed.data, skillFile.path)
    const info = {
      name: definition.name,
      description: definition.description,
      platforms: definition.platforms,
      required_tools: definition.required_tools,
    }
    const rootFiles = files
      .filter((file) => {
        if (root) return file.path === root || file.path.startsWith(`${root}/`)
        if (skillFiles.length === 1) return true
        return !siblingSkillRoots.some((siblingRoot) => file.path.startsWith(`${siblingRoot}/`))
      })
      .map((file) => ({
        sourcePath: file.path,
        relativePath: root ? file.path.slice(root.length + 1) : file.path,
        bytes: file.bytes,
      }))
      .filter((file) => file.relativePath)
    return { info, files: rootFiles }
  })
}
