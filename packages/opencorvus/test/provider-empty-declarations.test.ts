import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { memoryProject } from "./fixture/memory"

type Scope = "global" | "project"
const scopes: Scope[] = ["global", "project"]
const ids = ["empty-owned", "catalog-owned", "reference-owned"]
const api = "http://127.0.0.1:1/empty-declarations/v1"
// This is a public fictional value in the isolated runner, never a real credential.
const savedKey = "fictional-empty-declaration-key"
const authFile = path.join(Global.Path.data, "auth.json")
const globalFile = path.join(Global.Path.config, "opencorvus.jsonc")
let project: Awaited<ReturnType<typeof memoryProject>>
let projectFile: string
let originalConfig: Config.Info
let originalAuth: Buffer | undefined
let originalCatalog: string
let catalog: Record<string, ModelsDev.Provider>

function model(id: string, name = id): ModelsDev.Model {
  return {
    id,
    name,
    release_date: "2026-10-13",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
    cost: { input: 1, output: 2 },
    limit: { context: 8192, output: 512 },
    options: {},
  }
}

async function resetReaders() {
  Config.global.reset()
  await Config.state.resetAll()
  ModelsDev.Data.reset()
  await Provider.resetAll()
}

async function replaceAuth(contents?: Buffer) {
  await rm(authFile, { force: true })
  if (contents !== undefined) await writeFile(authFile, contents, { mode: 0o600 })
}

beforeAll(async () => {
  originalConfig = await Config.getGlobal()
  originalAuth = await readFile(authFile).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  originalCatalog = await readFile(ModelsDev.catalogPath(), "utf8")
  catalog = JSON.parse(originalCatalog)
  for (const id of ids) catalog[id] = { id, name: id, env: [], npm: "@ai-sdk/openai-compatible", api, models: {} }
  catalog["catalog-owned"]!.models = {
    "shared-model": model("shared-model", "Catalog shared"),
    "catalog-model": model("catalog-model", "Catalog second"),
  }
  project = await memoryProject("provider-empty-declarations")
  projectFile = path.join(project.path, ".opencorvus", "opencorvus.jsonc")
  await mkdir(path.dirname(projectFile), { recursive: true })
})

beforeEach(async () => {
  await Instance.disposeAll()
  await replaceAuth()
  await writeFile(ModelsDev.catalogPath(), JSON.stringify(catalog))
  await writeFile(projectFile, "{}")
  await resetReaders()
  await Config.writeGlobal({ enabled_providers: ids })
})

