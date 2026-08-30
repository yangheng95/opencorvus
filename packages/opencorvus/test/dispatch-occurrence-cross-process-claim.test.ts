import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

type WorkerMode =
  | "seed"
  | "execute-blocked"
  | "execute-replay"
  | "execute-takeover"
  | "execute-takeover-held"
  | "scan"

function startWorker(worker: string, mode: WorkerMode, projectPath: string, home: string, barrier?: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
      worker,
      mode,
      projectPath,
      ...(barrier ? [barrier] : []),
    ],
    {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: { ...process.env, OPENCORVUS_HOME: home },
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
  if (exitCode !== 0) throw new Error(`Dispatch occurrence ${mode} worker failed (${exitCode}): ${stderr || stdout}`)
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
  if (!result) throw new Error(`Dispatch occurrence ${mode} worker returned no result: ${stdout}`)
  return result as {
    mode: WorkerMode
    memberOutcome?: { kind?: string; session_id?: string; infrastructure_error?: { artifact_id?: string } }
    outerOutput?: string
    outerStatus?: string
  }
}

async function runWorker(worker: string, mode: WorkerMode, projectPath: string, home: string, barrier?: string) {
  return finishWorker(startWorker(worker, mode, projectPath, home, barrier), mode)
}

async function waitForFile(file: string, started?: ReturnType<typeof startWorker>): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!fs.existsSync(file)) {
    if (started?.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Worker exited before ${file}: STDERR=${stderr}\nSTDOUT=${stdout}`)
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`)
    await Bun.sleep(10)
  }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "opencorvus-dispatch-claim-"))
  const home = path.join(root, "home")
  const projectPath = path.join(root, "project")
  const barrier = path.join(root, "barrier")
  mkdirSync(home, { recursive: true })
  mkdirSync(projectPath, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) {
    throw new Error(`Could not initialize dispatch claim fixture repository: ${initialized.stderr.toString()}`)
  }
  return { root, home, projectPath, barrier, databasePath: path.join(home, "data", "opencorvus.db") }
}

function removeFixture(root: string) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
  }
}

test("a peer outer occurrence waits for the winner's exact durable Turn and joins its one physical Session", async () => {
  const input = fixture()
  const worker = path.join(import.meta.dir, "fixture", "dispatch-occurrence-claim-process-worker.ts")
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    await runWorker(worker, "seed", input.projectPath, input.home)
    blocked = startWorker(worker, "execute-blocked", input.projectPath, input.home, input.barrier)
    await waitForFile(path.join(input.barrier, "ready.json"), blocked)
    const claim = JSON.parse(fs.readFileSync(path.join(input.barrier, "ready.json"), "utf8")) as {
      lineageID: string
      childSessionID: string
    }
    const replay = startWorker(worker, "execute-replay", input.projectPath, input.home)
    await Bun.sleep(250)
    const waiting = new SQLite(input.databasePath, { readonly: true })
    try {
      expect({
        requestCount: waiting.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM tool_part_request WHERE json_extract(data,'$.tool')='dispatch_agents'",
        ).get()!.count,
        outcomeCount: waiting.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM tool_part_outcome",
        ).get()!.count,
        lineageCount: waiting.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='dispatch_lineage'",
        ).get()!.count,
      }).toEqual({ requestCount: 1, outcomeCount: 0, lineageCount: 1 })
    } finally {
      waiting.close()
    }
    fs.writeFileSync(path.join(input.barrier, "materialize"), "ready")
    const [replayed] = await Promise.all([
      finishWorker(replay, "execute-replay"),
      finishWorker(blocked, "execute-blocked"),
    ])
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      const outer = sqlite.query<{ data: string }, []>("SELECT data FROM tool_part_outcome").all()
      expect({
        replayMode: replayed.mode,
        replayOutcome: replayed.memberOutcome,
        lineageIDs: sqlite.query<{ id: string }, []>(
          "SELECT id FROM engine_artifact WHERE kind='dispatch_lineage'",
        ).all().map((row) => row.id),
        childSessions: sqlite.query<{ id: string }, [string]>("SELECT id FROM session WHERE id=?").all(claim.childSessionID),
        descriptors: sqlite.query<{ session_id: string }, [string]>(
          "SELECT session_id FROM worker_turn_descriptor WHERE session_id=?",
        ).all(claim.childSessionID),
        outerOutcomes: outer.map((row) => JSON.parse(row.data).outcome),
      }).toEqual({
        replayMode: "execute-replay",
        replayOutcome: {
          kind: "accepted",
          session_id: claim.childSessionID,
          dispatch_lineage_id: claim.lineageID,
        },
        lineageIDs: [claim.lineageID],
        childSessions: [{ id: claim.childSessionID }],
        descriptors: [{ session_id: claim.childSessionID }],
        outerOutcomes: ["completed"],
      })
    } finally {
      sqlite.close()
    }
  } finally {
    if (blocked && blocked.child.exitCode === null) {
      blocked.child.kill()
      await blocked.child.exited
    }
    removeFixture(input.root)
  }
}, 60_000)

