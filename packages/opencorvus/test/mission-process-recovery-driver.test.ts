import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { missionProcessRecoveryFrontierDigest } from "@/session/mission-process-recovery-schema"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"

type WorkerMode =
  | "live-owner"
  | "writeahead-blocked"
  | "recovery-run"
  | "close-route"
  | "delete-route-blocked"
  | "host-driver"

function fixture(label: string) {
  const root = mkdtempSync(path.join(tmpdir(), `opencorvus-mission-recovery-${label}-`))
  const home = path.join(root, "home")
  const projectPath = path.join(root, "project")
  const barrier = path.join(root, "barrier")
  mkdirSync(home, { recursive: true })
  mkdirSync(projectPath, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
  return { root, home, projectPath, barrier, databasePath: path.join(home, "data", "opencorvus.db") }
}

function startWorker(
  mode: WorkerMode,
  input: ReturnType<typeof fixture>,
  apiURL: string,
  options: { label?: string; deadlineMilliseconds?: number; callerAbortMilliseconds?: number } = {},
) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
      path.join(import.meta.dir, "fixture", "mission-process-recovery-driver-worker.ts"),
      mode,
      input.projectPath,
      input.barrier,
      apiURL,
      options.label ?? "first",
      String(options.deadlineMilliseconds ?? 0),
      String(options.callerAbortMilliseconds ?? 0),
    ],
    {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: { ...process.env, OPENCORVUS_HOME: input.home },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  return {
    child,
    stdout: new Response(child.stdout).text(),
    stderr: new Response(child.stderr).text(),
  }
}

async function finishWorker(started: ReturnType<typeof startWorker>, mode: WorkerMode) {
  const [exitCode, stdout, stderr] = await Promise.all([started.child.exited, started.stdout, started.stderr])
  if (exitCode !== 0) throw new Error(`Mission ${mode} worker failed (${exitCode}): ${stderr || stdout}`)
  return stdout
}

async function waitForFile(file: string, started: ReturnType<typeof startWorker>): Promise<void> {
  const deadline = Date.now() + 45_000
  while (!fs.existsSync(file)) {
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Mission worker exited before ${file}: STDERR=${stderr}\nSTDOUT=${stdout}`)
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`)
    await Bun.sleep(10)
  }
}