afterEach(async () => {
  // Restore independent authorities before the global writer validates the still-live project.
  const restored = await Promise.allSettled([
    replaceAuth(originalAuth),
    writeFile(ModelsDev.catalogPath(), originalCatalog),
    writeFile(projectFile, "{}"),
    writeFile(globalFile, JSON.stringify(originalConfig)),
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
  }
  if (failures.length) throw new AggregateError(failures, "Empty declaration fixture restoration failed")
})

afterAll(async () => {
  await project[Symbol.asyncDispose]()
})

async function configRequest(scope: Scope, patch?: Record<string, unknown>) {
  const response = await Server.App().request(scope === "global" ? "/global/config" : "/config", {
    method: patch === undefined ? "GET" : "PATCH",
    headers: {
      ...(scope === "project" ? { "x-opencorvus-directory": project.path } : {}),
      ...(patch === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(patch === undefined ? {} : { body: JSON.stringify(patch) }),
  })
  return { status: response.status, body: await response.json() }
}

async function projection(scope: Scope, id: string) {
  const response = await Server.App().request(scope === "global" ? "/global/providers" : "/provider", {
    headers: scope === "project" ? { "x-opencorvus-directory": project.path } : {},
  })
  const body = await response.json()
  const data = scope === "global" ? body.catalog : body
  const provider = data.all.find((entry: Provider.Info) => entry.id === id)
  return {
    status: response.status,
    id: provider?.id,
    name: provider?.name,
    modelIDs: Object.keys(provider?.models ?? {}).sort(),
    apiKeyConfigured: provider?.apiKeyConfigured,
    connected: data.connected,
  }
}

async function selectedModel(scope: Scope, providerID: string, modelID: string) {
  const read = async () => {
    const config = scope === "global" ? await Config.getGlobal() : await Config.get()
    const actual =
      scope === "global"
        ? await Provider.getModelGlobal(providerID, modelID, config)
        : await Provider.getModel(providerID, modelID, { config })
    return { id: actual.id, name: actual.name, inputCost: actual.cost.input }
  }
  return scope === "global" ? read() : Instance.provideProjectIdentity({ directory: project.path, fn: read })
}

describe.serial("Provider empty declaration contracts", () => {
  test("merging an overlay into a missing prompt object applies its nested deletion", () => {
    const base = Config.Info.parse({ prompt_profile: { active: "base" } })
    const patch = Config.Overlay.parse({ prompt: { owned: null } })
    expect(Config.mergeOverlay(base, patch)).toEqual({ ...base, prompt: {} })
  })

  for (const [label, current] of [
    ["empty", {}],
    ["explicit override", { prompt: { owned: "overridden" } }],
  ] as const) {
    test(`previewing deletion from an ${label} overlay preserves inherited prompt values`, () => {
      const prompt = { owned: "inherited", keep: "kept" }
      const base = Config.Info.parse({ prompt_profile: { active: "base" }, prompt })
      const result = Config.previewOverlayUpdate(
        base,
        Config.Overlay.parse(current),
        Config.Overlay.parse({ prompt: { owned: null } }),
      )
      expect(result).toEqual({ nextOverlay: { prompt: {} }, effective: { ...base, prompt } })
      expect(base.prompt).toEqual({ owned: "inherited", keep: "kept" })
    })
  }

  for (const [label, options] of [
    ["missing", { timeout: false }],
    ["scalar", { timeout: false, metadata: "public-scalar" }],
  ] as const) {
    test(`merging a nested object patch into ${label} metadata applies null and empty-object values`, () => {
      const base = Config.Info.parse({ prompt_profile: { active: "base" }, provider: { "merge-owned": { options } } })
      const merged = Config.mergePatch(base, {
        provider: { "merge-owned": { options: { metadata: { removed: null, empty: {} } } } },
      })
      expect(merged).toEqual({
        ...base,
        provider: { "merge-owned": { options: { timeout: false, metadata: { empty: {} } } } },
      })
      expect(base.provider?.["merge-owned"]?.options).toEqual(options)
    })
  }

  for (const scope of scopes) {
    for (const [label, initialMetadata, patchMetadata, expectedMetadata] of [
      ["scalar to empty object", { metadata: "public-scalar" }, {}, {}],
      ["missing object with nested deletion", {}, { removed: null }, {}],
      [
        "existing object with an empty patch",
        { metadata: { keep: "kept", nested: { leaf: "held" } } },
        {},
        { keep: "kept", nested: { leaf: "held" } },
      ],
    ] as const) {
      test(`${scope} JSONC writer preserves the complete source for ${label}`, async () => {
        const definition = {
          name: "Metadata owner",
          api,
          env: [],
          models: {},
          options: { timeout: false, headers: { "x-owned": "kept" }, ...initialMetadata },
        }
        expect((await configRequest(scope, { provider: { "empty-owned": definition } })).status).toBe(200)
        const filename = scope === "global" ? globalFile : projectFile
        const before = JSON.parse(await readFile(filename, "utf8"))
        const saved = await configRequest(scope, {
          provider: { "empty-owned": { options: { metadata: patchMetadata } } },
        })
        const expectedDefinition = {
          ...definition,
          options: { timeout: false, headers: { "x-owned": "kept" }, metadata: expectedMetadata },
        }
        expect({ status: saved.status, provider: saved.body.provider?.["empty-owned"] }).toEqual({
          status: 200,
          provider: expectedDefinition,
        })
        expect(JSON.parse(await readFile(filename, "utf8"))).toEqual({
          ...before,
          provider: { ...before.provider, "empty-owned": expectedDefinition },
        })
        const read = await configRequest(scope)
        expect({ status: read.status, provider: read.body.provider?.["empty-owned"] }).toEqual({
          status: 200,
          provider: expectedDefinition,
        })
      })
    }

    test(`${scope} public save persists an explicit models-only empty object`, async () => {
      const definition = { name: "Models-only", models: {} }
      const saved = await configRequest(scope, { provider: { "empty-owned": definition } })
      const persisted = JSON.parse(await readFile(scope === "global" ? globalFile : projectFile, "utf8"))
      expect({
        status: saved.status,
        provider: saved.body.provider?.["empty-owned"],
        persisted: persisted.provider["empty-owned"],
      }).toEqual({
        status: 200,
        provider: definition,
        persisted: definition,
      })
      const read = await configRequest(scope)
      expect({ status: read.status, provider: read.body.provider?.["empty-owned"] }).toEqual({
        status: 200,
        provider: definition,
      })
    })

    test(`${scope} public save accepts absent and empty model declarations`, async () => {
      for (const fields of [{}, { models: {} }]) {
        const definition = { name: "Bootstrap", api, env: [], options: { timeout: false }, ...fields }
        const saved = await configRequest(scope, { provider: { "empty-owned": definition } })
        expect({ status: saved.status, provider: saved.body.provider?.["empty-owned"] }).toEqual({
          status: 200,
          provider: definition,
        })
        const read = await configRequest(scope)
        const persisted = JSON.parse(await readFile(scope === "global" ? globalFile : projectFile, "utf8"))
        expect({
          status: read.status,
          provider: read.body.provider?.["empty-owned"],
          persisted: persisted.provider["empty-owned"],
        }).toEqual({
          status: 200,
          provider: definition,
          persisted: definition,
        })
        expect(await projection(scope, "empty-owned")).toEqual({
          status: 200,
          id: "empty-owned",
          name: "Bootstrap",
          modelIDs: [],
          apiKeyConfigured: false,
          connected: [],
        })
      }
    })

    test(`${scope} catalog models remain runnable through an empty declaration and cleared override`, async () => {
      expect(
        (await configRequest(scope, { provider: { "catalog-owned": { name: "Inherited", api, models: {} } } })).status,
      ).toBe(200)
      expect(await projection(scope, "catalog-owned")).toEqual({
        status: 200,
        id: "catalog-owned",
        name: "Inherited",
        modelIDs: ["catalog-model", "shared-model"],
        apiKeyConfigured: false,
        connected: ["catalog-owned"],
      })
      expect(
        (
          await configRequest(scope, {
            provider: {
              "catalog-owned": { models: { "shared-model": { name: "Override", cost: { input: 3, output: 4 } } } },
            },
          })
        ).status,
      ).toBe(200)
      expect(await selectedModel(scope, "catalog-owned", "shared-model")).toEqual({
        id: "shared-model",
        name: "Override",
        inputCost: 3,
      })
      const cleared = await configRequest(scope, {
        provider: { "catalog-owned": { models: { "shared-model": null } } },
      })
      expect({ status: cleared.status, models: cleared.body.provider?.["catalog-owned"]?.models }).toEqual({
        status: 200,
        models: {},
      })
      expect(await selectedModel(scope, "catalog-owned", "shared-model")).toEqual({
        id: "shared-model",
        name: "Catalog shared",
        inputCost: 1,
      })
    })

    test(`${scope} clearing the final unreferenced declaration retains the saved Auth fact`, async () => {
      expect(
        (
          await configRequest(scope, {
            provider: { "empty-owned": { api, models: { "only-model": model("only-model") } } },
          })
        ).status,
      ).toBe(200)
      const authResponse = await Server.App().request("/auth/empty-owned", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "api", key: savedKey }),
      })
      expect({ status: authResponse.status, body: await authResponse.json() }).toEqual({
        status: 200,
        body: { ok: true, issues: [] },
      })
      expect(await selectedModel(scope, "empty-owned", "only-model")).toEqual({
        id: "only-model",
        name: "only-model",
        inputCost: 1,
      })
      const cleared = await configRequest(scope, { provider: { "empty-owned": { models: { "only-model": null } } } })
      const auth = await Auth.get("empty-owned")
      expect({
        status: cleared.status,
        provider: cleared.body.provider?.["empty-owned"],
        keyMatched: auth?.type === "api" && auth.key === savedKey,
      }).toEqual({
        status: 200,
        provider: { api, models: {} },
        keyMatched: true,
      })
      expect(await projection(scope, "empty-owned")).toEqual({
        status: 200,
        id: "empty-owned",
        name: "empty-owned",
        modelIDs: [],
        apiKeyConfigured: true,
        connected: [],
      })
    })

    for (const reference of ["model", "agent"] as const) {
      test(`${scope} clearing a ${reference} referenced model returns the canonical 400`, async () => {
        const referenceFields =
          reference === "model"
            ? { model: "reference-owned/only-model" }
            : { agent: { chat: { model: "reference-owned/only-model" } } }
        expect(
          (
            await configRequest(scope, {
              ...referenceFields,
              provider: { "reference-owned": { api, models: { "only-model": model("only-model") } } },
            })
          ).status,
        ).toBe(200)
        const rejected = await configRequest(scope, {
          provider: { "reference-owned": { models: { "only-model": null } } },
        })
        expect(rejected).toEqual({
          status: 400,
          body: {
            name: "ProviderModelNotFoundError",
            data: { providerID: "reference-owned", modelID: "only-model", suggestions: [] },
          },
        })
        expect(await selectedModel(scope, "reference-owned", "only-model")).toEqual({
          id: "only-model",
          name: "only-model",
          inputCost: 1,
        })
        const current = await configRequest(scope)
        expect({
          status: current.status,
          reference: reference === "model" ? current.body.model : current.body.agent?.chat?.model,
          ids: Object.keys(current.body.provider?.["reference-owned"]?.models ?? {}),
        }).toEqual({ status: 200, reference: "reference-owned/only-model", ids: ["only-model"] })
      })
    }
  }

  test("clearing a project model override restores the global declaration", async () => {
    expect(
      (
        await configRequest("global", {
          provider: { "empty-owned": { api, models: { "only-model": model("only-model", "Global") } } },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await configRequest("project", {
          provider: { "empty-owned": { models: { "only-model": { name: "Project" } } } },
        })
      ).status,
    ).toBe(200)
    expect(await selectedModel("project", "empty-owned", "only-model")).toEqual({
      id: "only-model",
      name: "Project",
      inputCost: 1,
    })
    const cleared = await configRequest("project", { provider: { "empty-owned": { models: { "only-model": null } } } })
    const source = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.getProject() })
    expect({ status: cleared.status, projectModels: source.provider?.["empty-owned"]?.models }).toEqual({
      status: 200,
      projectModels: {},
    })
    expect({
      global: await selectedModel("global", "empty-owned", "only-model"),
      project: await selectedModel("project", "empty-owned", "only-model"),
    }).toEqual({
      global: { id: "only-model", name: "Global", inputCost: 1 },
      project: { id: "only-model", name: "Global", inputCost: 1 },
    })
  })
})
