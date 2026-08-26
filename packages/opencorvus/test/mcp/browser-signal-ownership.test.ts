import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type LifecycleEvent =
  | { mode: "http" | "stdio"; phase: "ready"; signalOwners: number; port?: number }
  | { mode: "http" | "stdio"; phase: "signal-requested" }
  | { exitCode: number | undefined; mode: "http" | "stdio"; phase: "cleanup-settled" }

const roots: string[] = []
const fixture = path.join(import.meta.dir, "..", "fixture", "browser-signal-owner-child.ts")

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function runSignalLifecycle(mode: "http" | "stdio"): Promise<{
  events: LifecycleEvent[]
  exitCode: number
  stderr: string
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), `opencorvus-browser-${mode}-signal-`))
  roots.push(root)
  const ledger = path.join(root, "lifecycle.ndjson")
  const child = Bun.spawn([process.execPath, fixture, mode, ledger], {
    cwd: path.join(import.meta.dir, "..", ".."),
    env: { ...Bun.env },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = new Response(child.stdout).text()
  const stderr = new Response(child.stderr).text()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const exitCode = await Promise.race([
      child.exited,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${mode} Browser MCP signal lifecycle timed out`)), 20_000)
      }),
    ])
    const events = (await readFile(ledger, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LifecycleEvent)
    await stdout
    return { events, exitCode, stderr: await stderr }
  } catch (error) {
    child.kill()
    await child.exited.catch(() => undefined)
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

describe("Browser composition roots settle one cleanup receipt after a signal", () => {
  for (const mode of ["http", "stdio"] as const) {
    test(
      `${mode} records ready, the signal request, and cleanup settlement before exit`,
      { timeout: 30_000 },
      async () => {
        const result = await runSignalLifecycle(mode)
        expect(result).toEqual({
          events: [
            {
              mode,
              phase: "ready",
              signalOwners: 1,
              ...(mode === "http" ? { port: expect.any(Number) } : {}),
            },
            { mode, phase: "signal-requested" },
            { exitCode: 143, mode, phase: "cleanup-settled" },
          ],
          exitCode: 143,
          stderr: expect.stringContaining(
            mode === "http" ? "[browser-mcp] HTTP server listening on" : "[browser-mcp] Live View available at",
          ),
        })
      },
    )
  }
})