async function waitForProviderRequests(
  provider: ReturnType<typeof startControlledStreamingProvider>,
  count: number,
  started: ReturnType<typeof startWorker>,
) {
  const deadline = Date.now() + 45_000
  while (provider.promptRequests().length < count) {
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Mission worker exited before Provider request ${count}: ${stderr || stdout}`)
    }
    if (Date.now() >= deadline) {
      started.child.kill()
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr, started.child.exited])
      throw new Error(`Timed out waiting for Provider request ${count}: STDERR=${stderr}\nSTDOUT=${stdout}`)
    }
    await Bun.sleep(10)
  }
}

function recoveryFacts(databasePath: string, sessionID: string) {
  const sqlite = new SQLite(databasePath, { readonly: true })
  try {
    return {
      wakes: sqlite
        .query<{ id: string; data: string }, [string]>(
          `SELECT id,data FROM message WHERE session_id=?
           AND json_extract(data,'$.role')='user'
           AND json_extract(data,'$.extra.wake_reason.source')='mission.process_recovery'
           ORDER BY time_created,id`,
        )
        .all(sessionID)
        .map((row) => ({ id: row.id, data: JSON.parse(row.data) })),
      controls: sqlite
        .query<
          { id: string },
          [string]
        >(`SELECT id FROM session_control_record WHERE session_id=? AND source='mission.process_recovery'`)
        .all(sessionID),
      owners: sqlite
        .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM session_prompt_owner WHERE session_id=?")
        .get(sessionID)!.count,
      incompleteAssistants: sqlite
        .query<{ count: number }, [string]>(
          `SELECT COUNT(*) AS count FROM message WHERE session_id=?
           AND json_extract(data,'$.role')='assistant'
           AND json_extract(data,'$.time.completed') IS NULL`,
        )
        .get(sessionID)!.count,
      recoveryReplies: sqlite
        .query<{ id: string; data: string }, [string]>(
          `SELECT reply.id,reply.data
           FROM message AS reply
           INNER JOIN message AS wake
             ON wake.id=json_extract(reply.data,'$.parentID')
            AND wake.session_id=reply.session_id
           WHERE reply.session_id=?
             AND json_extract(reply.data,'$.role')='assistant'
             AND json_extract(reply.data,'$.time.completed') IS NOT NULL
             AND json_extract(wake.data,'$.extra.wake_reason.source')='mission.process_recovery'
           ORDER BY reply.time_created,reply.id`,
        )
        .all(sessionID)
        .map((row) => ({ id: row.id, data: JSON.parse(row.data) })),
    }
  } finally {
    sqlite.close()
  }
}

function deleteRetentionFacts(databasePath: string, sessionID: string) {
  const sqlite = new SQLite(databasePath, { readonly: true })
  try {
    const events = sqlite
      .query<{ type: string; source: string; payload: string }, [string]>(
        `SELECT type,source,payload FROM protocol_event
         WHERE aggregate_type='session' AND aggregate_id=?
           AND type IN ('mission.execution.closed','mission.retention.delete_requested','session.deleted')
         ORDER BY seq,id`,
      )
      .all(sessionID)
    return {
      close: events
        .filter((event) => event.type === "mission.execution.closed")
        .map((event) => ({ source: event.source, payload: JSON.parse(event.payload) })),
      deleteRequests: events.filter((event) => event.type === "mission.retention.delete_requested").length,
      deletedBoundaries: events.filter((event) => event.type === "session.deleted").length,
      retainedSessionRows: sqlite
        .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM session WHERE id=?")
        .get(sessionID)!.count,
      boundTasks: sqlite
        .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM engine_task WHERE session_id=?")
        .get(sessionID)!.count,
    }
  } finally {
    sqlite.close()
  }
}

async function waitForRecoveryReplySettlement(
  input: ReturnType<typeof fixture>,
  sessionID: string,
  started: ReturnType<typeof startWorker>,
) {
  const deadline = Date.now() + 45_000
  while (true) {
    const facts = recoveryFacts(input.databasePath, sessionID)
    // A live Prompt process deliberately retains its durable owner for reuse.
    // The reply is settled once no assistant frontier remains; the worker's
    // normal Instance disposal must subsequently release that owner.
    if (facts.incompleteAssistants === 0) return facts
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Mission recovery worker exited before settlement: ${stderr || stdout}`)
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for Mission recovery settlement: ${JSON.stringify(facts)}`)
    }
    await Bun.sleep(20)
  }
}

async function waitForRecoveryLeaseRelease(
  input: ReturnType<typeof fixture>,
  sessionID: string,
  started: ReturnType<typeof startWorker>,
) {
  const deadline = Date.now() + 10_000
  while (true) {
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    const lease = (() => {
      try {
        return sqlite
          .query<{ expires_at: number }, [string]>(
            "SELECT expires_at FROM engine_control_activation_lease WHERE target='lifecycle' AND target_id=?",
          )
          .get(`mission:${sessionID}`)
      } finally {
        sqlite.close()
      }
    })()
    if (!lease || lease.expires_at <= Date.now()) return
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Deadline owner exited before its lease handback: ${stderr || stdout}`)
    }
    if (Date.now() >= deadline) throw new Error(`Mission recovery deadline did not release lifecycle ownership`)
    await Bun.sleep(20)
  }
}

function removeFixture(root: string) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
  }
}

