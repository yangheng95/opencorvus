import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { TaskControlDriver } from "@/engine/task-control-driver"
import {
  reconcileTaskControlPlane,
  readTaskRootIngressEvidence,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { acceptTaskRootIngressInTransaction, projectTaskRootIngress } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { taskRootIngressWakeInstant } from "@/engine/task-root-ingress-reducer"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function waitUntil(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`)
    await Bun.sleep(1)
  }
}

/** Commit one exact decision receipt for the activated ingress. */
async function commitDecision(input: {
  projectPath: string
  orchestratorSessionID: string
  taskID: string
  wakeID: string
  activationID: string
  predecessorID: string
}) {
  const control = currentOrchestratorControlMessage(
    { note: input.wakeID },
    input.taskID,
    input.wakeID,
    input.predecessorID,
  )
  if (!control) throw new Error("Expected an Orchestrator control occurrence")
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: input.orchestratorSessionID,
      role: "user",
      author: "orchestrator",
      time: { created: Date.now() },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: input.orchestratorSessionID,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      } satisfies Message.TextPart,
    ],
  })
  let assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: input.orchestratorSessionID,
    parentID: control.messageID,
    role: "assistant",
    author: "orchestrator",
    time: { created: Date.now() },
    agent: "orchestrator",
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "tool-calls",
    activationID: input.activationID,
  })
  const stateInput = { action: "inspect" }
  const request = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.orchestratorSessionID,
    messageID: assistant.id,
    type: "tool",
    callID: `call_${input.wakeID}`,
    tool: "manage_task",
    state: { status: "running", input: stateInput, time: { start: Date.now() } },
  })
  await Session.updatePart({
    ...request,
    state: {
      status: "completed",
      input: stateInput,
      output: "decision committed",
      title: "Manage Task",
      metadata: {},
      time: { start: request.state.time.start, end: Date.now() },
    },
  })
  assistant = await Session.updateMessage({ ...assistant, time: { ...assistant.time, completed: Date.now() } })
  return { finalMessageID: assistant.id }
}

describe("Task-control liveness", () => {
  test("activates an ingress accepted while the FIFO head held a live activation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Liveness root" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Liveness scheduler",
        })
        const now = Date.now()
        const first = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Lost wakeup",
              request: "Deliver a worker completion accepted during a live activation",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.liveness" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "dispatch-workers",
            inlinePayload: { note: "dispatch parallel workers" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now: now + 1,
          })
        })

        const activatedIngresses: string[] = []
        const blockedRequests: number[] = []
        let second: { id: string } | undefined
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID, activationID, predecessorID }) => {
            if (!wakeID || !activationID || !predecessorID) throw new Error("Missing exact activation identity")
            activatedIngresses.push(wakeID)
            if (wakeID === first.id) {
              // A worker Session reaches its terminal lifecycle event while the
              // Task-root head still holds this activation. Acceptance runs, and
              // the blocked concurrent reconciler finds the head leased.
              second = Database.immediateTransaction((db) =>
                acceptTaskRootIngressInTransaction(db, {
                  taskID,
                  executionEpoch: 1,
                  source: "inline",
                  sourceID: "worker-completed",
                  inlinePayload: { note: "worker completed" },
                  semanticTurnLimit: 3,
                  activationLimit: 4,
                  now: Date.now(),
                }),
              )
              blockedRequests.push(await reconcileTaskControlPlane(taskID))
            }
            return commitDecision({
              projectPath: project.path,
              orchestratorSessionID: orchestrator.id,
              taskID,
              wakeID,
              activationID,
              predecessorID,
            })
          },
        })

        const activated = await reconcileTaskControlPlane(taskID)
        expect({
          activated,
          blockedRequests,
          activatedIngresses,
          firstProjection: projectTaskRootIngress(first.id, Date.now(), readTaskRootIngressEvidence).state,
          secondProjection: projectTaskRootIngress(second!.id, Date.now(), readTaskRootIngressEvidence).state,
        }).toEqual({
          activated: 2,
          blockedRequests: [0],
          activatedIngresses: [first.id, second!.id],
          firstProjection: "resolved",
          secondProjection: "resolved",
        })
      },
    })
  })
})

describe("Task-control compaction coexistence", () => {
  test("a compaction summary under the control occurrence does not refuse the activation assistant", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Compaction coexistence root" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Compaction coexistence scheduler",
        })
        const now = Date.now()
        const ingress = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Compaction coexistence",
              request: "Survive a compaction summary landing under the live control occurrence",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.compaction" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "compaction-coexistence",
            inlinePayload: { note: "wake with compaction" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now: now + 1,
          })
        })

        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID, activationID, predecessorID }) => {
            if (!wakeID || !activationID || !predecessorID) throw new Error("Missing exact activation identity")
            // Reproduce the incident interleaving: the control occurrence is
            // written, then the Session compacts and parents its summary
            // assistant — author "compaction", no activationID — under that
            // same control Message, and only then does the real activation
            // assistant append. The fence must refuse a second *turn*, not a
            // system-authored summary.
            const control = currentOrchestratorControlMessage({ note: wakeID }, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected an Orchestrator control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: orchestrator.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: orchestrator.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: orchestrator.id,
              parentID: control.messageID,
              role: "assistant",
              author: "compaction",
              time: { created: Date.now(), completed: Date.now() },
              agent: "compaction",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "stop",
            })
            return commitDecision({
              projectPath: project.path,
              orchestratorSessionID: orchestrator.id,
              taskID,
              wakeID,
              activationID,
              predecessorID,
            })
          },
        })

        const activated = await reconcileTaskControlPlane(taskID)
        expect({
          activated,
          projection: projectTaskRootIngress(ingress.id, Date.now(), readTaskRootIngressEvidence).state,
        }).toEqual({ activated: 1, projection: "resolved" })
      },
    })
  })
})

describe("Task-control driver", () => {
  test("re-scans until the revision it observed is current", async () => {
    const scans: number[] = []
    let pending = 2
    const driver = new TaskControlDriver({
      scan: async (taskID) => {
        scans.push(scans.length)
        if (pending > 0) {
          pending -= 1
          void driver.request(taskID)
        }
        return { activated: 1 }
      },
      setTimer: () => ({ cancel() {} }),
    })
    expect({ activated: await driver.request("task-a"), passes: scans.length }).toEqual({ activated: 3, passes: 3 })
    driver.dispose()
  })

  test("records demand without joining a running scan", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let scans = 0
    const driver = new TaskControlDriver({
      scan: async () => {
        scans += 1
        if (scans === 1) await gate
        return { activated: 0 }
      },
      setTimer: () => ({ cancel() {} }),
    })
    const owner = driver.request("task-a")
    const reentrant = await driver.request("task-a")
    release()
    await owner
    expect({ reentrant, scans }).toEqual({ reentrant: 0, scans: 2 })
    driver.dispose()
  })

  test("bounds concurrent scans while completing every distinct Mission request", async () => {
    let active = 0
    let maximumActive = 0
    const entered: string[] = []
    const releases: Array<() => void> = []
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 2,
      scan: async (missionID) => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        entered.push(missionID)
        await new Promise<void>((resolve) => {
          releases.push(() => {
            active -= 1
            resolve()
          })
        })
        return { activated: 1 }
      },
      setTimer: () => ({ cancel() {} }),
    })
    const missionIDs = Array.from({ length: 9 }, (_, index) => `mission-${index}`)
    const requests = missionIDs.map((missionID) => driver.request(missionID))

    await waitUntil(() => entered.length === 2, "the first bounded Mission scan set")
    expect({ entered: [...entered], maximumActive }).toEqual({
      entered: ["mission-0", "mission-1"],
      maximumActive: 2,
    })
    while (entered.length < missionIDs.length) {
      releases.shift()!()
      const expected = entered.length + 1
      await waitUntil(() => entered.length === expected, `Mission scan ${expected}`)
    }
    while (releases.length > 0) releases.shift()!()

    expect({ outcomes: await Promise.all(requests), entered, maximumActive }).toEqual({
      outcomes: missionIDs.map(() => 1),
      entered: missionIDs,
      maximumActive: 2,
    })
    driver.dispose()
  })

  test("bounds admitted Mission scans and retires level-triggered candidate entries", async () => {
    const entered: string[] = []
    const releases: Array<() => void> = []
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 2,
      maximumPendingScans: 2,
      retireSettledEntries: true,
      scan: async (missionID) => {
        entered.push(missionID)
        await new Promise<void>((resolve) => releases.push(resolve))
        return { activated: 1 }
      },
      setTimer: () => ({ cancel() {} }),
    })
    const requests = Array.from({ length: 7 }, (_, index) => driver.request(`mission-bounded-${index}`))

    await waitUntil(() => entered.length === 2, "the active bounded Mission page")
    const admittedSnapshot = driver.snapshot()
    while (entered.length < 4) {
      releases.shift()!()
      const expected = entered.length + 1
      await waitUntil(() => entered.length === expected, `admitted Mission scan ${expected}`)
    }
    while (releases.length > 0) releases.shift()!()

    expect({
      admittedTaskIDs: admittedSnapshot.map((entry) => entry.taskID),
      outcomes: await Promise.all(requests),
      entered,
      settledSnapshot: driver.snapshot(),
    }).toEqual({
      admittedTaskIDs: [
        "mission-bounded-0",
        "mission-bounded-1",
        "mission-bounded-2",
        "mission-bounded-3",
      ],
      outcomes: [1, 1, 1, 1, 0, 0, 0],
      entered: ["mission-bounded-0", "mission-bounded-1", "mission-bounded-2", "mission-bounded-3"],
      settledSnapshot: [],
    })
    driver.dispose()
  })

  test("shares one concurrency bound across heartbeat and deadline requests", async () => {
    type Timer = { delay: number; fire: () => void; cancelled: boolean }
    const timers: Timer[] = []
    const entered: string[] = []
    const releases: Array<() => void> = []
    let active = 0
    let maximumActive = 0
    let block = false
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 1,
      scan: async (missionID) => {
        if (!block) return { activated: 0, wakeAt: 100 }
        active += 1
        maximumActive = Math.max(maximumActive, active)
        entered.push(missionID)
        await new Promise<void>((resolve) => {
          releases.push(() => {
            active -= 1
            resolve()
          })
        })
        return { activated: 0 }
      },
      liveTasks: () => ["mission-heartbeat-a", "mission-heartbeat-b"],
      heartbeatMilliseconds: 5_000,
      minimumWakeDelayMilliseconds: 25,
      maximumWakeDelayMilliseconds: 5_000,
      now: () => 0,
      setTimer: (fn, delay) => {
        const timer: Timer = { delay, fire: fn, cancelled: false }
        timers.push(timer)
        return {
          cancel() {
            timer.cancelled = true
          },
        }
      },
    })
    await driver.request("mission-deadline")
    const heartbeat = timers.find((timer) => timer.delay === 5_000 && !timer.cancelled)
    const deadline = timers.find((timer) => timer.delay === 100 && !timer.cancelled)
    if (!heartbeat || !deadline) throw new Error("Expected heartbeat and Mission deadline timers")

    block = true
    heartbeat.fire()
    deadline.fire()
    await waitUntil(() => entered.length === 1, "the first timer-driven Mission scan")
    while (entered.length < 3) {
      releases.shift()!()
      const expected = entered.length + 1
      await waitUntil(() => entered.length === expected, `timer-driven Mission scan ${expected}`)
    }
    while (releases.length > 0) releases.shift()!()
    await waitUntil(() => active === 0, "timer-driven Mission scans to settle")

    expect({ entered: entered.toSorted(), maximumActive }).toEqual({
      entered: ["mission-deadline", "mission-heartbeat-a", "mission-heartbeat-b"],
      maximumActive: 1,
    })
    driver.dispose()
  })

  test("settles queued requests with the disposed driver result", async () => {
    let releaseOwner!: () => void
    const ownerHeld = new Promise<void>((resolve) => (releaseOwner = resolve))
    const entered: string[] = []
    const driver = new TaskControlDriver({
      maximumConcurrentScans: 1,
      scan: async (missionID) => {
        entered.push(missionID)
        await ownerHeld
        return { activated: 1, wakeAt: 1_000 }
      },
      now: () => 0,
      setTimer: () => ({ cancel() {} }),
    })
    const owner = driver.request("mission-owner")
    await waitUntil(() => entered.length === 1, "the Mission scan owner")
    const queued = driver.request("mission-queued")
    driver.dispose()

    releaseOwner()
    expect({ owner: await owner, queued: await queued, snapshot: driver.snapshot() }).toEqual({
      owner: 1,
      queued: 0,
      snapshot: [],
    })
  })

  test("re-arms one timer at the earliest instant a projection can change", async () => {
    const timers: number[] = []
    let clock = 1_000
    const driver = new TaskControlDriver({
      scan: async () => ({ activated: 0, wakeAt: clock + 5_000 }),
      now: () => clock,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    await driver.request("task-a")
    expect(timers).toEqual([5_000])
    driver.dispose()
  })

  test("paces a faulting Task under backoff and isolates it from its siblings", async () => {
    const timers: number[] = []
    const driver = new TaskControlDriver({
      scan: async (taskID) => {
        if (taskID === "task-bad") throw new Error("scan fault")
        return { activated: 1 }
      },
      initialBackoffMilliseconds: 100,
      maximumBackoffMilliseconds: 400,
      now: () => 0,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    const propagated: string[] = []
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await driver.request("task-bad", { propagateFailure: true }).catch((error) => {
        propagated.push((error as Error).message)
      })
    }
    expect({
      propagated,
      timers,
      sibling: await driver.request("task-good"),
    }).toEqual({
      propagated: ["scan fault", "scan fault", "scan fault"],
      timers: [100, 200, 400],
      sibling: 1,
    })
    driver.dispose()
  })

  test("paces a scan that stops reducing under backoff instead of spinning", async () => {
    const timers: number[] = []
    const driver = new TaskControlDriver({
      scan: async () => ({ activated: 0, noProgress: true }),
      initialBackoffMilliseconds: 100,
      maximumBackoffMilliseconds: 400,
      now: () => 0,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    for (let attempt = 0; attempt < 3; attempt += 1) await driver.request("task-stuck")
    expect(timers).toEqual([100, 200, 400])
    driver.dispose()
  })

  test("paces an unsettled fixpoint under backoff instead of re-arming at the minimum delay", async () => {
    const timers: number[] = []
    let clock = 0
    // A scan whose own effects always enqueue more demand: the revision is
    // never current when the pass ends, so the fixpoint cannot settle.
    const driver = new TaskControlDriver({
      scan: async (taskID) => {
        void driver.request(taskID)
        return { activated: 1 }
      },
      maxPasses: 3,
      initialBackoffMilliseconds: 100,
      maximumBackoffMilliseconds: 400,
      minimumWakeDelayMilliseconds: 25,
      now: () => clock,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    for (let attempt = 0; attempt < 3; attempt += 1) await driver.request("task-hot")
    // 25 here would mean three full scans every 25ms, forever.
    expect(timers).toEqual([100, 200, 400])
    driver.dispose()
  })

  test("keeps the earliest wake a pass reported when a later pass reports none", async () => {
    const orders: Record<string, number[]> = {}
    for (const order of ["wake-then-silent", "silent-then-wake"]) {
      const timers: number[] = []
      let pass = 0
      const driver = new TaskControlDriver({
        scan: async (taskID) => {
          pass += 1
          if (pass === 1) void driver.request(taskID)
          const wake = order === "wake-then-silent" ? pass === 1 : pass === 2
          return { activated: 0, ...(wake ? { wakeAt: 1_500 } : {}) }
        },
        now: () => 0,
        setTimer: (_fn, delay) => {
          timers.push(delay)
          return { cancel() {} }
        },
      })
      await driver.request("task-a")
      orders[order] = timers
      driver.dispose()
    }
    // A pass that reports no wake means "nothing further from me", not
    // "cancel the lease expiry an earlier pass already owed".
    expect(orders).toEqual({ "wake-then-silent": [1_500], "silent-then-wake": [1_500] })
  })

  test("escalates backoff for a Task that alternates faults with progress", async () => {
    const timers: number[] = []
    let clock = 0
    let attempt = 0
    const driver = new TaskControlDriver({
      scan: async () => {
        attempt += 1
        if (attempt % 2 === 1) throw new Error("intermittent fault")
        return { activated: 0 }
      },
      initialBackoffMilliseconds: 100,
      maximumBackoffMilliseconds: 400,
      now: () => clock,
      setTimer: (_fn, delay) => {
        timers.push(delay)
        return { cancel() {} }
      },
    })
    for (let round = 0; round < 6; round += 1) {
      await driver.request("task-flaky")
      clock += 10
    }
    const escalating = [...timers]
    // A fault-free window as long as the maximum backoff forgives the history.
    clock += 400
    attempt = 0
    await driver.request("task-flaky")
    expect({ escalating, afterQuietWindow: timers.at(-1) }).toEqual({
      escalating: [100, 200, 400],
      afterQuietWindow: 100,
    })
    driver.dispose()
  })

  test("sweeps live Tasks on the heartbeat so a missing edge cannot stall one", async () => {
    const scanned: string[] = []
    let fire: (() => void) | undefined
    const driver = new TaskControlDriver({
      scan: async (taskID) => {
        scanned.push(taskID)
        return { activated: 0 }
      },
      liveTasks: () => ["task-a", "task-b"],
      heartbeatMilliseconds: 5_000,
      setTimer: (fn, delay) => {
        // Only the heartbeat arms at its own period here; settled scans in this
        // test report no wake instant at all.
        if (delay === 5_000 && !fire) fire = fn
        return { cancel() {} }
      },
    })
    expect(fire).toBeDefined()
    fire!()
    await Promise.resolve()
    await Promise.resolve()
    expect(scanned.toSorted()).toEqual(["task-a", "task-b"])
    driver.dispose()
  })

  test("cancels the heartbeat timer during disposal", () => {
    const cancelled: number[] = []
    const driver = new TaskControlDriver({
      scan: async () => ({ activated: 0 }),
      liveTasks: () => ["task-a"],
      heartbeatMilliseconds: 5_000,
      setTimer: (_fn, delay) => ({
        cancel() {
          cancelled.push(delay)
        },
      }),
    })
    driver.dispose()
    expect(cancelled).toEqual([5_000])
  })

  test("derives the wake instant from the time-dependent projections only", () => {
    expect({
      leased: taskRootIngressWakeInstant({
        state: "leased",
        activationID: "act",
        ownerOccurrenceID: "own",
        expiresAt: 500,
      }),
      waiting: taskRootIngressWakeInstant({ state: "waiting", interactionID: "int", resumeAt: 700 }),
      blocking: taskRootIngressWakeInstant({ state: "waiting", interactionID: "int" }),
      ready: taskRootIngressWakeInstant({ state: "ready" }),
      deadline: taskRootIngressWakeInstant({ state: "ready" }, 900),
      resolved: taskRootIngressWakeInstant({ state: "resolved", decisionIDs: ["d"] }, 900),
    }).toEqual({
      leased: 500,
      waiting: 700,
      blocking: undefined,
      ready: undefined,
      deadline: 900,
      resolved: undefined,
    })
  })
})
