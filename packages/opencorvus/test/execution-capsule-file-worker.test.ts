import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import { EXECUTION_CAPSULE_FILE_WORKER_SOURCE } from "../src/execution-capsule/file-worker-source"
import { WINDOWS_WSL_DISTRIBUTION, windowsWslExecutablesAvailable } from "./fixture/linux-runtime"

const fileWorkerTest = windowsWslExecutablesAvailable(["/usr/local/bin/node"]) ? test : test.skip

const linuxPath = (value: string) =>
  value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`)

async function createEscapingSymlink(target: string, link: string) {
  if (process.platform !== "win32") return symlink(target, link)
  const result = Bun.spawnSync([
    "wsl.exe",
    "-d",
    WINDOWS_WSL_DISTRIBUTION,
    "--exec",
    "/bin/ln",
    "-s",
    linuxPath(target),
    linuxPath(link),
  ])
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || "WSL symlink creation failed")
}

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

  fileWorkerTest("returns the typed exact-root error for an outside path and an escaping symlink", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-capsule-root-"))
    const outside = await mkdtemp(path.join(os.tmpdir(), "opencorvus-capsule-outside-"))
    const outsideFile = path.join(outside, "secret.txt")
    await writeFile(outsideFile, "secret")
    const link = path.join(root, "outside-link")
    await createEscapingSymlink(outsideFile, link)
    const direct = await invoke(root, "readFile", [outsideFile])
    const linked = await invoke(root, "readFile", [link])
    const expectedOutside = process.platform === "win32" ? outsideFile.replaceAll("\\", "/").replace(/^C:/i, "/mnt/c") : outsideFile
    const expectedLink = process.platform === "win32" ? link.replaceAll("\\", "/").replace(/^C:/i, "/mnt/c") : link
    expect([direct, linked].map((result) => ({ exitCode: result.exitCode, error: result.response.error }))).toEqual([
      {
        exitCode: 1,
        error: {
          name: "Error",
          message: expect.stringContaining("outside exact Capsule root"),
          code: "EACCES",
          path: expectedOutside,
          syscall: "capsule_path",
        },
      },
      {
        exitCode: 1,
        error: {
          name: "Error",
          message: expect.stringContaining("outside exact Capsule root"),
          code: "EACCES",
          path: expectedLink,
          syscall: "capsule_path",
        },
      },
    ])
  })
})
