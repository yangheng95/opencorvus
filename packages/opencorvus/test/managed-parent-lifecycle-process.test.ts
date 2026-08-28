import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type LifecycleEvent = {
  phase: "ready" | "shutdown" | "timeout"
  childPid: number
  parent: { pid: number; processInstanceID: string; occurrenceID: string }
  reason?: string
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function events(pathname: string): Promise<LifecycleEvent[]> {
  return await fs
    .readFile(pathname, "utf8")
    .then((text) =>
      text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LifecycleEvent),
    )
    .catch(() => [])
}

describe("managed backend follows one launcher-minted parent occurrence", () => {
  test("the real child shuts down once after its exact parent exits", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-managed-parent-"))
    const ledger = path.join(directory, "lifecycle.ndjson")
    const launcher = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "fixture", "managed-parent-launcher-worker.ts"), ledger],
      { stdout: "pipe", stderr: "pipe", windowsHide: true },
    )
    let childPid: number | undefined
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        launcher.exited,
        new Response(launcher.stdout).text(),
        new Response(launcher.stderr).text(),
      ])
      childPid = Number(stdout.trim())
      expect(Number.isSafeInteger(childPid) && childPid > 0).toBe(true)
      expect({ exitCode, stderr: stderr.trim(), childPid, launcherPid: launcher.pid }).toEqual({
        exitCode: 0,
        stderr: "",
        childPid: expect.any(Number),
        launcherPid: expect.any(Number),
      })

      const deadline = Date.now() + 10_000
      let observed: LifecycleEvent[] = []
      while (Date.now() < deadline) {
        observed = await events(ledger)
        if (observed.some((event) => event.phase === "shutdown")) break
        await Bun.sleep(20)
      }
      expect(observed).toEqual([
        {
          phase: "ready",
          childPid,
          parent: {
            pid: launcher.pid,
            processInstanceID: expect.stringMatching(/^(win32|linux|darwin):/),
            occurrenceID: expect.any(String),
          },
        },
        {
          phase: "shutdown",
          childPid,
          parent: {
            pid: launcher.pid,
            processInstanceID: observed[0]?.parent.processInstanceID,
            occurrenceID: observed[0]?.parent.occurrenceID,
          },
          reason: "parent-watchdog: parent process occurrence exited or its identifier was reused",
        },
      ])
      const exitDeadline = Date.now() + 5_000
      while (childPid && processIsAlive(childPid) && Date.now() < exitDeadline) await Bun.sleep(20)
      expect({ childPid, alive: childPid ? processIsAlive(childPid) : true }).toEqual({ childPid, alive: false })
    } finally {
      if (childPid && processIsAlive(childPid)) process.kill(childPid, "SIGKILL")
      await fs.rm(directory, { recursive: true, force: true })
    }
  }, 30_000)
})
