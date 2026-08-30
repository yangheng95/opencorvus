import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"

type WorkerMode =
  | "seed"
  | "close-blocked"
  | "close-takeover"
  | "wake-before-bundle"
  | "wake-blocked"
  | "wake-live"
  | "close-peer"
  | "operator-idempotent-blocked"
  | "operator-idempotent-peer"
  | "operator-drift-peer"

function fixture(label: string) {
  const root = mkdtempSync(path.join(tmpdir(), `opencorvus-mission-${label}-`))
  const home = path.join(root, "home")
  const projectPath = path.join(root, "project")
  const barrier = path.join(root, "barrier")
  mkdirSync(home, { recursive: true })
  mkdirSync(projectPath, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) {
    throw new Error(`Could not initialize Mission reconciliation repository: ${initialized.stderr.toString()}`)
  }
  return { root, home, projectPath, barrier, databasePath: path.join(home, "data", "opencorvus.db") }
}

function startWorker(worker: string, mode: WorkerMode, input: ReturnType<typeof fixture>, apiURL?: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
      worker,
      mode,
      input.projectPath,
      input.barrier,
      ...(apiURL ? [apiURL] : []),
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
  const result = stdout
    .trim()
    .split(/\r?\n/)
    .toReversed()
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return undefined
      }
    })
    .find((value) => value?.mode === mode)
  if (!result) throw new Error(`Mission ${mode} worker returned no result: ${stdout}`)
  return result as Record<string, any>
}

async function runWorker(worker: string, mode: WorkerMode, input: ReturnType<typeof fixture>, apiURL?: string) {
  return finishWorker(startWorker(worker, mode, input, apiURL), mode)
}

async function waitForFile(file: string, started: ReturnType<typeof startWorker>): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!fs.existsSync(file)) {
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Mission worker exited before ${file}: STDERR=${stderr}\nSTDOUT=${stdout}`)
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`)
    await Bun.sleep(10)
  }
}

function removeFixture(root: string) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
  }
}

const worker = path.join(import.meta.dir, "fixture", "mission-execution-reconciliation-process-worker.ts")

test("two backend processes join one exact operator request and reject accepted-input drift", async () => {
  const input = fixture("operator-idempotency")
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    const seeded = await runWorker(worker, "seed", input)
    blocked = startWorker(worker, "operator-idempotent-blocked", input)
    await waitForFile(path.join(input.barrier, "operator-idempotent-ready.json"), blocked)
    const planned = JSON.parse(fs.readFileSync(path.join(input.barrier, "operator-idempotent-ready.json"), "utf8")) as {
      sessionID: string
      messageID: string
      closureEventID: string
    }
    const peer = await runWorker(worker, "operator-idempotent-peer", input)
    const drift = await runWorker(worker, "operator-drift-peer", input)
    fs.writeFileSync(path.join(input.barrier, "operator-idempotent-release"), "release")
    const replay = await finishWorker(blocked, "operator-idempotent-blocked")
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      expect({
        seeded,
        planned,
        peer,
        replay,
        drift,
        requestMessages: sqlite
          .query<{ count: number }, [string]>(
            `SELECT COUNT(*) AS count FROM message
             WHERE session_id=?
               AND json_extract(data,'$.extra.wake_reason.source')='mission.operator'
               AND json_extract(data,'$.extra.wake_reason.requestID')='operator-idempotency-request'`,
          )
          .get(planned.sessionID)!.count,
        openedEvents: sqlite
          .query<{ count: number }, [string]>(
            `SELECT COUNT(*) AS count FROM protocol_event
             WHERE aggregate_type='session' AND aggregate_id=? AND type='mission.execution.opened'`,
          )
          .get(planned.sessionID)!.count,
      }).toMatchObject({
        seeded: { sessionID: planned.sessionID, openedEventID: planned.closureEventID },
        peer: { status: 200 },
        replay: { status: 200 },
        drift: {
          status: 409,
          body: {
            name: "MissionExecutionWakeInputConflictError",
            data: {
              requestID: "operator-idempotency-request",
              closureEventID: planned.closureEventID,
            },
          },
        },
        requestMessages: 1,
        openedEvents: 1,
      })
    } finally {
      sqlite.close()
    }
  } finally {
    if (blocked?.child.exitCode === null) {
      fs.writeFileSync(path.join(input.barrier, "operator-idempotent-release"), "release")
      blocked.child.kill()
      await blocked.child.exited
    }
    removeFixture(input.root)
  }
}, 90_000)

