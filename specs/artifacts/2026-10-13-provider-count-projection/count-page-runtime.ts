import fs from "node:fs"
import path from "node:path"
const root = path.resolve(process.argv[2]!)
const uiDirectory = process.argv[3]!
const edgeScope = path.basename(root) === "edges"
const started = Date.now()
const { installProcessShims } = await import("../packages/opencorvus/src/runtime/shims")
installProcessShims()
const { Log } = await import("../packages/opencorvus/src/util/log")
await Log.init({ print: false })
const requests: unknown[] = []
const modelIDs = { "count-zero": [], "count-one": ["owned-single"], "count-two": ["owned-dual-a", "owned-dual-b"] }
const participant = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const url = new URL(request.url)
  const providerID = url.pathname.split("/")[1]!
  if (request.method === "GET") {
    const ids = modelIDs[providerID as keyof typeof modelIDs] ?? []
    requests.push({ method: "GET", path: url.pathname, modelIDs: ids })
    fs.writeFileSync(path.join(root, "participant-requests.json"), JSON.stringify(requests, null, 2))
    return Response.json({ object: "list", data: ids.map((id) => ({ id, object: "model" })) })
  }
  const body = await request.json() as any
  requests.push({ method: "POST", path: url.pathname, model: body.model, stream: body.stream, stream_options: body.stream_options })
  fs.writeFileSync(path.join(root, "participant-requests.json"), JSON.stringify(requests, null, 2))
  const base = { id: "owned-count-usage", object: "chat.completion.chunk", created: 1, model: body.model }
  const text = { ...base, choices: [{ index: 0, delta: { content: "Owned declared usage" }, finish_reason: null }] }
  const end = { ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 } }
  return new Response(`data: ${JSON.stringify(text)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } })
} })
const model = (id: string, name = id) => ({ id, name, release_date: "2026-10-13", attachment: false, reasoning: false, temperature: true, tool_call: true, modalities: { input: ["text"], output: ["text"] }, cost: { input: 1, output: 2 }, limit: { context: 10000, output: 1000 }, options: {} })
const catalog = {
  opencorvus: { id: "opencorvus", name: "OpenCorvus", env: [], npm: "@ai-sdk/openai-compatible", api: new URL("empty/v1", participant.url).href, models: {} },
  kilo: { id: "kilo", name: "Kilo Gateway", env: [], npm: "@ai-sdk/openai-compatible", api: new URL("empty/v1", participant.url).href, models: {} },
  "catalog-one": { id: "catalog-one", name: "Catalog one", env: [], npm: "@ai-sdk/openai-compatible", api: new URL("catalog-one/v1", participant.url).href, models: { "catalog-single": model("catalog-single") } },
  "catalog-two": { id: "catalog-two", name: "Catalog two", env: [], npm: "@ai-sdk/openai-compatible", api: new URL("catalog-two/v1", participant.url).href, models: { "catalog-dual-a": model("catalog-dual-a"), "catalog-dual-b": model("catalog-dual-b") } },
}
fs.mkdirSync(path.join(root, "runtime", "data"), { recursive: true })
fs.writeFileSync(path.join(root, "runtime", "data", "models.json"), JSON.stringify(catalog, null, 2))
const { ModelsDev } = await import("../packages/opencorvus/src/provider/models")
ModelsDev.validateExplicitCatalog(catalog)
const { Config } = await import("../packages/opencorvus/src/config/config")
const custom = Object.fromEntries(Object.entries(modelIDs).map(([id, ids]) => [id, {
  name: `Local ${id.slice(6)}`, api: new URL(`${id}/v1`, participant.url).href, npm: "@ai-sdk/openai-compatible", env: [], options: { apiKey: "owned-local-counts" }, models: Object.fromEntries(ids.map((id) => [id, model(id)])),
}]))
await Config.updateGlobalPatch({ model: "count-two/owned-dual-a", small_model: "count-two/owned-dual-a", provider: custom, ...(edgeScope ? { enabled_providers: ["count-two", "catalog-two"], disabled_providers: ["count-zero"] } : {}), prompt_profile: { active: "base" }, experimental: { memory: { enabled: false } } })
const directory = path.join(root, "project")
fs.mkdirSync(directory, { recursive: true })
const git = (args: string[]) => { const result = Bun.spawnSync(["git", "-C", directory, ...args], { stdout: "pipe", stderr: "pipe" }); if (result.exitCode !== 0) throw new Error(`Owned Git ${args[0]} exited ${result.exitCode}`) }
git(["init"]); git(["config", "user.name", "Owned Count Qualification"]); git(["config", "user.email", "owned-counts@example.invalid"])
fs.writeFileSync(path.join(directory, "README.md"), "# Provider count project\n")
git(["add", "README.md"]); git(["commit", "-m", "Owned UI count qualification"])
fs.mkdirSync(path.join(directory, ".opencorvus"), { recursive: true })
fs.writeFileSync(path.join(directory, ".opencorvus", "opencorvus.jsonc"), JSON.stringify({ model: "count-project/owned-project", provider: { "count-project": { name: "Local project", api: new URL("count-one/v1", participant.url).href, npm: "@ai-sdk/openai-compatible", env: [], options: { apiKey: "owned-local-counts" }, models: { "owned-project": model("owned-project") } } } }, null, 2))
const { Instance } = await import("../packages/opencorvus/src/project/instance")
const { Provider } = await import("../packages/opencorvus/src/provider/provider")
const { ProviderLLM } = await import("../packages/opencorvus/src/provider/llm")
const { Session } = await import("../packages/opencorvus/src/session")
const { streamText } = await import("../packages/opencorvus/src/llm/api")
const { freezeOverlayUiDirectory } = await import("../packages/opencorvus/src/server/overlay-ui")
const { listenWithRecoveredServerRuntime } = await import("../packages/opencorvus/src/cli/server-runtime")
const { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded } = await import("../packages/opencorvus/src/engine/host-recovery")
const runtime = await listenWithRecoveredServerRuntime({ options: { hostname: "127.0.0.1", port: 18576, overlayUiSource: freezeOverlayUiDirectory({ directory: uiDirectory }) }, recover: async () => { const result = await recoverStartedTaskExecutions({ scopeProjectWorktree: directory }); assertStartedTaskProjectRecoverySucceeded(result) }, disposeInstances: () => Instance.disposeAll() })
await runtime.recovery
await Instance.provide({ directory, fn: () => Instance.project.id })
const observations: unknown[] = []
for (const [providerID, ids] of edgeScope ? [] : Object.entries(modelIDs)) {
  for (const id of ids) {
    const config = await Config.getGlobal()
    const selected = await Provider.getModelGlobal(providerID, id, config)
    const language = await Provider.getLanguageGlobal(selected, config)
    const result = streamText({ model: ProviderLLM.wrapModel(language, selected, {}), timeoutMs: false, prompt: "Measure the declared local count protocol input", usagePurpose: "other" })
    observations.push({ providerID, modelID: id, text: await result.text, normalized: Session.getUsage({ model: selected, usage: await result.usage }) })
  }
}
const read = async (route: string) => { const response = await fetch(`http://127.0.0.1:18576${route}`); return { status: response.status, body: await response.json() } }
fs.writeFileSync(path.join(root, "before-data.json"), JSON.stringify({ boundary: "Explicit owned catalog/config and local protocol input through real production HTTP/ledger; not online vendor metadata or financial evidence", catalog, custom, observations, global: await read("/global/providers"), project: await read(`/provider?directory=${encodeURIComponent(directory)}`), usage: await read("/global/usage?period=day&timeZone=Asia%2FShanghai"), config: await read("/global/config") }, null, 2))
fs.writeFileSync(path.join(root, "ready.json"), JSON.stringify({ pid: process.pid, started, port: runtime.server.port, participantPort: participant.port, project: directory, occurrence: runtime.occurrence }, null, 2))
let stopping = false
let poll: ReturnType<typeof setInterval>
let deadline: ReturnType<typeof setTimeout>
const stop = async (reason: string) => { if (stopping) return; stopping = true; clearInterval(poll); clearTimeout(deadline); try { await participant.stop(true); await runtime.server.stop(true); await runtime.recovery; fs.writeFileSync(path.join(root, "terminal.json"), JSON.stringify({ pid: process.pid, reason, elapsed: Date.now() - started, productionStop: "settled" }, null, 2)); await Log.close(); process.exit(0) } catch (error) { console.error(error); process.exit(1) } }
poll = setInterval(() => { if (fs.existsSync(path.join(root, "stop-requested"))) void stop("Own count page closed") }, 500)
deadline = setTimeout(() => void stop("Own count page 40min lifetime"), 2400000)