test("write-ahead takeover preserves one Message and a later owner death in the same opened occurrence gets a new identity", async () => {
  const input = fixture("writeahead-takeover")
  const provider = startControlledStreamingProvider()
  let owner: ReturnType<typeof startWorker> | undefined
  let blocked: ReturnType<typeof startWorker> | undefined
  let takeover: ReturnType<typeof startWorker> | undefined
  let secondOwner: ReturnType<typeof startWorker> | undefined
  let secondRecovery: ReturnType<typeof startWorker> | undefined
  try {
    owner = startWorker("live-owner", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "owner-ready.json"), owner)
    const ownerReady = JSON.parse(fs.readFileSync(path.join(input.barrier, "owner-ready.json"), "utf8")) as {
      sessionID: string
    }
    await waitForProviderRequests(provider, 1, owner)
    owner.child.kill()
    await owner.child.exited

    blocked = startWorker("writeahead-blocked", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "writeahead-ready.json"), blocked)
    const writeAhead = JSON.parse(fs.readFileSync(path.join(input.barrier, "writeahead-ready.json"), "utf8")) as {
      sessionID: string
      wakeMessageID: string
    }
    const afterClaim = recoveryFacts(input.databasePath, ownerReady.sessionID)
    blocked.child.kill()
    await blocked.child.exited
    const writable = new SQLite(input.databasePath)
    try {
      writable.run("UPDATE engine_control_activation_lease SET expires_at=? WHERE target='lifecycle' AND target_id=?", [
        Date.now() - 1,
        `mission:${ownerReady.sessionID}`,
      ])
    } finally {
      writable.close()
    }

    takeover = startWorker("recovery-run", input, provider.apiURL)
    await waitForProviderRequests(provider, 2, takeover)
    provider.promptRequests()[1]!.release()
    await waitForFile(path.join(input.barrier, "recovery-ready.json"), takeover)
    const settled = await waitForRecoveryReplySettlement(input, ownerReady.sessionID, takeover)
    fs.writeFileSync(path.join(input.barrier, "recovery-exit"), "exit")
    await finishWorker(takeover, "recovery-run")
    const disposed = recoveryFacts(input.databasePath, ownerReady.sessionID)

    fs.rmSync(path.join(input.barrier, "owner-ready.json"), { force: true })
    fs.rmSync(path.join(input.barrier, "recovery-ready.json"), { force: true })
    fs.rmSync(path.join(input.barrier, "recovery-exit"), { force: true })
    secondOwner = startWorker("live-owner", input, provider.apiURL, { label: "second" })
    await waitForFile(path.join(input.barrier, "owner-ready.json"), secondOwner)
    await waitForProviderRequests(provider, 3, secondOwner)
    secondOwner.child.kill()
    await secondOwner.child.exited

    secondRecovery = startWorker("recovery-run", input, provider.apiURL, { label: "second-recovery" })
    await waitForProviderRequests(provider, 4, secondRecovery)
    provider.promptRequests()[3]!.release()
    await waitForFile(path.join(input.barrier, "recovery-ready.json"), secondRecovery)
    const secondSettled = await waitForRecoveryReplySettlement(input, ownerReady.sessionID, secondRecovery)
    fs.writeFileSync(path.join(input.barrier, "recovery-exit"), "exit")
    await finishWorker(secondRecovery, "recovery-run")
    const secondDisposed = recoveryFacts(input.databasePath, ownerReady.sessionID)

    expect({ writeAhead, afterClaim, settled, disposed, secondSettled, secondDisposed }).toMatchObject({
      writeAhead: { sessionID: ownerReady.sessionID },
      afterClaim: {
        wakes: [{ id: writeAhead.wakeMessageID }],
        controls: [{ id: expect.any(String) }],
        owners: 0,
        incompleteAssistants: 1,
      },
      settled: {
        wakes: [{ id: writeAhead.wakeMessageID }],
        controls: [{ id: expect.any(String) }],
        owners: 1,
        incompleteAssistants: 0,
      },
      disposed: {
        wakes: [{ id: writeAhead.wakeMessageID }],
        controls: [{ id: expect.any(String) }],
        owners: 0,
        incompleteAssistants: 0,
      },
      secondSettled: {
        wakes: [{ id: writeAhead.wakeMessageID }, { id: expect.any(String) }],
        owners: 1,
        incompleteAssistants: 0,
      },
      secondDisposed: {
        wakes: [{ id: writeAhead.wakeMessageID }, { id: expect.any(String) }],
        owners: 0,
        incompleteAssistants: 0,
      },
    })
    const reasons = secondDisposed.wakes.map((wake) => wake.data.extra.wake_reason)
    expect({
      distinctWakeIDs: new Set(secondDisposed.wakes.map((wake) => wake.id)).size,
      distinctDeadOwnerGenerations: new Set(reasons.map((reason) => reason.deadOwnerGeneration)).size,
      exactDigests: reasons.map(
        (reason) =>
          reason.interruptedFrontierDigest ===
          missionProcessRecoveryFrontierDigest(reason.interruptedAssistantMessageIDs),
      ),
    }).toEqual({ distinctWakeIDs: 2, distinctDeadOwnerGenerations: 2, exactDigests: [true, true] })
  } finally {
    for (const request of provider.promptRequests()) request.release()
    provider.server.stop(true)
    for (const started of [owner, blocked, takeover, secondOwner, secondRecovery]) {
      if (started?.child.exitCode === null) {
        started.child.kill()
        await started.child.exited
      }
    }
    removeFixture(input.root)
  }
}, 120_000)

