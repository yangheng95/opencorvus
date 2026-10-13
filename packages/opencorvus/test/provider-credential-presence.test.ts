import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Auth, OAUTH_DUMMY_KEY } from "@/auth"
import { Config } from "@/config/config"
import { Env } from "@/env"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { memoryProject } from "./fixture/memory"

type Scope = "global" | "project"
type Catalog = { all: Provider.Info[]; connected: string[]; issues: Provider.LoadIssue[] }
const scopes: Scope[] = ["global", "project"]
const api = "http://127.0.0.1:1/presence/v1"
// These are deliberately fictional inputs in the runner-owned runtime, never real credentials.
const savedKey = "fictional-presence-saved-key"
const configKey = "fictional-presence-config-key"
const envName = "OPENCORVUS_PRESENCE_TEST_API_KEY"
const authPath = path.join(Global.Path.data, "auth.json")
const globalConfigPath = path.join(Global.Path.config, "opencorvus.jsonc")
let project: Awaited<ReturnType<typeof memoryProject>>
let projectConfigPath: string
let originalConfig: Config.Info
let originalAuth: Buffer | undefined
let originalCatalog: string
let testCatalog: Record<string, ModelsDev.Provider>
const originalEnv = process.env[envName]

function declaration(id: string, env: string[] = []): ModelsDev.Provider {
  return { id, name: id, env, npm: "@ai-sdk/openai-compatible", api, models: {} }
}

function readyModel(): ModelsDev.Model {
  return {
    id: "presence-model",
    name: "Presence model",
    release_date: "2026-10-13",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
    limit: { context: 10000, output: 1000 },
    options: {},
  }
}

function configuration(ids: string[], provider: Config.Info["provider"] = {}): Config.Info {
  return {
    enabled_providers: ids,
    provider: Object.fromEntries(ids.map((id) => [id, { api, models: {}, ...provider?.[id] }])),
  }
}

async function resetReaders() {
  Config.global.reset()
  await Config.state.resetAll()
  ModelsDev.Data.reset()
  await Provider.resetAll()
}

async function replaceAuth(contents?: string | Buffer) {
  await rm(authPath, { recursive: true, force: true })
  if (contents !== undefined) await writeFile(authPath, contents, { mode: 0o600 })
}

beforeAll(async () => {
  originalConfig = await Config.getGlobal()
  originalAuth = await readFile(authPath).catch(() => undefined)
  originalCatalog = await readFile(ModelsDev.catalogPath(), "utf8")
  testCatalog = Object.fromEntries(
    [
      "opencorvus",
      "kilo",
      "presence-empty",
      "presence-zero",
      "presence-ready",
      "presence-config",
      "presence-env",
      "presence-multi",
      "presence-filtered",
      "openai",
      "gitlab",
      "amazon-bedrock",
      "cloudflare-ai-gateway",
    ].map((id) => [id, declaration(id)]),
  )
  project = await memoryProject()
  projectConfigPath = path.join(project.path, ".opencorvus", "opencorvus.jsonc")
  await mkdir(path.dirname(projectConfigPath), { recursive: true })
})

beforeEach(async () => {
  await Instance.disposeAll()
  delete process.env[envName]
  await replaceAuth()
  await writeFile(ModelsDev.catalogPath(), JSON.stringify(testCatalog))
  await writeFile(projectConfigPath, "{}")
  await resetReaders()
  await Config.writeGlobal({})
})

afterEach(async () => {
  // Restore authorities before any global writer validates the registered, still-live project.
  const restored = await Promise.allSettled([
    replaceAuth(originalAuth),
    writeFile(ModelsDev.catalogPath(), originalCatalog),
    writeFile(projectConfigPath, "{}"),
    writeFile(globalConfigPath, JSON.stringify(originalConfig)),
  ])
  const failures = restored.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  try {
    await resetReaders()
    await Config.writeGlobal(originalConfig)
  } catch (error) {
    failures.push(error)
  } finally {
    try {
      await Instance.disposeAll()
    } catch (error) {
      failures.push(error)
    }
    if (originalEnv === undefined) delete process.env[envName]
    else process.env[envName] = originalEnv
  }
  if (failures.length) throw new AggregateError(failures, "Credential-presence fixture restoration failed")
})

