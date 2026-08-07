import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createOpenCorvusServer } from "../src/server"

const serverSourcePath = path.resolve(import.meta.dir, "..", "src", "server.ts")

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return false
    if (code === "EPERM") return true
    throw error
  }
}

async function waitForPidFile(file: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      return Number(readFileSync(file, "utf8"))
    }
    await delay(10)
  }
  throw new Error(`Timed out waiting for pid file: ${file}`)
}

async function waitForPidExit(pid: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true
    await delay(20)
  }
  return !isPidAlive(pid)
}

async function killIfAlive(pid: number | undefined) {
  if (pid === undefined || !isPidAlive(pid)) return
  process.kill(pid, "SIGKILL")
  await waitForPidExit(pid, 2_000)
}

async function removeTempDir(dir: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "EBUSY" && code !== "ENOTEMPTY") throw error
      await delay(50)
    }
  }
  rmSync(dir, { recursive: true, force: true })
}

describe("createOpenCorvusServer", () => {
  test.serial(
    "terminates the spawned process when startup times out",
    async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "opencorvus-sdk-server-"))
      const pidFile = path.join(tempDir, "fake-server.pid")
      const previousCwd = process.cwd()
      const previousBinPath = process.env.OPENCORVUS_BIN_PATH
      const previousPidFile = process.env.OPENCORVUS_FAKE_PID_FILE
      let pid: number | undefined

      writeFileSync(
        path.join(tempDir, "serve"),
        [
          'const fs = require("node:fs")',
          "fs.writeFileSync(process.env.OPENCORVUS_FAKE_PID_FILE, String(process.pid))",
          "setInterval(() => {}, 10_000)",
          "",
        ].join("\n"),
      )

      process.chdir(tempDir)
      process.env.OPENCORVUS_BIN_PATH = "node"
      process.env.OPENCORVUS_FAKE_PID_FILE = pidFile

      try {
        const startup = createOpenCorvusServer({ timeout: 300, port: 0 })
        pid = await waitForPidFile(pidFile, 2_000)

        await expect(startup).rejects.toThrow("Timeout waiting for server to start after 300ms")
        expect(await waitForPidExit(pid, 2_000)).toBe(true)
      } finally {
        await killIfAlive(pid)
        process.chdir(previousCwd)
        if (previousBinPath === undefined) delete process.env.OPENCORVUS_BIN_PATH
        else process.env.OPENCORVUS_BIN_PATH = previousBinPath
        if (previousPidFile === undefined) delete process.env.OPENCORVUS_FAKE_PID_FILE
        else process.env.OPENCORVUS_FAKE_PID_FILE = previousPidFile
        await removeTempDir(tempDir)
      }
    },
  )

  test.serial(
    "terminates ignored-stdio descendants when startup times out",
    async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "opencorvus-sdk-server-descendant-timeout-"))
      const rootPidFile = path.join(tempDir, "fake-server.pid")
      const childPidFile = path.join(tempDir, "fake-child.pid")
      const previousCwd = process.cwd()
      const previousBinPath = process.env.OPENCORVUS_BIN_PATH
      const previousRootPidFile = process.env.OPENCORVUS_FAKE_PID_FILE
      const previousChildPidFile = process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
      let rootPid: number | undefined
      let childPid: number | undefined

      writeFileSync(
        path.join(tempDir, "serve"),
        [
          'const { spawn } = require("node:child_process")',
          'const fs = require("node:fs")',
          "fs.writeFileSync(process.env.OPENCORVUS_FAKE_PID_FILE, String(process.pid))",
          `const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore"] })`,
          "child.unref()",
          "fs.writeFileSync(process.env.OPENCORVUS_FAKE_CHILD_PID_FILE, String(child.pid))",
          "setInterval(() => {}, 10_000)",
          "",
        ].join("\n"),
      )

      process.chdir(tempDir)
      process.env.OPENCORVUS_BIN_PATH = "node"
      process.env.OPENCORVUS_FAKE_PID_FILE = rootPidFile
      process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = childPidFile

      try {
        const startup = createOpenCorvusServer({ timeout: 300, port: 0 })
        rootPid = await waitForPidFile(rootPidFile, 2_000)
        childPid = await waitForPidFile(childPidFile, 2_000)

        await expect(startup).rejects.toThrow("Timeout waiting for server to start after 300ms")
        expect(await waitForPidExit(rootPid, 4_000)).toBe(true)
        expect(await waitForPidExit(childPid, 4_000)).toBe(true)
      } finally {
        await killIfAlive(childPid)
        await killIfAlive(rootPid)
        process.chdir(previousCwd)
        if (previousBinPath === undefined) delete process.env.OPENCORVUS_BIN_PATH
        else process.env.OPENCORVUS_BIN_PATH = previousBinPath
        if (previousRootPidFile === undefined) delete process.env.OPENCORVUS_FAKE_PID_FILE
        else process.env.OPENCORVUS_FAKE_PID_FILE = previousRootPidFile
        if (previousChildPidFile === undefined) delete process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
        else process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = previousChildPidFile
        await removeTempDir(tempDir)
      }
    },
  )

  test.serial(
    "terminates ignored-stdio descendants when server exits before startup",
    async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "opencorvus-sdk-server-descendant-exit-"))
      const childPidFile = path.join(tempDir, "fake-child.pid")
      const previousCwd = process.cwd()
      const previousBinPath = process.env.OPENCORVUS_BIN_PATH
      const previousChildPidFile = process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
      let childPid: number | undefined

      writeFileSync(
        path.join(tempDir, "serve"),
        [
          'const { spawn } = require("node:child_process")',
          'const fs = require("node:fs")',
          `const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore"] })`,
          "child.unref()",
          "fs.writeFileSync(process.env.OPENCORVUS_FAKE_CHILD_PID_FILE, String(child.pid))",
          "process.exit(7)",
          "",
        ].join("\n"),
      )

      process.chdir(tempDir)
      process.env.OPENCORVUS_BIN_PATH = "node"
      process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = childPidFile

      try {
        const startup = createOpenCorvusServer({ timeout: 2_000, port: 0 })
        childPid = await waitForPidFile(childPidFile, 2_000)

        await expect(startup).rejects.toThrow("Server exited with code 7")
        expect(await waitForPidExit(childPid, 4_000)).toBe(true)
      } finally {
        await killIfAlive(childPid)
        process.chdir(previousCwd)
        if (previousBinPath === undefined) delete process.env.OPENCORVUS_BIN_PATH
        else process.env.OPENCORVUS_BIN_PATH = previousBinPath
        if (previousChildPidFile === undefined) delete process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
        else process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = previousChildPidFile
        await removeTempDir(tempDir)
      }
    },
  )

  test.serial(
    "close terminates ignored-stdio descendants",
    async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "opencorvus-sdk-server-descendant-close-"))
      const childPidFile = path.join(tempDir, "fake-child.pid")
      const previousCwd = process.cwd()
      const previousBinPath = process.env.OPENCORVUS_BIN_PATH
      const previousChildPidFile = process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
      let childPid: number | undefined
      let server: Awaited<ReturnType<typeof createOpenCorvusServer>> | undefined

      writeFileSync(
        path.join(tempDir, "serve"),
        [
          'const { spawn } = require("node:child_process")',
          'const fs = require("node:fs")',
          `const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore"] })`,
          "child.unref()",
          "fs.writeFileSync(process.env.OPENCORVUS_FAKE_CHILD_PID_FILE, String(child.pid))",
          'console.log("server listening on http://127.0.0.1:43210")',
          "setInterval(() => {}, 10_000)",
          "",
        ].join("\n"),
      )

      process.chdir(tempDir)
      process.env.OPENCORVUS_BIN_PATH = "node"
      process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = childPidFile

      try {
        server = await createOpenCorvusServer({ timeout: 2_000, port: 0 })
        childPid = await waitForPidFile(childPidFile, 2_000)

        await server.close()
        server = undefined
        expect(await waitForPidExit(childPid, 4_000)).toBe(true)
      } finally {
        await server?.close().catch(() => undefined)
        await killIfAlive(childPid)
        process.chdir(previousCwd)
        if (previousBinPath === undefined) delete process.env.OPENCORVUS_BIN_PATH
        else process.env.OPENCORVUS_BIN_PATH = previousBinPath
        if (previousChildPidFile === undefined) delete process.env.OPENCORVUS_FAKE_CHILD_PID_FILE
        else process.env.OPENCORVUS_FAKE_CHILD_PID_FILE = previousChildPidFile
        await removeTempDir(tempDir)
      }
    },
  )

  test.serial("Windows PowerShell cleanup delegate is bounded and stale PID tolerant", () => {
    const source = readFileSync(serverSourcePath, "utf8")

    expect(source).toContain("const WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS = 5_000")
    expect(source).toContain("PowerShell cleanup timed out after")
    expect(source).toContain("runner.kill()")
    expect(source).toContain("clearTimeout(timer)")
    expect(source).toContain("Stop-Process -Id $target -Force -ErrorAction SilentlyContinue")
    expect(source).not.toContain("Stop-Process -Id $target -Force -ErrorAction Stop")
  })
})
