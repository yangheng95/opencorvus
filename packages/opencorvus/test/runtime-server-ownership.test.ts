import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { ServeRuntimeMemoryMetrics } from "../src/runtime/memory-metrics"
import { RuntimeServerOwnershipConflictError } from "../src/server/runtime-server-ownership"
import { Server } from "../src/server/server"

const temporaryDirectories: string[] = []
const children = new Set<ChildProcessWithoutNullStreams>()

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode !== null) continue
    child.stdin.end()
    await new Promise<void>((resolve) => child.once("exit", () => resolve()))
  }
  children.clear()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function startOwnershipProcess(database: string, mode: "hold" | "stale-hold" | "once") {
  const fixture = path.join(import.meta.dir, "fixtures", "runtime-server-ownership-process.ts")
  const child = spawn(process.execPath, [fixture, database, mode], { stdio: ["pipe", "pipe", "pipe"] })
  children.add(child)
  return child
}

function startRuntimeEntryProcess(home: string, project: string, mode: "server-hold" | "bootstrap-once") {
  const fixture = path.join(import.meta.dir, "fixtures", "runtime-entry-ownership-process.ts")
  const child = spawn(process.execPath, [fixture, mode, project], {
    env: { ...process.env, OPENCORVUS_TEST_HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  })
  children.add(child)
  return child
}

async function firstLine(child: ChildProcessWithoutNullStreams): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let output = ""
    let errors = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => (errors += String(chunk)))
    child.stdout.on("data", (chunk) => {
      output += String(chunk)
      const newline = output.indexOf("\n")
      if (newline >= 0) resolve(JSON.parse(output.slice(0, newline)) as Record<string, unknown>)
    })
    child.once("error", reject)
    child.once("exit", (code) => {
      if (!output.includes("\n")) reject(new Error(`ownership fixture exited ${code}: ${errors}`))
    })
  })
}