test("the production close route takes over a dead recovery write-ahead owner before committing closed", async () => {
  const input = fixture("writeahead-close-takeover")
  const provider = startControlledStreamingProvider()
  let owner: ReturnType<typeof startWorker> | undefined
  let blocked: ReturnType<typeof startWorker> | undefined
  let close: ReturnType<typeof startWorker> | undefined
  try {
    owner = startWorker("live-owner", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "owner-ready.json"), owner)
    const ownerReady = JSON.parse(fs.readFileSync(path.join(input.barrier, "owner-ready.json"), "utf8")) as {
      sessionID: string
    }
    await waitForProviderRequests(provider, 1, owner)
    owner.child.kill()
    await owner.child.exited

    blocked = startWorker("writeahead-blocked", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "writeahead-ready.json"), blocked)
    const writeAhead = JSON.parse(fs.readFileSync(path.join(input.barrier, "writeahead-ready.json"), "utf8")) as {
      wakeMessageID: string
    }
    blocked.child.kill()
    await blocked.child.exited
    const writable = new SQLite(input.databasePath)
    try {
      writable.run("UPDATE engine_control_activation_lease SET expires_at=? WHERE target='lifecycle' AND target_id=?", [
        Date.now() - 1,
        `mission:${ownerReady.sessionID}`,
      ])
    } finally {
      writable.close()
    }

    close = startWorker("close-route", input, provider.apiURL)
    await finishWorker(close, "close-route")
    const settled = recoveryFacts(input.databasePath, ownerReady.sessionID)
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      const closure = sqlite
        .query<{ type: string }, [string]>(
          `SELECT type FROM protocol_event
           WHERE aggregate_type='session' AND aggregate_id=?
             AND type IN ('mission.execution.closing','mission.execution.closed')
           ORDER BY seq,id`,
        )
        .all(ownerReady.sessionID)
      expect({
        settled,
        closure: closure.map((event) => event.type),
        providerRequests: provider.promptRequests().length,
      }).toMatchObject({
        settled: {
          wakes: [{ id: writeAhead.wakeMessageID }],
          controls: [{ id: expect.any(String) }],
          owners: 0,
          incompleteAssistants: 0,
          recoveryReplies: [
            {
              id: expect.any(String),
              data: {
                parentID: writeAhead.wakeMessageID,
                finish: "error",
                error: { name: "MessageAbortedError" },
                time: { completed: expect.any(Number) },
              },
            },
          ],
        },
        closure: ["mission.execution.closing", "mission.execution.closed"],
        providerRequests: 1,
      })
    } finally {
      sqlite.close()
    }
  } finally {
    for (const request of provider.promptRequests()) request.release()
    provider.server.stop(true)
    for (const started of [owner, blocked, close]) {
      if (started?.child.exitCode === null) {
        started.child.kill()
        await started.child.exited
      }
    }
    removeFixture(input.root)
  }
}, 120_000)

