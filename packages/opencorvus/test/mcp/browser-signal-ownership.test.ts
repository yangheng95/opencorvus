import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"

const browserRoot = path.join(import.meta.dir, "..", "..", "src", "mcp", "browser")

async function source(file: string): Promise<string> {
  return readFile(path.join(browserRoot, file), "utf8")
}

/** The module's code with comments removed — a rule about what a module DOES
 *  must not be satisfied or broken by prose describing what it no longer does. */
async function code(file: string): Promise<string> {
  return (await source(file))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
}

/**
 * Signal ownership is a source-level contract: exactly the composition roots
 * that own a process may install termination handlers, and the Browser
 * resource module may not. Asserting it against the modules themselves is
 * what keeps a future resource module from quietly taking the process back —
 * running these paths for real would require a live browser and a signalled
 * process, which proves nothing about who is allowed to own termination.
 */
describe("Browser process termination has exactly one owner per process", () => {
  test("the session resource module installs no termination handlers and never exits the process", async () => {
    const sessions = await code("sessions.ts")
    const signalHandlers = sessions.match(/process\.(on|once)\(\s*["'](SIGINT|SIGTERM|exit)["']/g) ?? []
    const exits = sessions.match(/process\.exit\(/g) ?? []
    expect({ signalHandlers, exits }).toEqual({ signalHandlers: [], exits: [] })
  })

  test("the session module still exposes its cleanup for the owner to await", async () => {
    const sessions = await source("sessions.ts")
    expect(sessions).toContain("export const shutdownBrowserSessions = async ()")
  })

  test("each composition root sets its exit status from the cleanup receipt, not before it", async () => {
    const index = await source("index.ts")
    // Both transports own their signals, and neither reports an exit status
    // except inside the settlement of the single close() receipt.
    const owners = index.match(/const closeForSignal = \(exitCode: number\) => \{/g) ?? []
    expect(owners.length).toBe(2)
    for (const segment of index.split("const closeForSignal = (exitCode: number) => {").slice(1)) {
      const body = segment.slice(0, segment.indexOf("\n    const on"))
      expect(body).toContain("void close().then(")
      expect(body).toContain("process.exitCode = exitCode")
      expect(body).toContain("process.exitCode = 1")
    }
  })

  test("both transports await Browser cleanup inside that receipt", async () => {
    const index = await source("index.ts")
    expect((index.match(/shutdownBrowserSessions\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  test("the node launcher owns its own process and its own child tree", async () => {
    const launcher = await source("node-launcher.ts")
    expect(launcher).toContain('process.once("SIGINT", sigint)')
    expect(launcher).toContain('process.once("SIGTERM", sigterm)')
    // It reports a failed termination as a failed exit rather than success.
    expect(launcher).toContain("process.exitCode = 1")
  })
})
