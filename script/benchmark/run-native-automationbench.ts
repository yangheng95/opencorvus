// Native single-agent control: official prompt/tools, raw streaming SDK, shared auth transport.
import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import { createInterface } from "node:readline"
import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"
import { once } from "node:events"
import { awaitNativeOperation, nativeStreamEvidence, requireScorableNativeCompletion } from "./native-run-contract"
import { createBenchmarkAdmissionGate, installBenchmarkTerminationHandlers } from "./process-lifecycle"

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith("--") || process.argv[index + 1] === undefined)
    throw new Error("Expected --name value arguments")
  values.set(process.argv[index]!.slice(2), process.argv[index + 1]!)
}
function required(name: string) {
  const value = values.get(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}
const runtime = path.resolve(required("runtime"))
const runtimeRevision = required("runtime-revision")
const runtimeHome = path.resolve(required("runtime-home"))
const python = path.resolve(required("python"))
const harness = path.resolve(required("harness"))
const output = path.resolve(required("output"))
const manifestPath = path.resolve(required("manifest"))
const caseIndex = Number(required("case-index"))
const effort = required("reasoning-effort")
if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) throw new Error("Unsupported explicit reasoning effort")
const modelID = "gpt-5.6-luna"
const manifestBytes = await fs.readFile(manifestPath)
const manifestSHA256 = crypto.createHash("sha256").update(manifestBytes).digest("hex")
const manifest = JSON.parse(manifestBytes.toString("utf8"))
const selected = manifest.cases.find((item: any) => item.case_index === caseIndex)
if (!selected) throw new Error("case_index_not_in_frozen_manifest")
if (process.env.OPENCORVUS_HOME && path.resolve(process.env.OPENCORVUS_HOME) !== runtimeHome)
  throw new Error("runtime_home_conflict")
process.env.OPENCORVUS_HOME = runtimeHome
await fs.mkdir(output, { recursive: false, mode: 0o700 })
const startedAt = Date.now()
const runID = crypto.randomUUID()
const append = (name: string, value: unknown) => fs.appendFile(path.join(output, name), JSON.stringify(value) + "\n")
const admission = createBenchmarkAdmissionGate("Native benchmark runner")
const abort = new AbortController()
let world: ReturnType<typeof spawn> | undefined
let worldClosed: Promise<unknown> | undefined
const removeTerminationHandlers = installBenchmarkTerminationHandlers((signal) => {
  admission.request(signal)
  abort.abort(new Error(`Native benchmark runner received ${signal}`))
})
let lastActivity = Date.now()
const inactivityMs = 600_000
const maxResponseSteps = 50
const watchdog = setInterval(() => {
  if (Date.now() - lastActivity >= inactivityMs) abort.abort(new Error("native_provider_inactivity"))
}, 1000)
watchdog.unref()
const activity = () => { lastActivity = Date.now() }
const wait = <T>(operation: Promise<T>) => awaitNativeOperation(operation, abort.signal)
const runCommand = promisify(execFile)
let outcome: any
let failureStage = "setup"
let redactError = (text: string) => "native_setup_error:" + text.split(":")[0]!.slice(0, 100)
await fs.writeFile(path.join(output, "run-start.json"), JSON.stringify({ run_id: runID, started_at: startedAt,
  case_index: caseIndex, runtime_revision: runtimeRevision, model: `openai/${modelID}`, reasoning_effort: effort,
  manifest_sha256: manifestSHA256, max_response_steps: maxResponseSteps, inactivity_ms: inactivityMs }) + "\n")
