import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { createServer } from "node:http"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { ModelsDev } from "@/provider/models"
import { Provider } from "@/provider/provider"
import { ProviderConnectionTestResult } from "@/provider/operations"
import { BAD_REQUEST_SCHEMA } from "@/server/error"
import { Server } from "@/server/server"
import { memoryProject } from "./fixture/memory"

type Scope = "global" | "project"
const scopes: Scope[] = ["global", "project"]
const providerID = "owned-connection"
const zeroID = "owned-zero-models"
const disabledID = "owned-disabled-connection"
const defaultModelID = "gpt-5-owned"
const explicitModelID = "other-owned"
const ownedIDs = [providerID, zeroID, disabledID]
// Fictional input in the isolated runner; no real Provider credential is used.
const savedKey = "fictional-connection-test-key"
const authPath = path.join(Global.Path.data, "auth.json")
const globalPath = path.join(Global.Path.config, "opencorvus.jsonc")
const requests: Array<{ path: string; model: string; streaming: boolean; credentialMatched: boolean }> = []
let participantMode: "stream" | "refuse" | "partial-error" = "stream"
let project: Awaited<ReturnType<typeof memoryProject>>
let projectPath: string
let originalConfig: Config.Info
let originalAuth: Buffer | undefined
let originalCatalog: string
let catalog: Record<string, ModelsDev.Provider>
let participant: ReturnType<typeof createServer>
let endpoint: (scope: string) => string