async function finish(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) {
    children.delete(child)
    if (child.exitCode !== 0) throw new Error(`ownership fixture exited ${child.exitCode}`)
    return
  }
  child.stdin.end()
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ownership fixture exited ${code}`))))
  })
  children.delete(child)
}

describe("runtime server database ownership", () => {
  test("one backend owns a project database and a successor acquires it after handoff", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-owner-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")

    const owner = startOwnershipProcess(database, "hold")
    const acquired = await firstLine(owner)
    expect(acquired).toMatchObject({ status: "acquired", owner: { database } })

    const concurrent = startOwnershipProcess(database, "once")
    const conflict = await firstLine(concurrent)
    expect(conflict).toMatchObject({
      status: "conflict",
      existing: { database, pid: (acquired.owner as { pid: number }).pid },
    })
    await finish(concurrent)

    await finish(owner)
    const successor = startOwnershipProcess(database, "once")
    expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database } })
    await finish(successor)
  })

  test("a live owner remains authoritative when its filesystem heartbeat appears stale", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-stale-owner-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")

    const owner = startOwnershipProcess(database, "stale-hold")
    const acquired = await firstLine(owner)
    const contender = startOwnershipProcess(database, "once")
    expect(await firstLine(contender)).toMatchObject({
      status: "conflict",
      existing: { database, pid: (acquired.owner as { pid: number }).pid },
    })
    await finish(contender)
    await finish(owner)
  })

  test("a stale owner record with a reused PID does not block the new process instance", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-reused-pid-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")
    const owner = startOwnershipProcess(database, "hold")
    await firstLine(owner)
    owner.kill()
    await new Promise<void>((resolve) => owner.once("exit", () => resolve()))
    children.delete(owner)

    const entries = await readdir(directory, { withFileTypes: true })
    const ownerEntry = entries.find((entry) => entry.isFile() && entry.name.endsWith(".owner"))
    const lockEntry = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".owner.lock"))
    if (!ownerEntry || !lockEntry) throw new Error("Crashed ownership fixture did not leave its owner evidence")
    const ownerFile = path.join(directory, ownerEntry.name)
    const recorded = JSON.parse(await readFile(ownerFile, "utf8")) as Record<string, unknown>
    await writeFile(ownerFile, JSON.stringify({ ...recorded, pid: process.pid, processInstanceID: "stale-instance" }))
    const stale = new Date(Date.now() - 20_000)
    await utimes(path.join(directory, lockEntry.name), stale, stale)

    const successor = startOwnershipProcess(database, "once")
    expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database } })
    await finish(successor)
  })

  test("the public server and in-process CLI bootstrap share one database runtime owner", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-entry-owner-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })

    const server = startRuntimeEntryProcess(home, project, "server-hold")
    const serverOwned = await firstLine(server)
    expect(serverOwned).toMatchObject({ status: "server-owned", database: expect.any(String) })

    const contender = startRuntimeEntryProcess(home, project, "bootstrap-once")
    expect(await firstLine(contender)).toMatchObject({
      status: "conflict",
      database: serverOwned.database,
    })
    await finish(contender)

    await finish(server)
    const successor = startRuntimeEntryProcess(home, project, "bootstrap-once")
    expect(await firstLine(successor)).toMatchObject({ status: "bootstrap-owned", database: serverOwned.database })
    await finish(successor)
  }, 20_000)

  test("a second public server in the same process conflicts until the first runtime stops", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-same-process-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let owner: ReturnType<typeof Server.listen> | undefined
    let successor: ReturnType<typeof Server.listen> | undefined
    try {
      owner = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      expect(() => Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })).toThrow(
        RuntimeServerOwnershipConflictError,
      )
      await owner.stop(true)
      owner = undefined

      successor = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      expect(successor.url).toBeInstanceOf(URL)
    } finally {
      if (successor) await successor.stop(true)
      if (owner) await owner.stop(true)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 20_000)

  test("concurrent public server stops share one settlement before ownership handoff", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-concurrent-stop-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const gate = await ProcessSupervisor.acquireRuntimeMandatorySettlementGate()
    let gateReleased = false
    let stopped = false
    try {
      const firstStop = server.stop(true)
      const joinedStop = server.stop(true)
      expect(joinedStop).toBe(firstStop)

      const contender = startRuntimeEntryProcess(home, project, "bootstrap-once")
      expect(await firstLine(contender)).toMatchObject({ status: "conflict" })
      await finish(contender)

      gate[Symbol.dispose]()
      gateReleased = true
      await Promise.all([firstStop, joinedStop])
      stopped = true

      const successor = startRuntimeEntryProcess(home, project, "bootstrap-once")
      expect(await firstLine(successor)).toMatchObject({ status: "bootstrap-owned" })
      await finish(successor)
    } finally {
      if (!gateReleased) gate[Symbol.dispose]()
      if (!stopped) await server.stop(true).catch(() => undefined)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 20_000)

  test("pre-bind listen failure retains ownership until runtime settlement finishes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-prebind-failure-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const gate = await ProcessSupervisor.acquireRuntimeMandatorySettlementGate()
    try {
      try {
        expect(() => Server.listen({ hostname: "127.0.0.1", port: 1, randomPort: true })).toThrow(
          "randomPort=true requires port=0",
        )
        const contender = startRuntimeEntryProcess(home, project, "bootstrap-once")
        expect(await firstLine(contender)).toMatchObject({ status: "conflict" })
        await finish(contender)
      } finally {
        gate[Symbol.dispose]()
      }
      await Bun.sleep(100)
      const successor = startRuntimeEntryProcess(home, project, "bootstrap-once")
      expect(await firstLine(successor)).toMatchObject({ status: "bootstrap-owned" })
      await finish(successor)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 20_000)

  test("listen initialization failure retains ownership until runtime settlement finishes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-startup-failure-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const gate = await ProcessSupervisor.acquireRuntimeMandatorySettlementGate()
    const metrics = spyOn(ServeRuntimeMemoryMetrics, "register").mockImplementation(() => {
      throw new Error("injected post-bind initialization failure")
    })
    try {
      try {
        expect(() => Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })).toThrow(
          "injected post-bind initialization failure",
        )
        const contender = startRuntimeEntryProcess(home, project, "bootstrap-once")
        expect(await firstLine(contender)).toMatchObject({ status: "conflict" })
        await finish(contender)
      } finally {
        metrics.mockRestore()
        gate[Symbol.dispose]()
      }
      await Bun.sleep(100)
      const successor = startRuntimeEntryProcess(home, project, "bootstrap-once")
      expect(await firstLine(successor)).toMatchObject({ status: "bootstrap-owned" })
      await finish(successor)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 30_000)
})
