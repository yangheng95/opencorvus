import fs from "node:fs/promises"
import path from "node:path"
import { afterEach, describe, expect, test } from "bun:test"
import {
  createManagedTemporaryDirectory,
  removeManagedDirectoryTree,
} from "@opencorvus-ai/util/runtime-directories"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("cross-process standalone Session deletion cleanup", () => {
  test("preserves a live owner's quarantine and rolls it back only after exact owner death", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process Session deletion test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-deletion-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-deletion-barrier-")
    const worker = path.join(import.meta.dir, "fixture", "session-deletion-cleanup-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init" | "hold" | "recover", sessionID = "-") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as {
        sessionID?: string
        recovery?: { unreconciled: string[] }
        sourcePresent?: boolean
        quarantinePresent?: boolean
        sessionPresent?: boolean
        activeManifests?: string[]
      }
    }
    const waitForReady = async () => {
      const target = path.join(barrier, "owner-ready.json")
      const deadline = Date.now() + 30_000
      while (!(await fs.stat(target).catch(() => undefined))) {
        if (Date.now() >= deadline) throw new Error("Deletion owner did not publish its staged quarantine")
        await Bun.sleep(20)
      }
    }

    let owner: ReturnType<typeof spawn> | undefined
    try {
      const initialized = await read(spawn("init"))
      const sessionID = initialized.sessionID!
      owner = spawn("hold", sessionID)
      await waitForReady()

      expect(await read(spawn("recover", sessionID))).toEqual({
        recovery: { unreconciled: [] },
        sourcePresent: false,
        quarantinePresent: true,
        sessionPresent: true,
        activeManifests: [expect.stringMatching(/^cal_.*\.json$/)],
      })

      owner.kill()
      await owner.exited
      owner = undefined

      expect(await read(spawn("recover", sessionID))).toEqual({
        recovery: { unreconciled: [] },
        sourcePresent: true,
        quarantinePresent: false,
        sessionPresent: true,
        activeManifests: [],
      })
    } finally {
      owner?.kill()
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 120_000)
})