test("an expired claim-window owner is taken over by the same exact outer occurrence", async () => {
  const input = fixture()
  const worker = path.join(import.meta.dir, "fixture", "dispatch-occurrence-claim-process-worker.ts")
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    await runWorker(worker, "seed", input.projectPath, input.home)
    blocked = startWorker(worker, "execute-blocked", input.projectPath, input.home, input.barrier)
    await waitForFile(path.join(input.barrier, "ready.json"), blocked)
    const claim = JSON.parse(fs.readFileSync(path.join(input.barrier, "ready.json"), "utf8")) as {
      ownerOccurrenceID: string
      lineageID: string
      childSessionID: string
    }
    blocked.child.kill()
    await blocked.child.exited
    const writable = new SQLite(input.databasePath)
    try {
      writable.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='runtime_process' AND target_id=?",
        [Date.now() - 1, claim.ownerOccurrenceID],
      )
      writable.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='dispatch_admission' AND target_id=?",
        [Date.now() - 1, claim.lineageID],
      )
    } finally {
      writable.close()
    }
    const replayed = await runWorker(worker, "execute-takeover", input.projectPath, input.home)
    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      const outer = sqlite.query<{ data: string }, []>("SELECT data FROM tool_part_outcome").all()
      expect({
        replayKind: replayed.memberOutcome?.kind,
        replaySessionID: replayed.memberOutcome?.session_id,
        outerStatus: replayed.outerStatus,
        lineageCount: sqlite.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='dispatch_lineage'",
        ).get()!.count,
        childSessionCount: sqlite.query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM session WHERE id=?",
        ).get(claim.childSessionID)!.count,
        descriptorCount: sqlite.query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM worker_turn_descriptor WHERE session_id=?",
        ).get(claim.childSessionID)!.count,
        admissionAttemptCount: sqlite.query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM engine_control_activation_lease WHERE target='dispatch_admission' AND target_id=?",
        ).get(claim.lineageID)!.count,
        outerOutcomes: outer.map((row) => JSON.parse(row.data).outcome),
      }).toEqual({
        replayKind: "accepted",
        replaySessionID: claim.childSessionID,
        outerStatus: "completed",
        lineageCount: 1,
        childSessionCount: 1,
        descriptorCount: 1,
        admissionAttemptCount: 2,
        outerOutcomes: ["completed"],
      })
    } finally {
      sqlite.close()
    }
  } finally {
    if (blocked && blocked.child.exitCode === null) {
      blocked.child.kill()
      await blocked.child.exited
    }
    removeFixture(input.root)
  }
}, 60_000)

