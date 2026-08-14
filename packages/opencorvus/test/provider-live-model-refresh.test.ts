import { afterEach, describe, expect, test } from "bun:test"
import { createServer } from "node:http"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

async function listenModels(input: { identities: unknown; info: unknown }) {
  const requests: Array<{ url: string; authorization?: string }> = []
  const server = createServer((request, response) => {
    requests.push({ url: request.url ?? "", authorization: request.headers.authorization })
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify(request.url === "/v1/model/info" ? input.info : input.identities))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Fixture server did not bind an IP port")
  return {
    endpoint: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

async function resetProviderReaders() {
  await Provider.resetAll()
  ModelsDev.Data.reset()
}

async function catalogBytes() {
  return readFile(ModelsDev.catalogPath(), "utf8")
}

function liveInfo(id: string, name: string) {
  return {
    id,
    name,
    release_date: "2026-08-13",
    attachment: true,
    reasoning: true,
    temperature: false,
    tool_call: true,
    limit: { context: 400_000, input: 272_000, output: 128_000 },
    modalities: { input: ["text", "image"], output: ["text"] },
    options: {},
  }
}

async function bindCatalogEndpoint(endpoint: string) {
  const catalog = JSON.parse(await catalogBytes()) as Record<string, { api?: string }>
  catalog.opencorvus!.api = endpoint
  await writeFile(ModelsDev.catalogPath(), JSON.stringify(catalog, null, 2), { mode: 0o600 })
  await resetProviderReaders()
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetProviderReaders()
})

describe.serial("Provider live model refresh authority", () => {
  test("the default catalog migration adds the bundled OpenCorvus declaration and explicit overrides stay strict", async () => {
    const current = await ModelsDev.get()
    const { opencorvus: _opencorvus, ...legacy } = current
    const migrated = ModelsDev.migrateDefaultCatalog(legacy)
    expect({ preserved: migrated.kilo, product: migrated.opencorvus }).toEqual({
      preserved: current.kilo,
      product: expect.objectContaining({ id: "opencorvus", api: "https://opencorvus.ai/zen/v1" }),
    })

    expect(() => ModelsDev.validateExplicitCatalog(legacy)).toThrow("missing required provider opencorvus")

    const migrationRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cs021-migration-"))
    const migrationPath = path.join(migrationRoot, "models.json")
    try {
      await writeFile(migrationPath, JSON.stringify(legacy), { mode: 0o600 })
      expect(await ModelsDev.migrateDefaultCatalogFile(migrationPath)).toBe(true)
      const published = ModelsDev.validateExplicitCatalog(JSON.parse(await readFile(migrationPath, "utf8")))
      expect({ product: published.opencorvus, preserved: published.kilo }).toEqual({
        product: expect.objectContaining({ id: "opencorvus", api: "https://opencorvus.ai/zen/v1" }),
        preserved: current.kilo,
      })
      expect(await ModelsDev.migrateDefaultCatalogFile(migrationPath)).toBe(false)
    } finally {
      await rm(migrationRoot, { recursive: true, force: true })
    }
  })

  test("both public routes publish exact live identities through one durable catalog writer", async () => {
    const beforeGlobal = await Config.getGlobal()
    const beforeAuth = await Auth.get("opencorvus")
    const beforeCatalog = await catalogBytes()
    await using project = await memoryProject()
    const projectFixture = await listenModels({
      identities: { data: [{ id: "project-live" }, { id: "gpt-5" }] },
      info: { data: [liveInfo("gpt-5", "GPT-5"), liveInfo("project-live", "Project Live")] },
    })
    const globalFixture = await listenModels({
      identities: { data: [{ id: "global-live" }] },
      info: { data: [liveInfo("global-live", "Global Live")] },
    })
    try {
      await Auth.set("opencorvus", { type: "api", key: "route-secret" })
      await Config.writeGlobal({ ...beforeGlobal, provider: { ...beforeGlobal.provider, opencorvus: { api: globalFixture.endpoint } } })
      await Instance.provide({ directory: project.path, fn: () => Config.updateProjectPatch({ provider: { opencorvus: { api: projectFixture.endpoint } } }) })
      await resetProviderReaders()

      const projectResponse = await Server.App().request("/provider/models/refresh", {
        method: "POST",
        headers: { "x-opencorvus-directory": project.path },
      })
      const projectBody = (await projectResponse.json()) as Record<string, unknown>
      expect({ status: projectResponse.status, ok: projectBody.ok, providers: projectBody.providers }).toEqual({
        status: 200,
        ok: true,
        providers: [{ providerID: "opencorvus", count: 2, ids: ["gpt-5", "project-live"] }],
      })
      expect(projectFixture.requests).toEqual([
        { url: "/v1/models", authorization: "Bearer route-secret" },
        { url: "/v1/model/info", authorization: "Bearer route-secret" },
      ])

      const firstCatalog = await ModelsDev.get()
      expect({
        ids: Object.keys(firstCatalog.opencorvus!.models),
        knownName: firstCatalog.opencorvus!.models["gpt-5"]?.name,
        live: firstCatalog.opencorvus!.models["project-live"],
      }).toEqual({
        ids: ["gpt-5", "project-live"],
        knownName: "GPT-5",
        live: expect.objectContaining({ id: "project-live", name: "Project Live", limit: { context: 400000, input: 272000, output: 128000 } }),
      })

      const projectProjectionAfterProjectRefresh = await Server.App().request("/provider", {
        headers: { "x-opencorvus-directory": project.path },
      })
      const projectCatalogAfterProjectRefresh = (await projectProjectionAfterProjectRefresh.json()) as {
        all: Array<{ id: string; models: Record<string, unknown> }>
      }
      expect({
        status: projectProjectionAfterProjectRefresh.status,
        ids: Object.keys(projectCatalogAfterProjectRefresh.all.find((item) => item.id === "opencorvus")?.models ?? {}),
      }).toEqual({ status: 200, ids: ["gpt-5", "project-live"] })

      const globalResponse = await Server.App().request("/global/providers/models/refresh", { method: "POST" })
      const globalBody = (await globalResponse.json()) as Record<string, unknown>
      expect({ status: globalResponse.status, ok: globalBody.ok, providers: globalBody.providers }).toEqual({
        status: 200,
        ok: true,
        providers: [{ providerID: "opencorvus", count: 1, ids: ["global-live"] }],
      })
      expect(globalFixture.requests).toEqual([
        { url: "/v1/models", authorization: "Bearer route-secret" },
        { url: "/v1/model/info", authorization: "Bearer route-secret" },
      ])
      const [projectProjection, globalProjection] = await Promise.all([
        Server.App().request("/provider", { headers: { "x-opencorvus-directory": project.path } }),
        Server.App().request("/global/providers"),
      ])
      const projectCatalog = (await projectProjection.json()) as { all: Array<{ id: string; models: Record<string, unknown> }> }
      const globalCatalog = (await globalProjection.json()) as { catalog: { all: Array<{ id: string; models: Record<string, unknown> }> } }
      expect({
        projectStatus: projectProjection.status,
        projectIDs: Object.keys(projectCatalog.all.find((item) => item.id === "opencorvus")?.models ?? {}),
        globalStatus: globalProjection.status,
        globalIDs: Object.keys(globalCatalog.catalog.all.find((item) => item.id === "opencorvus")?.models ?? {}),
      }).toEqual({ projectStatus: 200, projectIDs: ["global-live"], globalStatus: 200, globalIDs: ["global-live"] })
    } finally {
      await Config.writeGlobal(beforeGlobal)
      await writeFile(ModelsDev.catalogPath(), beforeCatalog, { mode: 0o600 })
      if (beforeAuth) await Auth.set("opencorvus", beforeAuth)
      else await Auth.remove("opencorvus")
      await projectFixture.close()
      await globalFixture.close()
      await resetProviderReaders()
    }
  })

  test("duplicate live identities return an explicit failure and preserve the canonical catalog", async () => {
    const beforeAuth = await Auth.get("opencorvus")
    const beforeCatalog = await catalogBytes()
    const fixture = await listenModels({ identities: { data: [{ id: "duplicate" }, { id: "duplicate" }] }, info: { data: [] } })
    try {
      await Auth.set("opencorvus", { type: "api", key: "duplicate-secret" })
      await bindCatalogEndpoint(fixture.endpoint)
      await resetProviderReaders()
      const publishedBefore = await catalogBytes()

      const body = await Provider.refreshModels({ provider: { opencorvus: { api: fixture.endpoint } } })
      expect({ body, catalog: await catalogBytes() }).toEqual({
        body: { ok: false, error: `GET ${fixture.endpoint}/models returned duplicate model ids` },
        catalog: publishedBefore,
      })
    } finally {
      await writeFile(ModelsDev.catalogPath(), beforeCatalog, { mode: 0o600 })
      if (beforeAuth) await Auth.set("opencorvus", beforeAuth)
      else await Auth.remove("opencorvus")
      await fixture.close()
      await resetProviderReaders()
    }
  })

  test("live metadata rejects extensions instead of publishing inferred catalog fields", async () => {
    const beforeAuth = await Auth.get("opencorvus")
    const beforeCatalog = await catalogBytes()
    const fixture = await listenModels({
      identities: { data: [{ id: "strict-live" }] },
      info: { data: [{ ...liveInfo("strict-live", "Strict Live"), undocumented_capability: true }] },
    })
    try {
      await Auth.set("opencorvus", { type: "api", key: "strict-secret" })
      await bindCatalogEndpoint(fixture.endpoint)
      const publishedBefore = await catalogBytes()

      const body = await Provider.refreshModels({ provider: { opencorvus: { api: fixture.endpoint } } })
      expect({ ok: body.ok, error: body.error, catalog: await catalogBytes() }).toEqual({
        ok: false,
        error: expect.stringContaining("Unrecognized key"),
        catalog: publishedBefore,
      })
    } finally {
      await writeFile(ModelsDev.catalogPath(), beforeCatalog, { mode: 0o600 })
      if (beforeAuth) await Auth.set("opencorvus", beforeAuth)
      else await Auth.remove("opencorvus")
      await fixture.close()
      await resetProviderReaders()
    }
  })

  test("malformed saved Auth is the public typed 503 and strict live metadata never commits", async () => {
    const beforeCatalog = await catalogBytes()
    const authPath = path.join(Global.Path.data, "auth.json")
    const beforeAuthFile = await readFile(authPath, "utf8").catch(() => undefined)
    await using project = await memoryProject()
    try {
      await writeFile(authPath, '{"opencorvus":', { mode: 0o600 })
      await resetProviderReaders()
      expect(await readFile(authPath, "utf8")).toBe('{"opencorvus":')
      expect(Auth.findReadError(await Auth.all().catch((error) => error))?.data.reason).toBe("malformed_json")
      const [globalResponse, projectResponse] = await Promise.all([
        Server.App().request("/global/providers/models/refresh", { method: "POST" }),
        Server.App().request("/provider/models/refresh", {
          method: "POST",
          headers: { "x-opencorvus-directory": project.path },
        }),
      ])
      const errorBody = {
        name: "AuthReadError",
        data: {
          operation: "read_saved_credentials",
          reason: "malformed_json",
          message: "Saved Provider credentials contain malformed JSON",
        },
      }
      expect({
        global: { status: globalResponse.status, body: await globalResponse.json() },
        project: { status: projectResponse.status, body: await projectResponse.json() },
        catalog: await catalogBytes(),
      }).toEqual({
        global: { status: 503, body: errorBody },
        project: { status: 503, body: errorBody },
        catalog: beforeCatalog,
      })
    } finally {
      if (beforeAuthFile === undefined) await rm(authPath, { force: true })
      else await writeFile(authPath, beforeAuthFile, { mode: 0o600 })
      await resetProviderReaders()
    }
  })
})
