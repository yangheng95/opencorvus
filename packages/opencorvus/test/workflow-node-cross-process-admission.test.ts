import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

type WorkerMode = "seed" | "execute-blocked" | "execute-peer"

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
  return { child, stdout: new Response(child.stdout).text(), stderr: new Response(child.stderr).text() }
}

async function finishWorker(started: ReturnType<typeof startWorker>, mode: WorkerMode) {
  const [exitCode, stdout, stderr] = await Promise.all([started.child.exited, started.stdout, started.stderr])
  if (exitCode !== 0) throw new Error(`Workflow node ${mode} worker failed (${exitCode}): ${stderr || stdout}`)
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
  if (!result) throw new Error(`Workflow node ${mode} worker returned no result: ${stdout}`)
  return result as {
    mode: WorkerMode
    taskID?: string
    rootSessionID?: string
    outcome?: Record<string, unknown>
    outerStatus?: string
  }
}

async function runWorker(worker: string, mode: WorkerMode, projectPath: string, home: string, barrier?: string) {
  return finishWorker(startWorker(worker, mode, projectPath, home, barrier), mode)
}

async function waitForFile(file: string, started: ReturnType<typeof startWorker>): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!fs.existsSync(file)) {
    if (started.child.exitCode !== null) {
      const [stdout, stderr] = await Promise.all([started.stdout, started.stderr])
      throw new Error(`Worker exited before ${file}: STDERR=${stderr}\nSTDOUT=${stdout}`)
    }
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`)
    await Bun.sleep(10)
  }
}

test("two production outer occurrences admit one virtual workflow node before physical Session creation", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "opencorvus-workflow-node-admission-"))
  const home = path.join(root, "home")
  const projectPath = path.join(root, "project")
  const barrier = path.join(root, "barrier")
  const worker = path.join(import.meta.dir, "fixture", "workflow-node-admission-process-worker.ts")
  mkdirSync(home, { recursive: true })
  mkdirSync(projectPath, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) throw new Error(initialized.stderr.toString())
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    const seeded = await runWorker(worker, "seed", projectPath, home)
    if (!seeded.rootSessionID) throw new Error("Seed worker returned no root Session identity")
    blocked = startWorker(worker, "execute-blocked", projectPath, home, barrier)
    await waitForFile(path.join(barrier, "ready.json"), blocked)
    const winner = JSON.parse(fs.readFileSync(path.join(barrier, "ready.json"), "utf8")) as {
      lineageID: string
      dispatchID: string
      childSessionID: string
    }
    const peer = await runWorker(worker, "execute-peer", projectPath, home)
    const sqlite = new SQLite(path.join(home, "data", "opencorvus.db"), { readonly: true })
    try {
      expect({
        peerOutcome: peer.outcome,
        peerOuterStatus: peer.outerStatus,
        lineage: sqlite
          .query<{ id: string; dispatchID: string; childSessionID: string }, []>(`
            SELECT id,
              json_extract(payload,'$.dispatch_id') AS dispatchID,
              json_extract(payload,'$.child_session_id') AS childSessionID
            FROM engine_artifact
            WHERE kind='dispatch_lineage'
          `)
          .all(),
        sessions: sqlite
          .query<{ id: string; kind: string; parentID: string | null }, []>(`
            SELECT id, kind, parent_id AS parentID
            FROM session
            ORDER BY CASE kind WHEN 'root' THEN 0 ELSE 1 END, id
          `)
          .all(),
        physicalWorkerSessions: sqlite
          .query<{ id: string; kind: string }, [string]>(
            "SELECT id, kind FROM session WHERE parent_id=? ORDER BY id",
          )
          .all(seeded.rootSessionID),
        descriptors: sqlite.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM worker_turn_descriptor").get()!.count,
      }).toMatchObject({
        peerOutcome: {
          kind: "infrastructure_failure",
          operation: "workflow_node_initial_claim",
          error_name: "WorkflowNodeOccurrenceConflictError",
          failure_issues: [
            {
              code: "workflow_node_occurrence_conflict",
              path: ["dispatch", "turn", "workflow_subject", "node_id"],
            },
          ],
        },
        peerOuterStatus: "completed",
        lineage: [{ id: winner.lineageID, dispatchID: winner.dispatchID, childSessionID: winner.childSessionID }],
        sessions: [{ id: seeded.rootSessionID, kind: "root", parentID: null }],
        physicalWorkerSessions: [],
        descriptors: 0,
      })
    } finally {
      sqlite.close()
    }
    fs.writeFileSync(path.join(barrier, "release"), "ready")
    const accepted = await finishWorker(blocked, "execute-blocked")
    const completed = new SQLite(path.join(home, "data", "opencorvus.db"), { readonly: true })
    try {
      expect({
        winnerOutcome: accepted.outcome,
        winnerOuterStatus: accepted.outerStatus,
        lineages: completed
          .query<{ id: string }, []>("SELECT id FROM engine_artifact WHERE kind='dispatch_lineage'")
          .all(),
        sessions: completed
          .query<{ id: string; kind: string; parentID: string | null }, []>(`
            SELECT id, kind, parent_id AS parentID
            FROM session
            ORDER BY CASE kind WHEN 'root' THEN 0 ELSE 1 END, id
          `)
          .all(),
        physicalWorkerSessions: completed
          .query<{ id: string; kind: string }, [string]>(
            "SELECT id, kind FROM session WHERE parent_id=? ORDER BY id",
          )
          .all(seeded.rootSessionID),
        descriptors: completed
          .query<{ session_id: string }, [string]>("SELECT session_id FROM worker_turn_descriptor WHERE session_id=?")
          .all(winner.childSessionID),
        activeAdmissionLeases: completed
          .query<{ count: number }, [string, number]>(
            "SELECT COUNT(*) AS count FROM engine_control_activation_lease WHERE target='dispatch_admission' AND target_id=? AND expires_at>?",
          )
          .get(winner.lineageID, Date.now())!.count,
        outerOutcomes: completed
          .query<{ data: string }, []>("SELECT data FROM tool_part_outcome ORDER BY request_part_id")
          .all()
          .map((row) => JSON.parse(row.data).outcome),
      }).toMatchObject({
        winnerOutcome: {
          kind: "accepted",
          session_id: winner.childSessionID,
          dispatch_lineage_id: winner.lineageID,
        },
        winnerOuterStatus: "completed",
        lineages: [{ id: winner.lineageID }],
        sessions: [
          { id: seeded.rootSessionID, kind: "root", parentID: null },
          { id: winner.childSessionID, kind: "explore", parentID: seeded.rootSessionID },
        ],
        physicalWorkerSessions: [{ id: winner.childSessionID, kind: "explore" }],
        descriptors: [{ session_id: winner.childSessionID }],
        activeAdmissionLeases: 0,
        outerOutcomes: ["completed", "completed"],
      })
    } finally {
      completed.close()
    }
  } finally {
    if (blocked && blocked.child.exitCode === null) {
      blocked.child.kill()
      await blocked.child.exited
    }
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
    }
  }
}, 60_000)