afterAll(async () => {
  await project[Symbol.asyncDispose]()
})

async function readCatalog(scope: Scope): Promise<{ status: number; catalog: Catalog }> {
  const response = await Server.App().request(scope === "global" ? "/global/providers" : "/provider", {
    headers: scope === "project" ? { "x-opencorvus-directory": project.path } : {},
  })
  const body = (await response.json()) as Catalog | { catalog: Catalog }
  return { status: response.status, catalog: "catalog" in body ? body.catalog : body }
}

function fact(catalog: Catalog, id: string) {
  const entry = catalog.all.find((provider) => provider.id === id)
  return { id: entry?.id, apiKeyConfigured: entry?.apiKeyConfigured }
}

function oauth(enterpriseUrl = "http://127.0.0.1:1") {
  return {
    type: "oauth" as const,
    access: "fictional-presence-oauth-access",
    refresh: "fictional-presence-oauth-refresh",
    expires: Date.now() + 24 * 60 * 60 * 1000,
    enterpriseUrl,
  }
}

describe.serial("Provider API-key configuration presence", () => {
  test("both public scopes expose zero-model source facts while keeping the exact runnable projection", async () => {
    await Auth.set("presence-zero", { type: "api", key: savedKey })
    await Auth.set("presence-ready", { type: "api", key: savedKey })
    process.env[envName] = "fictional-presence-environment-key"
    await Config.writeGlobal(
      configuration(["presence-zero", "presence-ready", "presence-config", "presence-env", "presence-empty"], {
        "presence-ready": { models: { "presence-model": readyModel() } },
        "presence-config": { options: { apiKey: configKey } },
        "presence-env": { env: [envName] },
      }),
    )
    await Instance.provide({ directory: project.path, fn: () => Env.set(envName, process.env[envName]!) })
    await Provider.resetAll()
    for (const scope of scopes) {
      const { status, catalog } = await readCatalog(scope)
      expect({
        status,
        facts: catalog.all.map((item) => fact(catalog, item.id)).sort((a, b) => a.id!.localeCompare(b.id!)),
        connected: catalog.connected,
      }).toEqual({
        status: 200,
        facts: [
          { id: "presence-config", apiKeyConfigured: true },
          { id: "presence-empty", apiKeyConfigured: false },
          { id: "presence-env", apiKeyConfigured: true },
          { id: "presence-ready", apiKeyConfigured: true },
          { id: "presence-zero", apiKeyConfigured: true },
        ],
        connected: ["presence-ready"],
      })
    }
    const response = await Server.App().request("/config/providers", {
      headers: { "x-opencorvus-directory": project.path },
    })
    const body = (await response.json()) as { providers: Provider.Info[]; default: Record<string, string> }
    expect({
      status: response.status,
      providers: body.providers.map(({ id, apiKeyConfigured }) => ({ id, apiKeyConfigured })),
      default: body.default,
    }).toEqual({
      status: 200,
      providers: [{ id: "presence-ready", apiKeyConfigured: true }],
      default: { "presence-ready": "presence-model" },
    })
  })

  test("project configuration supplies its own presence fact without changing the global configuration", async () => {
    await Config.writeGlobal(configuration(["presence-zero"]))
    await Instance.provide({
      directory: project.path,
      fn: () => Config.updateProjectPatch({ provider: { "presence-zero": { options: { apiKey: configKey } } } }),
    })
    const global = await readCatalog("global")
    const local = await readCatalog("project")
    expect({ global: fact(global.catalog, "presence-zero"), project: fact(local.catalog, "presence-zero") }).toEqual({
      global: { id: "presence-zero", apiKeyConfigured: false },
      project: { id: "presence-zero", apiKeyConfigured: true },
    })
  })

  test("real built-in OAuth loaders publish dummy and access options while API-key presence stays false", async () => {
    const credential = oauth()
    await Auth.set("openai", credential)
    await Auth.set("gitlab", credential)
    await Config.writeGlobal(configuration(["openai", "gitlab"]))
    for (const scope of scopes) {
      const config =
        scope === "global"
          ? await Config.getGlobal()
          : await Instance.provide({ directory: project.path, fn: () => Config.get() })
      const inspect = async () => {
        const openai = await Provider.getConfiguredProvider("openai", { config, global: scope === "global" })
        const gitlab = await Provider.getConfiguredProvider("gitlab", { config, global: scope === "global" })
        return {
          dummy: openai?.options.apiKey === OAUTH_DUMMY_KEY,
          access: gitlab?.options.apiKey === credential.access,
        }
      }
      const options =
        scope === "global" ? await inspect() : await Instance.provide({ directory: project.path, fn: inspect })
      const { status, catalog } = await readCatalog(scope)
      expect({ status, options, openai: fact(catalog, "openai"), gitlab: fact(catalog, "gitlab") }).toEqual({
        status: 200,
        options: { dummy: true, access: true },
        openai: { id: "openai", apiKeyConfigured: false },
        gitlab: { id: "gitlab", apiKeyConfigured: false },
      })
    }
  })

  test("explicit API-key configuration remains a positive fact alongside OAuth and an empty override preserves saved API existence", async () => {
    await Auth.set("openai", oauth())
    await Auth.set("presence-zero", { type: "api", key: savedKey })
    await Config.writeGlobal(
      configuration(["openai", "presence-zero"], {
        openai: { options: { apiKey: configKey } },
        "presence-zero": { options: { apiKey: "" } },
      }),
    )
    for (const scope of scopes) {
      const { catalog } = await readCatalog(scope)
      expect([fact(catalog, "openai"), fact(catalog, "presence-zero")]).toEqual([
        { id: "openai", apiKeyConfigured: true },
        { id: "presence-zero", apiKeyConfigured: true },
      ])
    }
  })

  test("missing Auth is a successfully observed empty authority in both scopes", async () => {
    await Config.writeGlobal(configuration(["presence-empty"]))
    for (const scope of scopes) {
      const { status, catalog } = await readCatalog(scope)
      expect({ status, fact: fact(catalog, "presence-empty"), issues: catalog.issues }).toEqual({
        status: 200,
        fact: { id: "presence-empty", apiKeyConfigured: false },
        issues: [],
      })
    }
  })

  for (const reason of ["malformed_json", "io"] as const) {
    test(`${reason} Auth observation yields unknown while a separately observed configured key remains true`, async () => {
      await Config.writeGlobal(
        configuration(["presence-empty", "presence-config"], { "presence-config": { options: { apiKey: configKey } } }),
      )
      if (reason === "io") await mkdir(authPath)
      else await writeFile(authPath, '{"presence-zero":')
      await resetReaders()
      const message =
        reason === "io"
          ? "Saved Provider credentials could not be read"
          : "Saved Provider credentials contain malformed JSON"
      const global = await readCatalog("global")
      const local = await readCatalog("project")
      expect({
        status: global.status,
        empty: fact(global.catalog, "presence-empty"),
        configured: fact(global.catalog, "presence-config"),
        authIssues: global.catalog.issues.filter((issue) => issue.phase === "auth.read"),
      }).toEqual({
        status: 200,
        empty: { id: "presence-empty", apiKeyConfigured: undefined },
        configured: { id: "presence-config", apiKeyConfigured: true },
        authIssues: [{ phase: "auth.read", message: `AuthReadError: ${message}` }],
      })
      expect({
        status: local.status,
        empty: fact(local.catalog, "presence-empty"),
        configured: fact(local.catalog, "presence-config"),
        authIssues: local.catalog.issues.filter((issue) => issue.phase === "auth.read"),
      }).toEqual({
        status: 200,
        empty: { id: "presence-empty", apiKeyConfigured: undefined },
        configured: { id: "presence-config", apiKeyConfigured: undefined },
        authIssues: [{ phase: "auth.read", message: `AuthReadError: ${message}` }],
      })
    })
  }

  for (const [name, contents] of [
    ["ConfigJsonError", '{"provider":'],
    ["ConfigInvalidError", '{"provider":42}'],
  ] as const) {
    test(`${name} through each public route publishes a configuration issue and unknown presence`, async () => {
      await writeFile(globalConfigPath, contents)
      await resetReaders()
      for (const scope of scopes) {
        const { status, catalog } = await readCatalog(scope)
        expect({
          status,
          fact: fact(catalog, "presence-empty"),
          issues: catalog.issues
            .filter((issue) => issue.phase === "config.read")
            .map((issue) => ({ phase: issue.phase, type: issue.message.split(":")[0] })),
        }).toEqual({
          status: 200,
          fact: { id: "presence-empty", apiKeyConfigured: undefined },
          issues: [{ phase: "config.read", type: name }],
        })
      }
    })
  }

  test("successful and failed observations of empty configuration have distinct reusable Provider cache identities", async () => {
    const inspect = async (global: boolean) => {
      const read = (available: boolean) =>
        global ? Provider.catalogGlobal({}, available) : Provider.catalog({ config: {}, configAvailable: available })
      const first = await read(true)
      const failed = await read(false)
      const restored = await read(true)
      return {
        first: first.database["presence-empty"]?.apiKeyConfigured,
        failed: failed.database["presence-empty"]?.apiKeyConfigured,
        restored: restored.database["presence-empty"]?.apiKeyConfigured,
        reusedSuccess: first.database === restored.database,
      }
    }
    expect({
      global: await inspect(true),
      project: await Instance.provide({ directory: project.path, fn: () => inspect(false) }),
    }).toEqual({
      global: { first: false, failed: undefined, restored: false, reusedSuccess: true },
      project: { first: false, failed: undefined, restored: false, reusedSuccess: true },
    })
  })

  test("multiple environment candidates retain unknown and existing provider filters retain exact public collections", async () => {
    await Config.writeGlobal({
      ...configuration(["presence-ready", "presence-multi", "presence-filtered", "presence-empty"], {
        "presence-ready": { models: { "presence-model": readyModel() } },
        "presence-multi": { env: [envName, `${envName}_OTHER`] },
        "presence-filtered": { models: { "presence-model": readyModel() }, whitelist: [] },
      }),
      disabled_providers: ["presence-empty"],
    })
    for (const scope of scopes) {
      const { status, catalog } = await readCatalog(scope)
      expect({
        status,
        ids: catalog.all.map((item) => item.id).sort(),
        connected: catalog.connected,
        multiple: fact(catalog, "presence-multi"),
        filtered: fact(catalog, "presence-filtered"),
      }).toEqual({
        status: 200,
        ids: ["presence-filtered", "presence-multi", "presence-ready"],
        connected: ["presence-ready"],
        multiple: { id: "presence-multi", apiKeyConfigured: undefined },
        filtered: { id: "presence-filtered", apiKeyConfigured: false },
      })
    }
  })

  test("an actual built-in loader error preserves unknown and independently configured API evidence", async () => {
    await Auth.set("gitlab", oauth("ftp://owned.invalid"))
    await Config.writeGlobal(configuration(["gitlab"]))
    const failed = await readCatalog("global")
    expect({
      fact: fact(failed.catalog, "gitlab"),
      issues: failed.catalog.issues.filter((issue) => issue.providerID === "gitlab"),
    }).toEqual({
      fact: { id: "gitlab", apiKeyConfigured: undefined },
      issues: [{ phase: "plugin.auth", providerID: "gitlab", message: "GitLab instance URL must use HTTP(S)" }],
    })
    await Config.updateGlobalPatch({ provider: { gitlab: { options: { apiKey: configKey } } } })
    const configured = await readCatalog("global")
    expect({
      fact: fact(configured.catalog, "gitlab"),
      issues: configured.catalog.issues.filter((issue) => issue.providerID === "gitlab"),
    }).toEqual({
      fact: { id: "gitlab", apiKeyConfigured: true },
      issues: [{ phase: "plugin.auth", providerID: "gitlab", message: "GitLab instance URL must use HTTP(S)" }],
    })
  })

  test("an observed environment API key remains configured when a later built-in loader fails", async () => {
    await Auth.set("gitlab", oauth("ftp://owned.invalid"))
    process.env[envName] = "fictional-presence-environment-key"
    await Config.writeGlobal(configuration(["gitlab"], { gitlab: { env: [envName] } }))
    await Instance.provide({ directory: project.path, fn: () => Env.set(envName, process.env[envName]!) })
    await Provider.resetAll()
    for (const scope of scopes) {
      const { status, catalog } = await readCatalog(scope)
      expect({
        status,
        fact: fact(catalog, "gitlab"),
        issues: catalog.issues.filter((issue) => issue.providerID === "gitlab"),
      }).toEqual({
        status: 200,
        fact: { id: "gitlab", apiKeyConfigured: true },
        issues: [{ phase: "plugin.auth", providerID: "gitlab", message: "GitLab instance URL must use HTTP(S)" }],
      })
    }
  })

  test("vendor-owned API options and a real custom-loader failure publish unknown", async () => {
    await Config.writeGlobal(configuration(["amazon-bedrock", "cloudflare-ai-gateway"]))
    const previousBearer = process.env.AWS_BEARER_TOKEN_BEDROCK
    process.env.AWS_BEARER_TOKEN_BEDROCK = "fictional-presence-bedrock-token"
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          Env.set("CLOUDFLARE_ACCOUNT_ID", "presence-account")
          Env.set("CLOUDFLARE_GATEWAY_ID", "presence-gateway")
          Env.remove("CLOUDFLARE_API_TOKEN")
          Env.remove("CF_AIG_TOKEN")
          await Provider.reset()
        },
      })
      const { status, catalog } = await readCatalog("project")
      const vendorKeyMatched = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const configured = await Provider.getConfiguredProvider("amazon-bedrock", {
            config: await Config.get(),
            global: false,
          })
          return configured?.options.apiKey === process.env.AWS_BEARER_TOKEN_BEDROCK
        },
      })
      expect({
        status,
        vendorKeyMatched,
        bedrock: fact(catalog, "amazon-bedrock"),
        gateway: fact(catalog, "cloudflare-ai-gateway"),
        issues: catalog.issues.filter((issue) => issue.providerID === "cloudflare-ai-gateway"),
      }).toEqual({
        status: 200,
        vendorKeyMatched: true,
        bedrock: { id: "amazon-bedrock", apiKeyConfigured: undefined },
        gateway: { id: "cloudflare-ai-gateway", apiKeyConfigured: undefined },
        issues: [
          {
            phase: "provider.loader",
            providerID: "cloudflare-ai-gateway",
            message:
              "CLOUDFLARE_API_TOKEN (or CF_AIG_TOKEN) is required for Cloudflare AI Gateway. Set it via environment variable or run `opencorvus auth cloudflare-ai-gateway`.",
          },
        ],
      })
    } finally {
      if (previousBearer === undefined) delete process.env.AWS_BEARER_TOKEN_BEDROCK
      else process.env.AWS_BEARER_TOKEN_BEDROCK = previousBearer
    }
  })
})
