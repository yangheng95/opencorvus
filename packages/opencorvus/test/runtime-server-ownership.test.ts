import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { ServeRuntimeMemoryMetrics } from "../src/runtime/memory-metrics"
import {
  RuntimeServerOwnership,
  RuntimeServerOwnershipConflictError,
  RuntimeServerOwnershipDatabaseMismatchError,
  RuntimeServerOwnershipHandoffPendingError,
  RuntimeServerOwnershipRecordInvalidError,
  RuntimeServerStartupCleanupPendingError,
} from "../src/server/runtime-server-ownership"
import { Server } from "../src/server/server"
import { RuntimeExecutionSettlement } from "../src/runtime/execution-settlement"
import { Database } from "../src/storage/db"
import { releaseServeRuntimeOwnership } from "../src/cli/cmd/serve"
import { acquireServerRuntimeAfterRecovery } from "../src/cli/server-runtime"
import { bootstrap } from "../src/cli/bootstrap"
import { restartFailureDisposition } from "../src/server/restart-handoff"
import { Scheduler } from "../src/scheduler"
import { SchedulerMessageTestHooks } from "../src/protocol/scheduler-message"
import { Instance } from "../src/project/instance"
import { InstanceBootstrap } from "../src/project/bootstrap"
import * as TaskRootIngressDelivery from "../src/engine/task-root-ingress-delivery"

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
  let errors = ""
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk) => (errors += String(chunk)))
  child.stdin.end()
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`ownership fixture exited ${code}: ${errors}`)),
    )
  })
  children.delete(child)
}

async function terminateUncleanly(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode === null) {
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()))
    child.kill("SIGKILL")
    await exited
  }
  children.delete(child)
}

