/**
 * A Project runtime must keep serving while one lease is busy.
 *
 * Observed 2026-08-17: every request for one Project hung forever. Instrumented
 * lock state at the time:
 *
 *   waiters: write,read,read,read,read   readers: 1   writer: false
 *   holder A: read, released, stage "await-upgrade"
 *   holder B: read, holding,  stage "fn"
 *
 * Lease B was running its caller's `fn` under a read lease. Lease A still owed
 * context preparation, and the old `upgradeLease` unshifted its write to the
 * head of the queue — where it could never be granted, because B still counted
 * as a reader. One busy handler took the whole Project down: no timeout, no
 * log, health still green, graceful shutdown blocked behind it.
 *
 * The mode lattice that made this constructible is gone. The runtime now has
 * two primitives: a per-Project exclusive FIFO tail (creation, init, refresh,
 * rollback, dispose) and refcounted serving handles. Serving never holds the
 * tail, so a busy caller `fn` can never block initialization, other serving
 * admissions, or shutdown. Only teardown (refresh, dispose) waits for serving
 * to drain, gates new admissions while it waits, and excuses its own ambient
 * chain so nested provide/dispose/refresh stay live.
 */
import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { symlink } from "node:fs/promises"
import { createManagedTemporaryDirectory } from "@opencorvus-ai/util/runtime-directories"
import { Instance, InstanceTestHooks } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectDirectoryAdmission } from "@/project/directory-admission"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function fixtureDirectory(prefix: string) {
  declareNativeTaskProcessDeployment()
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Project instance tests require the repository test preload")
  return await createManagedTemporaryDirectory(path.join(processRoot, "fixtures"), prefix)
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

function withDeadline<T>(operation: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label} did not settle within ${milliseconds}ms`)),
        milliseconds,
      )
      timer.unref?.()
    }),
  ])
}

test("admits every concurrent first admission while one of them holds a long caller function", async () => {
  const directory = await fixtureDirectory("instance-lock-liveness-")
  const admissionCount = 5
  const entered: string[] = []
  const releaseAll = deferred()
  const everyoneEntered = deferred()

  // All admissions race on an entry that still owes preparation. Exactly one
  // performs it on the exclusive tail; the rest are satisfied by that same
  // work and must be let through. Serving happens off the tail, so the first
  // admission running its long `fn` cannot block the other four.
  const admissions = Array.from({ length: admissionCount }, (_, index) =>
    Instance.provide({
      directory,
      fn: async () => {
        entered.push(`admission-${index}`)
        if (entered.length === admissionCount) everyoneEntered.resolve()
        await releaseAll.promise
        return Instance.project.id
      },
    }),
  )

  try {
    await withDeadline(everyoneEntered.promise, 20_000, "concurrent Project admissions")
  } finally {
    releaseAll.resolve()
  }

  const ids = await Promise.all(admissions)
  expect(entered).toHaveLength(admissionCount)
  expect(new Set(ids).size).toBe(1)
})

test("runs a new initializer to completion while another serving lease stays busy", async () => {
  const directory = await fixtureDirectory("instance-init-liveness-")
  const busyEntered = deferred()
  const releaseBusy = deferred()

  await Instance.provide({ directory, fn: () => Instance.project.id })

  const busy = Instance.provide({
    directory,
    fn: async () => {
      busyEntered.resolve()
      await releaseBusy.promise
      return "busy"
    },
  })
  await busyEntered.promise

  try {
    // Under the mode lattice this admission needed a write lease, which could
    // not be granted while the busy reader served — the request could only
    // fail by timeout. Initialization now runs on the exclusive tail, which a
    // serving handle never holds, so the admission completes while the busy
    // caller is still inside its `fn`.
    let initializerRuns = 0
    const admitted = await withDeadline(
      Instance.provide({
        directory,
        init: async () => {
          initializerRuns += 1
        },
        fn: () => Instance.project.id,
      }),
      20_000,
      "initializer-bearing admission while another lease serves",
    )
    expect(initializerRuns).toBe(1)
    expect(admitted).toBeTruthy()
  } finally {
    releaseBusy.resolve()
    await busy
  }
})

test("performs newly-required exclusive preparation from the queue without head-jumping", async () => {
  const directory = await fixtureDirectory("instance-refresh-stale-")
  // Initialize the entry so a later plain admission expects to serve directly.
  await Instance.provide({ directory, fn: () => Instance.project.id })

  // Hold the exclusive tail so the admission has to queue. While it waits,
  // turn the directory into a git repository: at its turn the entry suddenly
  // owes a full project refresh. The old code upgraded a read lease in place —
  // the exact head-jump that stalled a whole Project behind one long reader.
  // The admission must now perform that refresh in its own FIFO turn and then
  // serve the refreshed context.
  const held = await InstanceTestHooks.acquireCacheWriteLock(directory)
  const admission = Instance.provide({
    directory,
    fn: () => ({ projectID: Instance.project.id, git: Instance.current()?.git }),
  })
  await Bun.spawn(["git", "init"], { cwd: directory, stdout: "ignore", stderr: "ignore" }).exited
  held[Symbol.dispose]()

  const result = await withDeadline(admission, 30_000, "queued Project admission with stale preparation")
  expect(result.git).toBe(true)
  expect(result.projectID).toBeTruthy()
})

test("runs one shared initializer exactly once across concurrent first admissions", async () => {
  const directory = await fixtureDirectory("instance-init-once-")
  let initializerRuns = 0
  const init = async () => {
    initializerRuns += 1
    await Promise.resolve()
  }

  const results = await withDeadline(
    Promise.all(
      Array.from({ length: 6 }, () =>
        Instance.provide({
          directory,
          init,
          fn: () => Instance.project.id,
        }),
      ),
    ),
    20_000,
    "concurrent admissions sharing one initializer",
  )

  expect(initializerRuns).toBe(1)
  expect(new Set(results).size).toBe(1)
})

test("commits two disjoint Project registrations captured before either enters the shared queue", async () => {
  const firstDirectory = await fixtureDirectory("project-registration-first-")
  const secondDirectory = await fixtureDirectory("project-registration-second-")
  const bothCaptured = deferred()
  const release = deferred()
  let captured = 0
  using _capture = ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(async () => {
    captured += 1
    if (captured === 2) bothCaptured.resolve()
    await release.promise
  })

  const first = Instance.provide({ directory: firstDirectory, fn: () => Instance.project.id })
  const second = Instance.provide({ directory: secondDirectory, fn: () => Instance.project.id })
  try {
    await withDeadline(bothCaptured.promise, 20_000, "disjoint Project physical captures")
  } finally {
    release.resolve()
  }

  const projectIDs = await withDeadline(Promise.all([first, second]), 30_000, "disjoint Project registrations")
  const listedProjectIDs = Project.list().map((project) => project.id)
  expect(new Set(projectIDs).size).toBe(2)
  expect(projectIDs.every((projectID) => listedProjectIDs.includes(projectID))).toBe(true)
})

test("admits one physical Project owner when two aliases capture before the shared queue", async () => {
  const directory = await fixtureDirectory("project-registration-physical-")
  const alias = `${directory}-alias`
  await symlink(directory, alias, process.platform === "win32" ? "junction" : "dir")
  const bothCaptured = deferred()
  const release = deferred()
  let captured = 0
  using _capture = ProjectDirectoryAdmission.TestHooks.installBeforeAcquire(async () => {
    captured += 1
    if (captured === 2) bothCaptured.resolve()
    await release.promise
  })

  const original = Instance.provide({ directory, fn: () => Instance.project.id })
  const aliased = Instance.provide({ directory: alias, fn: () => Instance.project.id })
  try {
    await withDeadline(bothCaptured.promise, 20_000, "aliased Project physical captures")
  } finally {
    release.resolve()
  }

  const outcomes = await withDeadline(
    Promise.allSettled([original, aliased]),
    30_000,
    "aliased Project registration settlement",
  )
  const accepted = outcomes.filter((outcome) => outcome.status === "fulfilled")
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected")
  expect({ accepted: accepted.length, rejected: rejected.length }).toEqual({ accepted: 1, rejected: 1 })
  expect(rejected[0]?.reason).toBeInstanceOf(Project.RegisteredDirectoryConflictError)
  expect(Project.list().map((project) => project.id)).toContain(accepted[0]?.value)
})

test("prepares a nested same-key provide with a new initializer while another lease serves", async () => {
  const directory = await fixtureDirectory("instance-nested-reentry-")
  const busyEntered = deferred()
  const releaseBusy = deferred()

  await Instance.provide({ directory, fn: () => Instance.project.id })

  const busy = Instance.provide({
    directory,
    fn: async () => {
      busyEntered.resolve()
      await releaseBusy.promise
      return "busy"
    },
  })
  await busyEntered.promise

  try {
    // The nested provide inherits its caller's serving handle and still owes a
    // new initializer. Its ambient chain is excused from any serving-drain
    // wait, and initialization never drains serving at all, so the nested call
    // must complete while the unrelated busy lease keeps serving.
    let nestedInitializerRuns = 0
    const nested = await withDeadline(
      Instance.provide({
        directory,
        fn: () =>
          Instance.provide({
            directory,
            init: async () => {
              nestedInitializerRuns += 1
            },
            fn: () => Instance.project.id,
          }),
      }),
      20_000,
      "nested same-key provide with a new initializer",
    )
    expect(nestedInitializerRuns).toBe(1)
    expect(nested).toBeTruthy()
  } finally {
    releaseBusy.resolve()
    await busy
  }
})

test("settles concurrent open, dispose, and serve on one Project without deadlock", async () => {
  const directory = await fixtureDirectory("instance-dispose-recreate-")
  const busyEntered = deferred()
  const releaseBusy = deferred()

  const firstID = await Instance.provide({ directory, fn: () => Instance.project.id })

  const busy = Instance.provide({
    directory,
    fn: async () => {
      busyEntered.resolve()
      await releaseBusy.promise
      return "busy-complete"
    },
  })
  await busyEntered.promise

  // Ambient dispose waits for the busy serving handle to drain while its own
  // chain is excused. The late admission may serve the old instance or queue
  // behind the teardown and recreate — both are legal; what must never happen
  // is a hang.
  const disposal = Instance.provide({
    directory,
    fn: async () => {
      await Instance.dispose()
      return "disposed"
    },
  })
  await sleep(50)
  const late = Instance.provide({ directory, fn: () => Instance.project.id })
  await sleep(25)
  releaseBusy.resolve()

  expect(await withDeadline(busy, 20_000, "busy serving lease")).toBe("busy-complete")
  expect(await withDeadline(disposal, 20_000, "ambient disposal behind a busy lease")).toBe("disposed")
  expect(await withDeadline(late, 20_000, "admission issued during pending disposal")).toBe(firstID)

  const recreated = await withDeadline(
    Instance.provide({ directory, fn: () => Instance.project.id }),
    20_000,
    "admission after disposal",
  )
  expect(recreated).toBe(firstID)
})

test("completes a pending disposal under a continuous admission stream", async () => {
  const directory = await fixtureDirectory("instance-dispose-starvation-")
  const busyEntered = deferred()
  const releaseBusy = deferred()

  const firstID = await Instance.provide({ directory, fn: () => Instance.project.id })

  const busy = Instance.provide({
    directory,
    fn: async () => {
      busyEntered.resolve()
      await releaseBusy.promise
      return "busy"
    },
  })
  await busyEntered.promise

  const disposal = Instance.provide({
    directory,
    fn: async () => {
      await Instance.dispose()
      return "disposed"
    },
  })
  await sleep(50)

  // A teardown that merely waited for the serving count to reach zero would
  // starve here: every few milliseconds a fresh admission arrives. The pending
  // teardown must gate admissions that arrive after it, drain the ones before
  // it, and complete.
  let disposalSettled = false
  const disposalOutcome = disposal.finally(() => {
    disposalSettled = true
  })
  const stream: Promise<string>[] = []
  const pump = (async () => {
    while (!disposalSettled && stream.length < 400) {
      stream.push(Instance.provide({ directory, fn: () => Instance.project.id }))
      await sleep(5)
    }
  })()
  await sleep(25)
  releaseBusy.resolve()

  expect(await withDeadline(disposalOutcome, 20_000, "disposal under an admission stream")).toBe("disposed")
  await busy
  await pump
  const streamed = await withDeadline(Promise.all(stream), 20_000, "streamed admissions around a disposal")
  expect(streamed.length).toBeGreaterThan(0)
  expect(streamed.every((id) => id === firstID)).toBe(true)
})
