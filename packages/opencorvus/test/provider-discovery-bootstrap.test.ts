import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createServer } from "node:http"
import { randomUUID } from "node:crypto"
import { readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { memoryProject } from "./fixture/memory"

let project: Awaited<ReturnType<typeof memoryProject>>
beforeAll(async () => {
  project = await memoryProject()
})
afterAll(async () => {
  await project[Symbol.asyncDispose]()
})

function model(id: string) {
  return {
    id,
    name: id,
    release_date: "2026-10-13",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
    cost: { input: 1, output: 2 },
    limit: { context: 10000, output: 1000 },
    options: {},
  }
}

async function qualify(
  run: (scope: {
    endpoint: (name: string) => string
    project: string
    savedKey: string
    configuredKey: string
    requests: Array<{ path: string; matched: boolean }>
    catalog: Record<string, ModelsDev.Provider>
  }) => Promise<void>,
) {
  const beforeConfig = await Config.getGlobal()
  const authPath = path.join(Global.Path.data, "auth.json")
  const beforeAuth = await readFile(authPath).catch(() => undefined)
  const beforeCatalog = await readFile(ModelsDev.catalogPath(), "utf8")
  const savedKey = randomUUID()
  const configuredKey = randomUUID()
  const requests: Array<{ path: string; matched: boolean }> = []
  const server = createServer((request, response) => {
    const pathname = request.url ?? ""
    const prefix = pathname.split("/")[1]!
    const matched = request.headers.authorization === `Bearer ${prefix === "configured" ? configuredKey : savedKey}`
    requests.push({ path: pathname, matched })
    response.setHeader("Content-Type", "application/json")
    if (!matched) {
      response.writeHead(401)
      response.end(JSON.stringify({ error: "Owned sample credential required" }))
      return
    }
    const ids =
      prefix === "project" ? ["project-model"] : prefix === "known" ? ["known-model"] : [`${prefix}-a`, `${prefix}-b`]
    response.end(
      JSON.stringify({ data: pathname.endsWith("/model/info") ? ids.map(model) : ids.map((id) => ({ id })) }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Owned participant requires a bound port")
  const endpoint = (name: string) => `http://127.0.0.1:${address.port}/${name}/v1`
  try {
    const catalog = JSON.parse(beforeCatalog) as Record<string, ModelsDev.Provider>
    for (const id of ["opencorvus", "catalog-zero"]) {
      catalog[id] = { id, name: id, env: [], npm: "@ai-sdk/openai-compatible", api: endpoint(id), models: {} }
    }
    await writeFile(ModelsDev.catalogPath(), JSON.stringify(catalog))
    ModelsDev.Data.reset()
    for (const id of ["owned-read", "owned-ready", "opencorvus", "catalog-zero"])
      await Auth.set(id, { type: "api", key: savedKey })
    await Config.writeGlobal({
      enabled_providers: ["owned-read", "owned-ready", "catalog-zero"],
      provider: {
        "owned-read": { name: "Bootstrap", api: endpoint("global"), models: {} },
        "owned-ready": { name: "Known", api: endpoint("known"), models: { "known-model": model("known-model") } },
      },
    })
    await InstanceSetup(project.path, endpoint("project"))
    await Provider.resetAll()
    await run({ endpoint, project: project.path, savedKey, configuredKey, requests, catalog })
  } finally {
    try {
      const restored = await Promise.allSettled([
        writeFile(ModelsDev.catalogPath(), beforeCatalog),
        beforeAuth ? writeFile(authPath, beforeAuth) : rm(authPath, { force: true }),
      ])
      const failures = restored.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
      if (failures.length > 0) throw new AggregateError(failures, "Provider discovery fixture restoration failed")
      ModelsDev.Data.reset()
      await Provider.resetAll()
      await Config.writeGlobal(beforeConfig)
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
  }
}

async function InstanceSetup(directory: string, api: string) {
  const { Instance } = await import("@/project/instance")
  await Instance.provide({ directory, fn: () => Config.updateProjectPatch({ provider: { "owned-read": { api } } }) })
}

async function discover(route: string, input: { api: string; providerID: string; apiKey?: string }, project?: string) {
  const response = await Server.App().request(route, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(project ? { "x-opencorvus-directory": project } : {}) },
    body: JSON.stringify(input),
  })
  return { status: response.status, body: await response.json() }
}

const boundAddressError = {
  status: 400,
  body: {
    ok: false,
    models: [],
    count: 0,
    error: "Saved provider credentials can only be used with that provider's configured API URL.",
  },
}

describe.serial("Provider discovery before model availability", () => {
  test("a configured endpoint retains discovery when the independent model catalog is malformed", async () =>
    qualify(async (scope) => {
      await writeFile(ModelsDev.catalogPath(), '{"opencorvus":')
      ModelsDev.Data.reset()
      await Provider.resetAll()
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("global"),
          providerID: "owned-read",
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["global-a", "global-b"], count: 2 } })
      expect(scope.requests).toEqual([{ path: "/global/v1/models", matched: true }])
    }))

  test("both routes use their configured zero-model endpoint with the saved API credential", async () =>
    qualify(async (scope) => {
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("global"),
          providerID: "owned-read",
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["global-a", "global-b"], count: 2 } })
      expect(
        await discover(
          "/provider/discover-models",
          { api: scope.endpoint("project"), providerID: "owned-read" },
          scope.project,
        ),
      ).toEqual({ status: 200, body: { ok: true, models: ["project-model"], count: 1 } })
      expect(scope.requests).toEqual([
        { path: "/global/v1/models", matched: true },
        { path: "/project/v1/models", matched: true },
      ])
    }))

  test("explicit credentials and existing model endpoint discovery retain their positive responses", async () =>
    qualify(async (scope) => {
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("global"),
          providerID: "owned-read",
          apiKey: scope.savedKey,
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["global-a", "global-b"], count: 2 } })
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("known"),
          providerID: "owned-ready",
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["known-model"], count: 1 } })
    }))

  test("catalog-only discovery uses the one current top-level declaration and configured overrides", async () =>
    qualify(async (scope) => {
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("catalog-zero"),
          providerID: "catalog-zero",
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["catalog-zero-a", "catalog-zero-b"], count: 2 } })
      await Config.updateGlobalPatch({ provider: { "catalog-zero": { api: scope.endpoint("override") } } })
      await Provider.resetAll()
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("override"),
          providerID: "catalog-zero",
        }),
      ).toEqual({ status: 200, body: { ok: true, models: ["override-a", "override-b"], count: 2 } })
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("catalog-zero"),
          providerID: "catalog-zero",
        }),
      ).toEqual(boundAddressError)
    }))

  test("configured facts and the public runnable view retain distinct positive contracts", async () =>
    qualify(async () => {
      const config = await Config.getGlobal()
      const configured = await Provider.getConfiguredProvider("owned-read", { config, global: true })
      const list = await Provider.listGlobal(config)
      const catalog = await Provider.catalogGlobal(config)
      const ready = await Provider.getProviderGlobal("owned-ready", config)
      expect({
        name: configured?.name,
        modelIDs: Object.keys(configured?.models ?? {}),
        credentialPresent: typeof configured?.key === "string",
        listed: Object.keys(list),
        catalogReady: Object.keys(catalog.providers),
        selected: ready?.name,
      }).toEqual({
        name: "Bootstrap",
        modelIDs: [],
        credentialPresent: true,
        listed: ["owned-ready"],
        catalogReady: ["owned-ready"],
        selected: "Known",
      })
      const error = await Provider.getModelGlobal("owned-read", "unknown", config).catch((cause) => cause)
      expect({ name: error.name, data: error.data }).toEqual({
        name: "ProviderModelNotFoundError",
        data: { providerID: "owned-read", modelID: "unknown", suggestions: ["owned-ready"] },
      })
      expect(await Provider.getModelGlobal("owned-ready", "known-model", config)).toEqual(
        expect.objectContaining({ id: "known-model", providerID: "owned-ready", name: "known-model" }),
      )
    }))

  test("excluded providers and undeclared addresses return the existing bound-address error", async () =>
    qualify(async (scope) => {
      expect(
        await discover("/global/providers/discover-models", { api: scope.endpoint("other"), providerID: "owned-read" }),
      ).toEqual(boundAddressError)
      await Config.updateGlobalPatch({ disabled_providers: ["owned-read"] })
      await Provider.resetAll()
      expect(
        await discover("/global/providers/discover-models", {
          api: scope.endpoint("global"),
          providerID: "owned-read",
        }),
      ).toEqual(boundAddressError)
    }))

  test("live refresh restores a zero-model catalog with the configured API key selected ahead of saved Auth", async () =>
    qualify(async (scope) => {
      await Config.writeGlobal({
        enabled_providers: ["opencorvus"],
        provider: { opencorvus: { api: scope.endpoint("configured"), options: { apiKey: scope.configuredKey } } },
      })
      await Provider.resetAll()
      const response = await Server.App().request("/global/providers/models/refresh", { method: "POST" })
      const body = (await response.json()) as any
      expect({ status: response.status, ok: body.ok, providers: body.providers }).toEqual({
        status: 200,
        ok: true,
        providers: [{ providerID: "opencorvus", count: 2, ids: ["configured-a", "configured-b"] }],
      })
      expect(scope.requests).toEqual([
        { path: "/configured/v1/models", matched: true },
        { path: "/configured/v1/model/info", matched: true },
      ])
      expect(Object.keys((await ModelsDev.get()).opencorvus!.models)).toEqual(["configured-a", "configured-b"])
    }))

  test("an explicit empty configured API key produces the credential error contract", async () =>
    qualify(async (scope) => {
      await Config.writeGlobal({
        enabled_providers: ["opencorvus"],
        provider: { opencorvus: { api: scope.endpoint("configured"), options: { apiKey: "" } } },
      })
      await Provider.resetAll()
      const response = await Server.App().request("/global/providers/models/refresh", { method: "POST" })
      expect({ status: response.status, body: await response.json() }).toEqual({
        status: 200,
        body: { ok: false, error: "OpenCorvus Provider credentials are not configured" },
      })
    }))

  test("malformed saved Auth remains a typed 503 for generic discovery", async () =>
    qualify(async (scope) => {
      await writeFile(path.join(Global.Path.data, "auth.json"), '{"owned-read":')
      const input = { api: scope.endpoint("global"), providerID: "owned-read" }
      const body = {
        name: "AuthReadError",
        data: {
          operation: "read_saved_credentials",
          reason: "malformed_json",
          message: "Saved Provider credentials contain malformed JSON",
        },
      }
      expect(await discover("/global/providers/discover-models", input)).toEqual({ status: 503, body })
      expect(await discover("/provider/discover-models", input, scope.project)).toEqual({ status: 503, body })
    }))
})
