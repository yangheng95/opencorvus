import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { EXECUTION_CAPSULE_FILE_WORKER_SOURCE } from "../src/execution-capsule/file-worker-source"
import { WINDOWS_WSL_DISTRIBUTION, windowsWslExecutablesAvailable } from "./fixture/linux-runtime"

const fileWorkerTest =
  process.platform === "linux" ||
  (process.platform === "win32" && windowsWslExecutablesAvailable(["/usr/local/bin/node"]))
    ? test
    : test.skip

const linuxPath = (value: string) =>
  value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`)

async function invoke(root: string, operation: string, args: unknown[]) {
  const workerRoot = process.platform === "win32" ? linuxPath(root) : root
  const workerArgs = args.map((value) =>
    process.platform === "win32" && typeof value === "string" && path.isAbsolute(value) ? linuxPath(value) : value,
  )
  const command =
    process.platform === "win32"
      ? ["wsl.exe", "-d", "Ubuntu-24.04", "--exec", "/usr/local/bin/node", "-e", EXECUTION_CAPSULE_FILE_WORKER_SOURCE, workerRoot]
      : ["node", "-e", EXECUTION_CAPSULE_FILE_WORKER_SOURCE, workerRoot]
  const child = Bun.spawn(command, {
    cwd: root,
    env: process.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  child.stdin.write(JSON.stringify({ operation, args: workerArgs }))
  child.stdin.end()
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, response: JSON.parse(stdout), stderr }
}

describe("Task Execution Capsule file worker", () => {
  fileWorkerTest("reads and writes through the exact workspace root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-capsule-files-"))
    const target = path.join(root, "result.txt")
    const sourceDirectory = path.join(root, "source")
    const copiedDirectory = path.join(root, "copied")
    await mkdir(sourceDirectory)
    await writeFile(path.join(sourceDirectory, "nested.txt"), "anchored-copy")
    const write = await invoke(root, "writeFile", [target, { __bytes: Buffer.from("capsule").toString("base64") }])
    const copy = await invoke(root, "cp", [sourceDirectory, copiedDirectory, { recursive: true }])
    expect({
      exitCode: write.exitCode,
      response: write.response,
      bytes: await readFile(target, "utf8"),
      copyExitCode: copy.exitCode,
      copyResponse: copy.response,
      copiedBytes: await readFile(path.join(copiedDirectory, "nested.txt"), "utf8"),
    }).toEqual({
      exitCode: 0,
      response: { ok: true },
      bytes: "capsule",
      copyExitCode: 0,
      copyResponse: { ok: true },
      copiedBytes: "anchored-copy",
    })
  })
})