async function verifyHungRecoveryOwnerTakeover(fence: "deadline" | "caller-abort") {
  const input = fixture(`${fence}-takeover`)
  const provider = startControlledStreamingProvider()
  let owner: ReturnType<typeof startWorker> | undefined
  let deadlineOwner: ReturnType<typeof startWorker> | undefined
  let successor: ReturnType<typeof startWorker> | undefined
  try {
    owner = startWorker("live-owner", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "owner-ready.json"), owner)
    const ownerReady = JSON.parse(fs.readFileSync(path.join(input.barrier, "owner-ready.json"), "utf8")) as {
      sessionID: string
    }
    await waitForProviderRequests(provider, 1, owner)
    owner.child.kill()
    await owner.child.exited

    deadlineOwner = startWorker("writeahead-blocked", input, provider.apiURL, {
      ...(fence === "deadline" ? { deadlineMilliseconds: 750 } : { callerAbortMilliseconds: 750 }),
    })
    await waitForFile(path.join(input.barrier, "writeahead-ready.json"), deadlineOwner)
    const writeAhead = JSON.parse(fs.readFileSync(path.join(input.barrier, "writeahead-ready.json"), "utf8")) as {
      wakeMessageID: string
    }
    await waitForRecoveryLeaseRelease(input, ownerReady.sessionID, deadlineOwner)

    successor = startWorker("recovery-run", input, provider.apiURL, { label: `${fence}-successor` })
    await waitForProviderRequests(provider, 2, successor)
    provider.promptRequests()[1]!.release()
    await waitForFile(path.join(input.barrier, "recovery-ready.json"), successor)
    const settled = await waitForRecoveryReplySettlement(input, ownerReady.sessionID, successor)
    fs.writeFileSync(path.join(input.barrier, "recovery-exit"), "exit")
    await finishWorker(successor, "recovery-run")
    const disposed = recoveryFacts(input.databasePath, ownerReady.sessionID)

    expect({ settled, disposed }).toMatchObject({
      settled: {
        wakes: [{ id: writeAhead.wakeMessageID }],
        owners: 1,
        incompleteAssistants: 0,
      },
      disposed: {
        wakes: [{ id: writeAhead.wakeMessageID }],
        owners: 0,
        incompleteAssistants: 0,
      },
    })
  } finally {
    for (const request of provider.promptRequests()) request.release()
    provider.server.stop(true)
    for (const started of [owner, deadlineOwner, successor]) {
      if (started?.child.exitCode === null) {
        started.child.kill()
        await started.child.exited
      }
    }
    removeFixture(input.root)
  }
}

test(
  "an absolute deadline fences a live hung recovery owner and a successor resumes its write-ahead Message",
  () => verifyHungRecoveryOwnerTakeover("deadline"),
  120_000,
)

test(
  "caller abort fences a live hung recovery owner and a successor resumes its write-ahead Message",
  () => verifyHungRecoveryOwnerTakeover("caller-abort"),
  120_000,
)