try {
await fs.access(path.join(runtimeHome, "data/auth.json"))
await fs.access(path.join(runtimeHome, "data/models.json"))
const source = await wait(runCommand("git", ["-C", runtime, "rev-parse", "HEAD"], { signal: abort.signal }))
const dirty = await wait(runCommand("git", ["-C", runtime, "status", "--porcelain"], { signal: abort.signal }))
if (source.stdout.trim() !== runtimeRevision || dirty.stdout.trim()) throw new Error("runtime_source_identity_mismatch")
const requireRuntime = createRequire(path.join(runtime, "packages/opencorvus/package.json"))
const { streamText, jsonSchema, stepCountIs } = await wait(import(requireRuntime.resolve("ai")))
const { Provider } = await wait(import(path.join(runtime, "packages/opencorvus/src/provider/provider.ts")))
const { Config } = await wait(import(path.join(runtime, "packages/opencorvus/src/config/config.ts")))
const { ProviderError } = await wait(import(path.join(runtime, "packages/opencorvus/src/provider/error.ts")))
redactError = ProviderError.redactSensitiveProviderText
const config = await wait(Config.getGlobal())
const model = await wait<any>(Provider.getModelGlobal("openai", modelID, config))
if (model.api.id !== modelID) throw new Error("projected_request_model_mismatch")
  const language = await wait(Provider.getLanguageGlobal(model, config))
  failureStage = "official_world"
activity()
const child = spawn(python, [path.join(import.meta.dir, "native-automationbench-world.py"),
  "--harness", harness, "--domain", selected.domain, "--task", selected.task, "--output", path.join(output, "world")],
  { stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
world = child
worldClosed = new Promise((resolve) => { child.once("close", resolve) })
child.on("error", (error) => abort.abort(error))
child.stdin.on("error", (error) => abort.abort(error))
child.stderr.on("data", (chunk) => { void fs.appendFile(path.join(output, "world-stderr.log"), chunk) })
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
const read = async () => {
  const item = await wait(lines.next())
  if (item.done) throw new Error("official_world_transport_closed")
  activity()
  return JSON.parse(item.value)
}
// API world mutations are serial, as in the official environment's tool execution.
let worldQueue: Promise<unknown> = Promise.resolve()
const call = (request: unknown): Promise<any> => {
  const next = worldQueue.then(async () => {
    abort.signal.throwIfAborted()
    if (!child.stdin.write(JSON.stringify(request) + "\n"))
      await wait(once(child.stdin, "drain"))
    return read()
  })
  worldQueue = next
  return next
}
  const ready = await read()
  if (ready.kind !== "ready" || ready.example_id !== selected.example_id ||
      ready.task_contract_sha256 !== selected.task_contract_sha256 ||
      ready.package_tree_sha256 !== manifest.package_tree_sha256)
    throw new Error("official_task_or_package_identity_mismatch")
  const input = { run_id: runID, started_at: startedAt, case: selected, model: `openai/${modelID}`,
    reasoning_effort: effort, max_response_steps: maxResponseSteps, inactivity_ms: inactivityMs,
    runtime_revision: runtimeRevision,
    source_files: Object.fromEntries(await Promise.all([import.meta.path, path.join(import.meta.dir, "run-native-automationbench-batch.ts"),
      path.join(import.meta.dir, "native-run-contract.ts"),
      path.join(import.meta.dir, "process-lifecycle.ts"),
      path.join(import.meta.dir, "native-automationbench-world.py"), path.join(harness, "automationbench_bridge.py"),
      path.join(harness, "verify_automationbench_replay.py")].map(async (file) => [path.basename(file),
        crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")]))),
    manifest_sha256: crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    prompt: ready.prompt, tools: ready.tools }
  await fs.writeFile(path.join(output, "input.json"), JSON.stringify(input, null, 2) + "\n")
  failureStage = "model_execution"
  const tools = Object.fromEntries(ready.tools.map((definition: any) => [definition.name, {
    description: definition.description,
    inputSchema: jsonSchema(definition.parameters),
    execute: async (arguments_: unknown, context: any) => {
      activity()
      const result = await call({ kind: "tool", name: definition.name, arguments: arguments_ }).catch((error) => {
        abort.abort(error)
        throw error
      })
      await append("tool-results.jsonl", { tool_call_id: context.toolCallId, name: definition.name, arguments: arguments_, ...result })
      return result.output
    },
  }]))
  const system = ready.prompt.filter((message: any) => message.role === "system").map((message: any) => message.content).join("\n\n")
  const messages = ready.prompt.filter((message: any) => message.role !== "system")
  const stream = streamText({
    model: language, messages, tools, stopWhen: stepCountIs(maxResponseSteps), maxRetries: 0, abortSignal: abort.signal,
    providerOptions: { openai: { store: false, instructions: system, reasoningEffort: effort } },
    onStepFinish: async (step: any) => {
      const request = typeof step.request.body === "string" ? JSON.parse(step.request.body) : step.request.body
      await append("steps.jsonl", { finish_reason: step.finishReason, usage: step.usage,
        request_model: request.model, response_model: step.response.modelId, messages: step.response.messages })
      if (request.model !== modelID) throw new Error("actual_request_model_mismatch")
    },
  })
  const chunks = stream.fullStream[Symbol.asyncIterator]()
  for (;;) {
    const next = await wait<any>(chunks.next())
    if (next.done) break
    const part = next.value
    activity()
    if (part.type === "error") throw part.error
    if (part.type === "abort") throw abort.signal.reason ?? new Error("native_stream_aborted")
    await append("stream.jsonl", nativeStreamEvidence(part, ProviderError.redactSensitiveProviderHeaders))
  }
  const finishReason = await wait<string>(stream.finishReason)
  requireScorableNativeCompletion(finishReason, abort.signal)
  failureStage = "official_scoring"
  const score = await call({ kind: "score" })
  child.stdin.end()
  await wait(worldClosed)
  if (child.exitCode !== 0) throw new Error("official_world_exit_failure")
  failureStage = "official_replay"
  const replayChild = spawn(python, [path.join(harness, "verify_automationbench_replay.py"),
    "--domain", selected.domain, "--task", selected.task, "--events", path.join(output, "world/automationbench-events.jsonl"),
    "--initial-world", path.join(output, "world/automationbench-initial-world.json"),
    "--final-world", path.join(output, "world/automationbench-final-world.json")],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, signal: abort.signal })
  world = replayChild
  worldClosed = new Promise((resolve) => { replayChild.once("close", resolve) })
  replayChild.on("error", (error) => abort.abort(error))
  replayChild.stdin.on("error", (error) => abort.abort(error))
  let replayOutput = ""
  let replayError = ""
  replayChild.stdout.on("data", (chunk) => { replayOutput += chunk; activity() })
  replayChild.stderr.on("data", (chunk) => { replayError += chunk })
  replayChild.stdin.end(JSON.stringify(score))
  await wait(worldClosed)
  await fs.writeFile(path.join(output, "replay-stderr.log"), replayError)
  if (replayChild.exitCode !== 0) throw new Error("official_replay_failed")
  const replay = JSON.parse(replayOutput)
  if (replay.passed !== true) throw new Error("official_replay_failed")
  outcome = { status: "scored", score, replay, usage: await wait(stream.totalUsage), finish_reason: finishReason }
} catch (error) {
  outcome = { status: "unscored_infrastructure_failure", failure_stage: failureStage, error: redactError(
    error instanceof Error ? error.message : String(error)) }
} finally {
  clearInterval(watchdog)
  world?.stdin?.end()
  // This invocation owns this child. It never targets another runtime or user process.
  if (world && world.exitCode === null && world.signalCode === null) {
    world.kill("SIGTERM")
    const force = setTimeout(() => world?.kill("SIGKILL"), 5000)
    await worldClosed
    clearTimeout(force)
  }
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify({ run_id: runID,
    case_index: caseIndex, model: `openai/${modelID}`, started_at: startedAt, finished_at: Date.now(),
    runtime_revision: runtimeRevision, reasoning_effort: effort, manifest_sha256: manifestSHA256,
    max_response_steps: maxResponseSteps, inactivity_ms: inactivityMs,
    termination_signal: admission.signal() ?? null, ...outcome }, null, 2) + "\n")
  removeTerminationHandlers()
}
process.exitCode = outcome.status === "scored" ? 0 : 1