test("a peer process takes over the exact close occurrence after the fenced owner dies", async () => {
  const input = fixture("close-takeover")
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    const seeded = await runWorker(worker, "seed", input)
    blocked = startWorker(worker, "close-blocked", input)
    await waitForFile(path.join(input.barrier, "close-ready.json"), blocked)
    const claimed = JSON.parse(fs.readFileSync(path.join(input.barrier, "close-ready.json"), "utf8")) as {
      sessionID: string
      closureEventID: string
      operationID: string
      requestID: string
    }
    blocked.child.kill()
    await blocked.child.exited
    const writable = new SQLite(input.databasePath)
    try {
      writable.run("UPDATE engine_control_activation_lease SET expires_at=? WHERE target='lifecycle' AND target_id=?", [
        Date.now() - 1,
        `mission:${claimed.sessionID}`,
      ])
    } finally {
      writable.close()
    }

    const takeover = await runWorker(worker, "close-takeover", input)
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      const terminal = sqlite
        .query<
          {
            id: string
            type: string
            source: string
            correlation_id: string
            payload: string
          },
          [string]
        >(
          `SELECT id,type,source,correlation_id,payload FROM protocol_event
         WHERE aggregate_type='session' AND aggregate_id=?
           AND type IN ('mission.execution.closing','mission.execution.closed')
         ORDER BY seq,id`,
        )
        .all(claimed.sessionID)
        .map((row) => ({ ...row, payload: JSON.parse(row.payload) }))
      expect({
        seed: seeded,
        claimed,
        takeover: takeover.closed,
        terminal,
        lifecycleLeaseAttempts: sqlite
          .query<
            { count: number },
            [string]
          >("SELECT COUNT(*) AS count FROM engine_control_activation_lease WHERE target='lifecycle' AND target_id=?")
          .get(`mission:${claimed.sessionID}`)!.count,
      }).toMatchObject({
        seed: { sessionID: claimed.sessionID },
        takeover: {
          state: "closed",
          sessionID: claimed.sessionID,
          operationID: claimed.operationID,
          provenance: { kind: "request", surface: "api", reason: "Cross-process close owner" },
        },
        terminal: [
          {
            id: claimed.closureEventID,
            type: "mission.execution.closing",
            source: "mission.abort",
            correlation_id: claimed.operationID,
            payload: expect.objectContaining({
              requestID: claimed.requestID,
              provenance: { kind: "request", surface: "api", reason: "Cross-process close owner" },
            }),
          },
          {
            type: "mission.execution.closed",
            source: "mission.abort",
            correlation_id: claimed.operationID,
            payload: expect.objectContaining({
              requestID: claimed.requestID,
              provenance: { kind: "request", surface: "api", reason: "Cross-process close owner" },
            }),
          },
        ],
        lifecycleLeaseAttempts: 2,
      })
    } finally {
      sqlite.close()
    }
  } finally {
    if (blocked?.child.exitCode === null) {
      blocked.child.kill()
      await blocked.child.exited
    }
    removeFixture(input.root)
  }
}, 60_000)