test("the live Project driver preserves a peer owner and takes over after that owner dies without restart", async () => {
  const input = fixture("continuous-driver")
  const provider = startControlledStreamingProvider()
  let owner: ReturnType<typeof startWorker> | undefined
  let driver: ReturnType<typeof startWorker> | undefined
  try {
    owner = startWorker("live-owner", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "owner-ready.json"), owner)
    const ownerReady = JSON.parse(fs.readFileSync(path.join(input.barrier, "owner-ready.json"), "utf8")) as {
      sessionID: string
    }
    await waitForProviderRequests(provider, 1, owner)

    driver = startWorker("host-driver", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "driver-ready.json"), driver)
    const driverReady = JSON.parse(fs.readFileSync(path.join(input.barrier, "driver-ready.json"), "utf8")) as {
      result: {
        missionAttempted: number
        missionWoken: number
        missionCompleted: number
        failures: unknown[]
      }
    }
    await Bun.sleep(1_500)
    expect({
      initial: driverReady.result,
      persisted: recoveryFacts(input.databasePath, ownerReady.sessionID),
    }).toMatchObject({
      initial: { missionAttempted: 1, missionWoken: 0, missionCompleted: 0, failures: [] },
      persisted: { owners: 1, incompleteAssistants: 1 },
    })

    owner.child.kill()
    await owner.child.exited
    await waitForProviderRequests(provider, 2, driver)
    const claimed = recoveryFacts(input.databasePath, ownerReady.sessionID)
    provider.promptRequests()[1]!.release()
    const settled = await waitForRecoveryReplySettlement(input, ownerReady.sessionID, driver)
    fs.writeFileSync(path.join(input.barrier, "driver-exit"), "exit")
    await finishWorker(driver, "host-driver")
    const disposed = recoveryFacts(input.databasePath, ownerReady.sessionID)

    expect({ claimed, settled, disposed }).toMatchObject({
      claimed: {
        wakes: [{ id: expect.any(String) }],
        controls: [{ id: expect.any(String) }],
        owners: 1,
      },
      settled: {
        wakes: [{ id: claimed.wakes[0]!.id }],
        controls: [{ id: expect.any(String) }],
        owners: 1,
        incompleteAssistants: 0,
      },
      disposed: {
        wakes: [{ id: claimed.wakes[0]!.id }],
        controls: [{ id: expect.any(String) }],
        owners: 0,
        incompleteAssistants: 0,
      },
    })
  } finally {
    for (const request of provider.promptRequests()) request.release()
    provider.server.stop(true)
    for (const started of [owner, driver]) {
      if (started?.child.exitCode === null) {
        started.child.kill()
        await started.child.exited
      }
    }
    removeFixture(input.root)
  }
}, 120_000)

test("startup takes over an abort-closed delete intent after the route owner dies", async () => {
  const input = fixture("delete-intent-takeover")
  const provider = startControlledStreamingProvider()
  let routeOwner: ReturnType<typeof startWorker> | undefined
  let driver: ReturnType<typeof startWorker> | undefined
  try {
    routeOwner = startWorker("delete-route-blocked", input, provider.apiURL)
    const readyPath = path.join(input.barrier, "delete-intent-ready.json")
    await waitForFile(readyPath, routeOwner)
    const ready = JSON.parse(fs.readFileSync(readyPath, "utf8")) as { sessionID: string; eventID: string }
    const admitted = deleteRetentionFacts(input.databasePath, ready.sessionID)
    expect(admitted).toMatchObject({
      close: [
        {
          source: "mission.abort",
          payload: {
            missionID: "mission-process-recovery-driver",
            provenance: {
              kind: "request",
              surface: "api",
              reason: "Close before accepting the cross-process delete request",
            },
          },
        },
      ],
      deleteRequests: 1,
      deletedBoundaries: 0,
      retainedSessionRows: 1,
      boundTasks: 0,
    })

    routeOwner.child.kill()
    await routeOwner.child.exited
    driver = startWorker("host-driver", input, provider.apiURL)
    await waitForFile(path.join(input.barrier, "driver-ready.json"), driver)
    const driverResult = JSON.parse(fs.readFileSync(path.join(input.barrier, "driver-ready.json"), "utf8")) as {
      result: { missionAttempted: number; missionCompleted: number; failures: unknown[] }
    }
    const recovered = deleteRetentionFacts(input.databasePath, ready.sessionID)
    fs.writeFileSync(path.join(input.barrier, "driver-exit"), "exit")
    await finishWorker(driver, "host-driver")

    expect({ driver: driverResult.result, recovered }).toMatchObject({
      driver: { missionAttempted: 1, missionCompleted: 1, failures: [] },
      recovered: {
        close: admitted.close,
        deleteRequests: 1,
        deletedBoundaries: 1,
        retainedSessionRows: 1,
        boundTasks: 0,
      },
    })
  } finally {
    provider.server.stop(true)
    for (const started of [routeOwner, driver]) {
      if (started?.child.exitCode === null) {
        started.child.kill()
        await started.child.exited
      }
    }
    removeFixture(input.root)
  }
}, 120_000)