test("a third backend follows the consumed takeover attempt as delivery owner before recovering its death", async () => {
  const input = fixture()
  const worker = path.join(import.meta.dir, "fixture", "dispatch-occurrence-claim-process-worker.ts")
  let original: ReturnType<typeof startWorker> | undefined
  let successor: ReturnType<typeof startWorker> | undefined
  try {
    await runWorker(worker, "seed", input.projectPath, input.home)
    original = startWorker(worker, "execute-blocked", input.projectPath, input.home, input.barrier)
    await waitForFile(path.join(input.barrier, "ready.json"), original)
    const firstClaim = JSON.parse(fs.readFileSync(path.join(input.barrier, "ready.json"), "utf8")) as {
      ownerOccurrenceID: string
      lineageID: string
      childSessionID: string
    }
    original.child.kill()
    await original.child.exited
    const writable = new SQLite(input.databasePath)
    try {
      writable.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='runtime_process' AND target_id=?",
        [Date.now() - 1, firstClaim.ownerOccurrenceID],
      )
      writable.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='dispatch_admission' AND target_id=?",
        [Date.now() - 1, firstClaim.lineageID],
      )
    } finally {
      writable.close()
    }

    successor = startWorker(worker, "execute-takeover-held", input.projectPath, input.home, input.barrier)
    await waitForFile(path.join(input.barrier, "accepted-ready.json"), successor)
    const successorReceipt = JSON.parse(
      fs.readFileSync(path.join(input.barrier, "accepted-ready.json"), "utf8"),
    ) as { ownerOccurrenceID: string }

    const beforeLiveScan = new SQLite(input.databasePath, { readonly: true })
    const ingressCountBeforeScan = beforeLiveScan.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM engine_task_root_ingress",
    ).get()!.count
    beforeLiveScan.close()

    await runWorker(worker, "scan", input.projectPath, input.home)
    const live = new SQLite(input.databasePath, { readonly: true })
    try {
      const latestAdmission = live.query<
        { owner_occurrence_id: string; expires_at: number },
        [string]
      >(
        `SELECT owner_occurrence_id,expires_at FROM engine_control_activation_lease
         WHERE target='dispatch_admission' AND target_id=?
         ORDER BY time_activated DESC,id DESC LIMIT 1`,
      ).get(firstClaim.lineageID)!
      expect({
        latestAdmissionOwner: latestAdmission.owner_occurrence_id,
        consumed: latestAdmission.expires_at <= Date.now(),
        successorOwner: successorReceipt.ownerOccurrenceID,
        descriptorCount: live.query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM worker_turn_descriptor WHERE session_id=?",
        ).get(firstClaim.childSessionID)!.count,
        settlementCount: live.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='dispatch_settlement'",
        ).get()!.count,
        infrastructureCount: live.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='task-infrastructure-error'",
        ).get()!.count,
        ingressCount: live.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_task_root_ingress",
        ).get()!.count,
      }).toEqual({
        latestAdmissionOwner: successorReceipt.ownerOccurrenceID,
        consumed: true,
        successorOwner: successorReceipt.ownerOccurrenceID,
        descriptorCount: 1,
        settlementCount: 0,
        infrastructureCount: 0,
        ingressCount: ingressCountBeforeScan,
      })
    } finally {
      live.close()
    }

    successor.child.kill()
    await successor.child.exited
    const expireSuccessor = new SQLite(input.databasePath)
    try {
      expireSuccessor.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='runtime_process' AND target_id=?",
        [Date.now() - 1, successorReceipt.ownerOccurrenceID],
      )
    } finally {
      expireSuccessor.close()
    }
    await runWorker(worker, "scan", input.projectPath, input.home)
    const recovered = new SQLite(input.databasePath, { readonly: true })
    try {
      expect({
        settlementCount: recovered.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='dispatch_settlement'",
        ).get()!.count,
        infrastructureCount: recovered.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_artifact WHERE kind='task-infrastructure-error'",
        ).get()!.count,
        ingressCount: recovered.query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM engine_task_root_ingress",
        ).get()!.count,
      }).toEqual({
        settlementCount: 1,
        infrastructureCount: 1,
        ingressCount: ingressCountBeforeScan + 1,
      })
    } finally {
      recovered.close()
    }
  } finally {
    if (original && original.child.exitCode === null) {
      original.child.kill()
      await original.child.exited
    }
    if (successor && successor.child.exitCode === null) {
      successor.child.kill()
      await successor.child.exited
    }
    removeFixture(input.root)
  }
}, 90_000)
