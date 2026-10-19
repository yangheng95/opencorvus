import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DurablePublicationStore, type DurablePublicationSubjectOwner } from "@opencorvus-ai/util/durable-publication"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("durable publication fact store", () => {
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
      expect(exitCode).not.toBe(0)

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
