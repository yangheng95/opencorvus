/** Credential-free physical crash checker. Scripted loopback responses prove storage/recovery, not model reasoning. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
  testCommandDeadlineAt,
} from "@opencorvus-ai/util/test-runtime-environment"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const resultPath = process.env.COMPACTION_CRASH_RESULT
assert(resultPath && path.isAbsolute(resultPath), "COMPACTION_CRASH_RESULT must be an absolute report path")
const cuts = ["streaming", "summary_saved", "checkpoint_transaction", "checkpoint_saved"]
const selected = process.env.COMPACTION_CRASH_CUTS?.split(",") ?? cuts
assert(selected.length && selected.every((cut) => cuts.includes(cut)), "Unknown cut selection")
const kinds = process.env.COMPACTION_CRASH_KINDS?.split(",") ?? ["manual", "automatic"]
assert(kinds.length && kinds.every((kind) => ["manual", "automatic"].includes(kind)), "Unknown control kind")
const supervisor = prepareTestProcessSupervisor()
const runtime = await bootstrapIsolatedTestRuntime("runner")
Object.assign(process.env, isolatedTestChildEnvironment(runtime))
process.env.OPENCORVUS_HOME = runtime.runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = runtime.processRoot
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const { runHostCommandWithInactivity } = await import("@/shell/command-inactivity")
const { declareNativeTaskProcessDeployment } = await import("@/runtime/task-process-deployment")
declareNativeTaskProcessDeployment()
const requests = new Map<string, Array<Record<string, unknown>>>()
const cases: Array<Record<string, unknown>> = []
const runnerErrors: Array<{ name: string; message: string; stack?: string }> = []
let physicallySettled = true
const checkpoint = "Verified correction: retain eu-west; permission: read only; evidence trace CRASH-317."
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const [, key, mode] = new URL(request.url).pathname.split("/")
    const body = (await request.json()) as Record<string, unknown>
    assert.equal(body.stream, true)
    assert.equal(body.model, "checkpoint")
    const rows = requests.get(key!)
    assert(rows, "Only the exact created case may use this transport")
    rows.push({ mode, body })
    console.log(JSON.stringify({ case: key, stage: "provider-request", mode, count: rows.length }))
    const chunk = (delta: unknown, finish: string | null) =>
      `data: ${JSON.stringify({
        id: `chatcmpl-${key}-${rows.length}`,
        object: "chat.completion.chunk",
        created: 1,
        model: "checkpoint",
        choices: [{ index: 0, delta, finish_reason: finish }],
      })}\n\n`
    if (key?.startsWith("streaming-") && mode === "cut") {
      let timer: ReturnType<typeof setTimeout> | undefined
      const encoder = new TextEncoder()
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(chunk({ role: "assistant", content: checkpoint }, null)))
            timer = setTimeout(() => {
              controller.enqueue(encoder.encode(chunk({}, "stop") + "data: [DONE]\n\n"))
              controller.close()
            }, 1_500)
          },
          cancel() {
            if (timer) clearTimeout(timer)
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      )
    }
    return new Response(
      chunk({ role: "assistant", content: checkpoint }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
      {
        headers: { "content-type": "text/event-stream" },
      },
    )
  },
})
await fs.mkdir(path.dirname(resultPath), { recursive: true })
let saving = Promise.resolve()
const save = () => {
  const text = JSON.stringify(
    {
      status:
        runnerErrors.length || cases.some((item) => item.status === "failed")
          ? "failed"
          : cases.length === selected.length * kinds.length && cases.every((item) => item.status === "passed")
            ? "passed"
            : "running",
      scope: "physical child exit and fresh Session loop recovery using scripted local streaming transport",
      remoteModelRequests: 0,
      inactivityMilliseconds: 180_000,
      cases,
      runnerErrors,
    },
    null,
    2,
  )
  saving = saving.then(async () => {
    await fs.writeFile(`${resultPath}.tmp`, text)
    await fs.rename(`${resultPath}.tmp`, resultPath)
  })
  return saving
}
async function scenario(cut: string, kind: string) {
  const key = `${cut}-${kind}`
  const scope = await createManagedTemporaryDirectory(runtime.processRoot, `${key}-`)
  const directory = path.join(scope, "project")
  const statePath = path.join(scope, "state.json")
  const report: Record<string, any> = { cut, kind, status: "running", scope, phases: [] }
  cases.push(report)
  requests.set(key, [])
  let settled = true
  try {
    await fs.mkdir(directory)
    await fs.writeFile(path.join(directory, "identity.txt"), key)
    for (const args of [
      ["init"],
      ["config", "user.name", "Compaction Crash Check"],
      ["config", "user.email", "check@example.invalid"],
      ["add", "identity.txt"],
      ["commit", "-m", "isolated evidence"],
    ]) {
      execFileSync("git", args, { cwd: directory, stdio: "ignore", windowsHide: true })
    }
    for (const mode of ["cut", "recover", "inspect"]) {
      const childEnv: NodeJS.ProcessEnv = {
        ...isolatedTestChildEnvironment(runtime),
        OPENCORVUS_HOME: path.join(scope, "runtime"),
        OPENCORVUS_TASK_PROCESS_MODE: "native",
      }
      delete childEnv.OPENCORVUS_DB
      delete childEnv.OPENCORVUS_API_KEY
      console.log(JSON.stringify({ case: key, stage: "start", mode }))
      const result = await runHostCommandWithInactivity({
        executable: process.execPath,
        args: [
          `--config=${path.resolve(import.meta.dir, "../test/empty-bunfig.toml")}`,
          path.join(import.meta.dir, "compaction-crash-worker.ts"),
          mode,
          cut,
          kind,
          directory,
          statePath,
          `http://127.0.0.1:${server.port}/${key}/${mode}/v1`,
        ],
        cwd: path.resolve(import.meta.dir, ".."),
        env: childEnv,
        inactivityTimeoutMs: 180_000,
        deadlineAt: testCommandDeadlineAt(),
        onStdout: (chunk) => process.stdout.write(chunk),
        onStderr: (chunk) => process.stderr.write(chunk),
      })
      settled &&= result.settlementConfirmed
      const events = result.stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      report.phases.push({
        mode,
        exitCode: result.exitCode,
        settlementConfirmed: result.settlementConfirmed,
        failure: result.failure,
        stderr: result.stderr,
        events,
      })
      await save()
      assert(result.settlementConfirmed, "Physical child and output settlement must be confirmed")
      assert.equal(result.failure, undefined)
      assert.equal(result.exitCode, mode === "cut" ? 81 + cuts.indexOf(cut) : 0, `${key}/${mode}: see phase stderr`)
    }
    const recovered = report.phases[1].events.find((event: any) => event.stage === "recovered")
    const inspected = report.phases[2].events.find((event: any) => event.stage === "inspect")
    assert.deepEqual(inspected.snapshot, recovered.after, "Another fresh process must reconstruct the same checkpoint")
    const phaseRequests = requests.get(key)!
    const compactions = phaseRequests.filter((item: any) =>
      item.body.tools.some((tool: any) => tool.function.name === "ReadCompactionEvidence"),
    )
    const continuations = phaseRequests.filter((item) => !compactions.includes(item))
    assert.deepEqual(
      compactions.map((item) => item.mode),
      cut === "checkpoint_saved" ? ["cut"] : ["cut", "recover"],
    )
    assert.deepEqual(
      continuations.map((item) => item.mode),
      kind === "automatic" ? ["recover"] : [],
    )
    report.source = JSON.parse(await fs.readFile(statePath, "utf8"))
    report.status = "passed"
  } catch (error) {
    report.status = "failed"
    report.error =
      error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error)
    process.exitCode = 1
  } finally {
    report.requests = requests.get(key)
    report.settlementConfirmed = settled
    physicallySettled &&= settled
    if (settled && report.status === "passed") await removeManagedDirectoryTree(scope)
    await save()
    console.log(JSON.stringify({ case: key, status: report.status, error: report.error }))
  }
}
try {
  // Each project has its own runtime/database; allow real independent lease
  // expiry to overlap while keeping this checker to four owned child commands.
  const pending = selected.flatMap((cut) => kinds.map((kind) => ({ cut, kind })))
  for (let i = 0; i < pending.length; i += 4) {
    const joined = await Promise.allSettled(pending.slice(i, i + 4).map(({ cut, kind }) => scenario(cut, kind)))
    for (const result of joined) {
      if (result.status !== "rejected") continue
      const error = result.reason
      runnerErrors.push(
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "RunnerError", message: String(error) },
      )
      process.exitCode = 1
    }
  }
} finally {
  await server.stop(true)
  await save()
  if (!runnerErrors.length && physicallySettled && cases.every((item) => item.status === "passed"))
    await removeIsolatedTestRuntime(runtime)
  else console.error(`Preserved isolated failure evidence under ${runtime.processRoot}`)
}