function model(id: string): ModelsDev.Model {
  return {
    id,
    name: id,
    release_date: "2026-10-14",
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

async function resetReaders() {
  Config.global.reset()
  await Config.state.resetAll()
  ModelsDev.Data.reset()
  await Provider.resetAll()
}

async function replaceAuth(contents: Buffer | string | undefined) {
  if (contents === undefined) await rm(authPath, { force: true })
  else await writeFile(authPath, contents, { mode: 0o600 })
}

beforeAll(async () => {
  originalConfig = await Config.getGlobal()
  originalAuth = await readFile(authPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  originalCatalog = await readFile(ModelsDev.catalogPath(), "utf8")
  project = await memoryProject("provider-connection-test")
  projectPath = path.join(project.path, ".opencorvus", "opencorvus.jsonc")
  await mkdir(path.dirname(projectPath), { recursive: true })

  // A real loopback TCP/SSE participant exercises the production SDK and stream.
  // It qualifies the local protocol contract, never genuine Sol or third-party auth.
  participant = createServer(async (request, response) => {
    try {
      let text = ""
      for await (const chunk of request) text += chunk.toString()
      const body = JSON.parse(text) as { model: string; stream: boolean }
      const credentialMatched = request.headers.authorization === `Bearer ${savedKey}`
      requests.push({ path: request.url ?? "", model: body.model, streaming: body.stream, credentialMatched })
      if (!credentialMatched || participantMode === "refuse") {
        response.writeHead(400, { "content-type": "application/json" })
        response.end(JSON.stringify({ error: { message: "Owned sample refusal" } }))
        return
      }
      const chunk = {
        id: "owned-connection-response",
        object: "chat.completion.chunk",
        created: 1,
        model: body.model,
        choices: [{ index: 0, delta: { content: "OK" }, finish_reason: null }],
      }
      const finish = {
        ...chunk,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      }
      response.writeHead(200, { "content-type": "text/event-stream" })
      if (participantMode === "partial-error") {
        response.end(
          `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify({ error: { message: "Owned stream refusal" } })}\n\ndata: [DONE]\n\n`,
        )
        return
      }
      response.end(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(finish)}\n\ndata: [DONE]\n\n`)
    } catch {
      response.writeHead(400, { "content-type": "application/json" })
      response.end(JSON.stringify({ error: { message: "Owned sample requires a JSON stream request" } }))
    }
  })
  await new Promise<void>((resolve) => participant.listen(0, "127.0.0.1", resolve))
  const address = participant.address()
  if (!address || typeof address === "string") throw new Error("Owned participant requires a bound port")
  endpoint = (scope) => `http://127.0.0.1:${address.port}/${scope}/v1`
  catalog = JSON.parse(originalCatalog)
  for (const id of ownedIDs) {
    catalog[id] = {
      id,
      name: id,
      env: [],
      npm: "@ai-sdk/openai-compatible",
      api: endpoint("catalog"),
      models:
        id === zeroID ? {} : { [explicitModelID]: model(explicitModelID), [defaultModelID]: model(defaultModelID) },
    }
  }
})

beforeEach(async () => {
  await Instance.disposeAll()
  participantMode = "stream"
  requests.length = 0
  await writeFile(ModelsDev.catalogPath(), JSON.stringify(catalog))
  await writeFile(projectPath, "{}")
  await replaceAuth("{}")
  for (const id of ownedIDs) await Auth.set(id, { type: "api", key: savedKey })
  await resetReaders()
  await Config.writeGlobal({
    enabled_providers: ownedIDs,
    disabled_providers: [disabledID],
    provider: Object.fromEntries(
      ownedIDs.map((id) => [id, { api: endpoint("global"), models: {}, options: { baseURL: endpoint("global") } }]),
    ),
  })
  await Instance.provide({
    directory: project.path,
    fn: () =>
      Config.updateProjectPatch({
        provider: { [providerID]: { options: { baseURL: endpoint("project") } } },
      }),
  })
})

afterAll(async () => {
  const restored = await Promise.allSettled([
    replaceAuth(originalAuth),
    writeFile(ModelsDev.catalogPath(), originalCatalog),
    writeFile(projectPath, "{}"),
    writeFile(globalPath, JSON.stringify(originalConfig)),
  ])
  const failures = restored.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  try {
    await resetReaders()
    // Keep the registered Project alive through the final global reconciliation.
    await Config.writeGlobal(originalConfig)
  } catch (error) {
    failures.push(error)
  } finally {
    try {
      await project[Symbol.asyncDispose]()
    } catch (error) {
      failures.push(error)
    } finally {
      await new Promise<void>((resolve, reject) => participant.close((error) => (error ? reject(error) : resolve())))
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "Provider Test fixture restoration failed")
})

async function requestTest(scope: Scope, id: string, body: unknown = {}) {
  const response = await Server.App().request(
    scope === "global" ? `/global/providers/${id}/test` : `/provider/${id}/test`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(scope === "project" ? { "x-opencorvus-directory": project.path } : {}),
      },
      body: JSON.stringify(body),
    },
  )
  return { status: response.status, body: await response.json() }
}

async function catalogFact(scope: Scope, id: string) {
  const response = await Server.App().request(scope === "global" ? "/global/providers" : "/provider", {
    headers: scope === "project" ? { "x-opencorvus-directory": project.path } : {},
  })
  const body = await response.json()
  const catalog = scope === "global" ? body.catalog : body
  const item = catalog.all.find((value: Provider.Info) => value.id === id)
  return {
    status: response.status,
    id: item.id,
    models: Object.keys(item.models).sort(),
    keyConfigured: item.apiKeyConfigured,
  }
}

describe.each(scopes)("%s Provider connection Test", (scope) => {
  test("a saved credential and zero effective models produce the explicit no-models result", async () => {
    expect(await catalogFact(scope, zeroID)).toEqual({ status: 200, id: zeroID, models: [], keyConfigured: true })
    const result = await requestTest(scope, zeroID)
    expect(result).toEqual({
      status: 400,
      body: {
        ok: false,
        status: "error",
        code: "no_models",
        providerID: zeroID,
        modelID: "",
        message: "Provider has no available models.",
        output: "",
      },
    })
    expect(ProviderConnectionTestResult.parse(result.body)).toEqual(result.body)
  })

  for (const id of ["owned-missing-connection", disabledID]) {
    test(`${id} produces the current-configuration unavailable result`, async () => {
      expect(await requestTest(scope, id, { modelID: defaultModelID })).toEqual({
        status: 400,
        body: {
          ok: false,
          status: "error",
          code: "provider_unavailable",
          providerID: id,
          modelID: defaultModelID,
          message: "Provider is unavailable in the current configuration.",
          output: "",
        },
      })
    })
  }

  test("an explicit unavailable model preserves its requested identity and model error", async () => {
    expect(await requestTest(scope, providerID, { modelID: "zzzzzz" })).toEqual({
      status: 200,
      body: {
        ok: false,
        status: "error",
        code: "request_failed",
        providerID,
        modelID: "zzzzzz",
        message: `ProviderModelNotFoundError: {"providerID":"${providerID}","modelID":"zzzzzz","suggestions":[]}`,
        output: "",
      },
    })
  })

  for (const explicit of [false, true]) {
    test(`${explicit ? "explicit" : "default"} effective model streams through the real local participant`, async () => {
      expect(await catalogFact(scope, providerID)).toEqual({
        status: 200,
        id: providerID,
        models: [defaultModelID, explicitModelID],
        keyConfigured: true,
      })
      const selected = explicit ? explicitModelID : defaultModelID
      const result = await requestTest(scope, providerID, explicit ? { modelID: selected } : {})
      expect(result).toEqual({
        status: 200,
        body: {
          ok: true,
          status: "connected",
          code: "connected",
          providerID,
          modelID: selected,
          message: "Provider is reachable.",
          output: "OK",
        },
      })
      expect(ProviderConnectionTestResult.parse(result.body)).toEqual(result.body)
      expect(requests).toEqual([
        { path: `/${scope}/v1/chat/completions`, model: selected, streaming: true, credentialMatched: true },
      ])
    })
  }

  test("an actual upstream refusal retains the request identity and explicit request-failed result", async () => {
    participantMode = "refuse"
    expect(await requestTest(scope, providerID, { modelID: explicitModelID })).toEqual({
      status: 200,
      body: {
        ok: false,
        status: "error",
        code: "request_failed",
        providerID,
        modelID: explicitModelID,
        message: `Provider ${providerID} returned HTTP 400: Owned sample refusal`,
        output: "",
      },
    })
    expect(requests).toEqual([
      { path: `/${scope}/v1/chat/completions`, model: explicitModelID, streaming: true, credentialMatched: true },
    ])
  })

  test("text received before a stream error remains in the failed result", async () => {
    participantMode = "partial-error"
    expect(await requestTest(scope, providerID, { modelID: explicitModelID })).toEqual({
      status: 200,
      body: {
        ok: false,
        status: "error",
        code: "request_failed",
        providerID,
        modelID: explicitModelID,
        message: "Owned stream refusal",
        output: "OK",
      },
    })
    expect(requests).toEqual([
      { path: `/${scope}/v1/chat/completions`, model: explicitModelID, streaming: true, credentialMatched: true },
    ])
  })

  test("an invalid modelID type retains the public validator BadRequest result", async () => {
    const result = await requestTest(scope, providerID, { modelID: 42 })
    expect(result).toEqual({
      status: 400,
      body: {
        data: { message: "Request validation failed" },
        error: [
          { code: "invalid_type", path: ["modelID"], message: "Invalid input: expected string, received number" },
        ],
        success: false,
      },
    })
    expect(BAD_REQUEST_SCHEMA.parse(result.body)).toEqual(result.body)
  })

  test("malformed saved Auth retains the actual typed read failure", async () => {
    const before = await readFile(authPath)
    try {
      await replaceAuth("{")
      await resetReaders()
      expect(await requestTest(scope, providerID, { modelID: defaultModelID })).toEqual({
        status: 503,
        body: {
          name: "AuthReadError",
          data: {
            operation: "read_saved_credentials",
            reason: "malformed_json",
            message: "Saved Provider credentials contain malformed JSON",
          },
        },
      })
    } finally {
      await replaceAuth(before)
      await resetReaders()
    }
  })
})
