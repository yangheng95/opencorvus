import path from "path"
import fs from "node:fs/promises"
import { DEFAULT_PROMPT_PROFILE_ID } from "../../src/agent/prompt-profile"
import { ExpertSquadRuntimeOverridesSchema } from "../../src/agent/runtime-override"
import type { Config } from "../../src/config/config"

export type BenchmarkAgentModelConfiguration = {
  modelByAgent: Record<string, string>
  expertSquads: NonNullable<Config.Info["expert_squads"]>
}

export async function loadBenchmarkEnv(metaDir: string, options?: { cwd?: string }) {
  const locked = new Set(
    Object.entries(process.env).flatMap(([key, value]) => (typeof value === "string" && value.trim() ? [key] : [])),
  )
  const packageRoot = path.resolve(metaDir, "../..")
  const repoRoot = path.resolve(metaDir, "../../../..")
  const cwd = options?.cwd ? path.resolve(options.cwd) : process.cwd()
  const files = [...new Set([path.join(repoRoot, ".env"), path.join(packageRoot, ".env"), path.join(cwd, ".env")])]
  const loaded: string[] = []

  for (const file of files) {
    const text = await Bun.file(file)
      .text()
      .catch(() => "")
    if (!text) continue
    loaded.push(file)
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith("#")) continue
      const idx = line.indexOf("=")
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim()
      if (!key || locked.has(key)) continue
      let value = line.slice(idx + 1).trim()
      if (!value) {
        process.env[key] = ""
        continue
      }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        process.env[key] = value.slice(1, -1)
        continue
      }
      process.env[key] = value.replace(/\s+#.*$/, "").trim()
    }
  }

  return loaded
}

export function env(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
}

export async function copyBenchmarkAuth(input: { sourceDataDirectory: string; benchmarkHome: string }) {
  const source = path.join(input.sourceDataDirectory, "auth.json")
  const targetDirectory = path.join(input.benchmarkHome, "data")
  const target = path.join(targetDirectory, "auth.json")
  await fs.mkdir(targetDirectory, { recursive: true })
  try {
    await fs.copyFile(source, target)
    return { copied: true as const, source, target }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { copied: false as const, source, target }
    }
    throw error
  }
}

export async function provisionBenchmarkExpertSquad(input: { projectDirectory: string; profileID: string }) {
  if (input.profileID === DEFAULT_PROMPT_PROFILE_ID) {
    return { id: input.profileID, installationScope: "builtin" as const }
  }
  const { ExpertSquadPackageManager } = await import("../../src/expert-squad/manager")
  return ExpertSquadPackageManager.installPayloadPackage({
    projectDirectory: input.projectDirectory,
    id: input.profileID,
    installationScope: "project",
  })
}

export async function readBenchmarkAgentModelMap(input: {
  file: string
  profileID: string
}): Promise<BenchmarkAgentModelConfiguration> {
  const file = path.resolve(input.file)
  const value = JSON.parse(await fs.readFile(file, "utf8")) as unknown
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`benchmark agent model map must be a JSON object: ${file}`)
  }
  const modelByAgent = Object.fromEntries(Object.entries(value).map(([agentID, model]) => [agentID, model]))
  if (Object.keys(modelByAgent).length === 0) {
    throw new Error(`benchmark agent model map must declare at least one projected agent: ${file}`)
  }
  const expertSquads = ExpertSquadRuntimeOverridesSchema.parse({
    [input.profileID]: {
      agents: Object.fromEntries(
        Object.entries(modelByAgent).map(([agentID, model]) => [agentID, { runtime: { model } }]),
      ),
    },
  })
  return {
    modelByAgent: Object.fromEntries(
      Object.entries(expertSquads[input.profileID]!.agents).map(([agentID, value]) => [agentID, value.runtime.model!]),
    ),
    expertSquads,
  }
}

