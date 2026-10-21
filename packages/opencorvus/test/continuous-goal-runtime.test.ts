import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "./fixture/memory"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"

test("a fresh process settles the same accepted goal input after its streamed owner exits", async () => {
  await using project = await memoryProject("continuous-goal-runtime")
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT!
  const runtime = await createManagedTemporaryDirectory(root, "goal-stream-restart-")
  const barriers = path.join(runtime, "barriers")
  await fs.mkdir(barriers)
  const provider = startControlledStreamingProvider({ memoryModelID: "goal-runtime-memory" })
  const children: ReturnType<typeof start>[] = []
  function start(mode: string) {
    const child = Bun.spawn(
      [
        process.execPath,
        "--config=" + path.join(import.meta.dir, "empty-bunfig.toml"),
        path.join(import.meta.dir, "fixture", "continuous-goal-runtime-worker.ts"),
        mode,
        project.path,
        barriers,
        provider.apiURL,
      ],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: { ...process.env, OPENCORVUS_HOME: runtime },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    return { child, stdout: new Response(child.stdout).text(), stderr: new Response(child.stderr).text() }
  }
  async function waitFor(predicate: () => Promise<boolean> | boolean, worker: ReturnType<typeof start>) {
    let lastActivity = Date.now()
    let priorActivity = ""
    while (!(await predicate())) {
      if (worker.child.exitCode !== null)
        throw new Error("Goal worker exited: " + (await worker.stderr) + (await worker.stdout))
      const files = (await fs.readdir(barriers)).filter((name) => name.endsWith(".json")).sort()
      const activity = JSON.stringify({
        barriers: await Promise.all(
          files.map(async (name) => ({ name, modifiedAt: (await fs.stat(path.join(barriers, name))).mtimeMs })),
        ),
        requests: provider.requests.length,
      })
      if (activity !== priorActivity) {
        priorActivity = activity
        lastActivity = Date.now()
      }
      if (Date.now() - lastActivity > 60_000) throw new Error("Goal runtime made no progress for60s: " + files)
      await Bun.sleep(25)
    }
  }
  try {
    const first = start("start")
    children.push(first)
    await waitFor(async () => !!(await fs.stat(path.join(barriers, "ready.json")).catch(() => undefined)), first)
    await waitFor(() => provider.promptRequests().length === 1, first)
    const ready = JSON.parse(await fs.readFile(path.join(barriers, "ready.json"), "utf8"))
    expect(ready.outcome).toBe("accepted")
    console.log("[goal-runtime-stage] accepted", runtime)
    first.child.kill()
    await first.child.exited
    console.log("[goal-runtime-stage] owner exited")
    const recovered = start("recover")
    children.push(recovered)
    await waitFor(() => provider.promptRequests().length === 2, recovered)
    console.log("[goal-runtime-stage] recovery stream requested")
    provider.promptRequests()[1]!.release()
    await waitFor(async () => {
      const error = await fs.readFile(path.join(barriers, "error.json"), "utf8").catch(() => undefined)
      if (error) throw new Error(error)
      return !!(await fs.stat(path.join(barriers, "result.json")).catch(() => undefined))
    }, recovered)
    console.log("[goal-runtime-stage] result", await fs.readFile(path.join(barriers, "result.json"), "utf8"))
    const [exitCode, stdout, stderr] = await Promise.all([recovered.child.exited, recovered.stdout, recovered.stderr])
    if (exitCode !== 0) throw new Error("Goal recovery failed: " + stderr + stdout)
    const line = stdout.split(/\r?\n/).find((line) => line.startsWith("[goal-runtime-result]"))!
    const result = JSON.parse(line.slice("[goal-runtime-result]".length))
    expect(result).toMatchObject({
      recoveryDriver: "continuous-goal.reconcile",
      recoveryCandidates: [{ kind: "chat", id: ready.sessionID }],
      goal: { id: ready.goalID, status: "budget_limited", turnsAccepted: 1 },
      request: { id: ready.requestID },
      controllerInputs: [ready.messageID],
    })
    expect(result.replies).toMatchObject([{ parentID: ready.messageID, text: "provider reply 2" }])
    expect(provider.promptRequests().map((request) => (request.body as { stream: boolean }).stream)).toEqual([
      true,
      true,
    ])
  } finally {
    for (const request of provider.requests) request.release()
    for (const worker of children) {
      if (worker.child.exitCode === null) worker.child.kill()
      await worker.child.exited
    }
    await provider.server.stop(true)
    await removeManagedDirectoryTree(runtime)
  }
}, 180_000)
