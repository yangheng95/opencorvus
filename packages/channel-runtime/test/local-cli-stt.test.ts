import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { LocalCLIProvider } from "../src/stt/providers/local-cli"
import type { AudioBuffer } from "../src/stt/types"

const tempRoots: string[] = []
const localCliSourcePath = path.resolve(import.meta.dir, "..", "src", "stt", "providers", "local-cli.ts")

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix))
  tempRoots.push(root)
  return root
}

function audio(): AudioBuffer {
  return {
    data: Buffer.from([1, 2, 3]),
    mime: "audio/ogg",
    size: 3,
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

function killProcess(pid: number): void {
  try {
    process.kill(pid, "SIGKILL")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
  }
}

async function waitForDead(pid: number, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!processAlive(pid)) return
    await Bun.sleep(25)
  }
  expect(processAlive(pid)).toBe(false)
}

test("local CLI transcribe removes its temporary output directory", async () => {
  const root = tempRoot("opencorvus-local-cli-stt-")
  const script = path.join(root, "transcribe.cjs")
  const outputRecord = path.join(root, "output-dir.txt")
  writeFileSync(
    script,
    [
      "const fs = require('node:fs')",
      "const path = require('node:path')",
      "const outputDir = process.argv[2]",
      "const outputRecord = process.argv[3]",
      "fs.writeFileSync(path.join(outputDir, 'input.txt'), 'transcribed text')",
      "fs.writeFileSync(outputRecord, outputDir)",
    ].join("\n"),
  )
  const provider = new LocalCLIProvider({
    command: `${process.execPath} ${script} {{OutputDir}} ${outputRecord}`,
    timeoutMs: 2_000,
  })

  const result = await provider.transcribe(audio())

  expect(result.text).toBe("transcribed text")
  expect(existsSync(readFileSync(outputRecord, "utf8"))).toBe(false)
})

test("local CLI transcribe cleans ignored-stdio descendants after root exit", async () => {
  const root = tempRoot("opencorvus-local-cli-stt-descendant-")
  const script = path.join(root, "spawn-descendant.cjs")
  const pidFile = path.join(root, "descendant.pid")
  writeFileSync(
    script,
    [
      "const { spawn } = require('node:child_process')",
      "const fs = require('node:fs')",
      "const path = require('node:path')",
      "const outputDir = process.argv[2]",
      "const pidFile = process.argv[3]",
      `const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore"] })`,
      "child.unref()",
      "fs.writeFileSync(pidFile, String(child.pid))",
      "fs.writeFileSync(path.join(outputDir, 'input.txt'), 'descendant text')",
      "process.exit(0)",
    ].join("\n"),
  )
  const provider = new LocalCLIProvider({
    command: `${process.execPath} ${script} {{OutputDir}} ${pidFile}`,
    timeoutMs: 2_000,
  })
  let descendantPid: number | undefined
  try {
    const result = await provider.transcribe(audio())
    expect(result.text).toBe("descendant text")
    descendantPid = Number(readFileSync(pidFile, "utf8"))
    await waitForDead(descendantPid)
  } finally {
    if (descendantPid !== undefined && processAlive(descendantPid)) killProcess(descendantPid)
  }
})

test("local CLI Windows PowerShell cleanup delegate is bounded", () => {
  const source = readFileSync(localCliSourcePath, "utf8")

  expect(source).toContain("const WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS = 5_000")
  expect(source).toContain("PowerShell cleanup timed out after")
  expect(source).toContain("runner.kill()")
  expect(source).toContain("clearTimeout(timer)")
  expect(source).toContain("Stop-Process -Id $target -Force -ErrorAction SilentlyContinue")
  expect(source).not.toContain("Stop-Process -Id $target -Force -ErrorAction Stop")
})