describe("runtime server database ownership", () => {
  test("binds a listener only with ownership for the active canonical database", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-database-match-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const otherDatabase = path.join(root, "other.db")
    const otherOwnership = RuntimeServerOwnership.acquire({ database: otherDatabase })
    try {
      expect(() =>
        Server.listenWithOwnedRuntime({ hostname: "127.0.0.1", port: 0, randomPort: true }, otherOwnership),
      ).toThrow(RuntimeServerOwnershipDatabaseMismatchError)
      await RuntimeServerOwnership.releaseWithRetry(otherOwnership)
      const reusableOtherOwnership = RuntimeServerOwnership.acquire({ database: otherDatabase })
      expect(reusableOtherOwnership.owner.database).toBe(path.resolve(otherDatabase))
      reusableOtherOwnership.release()

      const matchingOwnership = RuntimeServerOwnership.acquire({ database: Database.Path() })
      const server = Server.listenWithOwnedRuntime(
        { hostname: "127.0.0.1", port: 0, randomPort: true },
        matchingOwnership,
      )
      expect(server.url).toBeInstanceOf(URL)
      await server.stop(true)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("treats invalid canonical and handoff records as authoritative typed failures", async () => {
    for (const kind of ["owner", "handoff"] as const) {
      const directory = await mkdtemp(path.join(os.tmpdir(), `opencorvus-runtime-invalid-${kind}-`))
      temporaryDirectories.push(directory)
      const database = path.join(directory, "project.db")
      const authorityFile =
        kind === "owner"
          ? RuntimeServerOwnership.TestHooks.ownerFile(database)
          : RuntimeServerOwnership.TestHooks.handoffFile(database)
      await writeFile(authorityFile, '{"pid":', "utf8")

      expect(() => RuntimeServerOwnership.acquire({ database })).toThrow(RuntimeServerOwnershipRecordInvalidError)
      expect(await readFile(authorityFile, "utf8")).toBe('{"pid":')
    }
  })

  test("retains a retryable owner and delays handoff commit until every release stage succeeds", async () => {
    for (const failure of ["filesystemLock", "ownerFileMove"] as const) {
      const directory = await mkdtemp(path.join(os.tmpdir(), `opencorvus-runtime-release-${failure}-`))
      temporaryDirectories.push(directory)
      const database = path.join(directory, "project.db")
      const owner = RuntimeServerOwnership.acquire({ database })
      const handoff: string[] = []
      using _failure = RuntimeServerOwnership.TestHooks.failNextRelease({ [failure]: 1 })

      await expect(
        RuntimeServerOwnership.releaseWithRetry(owner, () => handoff.push("committed"), { attempts: 1 }),
      ).rejects.toThrow(
        failure === "filesystemLock"
          ? "injected runtime filesystem lock release failure"
          : "injected runtime owner record move failure",
      )
      expect({ occurrenceID: RuntimeServerOwnership.currentOccurrenceID(database), handoff }).toEqual({
        occurrenceID: owner.owner.occurrenceID,
        handoff: [],
      })

      await RuntimeServerOwnership.releaseWithRetry(owner, () => handoff.push("committed"))
      const successor = RuntimeServerOwnership.acquire({ database })
      expect({ handoff, successor: successor.owner.occurrenceID }).toEqual({
        handoff: ["committed"],
        successor: expect.any(String),
      })
      successor.release()
    }

    const retryDirectory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-release-retry-"))
    temporaryDirectories.push(retryDirectory)
    const retryDatabase = path.join(retryDirectory, "project.db")
    const retryOwner = RuntimeServerOwnership.acquire({ database: retryDatabase })
    const retryHandoff: string[] = []
    using _transientFailure = RuntimeServerOwnership.TestHooks.failNextRelease({ filesystemLock: 1 })
    await RuntimeServerOwnership.releaseWithRetry(retryOwner, () => retryHandoff.push("committed"), {
      attempts: 2,
      delayMilliseconds: 1,
    })
    expect({ occurrenceID: RuntimeServerOwnership.currentOccurrenceID(retryDatabase), retryHandoff }).toEqual({
      occurrenceID: undefined,
      retryHandoff: ["committed"],
    })
  })

  test("blocks every process-local successor until an asynchronous afterRelease retry completes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-after-release-successor-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")
    const otherDatabase = path.join(directory, "other-project.db")
    const owner = RuntimeServerOwnership.acquire({ database })
    let rollbackCalls = 0
    let commitAttempts = 0

    await releaseServeRuntimeOwnership({
      database,
      occurrenceID: owner.owner.occurrenceID,
      releaseOwnership: (afterRelease) =>
        RuntimeServerOwnership.releaseWithRetry(owner, afterRelease, { attempts: 2, delayMilliseconds: 1 }),
      commit() {
        commitAttempts += 1
        expect(() => RuntimeServerOwnership.acquire({ database })).toThrow(RuntimeServerOwnershipConflictError)
        expect(() => RuntimeServerOwnership.acquire({ database: otherDatabase })).toThrow(
          RuntimeServerOwnershipConflictError,
        )
        if (commitAttempts === 1) {
          throw new Error("injected afterRelease failure after successor acquire")
        }
      },
      rollback() {
        rollbackCalls += 1
      },
    })

    const successor = RuntimeServerOwnership.acquire({ database: otherDatabase })
    expect({
      rollbackCalls,
      commitAttempts,
      current: RuntimeServerOwnership.currentOccurrenceID(otherDatabase),
    }).toEqual({
      rollbackCalls: 0,
      commitAttempts: 2,
      current: successor.owner.occurrenceID,
    })
    successor.release()
  })

  test("keeps the exact committed handoff pending after retry exhaustion and completes it without rollback", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-pending-handoff-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")
    const successorDatabase = path.join(directory, "successor.db")
    const owner = RuntimeServerOwnership.acquire({ database })
    let rollbackCalls = 0
    let commitAttempts = 0
    let commitCanComplete = false
    let pending: RuntimeServerOwnershipHandoffPendingError | undefined

    try {
      await releaseServeRuntimeOwnership({
        database,
        occurrenceID: owner.owner.occurrenceID,
        releaseOwnership: (afterRelease) =>
          RuntimeServerOwnership.releaseWithRetry(owner, afterRelease, { attempts: 3, delayMilliseconds: 1 }),
        commit() {
          commitAttempts += 1
          if (!commitCanComplete) throw new Error("injected persistent committed-handoff cleanup failure")
        },
        rollback() {
          rollbackCalls += 1
        },
      })
    } catch (error) {
      if (!(error instanceof RuntimeServerOwnershipHandoffPendingError)) throw error
      pending = error
    }

    expect({ rollbackCalls, commitAttempts, owner: RuntimeServerOwnership.currentOccurrenceID(database) }).toEqual({
      rollbackCalls: 0,
      commitAttempts: 3,
      owner: owner.owner.occurrenceID,
    })
    expect(restartFailureDisposition(pending)).toBe("remain-quiesced")
    expect(() => RuntimeServerOwnership.acquire({ database: successorDatabase })).toThrow(
      RuntimeServerOwnershipConflictError,
    )

    commitCanComplete = true
    await pending!.complete()
    const successor = RuntimeServerOwnership.acquire({ database: successorDatabase })
    expect({ commitAttempts, successor: RuntimeServerOwnership.currentOccurrenceID(successorDatabase) }).toEqual({
      commitAttempts: 4,
      successor: successor.owner.occurrenceID,
    })
    successor.release()
  })

  test("releases startup ownership after pre-listen recovery fails so a successor can acquire", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-prelisten-recovery-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let schedulerPolls = 0
    using _schedulerPoll = SchedulerMessageTestHooks.installBeforeGlobalPoll(() => {
      schedulerPolls += 1
    })
    try {
      await expect(
        acquireServerRuntimeAfterRecovery({
          recover: async () => {
            throw new Error("injected started Task recovery failure")
          },
          disposeInstances: () => Promise.resolve(),
        }),
      ).rejects.toThrow("injected started Task recovery failure")
      expect(schedulerPolls).toBe(0)

      const successor = RuntimeServerOwnership.acquire({ database: Database.Path() })
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(successor.owner.occurrenceID)
      successor.release()
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  })

  test("starts scheduler delivery polling only after process recovery completes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-scheduler-recovery-barrier-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let releaseRecovery!: () => void
    let markRecoveryEntered!: () => void
    const recoveryEntered = new Promise<void>((resolve) => (markRecoveryEntered = resolve))
    const recoveryRelease = new Promise<void>((resolve) => (releaseRecovery = resolve))
    let markPoll!: () => void
    const pollStarted = new Promise<void>((resolve) => (markPoll = resolve))
    let schedulerPolls = 0
    using _schedulerPoll = SchedulerMessageTestHooks.installBeforeGlobalPoll(() => {
      schedulerPolls += 1
      markPoll()
    })
    try {
      const runtime = acquireServerRuntimeAfterRecovery({
        recover: async () => {
          markRecoveryEntered()
          await recoveryRelease
        },
        disposeInstances: () => Promise.resolve(),
      })
      await recoveryEntered
      await Bun.sleep(25)
      expect(schedulerPolls).toBe(0)
      releaseRecovery()
      const acquired = await runtime
      await pollStarted
      expect(schedulerPolls).toBe(1)
      const server = Server.listenWithOwnedRuntime(
        { hostname: "127.0.0.1", port: 0, randomPort: true },
        acquired.ownership,
      )
      await Bun.sleep(25)
      expect({ schedulerPolls, listener: server.url instanceof URL }).toEqual({ schedulerPolls: 1, listener: true })
      await server.stop(true)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  })

  test("registers scheduler delivery polling for an ordinary non-retained listener", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-scheduler-direct-listener-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let markPoll!: () => void
    const pollStarted = new Promise<void>((resolve) => (markPoll = resolve))
    let schedulerPolls = 0
    using _schedulerPoll = SchedulerMessageTestHooks.installBeforeGlobalPoll(() => {
      schedulerPolls += 1
      markPoll()
    })
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    try {
      await pollStarted
      expect({ schedulerPolls, listener: server.url instanceof URL }).toEqual({ schedulerPolls: 1, listener: true })
    } finally {
      await server.stop(true)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

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
    // The stale mtime deliberately compromises proper-lockfile's heartbeat.
    // Once live-process authority is proven, terminate the fixture without
    // pretending that a deliberately compromised filesystem lock can release cleanly.
    await terminateUncleanly(owner)
  })

  test("a stale owner record with a reused PID does not block the new process instance", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-reused-pid-"))
    temporaryDirectories.push(directory)
    const database = path.join(directory, "project.db")
    const owner = startOwnershipProcess(database, "hold")
    await firstLine(owner)
    await terminateUncleanly(owner)

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
    const successor = startOwnershipProcess(String(serverOwned.database), "once")
    expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database: serverOwned.database } })
    await finish(successor)
  }, 90_000)

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
      RuntimeExecutionSettlement.reserve("task_control_activation", "stopped-runtime-settled").settle()

      successor = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      RuntimeExecutionSettlement.reserve("task_control_activation", "successor-runtime-recovery").settle()
      expect(successor.url).toBeInstanceOf(URL)
    } finally {
      if (successor) await successor.stop(true)
      if (owner) await owner.stop(true)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 90_000)

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

      const successor = startOwnershipProcess(Database.Path(), "once")
      expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database: Database.Path() } })
      await finish(successor)
    } finally {
      if (!gateReleased) gate[Symbol.dispose]()
      if (!stopped) await server.stop(true).catch(() => undefined)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 90_000)

  test("requests runtime cancellation before waiting for an active HTTP handler to settle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-stop-cancellation-order-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const events: string[] = []
    let requestStarted!: () => void
    const started = new Promise<void>((resolve) => (requestStarted = resolve))
    using _requestBarrier = Server.TestHooks.installBeforeRequest(async () => {
      const reservation = RuntimeExecutionSettlement.reserve("session_wake_loop", "active-http-handler")
      requestStarted()
      await new Promise<void>((resolve) => {
        reservation.onCancel(() => {
          events.push("cancellation_requested")
          resolve()
        })
      })
      reservation.settle()
      events.push("request_settled")
    })
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    try {
      const request = fetch(new URL("/global/health", server.url)).catch(() => undefined)
      await started
      await server.stop(true)
      await request
      events.push("stop_completed")
      expect(events).toEqual(["cancellation_requested", "request_settled", "stop_completed"])
    } finally {
      await server.stop(true).catch(() => undefined)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("rolls back the exact runtime settlement after listener quiesce fails and then retries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-stop-listener-retry-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const failure = Server.TestHooks.failNextListenerStop(1)
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const recoveryDirectories: string[][] = []
    const reconcileTaskControlAfterRuntimeRollback =
      TaskRootIngressDelivery.reconcileTaskControlAfterRuntimeRollback
    const recoverTaskIngresses = spyOn(
      TaskRootIngressDelivery,
      "reconcileTaskControlAfterRuntimeRollback",
    ).mockImplementation(async (directories) => {
      recoveryDirectories.push([...directories])
      await reconcileTaskControlAfterRuntimeRollback(directories)
    })
    try {
      await Instance.provide({ directory: project, init: InstanceBootstrap, fn: async () => undefined })
      await expect(server.stop(true)).rejects.toThrow("injected server listener stop failure")
      expect(recoveryDirectories).toEqual([[project]])
      failure[Symbol.dispose]()
      RuntimeExecutionSettlement.reserve("session_wake_loop", "listener-stop-rollback-admission").settle()
      await server.stop(true)
      const successor = RuntimeServerOwnership.acquire({ database: Database.Path() })
      successor.release()
    } finally {
      recoverTaskIngresses.mockRestore()
      failure[Symbol.dispose]()
      await server.stop(true).catch(() => undefined)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("restores a quiesced listener under the retained owner after persistent release failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-release-rollback-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    let restored = false
    try {
      const options = { hostname: "127.0.0.1", port: server.port!, randomPort: false }
      const transfer = Server.beginRuntimeTransfer(server)
      await transfer.quiesced
      const terminated = await Server.settleCurrentProcessExecution("injected retained-owner restore", {
        disposeInstances: () => Promise.resolve(),
      })
      using _failure = RuntimeServerOwnership.TestHooks.failNextRelease({ filesystemLock: 3 })
      await expect(transfer.releaseOwnership(() => terminated.releaseHandoff(true))).rejects.toThrow(
        "injected runtime filesystem lock release failure",
      )
      await terminated.releaseHandoff(false)

      server = transfer.restoreListener(options)
      restored = true
      expect({ port: server.port, ownership: RuntimeServerOwnership.currentOccurrenceID(Database.Path()) }).toEqual({
        port: options.port,
        ownership: expect.any(String),
      })
    } finally {
      if (restored) await server.stop(true)
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("preserves the operation failure and reuses the exact CLI owner after persistent release failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cli-release-rollback-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const retainedDatabase = Database.Path()
    const failure = RuntimeServerOwnership.TestHooks.failNextRelease({ ownerFileMove: 3 })
    const operationError = new Error("injected CLI operation failure before ownership release")
    try {
      await expect(
        bootstrap(project, async () => {
          throw operationError
        }),
      ).rejects.toMatchObject({
        name: "AggregateError",
        errors: [operationError, expect.objectContaining({ message: "injected runtime owner record move failure" })],
      })
      failure[Symbol.dispose]()
      const retainedOccurrence = RuntimeServerOwnership.currentOccurrenceID(retainedDatabase)
      const otherDatabase = path.join(root, "other.db")
      expect(() => RuntimeServerOwnership.acquire({ database: otherDatabase })).toThrow(
        RuntimeServerOwnershipConflictError,
      )
      expect(RuntimeServerOwnership.currentOccurrenceID(retainedDatabase)).toBe(retainedOccurrence)
      await expect(bootstrap(project, async () => "successor-result")).resolves.toBe("successor-result")
      const otherOwner = RuntimeServerOwnership.acquire({ database: otherDatabase })
      expect(otherOwner.owner.database).toBe(path.resolve(otherDatabase))
      otherOwner.release()
    } finally {
      failure[Symbol.dispose]()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("keeps exact CLI cleanup retryable until a failed ownership rollback completes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cli-release-rollback-retry-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const releaseFailure = RuntimeServerOwnership.TestHooks.failNextRelease({ ownerFileMove: 3 })
    const rollbackError = new Error("injected CLI ownership rollback failure")
    let rollbackAttempts = 0
    let retryStarted!: () => void
    const rollbackRetryStarted = new Promise<void>((resolve) => (retryStarted = resolve))
    let releaseRollbackRetry!: () => void
    const heldRollbackRetry = new Promise<void>((resolve) => (releaseRollbackRetry = resolve))
    const settlement = spyOn(Server, "settleCurrentProcessExecution").mockImplementation(async (_reason, options) => {
      await options?.disposeInstances?.()
      return {
        releaseHandoff: async (commit = true) => {
          if (commit) return
          rollbackAttempts += 1
          if (rollbackAttempts === 1) throw rollbackError
          retryStarted()
          await heldRollbackRetry
        },
      }
    })
    try {
      await expect(bootstrap(project, async () => "first-result")).rejects.toMatchObject({
        name: "AggregateError",
        errors: [expect.objectContaining({ message: "injected runtime owner record move failure" }), rollbackError],
      })
      const retainedOccurrence = RuntimeServerOwnership.currentOccurrenceID(Database.Path())
      expect(retainedOccurrence).toEqual(expect.any(String))
      releaseFailure[Symbol.dispose]()

      const successor = bootstrap(project, async () => "recovered-result")
      await rollbackRetryStarted
      let pendingCleanup: unknown
      try {
        RuntimeServerOwnership.acquire({ database: path.join(root, "contender.db") })
      } catch (error) {
        pendingCleanup = error
      }
      expect(pendingCleanup).toMatchObject({
        name: "RuntimeServerStartupCleanupPendingError",
        owner: { occurrenceID: retainedOccurrence },
      })

      releaseRollbackRetry()
      await expect(successor).resolves.toBe("recovered-result")
      expect(rollbackAttempts).toBe(2)
      const nextOwner = RuntimeServerOwnership.acquire({ database: path.join(root, "next.db") })
      nextOwner.release()
    } finally {
      releaseRollbackRetry()
      releaseFailure[Symbol.dispose]()
      settlement.mockRestore()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("awaits the in-process CLI handoff commit receipt before admitting a successor owner", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cli-delayed-commit-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let commitStarted!: () => void
    const started = new Promise<void>((resolve) => (commitStarted = resolve))
    let releaseCommit!: () => void
    const heldCommit = new Promise<void>((resolve) => (releaseCommit = resolve))
    const settlement = spyOn(Server, "settleCurrentProcessExecution").mockImplementation(async (_reason, options) => {
      await options?.disposeInstances?.()
      return {
        releaseHandoff: async (commit = true) => {
          if (!commit) return
          commitStarted()
          await heldCommit
        },
      }
    })
    const otherDatabase = path.join(root, "successor.db")
    try {
      const completion = bootstrap(project, async () => "delayed-commit-result")
      await started
      expect(() => RuntimeServerOwnership.acquire({ database: otherDatabase })).toThrow(
        RuntimeServerOwnershipConflictError,
      )

      releaseCommit()
      await expect(completion).resolves.toBe("delayed-commit-result")
      const successor = RuntimeServerOwnership.acquire({ database: otherDatabase })
      expect(successor.owner.database).toBe(path.resolve(otherDatabase))
      successor.release()
    } finally {
      releaseCommit()
      settlement.mockRestore()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

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
      await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      const successor = startOwnershipProcess(Database.Path(), "once")
      expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database: Database.Path() } })
      await finish(successor)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 90_000)

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
      await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      const successor = startOwnershipProcess(Database.Path(), "once")
      expect(await firstLine(successor)).toMatchObject({ status: "acquired", owner: { database: Database.Path() } })
      await finish(successor)
    } finally {
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 90_000)

  test("retains exact startup cleanup after persistent physical release failure until successor listen recovery", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-startup-physical-recovery-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const metrics = spyOn(ServeRuntimeMemoryMetrics, "register").mockImplementation(() => {
      throw new Error("injected startup failure before physical release")
    })
    const releaseFailure = RuntimeServerOwnership.TestHooks.failNextRelease({ ownerFileMove: 6 })
    try {
      expect(() => Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })).toThrow(
        "injected startup failure before physical release",
      )
      await expect(RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()).rejects.toThrow(
        "injected runtime owner record move failure",
      )
      let pending: RuntimeServerStartupCleanupPendingError | undefined
      try {
        Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      } catch (error) {
        if (!(error instanceof RuntimeServerStartupCleanupPendingError)) throw error
        pending = error
      }
      await expect(pending!.complete()).rejects.toThrow("injected runtime owner record move failure")

      releaseFailure[Symbol.dispose]()
      metrics.mockRestore()
      await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      const successor = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      await successor.stop(true)
    } finally {
      releaseFailure[Symbol.dispose]()
      metrics.mockRestore()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("retains exact startup commit cleanup after physical handoff until successor listen recovery", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-startup-commit-recovery-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    const metrics = spyOn(ServeRuntimeMemoryMetrics, "register").mockImplementation(() => {
      throw new Error("injected startup failure before committed handoff")
    })
    using _commitFailure = Server.TestHooks.failNextRuntimeHandoffCommit(3)
    try {
      expect(() => Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })).toThrow(
        "injected startup failure before committed handoff",
      )
      await expect(RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()).rejects.toBeInstanceOf(
        RuntimeServerOwnershipHandoffPendingError,
      )

      metrics.mockRestore()
      await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      const successor = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
      await successor.stop(true)
    } finally {
      metrics.mockRestore()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)
})
