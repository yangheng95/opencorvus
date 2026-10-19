import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { which, whichAsync } from "@/util/which"
import { Process } from "@/util/process"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { tmpdir } from "./fixture/fixture"

test("asynchronous executable discovery preserves PATH and extension order while yielding to queued work", async () => {
  await using root = await tmpdir()
  const directories = await Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      const directory = path.join(root.path, String(index))
      await fs.mkdir(directory)
      return directory
    }),
  )
  const command = `ordered-${randomUUID()}`
  const extensions = process.platform === "win32" ? [".CMD", ".EXE"] : [""]
  for (const directory of directories.slice(-2)) {
    for (const extension of extensions)
      await fs.writeFile(path.join(directory, command + extension), "owned executable", { mode: 0o755 })
  }
  const env = { PATH: directories.join(path.delimiter), PATHEXT: ".CMD;.EXE" }
  const order: string[] = []
  const queued = new Promise<void>((resolve) =>
    setImmediate(() => {
      order.push("queued work")
      resolve()
    }),
  )
  const resolved = await whichAsync(command, env)
  order.push("resolved")
  await queued
  expect({ resolved, synchronous: which(command, env), order }).toEqual({
    resolved: path.join(directories[6], command + extensions[0]),
    synchronous: path.join(directories[6], command + extensions[0]),
    order: ["queued work", "resolved"],
  })
})

test("executable discovery observes each current PATH and file location", async () => {
  await using root = await tmpdir()
  const first = path.join(root.path, "first"),
    second = path.join(root.path, "second")
  await fs.mkdir(first)
  await fs.mkdir(second)
  const command = `fresh-${randomUUID()}`
  const filename = command + (process.platform === "win32" ? ".EXE" : "")
  await fs.writeFile(path.join(first, filename), "owned executable", { mode: 0o755 })
  const initial = await whichAsync(command, { PATH: first, PATHEXT: ".EXE" })
  await fs.rename(path.join(first, filename), path.join(second, filename))
  const current = await whichAsync(command, { PATH: second, PATHEXT: ".EXE" })
  expect({ initial, current }).toEqual({ initial: path.join(first, filename), current: path.join(second, filename) })
})

test("the Windows command resolver returns its declared missing-executable error", async () => {
  if (process.platform !== "win32") return
  await using root = await tmpdir()
  const executable = `declared-missing-${randomUUID()}`
  const failure = await ProcessSupervisor.spawnHostCommand({
    executable,
    args: [],
    env: { PATH: root.path, PATHEXT: ".EXE" },
  }).catch((error: unknown) => error)
  expect(failure).toMatchObject({
    name: "Error",
    message: `Windows command executable "${executable}" was not found in PATH`,
  })
})

test("native Git resolves the current PATH and returns its fully settled output", async () => {
  await using root = await tmpdir()
  const git = await whichAsync("git")
  if (!git) throw new Error("Real Git is required for the executable discovery contract")
  const executable = path.basename(git)
  const env = { ...process.env, PATH: [root.path, path.dirname(git)].join(path.delimiter) }
  const requests: string[] = []
  const restore = ProcessSupervisor.setWindowsRequestObserverForTest((request) => {
    if (request.kind === "command" && typeof request.executable === "string") requests.push(request.executable)
  })
  try {
    const result = await Process.runHost([executable, "--version"], { exactEnv: env, inactivityTimeoutMs: 10_000 })
    expect({ code: result.code, output: result.stdout.toString().trim() }).toEqual({
      code: 0,
      output: expect.stringMatching(/^git version /),
    })
    if (process.platform === "win32") expect(requests).toEqual([git])
  } finally {
    restore()
  }
})
