import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const signalTest = process.platform === "win32" ? test.skip : test

signalTest("a real SIGTERM closes process admission and reaches an exact terminal response", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-benchmark-signal-"))
  const readyPath = path.join(directory, "ready")
  const child = Bun.spawn(
    [process.execPath, path.resolve(import.meta.dir, "../fixture/benchmark-termination-worker.ts"), readyPath],
    { stdout: "pipe", stderr: "pipe" },
  )
  try {
    const deadline = Date.now() + 5_000
    while (!(await fs.access(readyPath).then(() => true).catch(() => false))) {
      if (Date.now() >= deadline) throw new Error("termination fixture did not become ready")
      await Bun.sleep(10)
    }
    child.kill("SIGTERM")
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ exitCode, stderr, response: JSON.parse(stdout) }).toEqual({
      exitCode: 0,
      stderr: "",
      response: { signal: "SIGTERM", admission_open: false },
    })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
