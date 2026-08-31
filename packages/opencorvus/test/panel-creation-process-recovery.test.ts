import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { hostGit } from "@/util/git"

async function waitForReady(file: string, child: ReturnType<typeof Bun.spawn>): Promise<void> {
  const deadline = Date.now() + 30_000
  while (true) {
    if (await fs.stat(file).catch(() => undefined)) return
    if (child.exitCode !== null) {
      throw new Error(`Panel seed exited ${child.exitCode}: ${await new Response(child.stderr).text()}`)
    }
    if (Date.now() >= deadline) {
      child.kill()
      throw new Error(`Panel seed did not reach committed-target cut: ${await new Response(child.stderr).text()}`)
    }
    await Bun.sleep(10)
  }
}

async function finish(child: ReturnType<typeof Bun.spawn>) {
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`Panel recovery worker exited ${exitCode}: ${stderr}`)
  const line = stdout.trim().split(/\r?\n/).at(-1)
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
    const spawn = (mode: "seed" | "recover", action: "create_task" | "wake_mission" | "wake_work") => Bun.spawn(
      [process.execPath, `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`, worker, mode, barrier, project, action],
      { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
    )
    for (const action of ["create_task", "wake_mission", "wake_work"] as const) {
      const seed = spawn("seed", action)
      await waitForReady(path.join(barrier, `${action}.ready`), seed)
      seed.kill()
      await seed.exited
      const recovered = await finish(spawn("recover", action))
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
