import { lstat, mkdir, mkdtemp, rename, rm } from "fs/promises"
import { randomUUID } from "node:crypto"
import path from "path"
import z from "zod"
import { Config } from "@/config/config"
import { ConfigMarkdown } from "@/config/markdown"
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

const MANIFEST = ".opencorvus-skill-source.json"
const log = Log.create({ service: "skill-manager" })
export namespace SkillManager {
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
    source_type: z.enum(["builtin", "managed_git", "config_path", "config_url", "external", "unknown"]),
    source: z.string().optional(),
    trust: Trust,
    risk: Risk,
    recommended_policy: Policy,
    policy: Policy,
    managed: z.boolean(),
    writable: z.boolean(),
  })

  const MarketListing = z.object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    description: z.string(),
    homepage: z.string().url(),
    source: z.string().optional(),
    install_kind: z.enum(["git", "url", "manual"]),
    trust: z.enum(["official", "curated", "community"]),
    recommended_policy: Policy,
    notes: z.string().optional(),
  })

  export const MarketEntry = MarketListing.extend({
    installed: z.boolean(),
  })

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
    kind: z.enum(["path", "url", "git"]).optional(),
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

  /** 内置默认市场条目 */
  const BUILTIN_MARKET: z.input<typeof MarketListing>[] = [
    {
      id: "openai-skills",
      name: "OpenAI Skills",
      provider: "OpenAI",
      description: "Official public repository for Agent Skills and related skill plugins.",
      homepage: "https://github.com/openai/skills",
      source: "https://github.com/openai/skills.git",
      install_kind: "git",
      trust: "official",
      recommended_policy: "allow",
      notes: "Installable as a Git source; review individual skills before allowing always.",
    },
    {
      id: "anthropic-skills",
      name: "Anthropic Skills",
      provider: "Anthropic",
      description: "Official skill repository curated for Claude-style agent workflows.",
      homepage: "https://github.com/anthropics/skills",
      source: "https://github.com/anthropics/skills.git",
      install_kind: "git",
      trust: "official",
      recommended_policy: "allow",
      notes: "Official source, but still prefer ask-by-default for script-bearing skills.",
    },
    {
      id: "skills-sh",
      name: "skills.sh",
      provider: "skills.sh",
      description: "Large searchable skill directory with repo-based install flows and popularity signals.",
      homepage: "https://skills.sh",
      install_kind: "manual",
      trust: "curated",
      recommended_policy: "allow",
      notes: "Best used to discover repo URLs, then install via Git source in OpenCorvus.",
    },
    {
      id: "skillstore",
      name: "Skillstore",
      provider: "Skillstore",
      description: "Marketplace focused on install guides, packaging patterns, and skill submission review.",
      homepage: "https://skillstore.io",
      install_kind: "manual",
      trust: "curated",
      recommended_policy: "allow",
      notes: "Useful discovery surface; installation method depends on the linked repository.",
    },
    {
      id: "skills-pub",
      name: "skills.pub",
      provider: "skills.pub",
      description: "High-volume community index covering hundreds of public skills across ecosystems.",
      homepage: "https://skills.pub",
      install_kind: "manual",
      trust: "community",
      recommended_policy: "allow",
      notes: "Community directory only; import the referenced repo or path after review.",
    },
  ]

  /**
   * 返回市场条目：内置默认 + 从配置的 registry URL 动态拉取。
   * registry URL 应返回不含 installed 的市场条目 JSON 数组；installed 由服务端根据真实安装来源计算。
   */
  export async function market() {
    const entries = [...BUILTIN_MARKET]
    const global = await Config.getGlobal()
    const registries = ((global?.skills as Record<string, unknown> | undefined)?.registries ?? []) as string[]
    const seenIDs = new Set(entries.map((e) => e.id))

    // 并行拉取所有配置的 registry
    const fetched = await Promise.all(
      registries.map(async (url: string) => {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
          if (!resp.ok) return []
          const data = await resp.json()
          return MarketListing.array().parse(data)
        } catch {
          return []
        }
      }),
    )
    for (const list of fetched) {
      for (const entry of list) {
        if (!seenIDs.has(entry.id)) {
          entries.push(entry)
          seenIDs.add(entry.id)
        }
      }
    }

    return MarketEntry.array().parse(
      await Promise.all(
        entries.map(async (entry) => {
          return {
            ...entry,
            installed: await marketEntryInstalled(entry, global),
          }
        }),
      ),
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
              manifest?.kind === "git"
                ? ("managed_git" as const)
                : manifest?.kind === "url"
                  ? ("config_url" as const)
                  : sourceType,
            source:
              remoteSource ??
              manifest?.source ??
              (sourceType === "config_path"
                ? configuredPaths.find((item) => Filesystem.contains(item, dir!))
                : undefined) ??
              (sourceType === "config_url" && configuredUrls.length === 1 ? configuredUrls[0] : undefined),
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

  async function resetInstalledDiscoveryState() {
    await Skill.state.resetAll()
    await installedInventoryState.resetAll()
  }

  export async function installed() {
    const global = await Config.getGlobal()
    const rules = CapabilityRules.fromConfig({ skill: global.skill_policy ?? {} })

    return Installed.array().parse(
      (await installedInventoryState()).map((skill) => ({
        ...skill,
        policy: CapabilityRules.evaluate("skill", skill.name, rules).action,
      })),
    )
  }

  export async function refreshDiscoveryState() {
    Config.global.reset()
    await Config.state.reset()
    await resetInstalledDiscoveryState()
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
          await replaceSkillDirectories(targets, false, async () => {
            await Config.state.reset()
            await resetInstalledDiscoveryState()
            if (input.policy) {
              await applyPolicyToNames(
                targets.map((item) => item.root.info.name),
                input.policy,
              )
            }
          })
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
    const source =
      input.kind === "git"
        ? managedGitTarget(normalizeGit(input.source))
        : input.kind === "url"
          ? input.source
          : resolveSource(input.source)

    return withSkillCatalogMutation(() =>
      withSkillSourceMutation(source, async () => {
        await patchGlobal((next) => {
          next.skills = next.skills || {}
          next.skills.paths = (next.skills.paths ?? []).filter((item) => resolveSource(item) !== source)
          next.skills.urls = (next.skills.urls ?? []).filter((item) => item !== input.source)
        })
        const effective = await Config.getGlobal()
        const stillConfigured =
          (effective.skills?.paths ?? []).some((item) => resolveSource(item) === source) ||
          (effective.skills?.urls ?? []).includes(input.source)
        if (stillConfigured) {
          throw new Error(`Skill source is owned by a lower-priority global config file: ${input.source}`)
        }

        if (Filesystem.contains(managedRoot(), source)) {
          await rm(source, { recursive: true, force: true })
        }

        await Config.state.reset()
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

async function marketEntryInstalled(
  entry: { source?: string; install_kind: "git" | "url" | "manual" },
  config: z.infer<typeof Config.Info>,
): Promise<boolean> {
  if (!entry.source || entry.install_kind === "manual") return false
  if (entry.install_kind === "url") {
    const source = normalizeUrl(entry.source)
    return (config.skills?.urls ?? []).some((configured) => normalizeUrl(configured) === source)
  }
  const target = path.normalize(managedGitTarget(normalizeGit(entry.source)))
  const configured = (config.skills?.paths ?? []).some((configuredPath) => {
    const expanded = configuredPath.startsWith("~/")
      ? path.join(Global.Path.home, configuredPath.slice(2))
      : configuredPath
    return path.isAbsolute(expanded) && path.normalize(expanded) === target
  })
  return configured && (await Filesystem.isDir(target))
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

async function applyPolicyToNames(names: string[], policy: z.infer<typeof SkillManager.Policy>) {
  await patchGlobal((next) => {
    applyPolicyToConfig(next, names, policy)
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
  if (source?.includes("github.com/openai/skills")) return "official" as const
  if (source?.includes("github.com/anthropics/skills")) return "official" as const
  if (source?.includes("skills.sh")) return "curated" as const
  if (source?.includes("skillstore.io")) return "curated" as const
  if (source?.includes("skills.pub")) return "community" as const
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
    const manifest = await Filesystem.readJson<{ kind?: string; source?: string }>(file).catch(() => undefined)
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
  target: string
  root: ParsedSkillRoot
  staging: string
  backup: string
  targetMoved: boolean
  targetInstalled: boolean
}

async function replaceSkillDirectories(
  entries: readonly { targetDir: string; root: ParsedSkillRoot }[],
  requireExisting = false,
  afterInstall?: () => Promise<void>,
) {
  const replacements: SkillDirectoryReplacement[] = []
  let committedReconcileError: Config.GlobalConfigCommittedReconcileError | undefined
  try {
    for (const { targetDir, root } of entries) {
      const target = path.resolve(targetDir)
      const parent = path.dirname(target)
      await mkdir(parent, { recursive: true })
      const staging = await mkdtemp(path.join(parent, `.skill-update-${slug(root.info.name)}-`))
      const replacement: SkillDirectoryReplacement = {
        target,
        root,
        staging,
        backup: path.join(parent, `.skill-replace-${slug(root.info.name)}-${randomUUID()}`),
        targetMoved: false,
        targetInstalled: false,
      }
      replacements.push(replacement)
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
    }

    for (const replacement of replacements) {
      let targetState
      try {
        targetState = await lstat(replacement.target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      if (targetState) {
        if (targetState.isSymbolicLink() || !targetState.isDirectory()) {
          throw new Error(`Skill update target is not a regular directory: ${replacement.target}`)
        }
        const definitions = await validateSkillDirectory(replacement.target)
        if (definitions.length !== 1 || definitions[0]!.name !== replacement.root.info.name) {
          throw new Error(`Skill import target identity differs from ${JSON.stringify(replacement.root.info.name)}`)
        }
        await rename(replacement.target, replacement.backup)
        replacement.targetMoved = true
      } else if (requireExisting) {
        throw new Error(`Skill update target is not a regular directory: ${replacement.target}`)
      }
      await rename(replacement.staging, replacement.target)
      replacement.targetInstalled = true
    }

    await Promise.all(replacements.map((replacement) => validateSkillDirectory(replacement.target)))
    await afterInstall?.()
  } catch (error) {
    if (error instanceof Config.GlobalConfigCommittedReconcileError) {
      committedReconcileError = error
    } else {
      const cleanupFailures: unknown[] = []
      for (const replacement of [...replacements].reverse()) {
        if (replacement.targetInstalled) {
          try {
            await rm(replacement.target, { recursive: true, force: true })
          } catch (cleanupError) {
            cleanupFailures.push(cleanupError)
          }
        }
        if (replacement.targetMoved) {
          try {
            await rename(replacement.backup, replacement.target)
          } catch (cleanupError) {
            cleanupFailures.push(cleanupError)
          }
        }
        try {
          await rm(replacement.staging, { recursive: true, force: true })
        } catch (cleanupError) {
          cleanupFailures.push(cleanupError)
        }
      }
      if (cleanupFailures.length > 0) {
        throw new AggregateError(
          [error, ...cleanupFailures],
          "Skill update failed and atomic directory restoration also failed",
          { cause: error },
        )
      }
      throw error
    }
  }
  const backupCleanup = await Promise.allSettled(
    replacements
      .filter((replacement) => replacement.targetMoved)
      .map((replacement) => rm(replacement.backup, { recursive: true, force: true })),
  )
  const backupCleanupFailures = backupCleanup.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  )
  if (backupCleanupFailures.length > 0) {
    log.warn("Skill directory replacement committed with backup cleanup failures", {
      failures: backupCleanupFailures.map((failure) => String(failure.reason)),
    })
  }
  if (committedReconcileError) throw committedReconcileError
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
