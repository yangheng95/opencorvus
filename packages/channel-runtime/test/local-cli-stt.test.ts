import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { LocalCLIProvider } from "../src/stt/providers/local-cli"
import type { AudioBuffer } from "../src/stt/types"

const tempRoots: string[] = []

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

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

async function waitForFile(file: string, timeoutMs = 2_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(file)) return readFileSync(file, "utf8")
    await Bun.sleep(10)
  }
  throw new Error(`Local CLI fixture did not publish ${file}`)
}

async function waitForExit(pid: number, timeoutMs = 4_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true
    await Bun.sleep(20)
  }
  return !isPidAlive(pid)
}

test("local CLI transcribe releases its temporary output directory for immediate reuse", async () => {
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
  const releasedDirectory = readFileSync(outputRecord, "utf8")
  mkdirSync(releasedDirectory)
  try {
    const reuseReceipt = path.join(releasedDirectory, "reuse-receipt.txt")
    writeFileSync(reuseReceipt, "temporary-directory-reused")
    expect(readFileSync(reuseReceipt, "utf8")).toBe("temporary-directory-reused")
  } finally {
    rmSync(releasedDirectory, { recursive: true, force: true })
  }
})

test("local CLI timeout settles its owned descendant tree", async () => {
  const root = tempRoot("opencorvus-local-cli-tree-timeout-")
  const script = path.join(root, "transcribe-timeout.cjs")
  const childPidFile = path.join(root, "child.pid")
  writeFileSync(
    script,
    [
      'const { spawn } = require("node:child_process")',
      'const fs = require("node:fs")',
      'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" })',
      "child.unref()",
      `fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid))`,
      "setInterval(() => {}, 1000)",
    ].join("\n"),
  )
  const provider = new LocalCLIProvider({ command: `${process.execPath} ${script}`, timeoutMs: 1_000 })
  let childPID: number | undefined
  try {
    const transcribing = provider.transcribe(audio())
    void transcribing.catch(() => undefined)
    childPID = Number(await waitForFile(childPidFile))
    await expect(transcribing).rejects.toThrow("CLI timed out after 1000ms without completing")
    expect(await waitForExit(childPID)).toBe(true)
  } finally {
    if (childPID && isPidAlive(childPID)) process.kill(childPID, "SIGKILL")
  }
})