test("a peer close settles the exact live streamed Mission Prompt before committing closed", async () => {
  const input = fixture("live-peer")
  const provider = startControlledStreamingProvider()
  let live: ReturnType<typeof startWorker> | undefined
  try {
    const seeded = await runWorker(worker, "seed", input, provider.apiURL)
    live = startWorker(worker, "wake-live", input)
    await waitForFile(path.join(input.barrier, "live-ready.json"), live)
    const ready = JSON.parse(fs.readFileSync(path.join(input.barrier, "live-ready.json"), "utf8")) as {
      sessionID: string
      status: number
      body: unknown
    }
    if (ready.status !== 200) throw new Error(`Live Mission wake route failed: ${JSON.stringify(ready.body)}`)
    const deadline = Date.now() + 30_000
    let lastOwnerCount = 0
    while (true) {
      const sqlite = new SQLite(input.databasePath, { readonly: true })
      lastOwnerCount = sqlite
        .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM session_prompt_owner WHERE session_id=?")
        .get(ready.sessionID)!.count
      sqlite.close()
      if (lastOwnerCount === 1 && provider.promptRequests().length >= 1) break
      if (live.child.exitCode !== null) {
        const [stdout, stderr] = await Promise.all([live.stdout, live.stderr])
        throw new Error(`Live Mission worker exited before Prompt ownership: ${stderr || stdout}`)
      }
      if (Date.now() >= deadline) {
        const sqlite = new SQLite(input.databasePath, { readonly: true })
        const messages = sqlite
          .query<{ data: string }, [string]>("SELECT data FROM message WHERE session_id=? ORDER BY time_created,id")
          .all(ready.sessionID)
          .map((row) => JSON.parse(row.data))
        sqlite.close()
        throw new Error(
          `Live Mission Prompt did not reach durable owner and Provider: ${JSON.stringify({
            lastOwnerCount,
            providerPromptRequests: provider.promptRequests().length,
            messages,
          })}`,
        )
      }
      await Bun.sleep(10)
    }

    const close = await runWorker(worker, "close-peer", input)
    fs.writeFileSync(path.join(input.barrier, "live-exit"), "exit")
    const liveResult = await finishWorker(live, "wake-live")
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      expect({
        seed: seeded,
        ready,
        close,
        liveResult,
        providerPromptRequests: provider.promptRequests().length,
        promptOwners: sqlite
          .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM session_prompt_owner WHERE session_id=?")
          .get(ready.sessionID)!.count,
        terminalAssistants: sqlite
          .query<{ count: number }, [string]>(
            `SELECT COUNT(*) AS count FROM message WHERE session_id=?
           AND json_extract(data,'$.role')='assistant'
           AND json_extract(data,'$.time.completed') IS NOT NULL`,
          )
          .get(ready.sessionID)!.count,
      }).toMatchObject({
        seed: { sessionID: ready.sessionID },
        ready: { status: 200 },
        close: {
          status: 200,
          body: true,
          closure: { state: "closed", sessionID: ready.sessionID },
        },
        liveResult: { status: 200, sessionID: ready.sessionID },
        providerPromptRequests: 1,
        promptOwners: 0,
        terminalAssistants: 1,
      })
    } finally {
      sqlite.close()
    }
  } finally {
    for (const request of provider.promptRequests()) request.release()
    provider.server.stop(true)
    if (live?.child.exitCode === null) {
      fs.writeFileSync(path.join(input.barrier, "live-exit"), "exit")
      live.child.kill()
      await live.child.exited
    }
    removeFixture(input.root)
  }
}, 90_000)

for (const scenario of [
  { mode: "wake-before-bundle" as const, persistedUserMessages: 1 },
  { mode: "wake-blocked" as const, persistedUserMessages: 2 },
]) {
  test(`a peer close wins the ${scenario.mode} cross-process ordering with one typed terminal outcome`, async () => {
    const input = fixture(scenario.mode)
    let blocked: ReturnType<typeof startWorker> | undefined
    try {
      const seeded = await runWorker(worker, "seed", input)
      blocked = startWorker(worker, scenario.mode, input)
      await waitForFile(path.join(input.barrier, "wake-ready.json"), blocked)
      const planned = JSON.parse(fs.readFileSync(path.join(input.barrier, "wake-ready.json"), "utf8")) as {
        sessionID: string
        messageID: string
      }
      const close = await runWorker(worker, "close-peer", input)
      fs.writeFileSync(path.join(input.barrier, "wake-release"), "release")
      const wake = await finishWorker(blocked, scenario.mode)
      const sqlite = new SQLite(input.databasePath, { readonly: true })
      try {
        expect({
          seed: seeded,
          planned,
          close,
          wake,
          persistedUserMessages: sqlite
            .query<
              { count: number },
              [string]
            >("SELECT COUNT(*) AS count FROM message WHERE session_id=? AND json_extract(data,'$.role')='user'")
            .get(planned.sessionID)!.count,
        }).toMatchObject({
          seed: { sessionID: planned.sessionID },
          close: {
            status: 200,
            body: true,
            closure: { state: "closed", sessionID: planned.sessionID },
          },
          wake: {
            status: 409,
            body: {
              name: "MissionExecutionWakeClosedError",
              data: { sessionID: planned.sessionID, state: "closed" },
            },
          },
          persistedUserMessages: scenario.persistedUserMessages,
        })
      } finally {
        sqlite.close()
      }
    } finally {
      if (blocked?.child.exitCode === null) {
        blocked.child.kill()
        await blocked.child.exited
      }
      removeFixture(input.root)
    }
  }, 60_000)
}
