import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { findLockedBuildBinaries } from "../script/build-binary-lock"

test("writable and absent build outputs yield an empty lock set and preserve bytes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oc-build-lock-"))
  try {
    const file = path.join(directory, "writable.exe")
    await fs.writeFile(file, "build-output")
    expect(await findLockedBuildBinaries([file, path.join(directory, "absent.exe")])).toEqual([])
    expect(await fs.readFile(file, "utf8")).toBe("build-output")
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test.skipIf(process.platform !== "win32")(
  "reports an exact Windows output held by an exclusive file owner",
  async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oc-build-lock-"))
    const file = path.join(directory, "locked.exe")
    await fs.writeFile(file, "held-output")
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$f = [System.IO.File]::Open($env:OC_TEST_LOCK_PATH, 'Open', 'ReadWrite', 'None'); try { [Console]::WriteLine('ready'); [Console]::In.ReadLine() | Out-Null } finally { $f.Dispose() }",
      ],
      { windowsHide: true, env: { ...process.env, OC_TEST_LOCK_PATH: file }, stdio: ["pipe", "pipe", "pipe"] },
    )
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("File lock owner did not become ready")), 10_000)
        child.once("error", (error) => {
          clearTimeout(timer)
          reject(error)
        })
        child.stdout.once("data", () => {
          clearTimeout(timer)
          resolve()
        })
      })
      expect(await findLockedBuildBinaries([file])).toEqual([file])
    } finally {
      child.stdin.end("\n")
      await exited
      await fs.rm(directory, { recursive: true, force: true })
    }
  },
  20_000,
)
