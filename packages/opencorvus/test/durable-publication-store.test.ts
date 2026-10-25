import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AsyncLocalStorage } from "node:async_hooks"
import {
  DurablePublicationStore,
  setDurablePublicationTestCutHook,
  type DurablePublicationSubjectOwner,
} from "@opencorvus-ai/util/durable-publication"

const roots: string[] = []

afterEach(async () => {
  setDurablePublicationTestCutHook()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("durable publication fact store", () => {
  test("an independent subject callback queues and reads its predecessor's committed value", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-independent-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const file = path.join(root, "current-value.txt")
    const events: string[] = []
    const queued = Promise.withResolvers<void>()
    let detached!: Promise<{ value: string; current: boolean }>
    const timeout = setTimeout(() => queued.reject(new Error("Independent subject admission did not queue")), 15000)
    try {
      const parent = await store.withSubjectLock("independent-publication", "owner:current", async () => {
        events.push("parent-owned")
        await writeFile(file, "parent-committed")
        setDurablePublicationTestCutHook((point, kind) => {
          if (point !== "subject-queued" || kind !== "independent-publication") return
          events.push("independent-queued")
          queued.resolve()
        })
        detached = DurablePublicationStore.runOutsideSubjectOwners(() =>
          store.withSubjectLock("independent-publication", "owner:current", async (owner) => {
            events.push("independent-owned")
            return { value: await readFile(file, "utf8"), current: owner.isCurrent() }
          }),
        )
        await queued.promise
        events.push("parent-completed")
        return "parent-committed"
      })
      expect({ parent, detached: await detached, events }).toEqual({
        parent: "parent-committed",
        detached: { value: "parent-committed", current: true },
        events: ["parent-owned", "independent-queued", "parent-completed", "independent-owned"],
      })
    } finally {
      clearTimeout(timeout)
      if (detached) await Promise.allSettled([detached])
    }
  })

  test("physical subject callbacks enter in their accepted admission order", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-admission-"))
    roots.push(parent)
    const root = path.join(parent, "store"),
      alias = path.join(parent, "alias")
    await mkdir(root)
    await symlink(root, alias, process.platform === "win32" ? "junction" : "dir")
    const stores = [
      new DurablePublicationStore(root),
      new DurablePublicationStore(`${root}${path.sep}`),
      new DurablePublicationStore(alias),
    ]
    const context = new AsyncLocalStorage<number>()
    const entered = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>()
    const queued = Array.from({ length: 12 }, () => Promise.withResolvers<void>())
    const accepted: number[] = [],
      callbacks: number[] = []
    const requests: Promise<{ index: number; current: boolean }>[] = []
    const holder = stores[0]!.withSubjectLock("test-publication", "admission:order", async () => {
      entered.resolve()
      await release.promise
    })
    await entered.promise
    setDurablePublicationTestCutHook((point, kind) => {
      const index = context.getStore()
      if (point !== "subject-queued" || kind !== "test-publication" || index === undefined) return
      accepted.push(index)
      queued[index]!.resolve()
    })
    try {
      for (let index = 0; index < queued.length; index++) {
        requests.push(
          context.run(index, () =>
            stores[index % stores.length]!.withSubjectLock("test-publication", "admission:order", async (owner) => {
              callbacks.push(index)
              return { index, current: owner.isCurrent() }
            }),
          ),
        )
        await queued[index]!.promise
      }
      release.resolve()
      const values = await Promise.all(requests)
      expect(callbacks).toEqual(accepted)
      expect(values).toEqual(queued.map((_, index) => ({ index, current: true })))
    } finally {
      release.resolve()
      await Promise.allSettled([holder, ...requests])
    }
  })

  for (const stage of ["preparation", "callback"] as const) {
    test(`a ${stage} failure settles the preceding admission before its successor owns the subject`, async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-admission-error-"))
      roots.push(root)
      const store = new DurablePublicationStore(root),
        context = new AsyncLocalStorage<string>()
      const entered = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>()
      const failureQueued = Promise.withResolvers<void>(),
        nextQueued = Promise.withResolvers<void>()
      const failure = new Error(`declared ${stage} failure`),
        events: string[] = []
      const pending: Promise<unknown>[] = []
      const holder = store.withSubjectLock("test-publication", "admission:error", async () => {
        events.push("first-owned")
        entered.resolve()
        await release.promise
        events.push("first-settled")
      })
      pending.push(holder)
      await entered.promise
      setDurablePublicationTestCutHook((point, kind) => {
        if (point !== "subject-queued" || kind !== "test-publication") return
        if (context.getStore() === "failed") {
          failureQueued.resolve()
          if (stage === "preparation") throw failure
        }
        if (context.getStore() === "next") nextQueued.resolve()
      })
      try {
        const rejected = context
          .run("failed", () =>
            store.withSubjectLock("test-publication", "admission:error", async () => {
              events.push("failed-owned")
              throw failure
            }),
          )
          .catch((error) => error)
        pending.push(rejected)
        await failureQueued.promise
        const next = context.run("next", () =>
          store.withSubjectLock("test-publication", "admission:error", async (owner) => {
            events.push("next-owned")
            return { generation: "next", current: owner.isCurrent() }
          }),
        )
        pending.push(next)
        await nextQueued.promise
        release.resolve()
        expect(await rejected).toBe(failure)
        expect(await next).toEqual({ generation: "next", current: true })
        expect(events).toEqual(
          stage === "preparation"
            ? ["first-owned", "first-settled", "next-owned"]
            : ["first-owned", "first-settled", "failed-owned", "next-owned"],
        )
      } finally {
        release.resolve()
        await Promise.allSettled(pending)
      }
    })
  }

  test("different subjects finish their own owner while the original subject remains admitted", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-independent-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const entered = Promise.withResolvers<void>(),
      release = Promise.withResolvers<void>()
    const events: string[] = []
    const holder = store.withSubjectLock("test-publication", "admission:first", async (owner) => {
      events.push("first-owned")
      entered.resolve()
      await release.promise
      events.push(`first-settled:${owner.isCurrent()}`)
    })
    await entered.promise
    try {
      const independent = await store.withSubjectLock("test-publication", "admission:independent", async (owner) => {
        events.push("independent-owned")
        return { subject: "independent", current: owner.isCurrent() }
      })
      expect(independent).toEqual({ subject: "independent", current: true })
    } finally {
      release.resolve()
      await holder
    }
    expect(events).toEqual(["first-owned", "independent-owned", "first-settled:true"])
  })

  test("subject owner observations follow the original active lease through nested callbacks and retirement", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-owner-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const states: string[] = []
    let original!: DurablePublicationSubjectOwner
    await store.withSubjectLock("test-publication", "owner:current", async (owner) => {
      original = owner
      states.push(owner.isCurrent() ? "outer-owned" : "outer-retired")
      await store.withSubjectLock("test-publication", "owner:current", async (nested) => {
        states.push(nested.isCurrent() && owner.isCurrent() ? "nested-owned" : "nested-retired")
      })
      states.push(owner.isCurrent() ? "ancestor-owned" : "ancestor-retired")
    })
    states.push(original.isCurrent() ? "outside-owned" : "outside-retired")
    await store.withSubjectLock("test-publication", "owner:current", async (next) => {
      states.push(original.isCurrent() ? "previous-owned" : "previous-retired")
      states.push(next.isCurrent() ? "next-owned" : "next-retired")
    })
    expect(states).toEqual([
      "outer-owned",
      "nested-owned",
      "ancestor-owned",
      "outside-retired",
      "previous-retired",
      "next-owned",
    ])
  })

  test("an accepted nested subject callback settles its value before the next owner enters", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-child-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    let generation = 1
    let child!: Promise<{ generation: number; owner: string }>
    const parent = store.withSubjectLock("test-publication", "child:current", async () => {
      child = store.withSubjectLock("test-publication", "child:current", async (owner) => {
        entered.resolve()
        await release.promise
        return { generation, owner: owner.isCurrent() ? "current" : "retired" }
      })
      await entered.promise
      return "parent-current"
    })
    await entered.promise
    const next = store.withSubjectLock("test-publication", "child:current", async () => ++generation)
    await Bun.sleep(50)
    release.resolve()
    const [parentValue, childValue, nextValue] = await Promise.all([parent, child, next])
    expect({ parent: parentValue, child: childValue, next: nextValue }).toEqual({
      parent: "parent-current",
      child: { generation: 1, owner: "current" },
      next: 2,
    })
  })

  test("an inherited subject lease queues again after its outer owner releases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-lease-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const events: string[] = []
    let startDescendant!: () => void
    const descendantStart = new Promise<void>((resolve) => (startDescendant = resolve))
    let descendantRequested!: () => void
    const requested = new Promise<void>((resolve) => (descendantRequested = resolve))
    let releaseOwner!: () => void
    const ownerRelease = new Promise<void>((resolve) => (releaseOwner = resolve))
    let ownerStarted!: () => void
    const started = new Promise<void>((resolve) => (ownerStarted = resolve))
    let descendant!: Promise<void>

    await store.withSubjectLock("test-publication", "lease:test", async () => {
      events.push("outer")
      descendant = (async () => {
        await descendantStart
        events.push("descendant-request")
        descendantRequested()
        await store.withSubjectLock("test-publication", "lease:test", async () => {
          events.push("descendant-enter")
        })
      })()
    })

    const owner = store.withSubjectLock("test-publication", "lease:test", async () => {
      events.push("owner-enter")
      ownerStarted()
      await ownerRelease
      events.push("owner-release")
    })
    await started
    startDescendant()
    await requested
    releaseOwner()
    await Promise.all([owner, descendant])

    expect(events).toEqual(["outer", "owner-enter", "descendant-request", "owner-release", "descendant-enter"])
  })

  test("subject leases remain isolated across durable publication roots", async () => {
    const [rootA, rootB] = await Promise.all([
      mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-root-a-")),
      mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-root-b-")),
    ])
    roots.push(rootA, rootB)
    const storeA = new DurablePublicationStore(rootA)
    const storeB = new DurablePublicationStore(rootB)
    const events: string[] = []
    let releaseB!: () => void
    const bRelease = new Promise<void>((resolve) => (releaseB = resolve))
    let bStarted!: () => void
    const started = new Promise<void>((resolve) => (bStarted = resolve))
    let nestedRequested!: () => void
    const requested = new Promise<void>((resolve) => (nestedRequested = resolve))

    const ownerB = storeB.withSubjectLock("test-publication", "cross-root:test", async () => {
      events.push("b-owner-enter")
      bStarted()
      await bRelease
      events.push("b-owner-release")
    })
    await started
    const nested = storeA.withSubjectLock("test-publication", "cross-root:test", async () => {
      events.push("a-enter")
      const attempt = storeB.withSubjectLock("test-publication", "cross-root:test", async () => {
        events.push("b-nested-enter")
      })
      events.push("b-nested-request")
      nestedRequested()
      await attempt
    })
    await requested
    releaseB()
    await Promise.all([ownerB, nested])

    expect(events).toEqual(["b-owner-enter", "a-enter", "b-nested-request", "b-owner-release", "b-nested-enter"])
  })

  test("alternate spellings of one root compete on the same subject lock", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-same-root-"))
    roots.push(root)
    const canonical = new DurablePublicationStore(root)
    const alternate = new DurablePublicationStore(`${root}${path.sep}`)
    const events: string[] = []
    let releaseOwner!: () => void
    const ownerRelease = new Promise<void>((resolve) => (releaseOwner = resolve))
    let ownerStarted!: () => void
    const started = new Promise<void>((resolve) => (ownerStarted = resolve))
    let contenderRequested!: () => void
    const requested = new Promise<void>((resolve) => (contenderRequested = resolve))

    const owner = canonical.withSubjectLock("test-publication", "same-root:test", async () => {
      events.push("owner-enter")
      ownerStarted()
      await ownerRelease
      events.push("owner-release")
    })
    await started
    const contender = (async () => {
      events.push("contender-request")
      contenderRequested()
      await alternate.withSubjectLock("test-publication", "same-root:test", async () => {
        events.push("contender-enter")
      })
    })()
    await requested
    releaseOwner()
    await Promise.all([owner, contender])

    expect(events).toEqual(["owner-enter", "contender-request", "owner-release", "contender-enter"])
  })

  test("reloads one immutable intent, ordered phases and terminal receipt", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const occurrenceID = crypto.randomUUID()

    await store.create({
      occurrenceID,
      kind: "test-publication",
      subject: "catalog:test",
      payload: { target: "generation-a" },
      timeCreated: 1,
    })
    await store.appendPhase("test-publication", {
      occurrenceID,
      sequence: 1,
      name: "prepared",
      payload: { digest: "a".repeat(64) },
      timeCreated: 2,
    })
    await store.appendPhase("test-publication", {
      occurrenceID,
      sequence: 2,
      name: "published",
      payload: { generation: "generation-a" },
      timeCreated: 3,
    })
    await store.settle("test-publication", {
      occurrenceID,
      outcome: "committed",
      payload: { generation: "generation-a" },
      timeCreated: 4,
    })

    const reloaded = await new DurablePublicationStore(root).read("test-publication", occurrenceID)
    expect({
      subject: reloaded.intent.subject,
      phases: reloaded.phases.map((phase) => [phase.sequence, phase.name]),
      terminal: reloaded.terminal,
      open: await store.listOpen("test-publication"),
    }).toEqual({
      subject: "catalog:test",
      phases: [
        [1, "prepared"],
        [2, "published"],
      ],
      terminal: {
        schemaVersion: 1,
        occurrenceID,
        outcome: "committed",
        payload: { generation: "generation-a" },
        timeCreated: 4,
      },
      open: [],
    })
  })

  test("a killed writer leaves only a complete old or new intent, phase and terminal fact", async () => {
    const fixture = path.join(import.meta.dir, "fixture", "durable-publication-child.ts")
    const cases = [
      ["intent", "occurrence-staging-created", 0, false],
      ["intent", "intent-temp-synced", 0, false],
      ["intent", "occurrence-published", 0, false],
      ["phase", "phase-temp-synced", 0, false],
      ["phase", "phase-published", 1, false],
      ["terminal", "terminal-temp-synced", 1, false],
      ["terminal", "terminal-published", 1, true],
    ] as const

    for (const [action, cut, expectedPhases, expectedTerminal] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), `opencorvus-publication-crash-${action}-`))
      roots.push(root)
      const child = Bun.spawn([process.execPath, fixture, root, action, cut], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      const exitCode = await child.exited
      expect(process.platform === "win32" ? { exitCode } : { signal: child.signalCode }).toEqual(
        process.platform === "win32" ? { exitCode: 1 } : { signal: "SIGKILL" },
      )
      expect(JSON.parse(await readFile(path.join(root, "cut-observed.json"), "utf8"))).toEqual({ action, cut })

      const store = new DurablePublicationStore(root)
      const listed = await store.list("test-publication")
      if (action === "intent" && expectedPhases === 0 && !expectedTerminal) {
        expect(listed.length).toBe(cut === "occurrence-published" ? 1 : 0)
        if (listed.length === 0) continue
      }
      const occurrence = await store.read("test-publication", "occurrence-crash-proof")
      expect({ phases: occurrence.phases.length, terminal: Boolean(occurrence.terminal) }).toEqual({
        phases: expectedPhases,
        terminal: expectedTerminal,
      })
    }
  }, 60_000)
})
