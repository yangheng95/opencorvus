import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { hostGit } from "@/util/git"

type Worker = {
  handle: ProcessSupervisor.Handle
  exitCode: number | null
  stdout: string
  stderr: string
}

async function waitForReady(file: string, child: Worker): Promise<void> {
  const deadline = Date.now() + 30_000
  while (true) {
    if (await fs.stat(file).catch(() => undefined)) return
    if (child.exitCode !== null) {
      throw new Error(`Panel seed exited ${child.exitCode}: ${child.stderr}`)
    }
    if (Date.now() >= deadline) {
      await ProcessSupervisor.terminateAndWaitForExit(child.handle, "Panel seed readiness timeout")
      throw new Error(`Panel seed did not reach committed-target cut: ${child.stderr}`)
    }
    await Bun.sleep(10)
  }
}

async function finish(child: Worker) {
  const exitCode = await child.handle.exited
  await Promise.all([child.handle.outputSettled, child.handle.settled])
  if (exitCode !== 0) throw new Error(`Panel recovery worker exited ${exitCode}: ${child.stderr}`)
  const line = child.stdout.trim().split(/\r?\n/).at(-1)
  if (!line) throw new Error("Panel recovery worker returned no result")
  return JSON.parse(line) as Record<string, unknown>
}

test("generic startup recovery completes Panel creation after the owner process dies", async () => {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Panel process recovery requires the repository test runtime")
  const runtime = await createManagedTemporaryDirectory(processRoot, "panel-process-runtime-")
  const barrier = await createManagedTemporaryDirectory(processRoot, "panel-process-barrier-")
  const project = await createManagedTemporaryDirectory(processRoot, "panel-process-project-")
  try {
    const initialized = await hostGit(["init"], { cwd: project, timeoutProfile: "default" })
    if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
    const worker = path.join(import.meta.dir, "fixture", "panel-creation-process-worker.ts")
    const environment = {
      ...process.env,
      OPENCORVUS_HOME: runtime,
      OPENCORVUS_TASK_PROCESS_MODE: "native",
    }
    const spawn = async (mode: "seed" | "recover", action: "create_task" | "wake_mission" | "wake_work") => {
      const result: Worker = {
        handle: await ProcessSupervisor.spawnHostCommand({
          executable: process.execPath,
          args: [`--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`, worker, mode, barrier, project, action],
          cwd: path.join(import.meta.dir, ".."),
          env: environment,
          owner: `panel-process-recovery-${mode}-${action}`,
        }),
        exitCode: null,
        stdout: "",
        stderr: "",
      }
      result.handle.stdout?.setEncoding("utf8")
      result.handle.stdout?.on("data", (chunk) => (result.stdout += String(chunk)))
      result.handle.stderr?.setEncoding("utf8")
      result.handle.stderr?.on("data", (chunk) => (result.stderr += String(chunk)))
      void result.handle.exited.then((exitCode) => (result.exitCode = exitCode))
      return result
    }
    for (const action of ["create_task", "wake_mission", "wake_work"] as const) {
      const seed = await spawn("seed", action)
      await waitForReady(path.join(barrier, `${action}.ready`), seed)
      await ProcessSupervisor.terminateAndWaitForExit(seed.handle, `Panel ${action} owner-death cut`)
      await seed.handle.settled
      const recovered = await finish(await spawn("recover", action))
      expect(recovered).toEqual({
        recovered: true,
        partStatus: "completed",
        assistantCompleted: true,
        targetID: expect.any(String),
        targetUserMessages: action === "create_task" ? 0 : 1,
      })
    }
  } finally {
    await removeManagedDirectoryTree(project)
    await removeManagedDirectoryTree(barrier)
    await removeManagedDirectoryTree(runtime)
  }
}, 180_000)