export async function assertBenchmarkAgentModelCoverage(input: {
  projectDirectory: string
  profileID: string
  config: Config.Info
  modelByAgent: Record<string, string>
}) {
  const { PromptProfileResolver } = await import("../../src/expert-squad/prompt-profile-resolver")
  const projection = await PromptProfileResolver.resolveSkillProjection({
    projectDirectory: input.projectDirectory,
    config: input.config,
  })
  if (projection.expertSquadID !== input.profileID) {
    throw new Error(
      `benchmark active expert squad mismatch: expected ${input.profileID}, resolved ${projection.expertSquadID}`,
    )
  }
  const expected = [...projection.projectedAgentIDs].sort()
  const configured = Object.keys(input.modelByAgent).sort()
  const missing = expected.filter((agentID) => !configured.includes(agentID))
  const unexpected = configured.filter((agentID) => !expected.includes(agentID))
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `benchmark agent model map must cover the exact ${input.profileID} projection; missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}`,
    )
  }
  return { agentCount: expected.length }
}

export function dashscopeCodingKey() {
  const key = env("DASHSCOPE_API_KEY", "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY")
  return key?.startsWith("sk-sp-") ? key : undefined
}

// `alibaba-coding-plan` (international) deliberately excluded — bench keys are
// 国内 sk-sp-*, the international endpoint coding-intl.dashscope.aliyuncs.com
// rejects them with HTTP 401. Use `-cn` exclusively (rule 8: no double source).
const preferredProviders = [
  "alibaba-coding-plan-cn",
  "alibaba-cn",
  "google",
  "deepseek",
  "gitlab",
  "moonshotai-cn",
  "moonshotai",
  "huggingface",
]

async function providerList() {
  const { Provider } = await import("../../src/provider/provider")
  return Provider.list()
}

async function resetBenchmarkState() {
  const [{ Config }, { Instance }] = await Promise.all([
    import("../../src/config/config"),
    import("../../src/project/instance"),
  ])
  Config.global.reset()
  await Instance.disposeAll()
}

export function explicitModel(providers: Awaited<ReturnType<typeof providerList>>, explicit: string) {
  if (explicit.startsWith("alibaba-coding-plan/")) {
    throw new Error(
      `benchmark model "${explicit}" rejected: international alibaba-coding-plan endpoint does not accept 国内 sk-sp-* keys (rule 8). Use alibaba-coding-plan-cn/<model> instead.`,
    )
  }
  if (explicit.includes("/")) return explicit
  for (const providerID of preferredProviders) {
    const provider = providers[providerID]
    if (provider?.models[explicit]) return `${providerID}/${explicit}`
  }
  for (const provider of Object.values(providers)) {
    if (provider.models[explicit]) return `${provider.id}/${explicit}`
  }
  throw new Error(`benchmark model not found: ${explicit}`)
}

export async function resolveBenchmarkModel(
  metaDir: string,
  options?: {
    cwd?: string
    explicitKeys?: string[]
  },
) {
  await resetBenchmarkState()
  const root = path.resolve(metaDir, "../..")
  const [{ Instance }, { Provider }] = await Promise.all([
    import("../../src/project/instance"),
    import("../../src/provider/provider"),
  ])
  return Instance.provide({
    directory: root,
    fn: async () => {
      const providers = await Provider.list()
      const explicitKeys = options?.explicitKeys ?? ["OPENCORVUS_BENCHMARK_MODEL", "OPENCORVUS_E2E_MODEL"]
      const explicit = env(...explicitKeys)
      if (!explicit) {
        throw new Error(`benchmark model must be configured explicitly via ${explicitKeys.join(" or ")}`)
      }
      return explicitModel(providers, explicit)
    },
  })
}

export async function ensureBenchmarkModel(metaDir: string, model: string) {
  await resetBenchmarkState()
  const [{ Instance }, { Provider }] = await Promise.all([
    import("../../src/project/instance"),
    import("../../src/provider/provider"),
  ])
  return Instance.provide({
    directory: path.resolve(metaDir, "../.."),
    fn: async () => {
      const parsed = Provider.parseModel(model)
      const resolved = await Provider.getModel(parsed.providerID, parsed.modelID)
      await Provider.getLanguage(resolved)
    },
  })
}

export async function hasBenchmarkModel(metaDir: string, model: string) {
  try {
    await ensureBenchmarkModel(metaDir, model)
    return true
  } catch {
    return false
  }
}
