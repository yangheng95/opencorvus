import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Identifier } from "../src/id/id"

type WorkerMode = "seed" | "hold" | "poll"

type WorkerResult = {
  mode: WorkerMode
  automationID?: string
  sessionID?: string
  nextRun?: number
  outcome?: string
  frontier?: {
    id: string
    next_run: number
    lease_until: number
    lease_owner: string | null
    pending_fire_id: string | null
    scheduled_due_at: number | null
    attempt_ordinal: number
  }
  facts?: {
    fires: Array<{ id: string; scheduled_due_at: number; origin: string }>
    attempts: Array<{ id: string; fire_id: string; ordinal: number }>
    runs: Array<{ id: string; fire_id: string }>
    receipts: Array<{ run_id: string; outcome: string }>
  }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "opencorvus-scheduler-busy-session-"))
  const home = path.join(root, "home")
  const projectPath = path.join(root, "project")
  const barrier = path.join(root, "barrier")
  mkdirSync(home, { recursive: true })
  mkdirSync(projectPath, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) {
    throw new Error(`Could not initialize scheduler busy-Session fixture: ${initialized.stderr.toString()}`)
  }
  return { root, home, projectPath, barrier, databasePath: path.join(home, "data", "opencorvus.db") }
}

function startWorker(worker: string, mode: WorkerMode, input: ReturnType<typeof fixture>) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
      worker,
      mode,
      input.projectPath,
      input.barrier,
    ],
    {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: { ...process.env, OPENCORVUS_HOME: input.home },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  return { child, stdout: new Response(child.stdout).text(), stderr: new Response(child.stderr).text() }
}

async function finishWorker(started: ReturnType<typeof startWorker>, mode: WorkerMode): Promise<WorkerResult> {
  const [exitCode, stdout, stderr] = await Promise.all([started.child.exited, started.stdout, started.stderr])
  if (exitCode !== 0) throw new Error(`Scheduler ${mode} worker failed (${exitCode}): ${stderr || stdout}`)
  const result = stdout
    .trim()
    .split(/\r?\n/)
    .toReversed()
    .map((line) => {
      try {
        return JSON.parse(line) as WorkerResult
      } catch {
        return undefined
      }
    })
    .find((candidate) => candidate?.mode === mode)
  if (!result) throw new Error(`Scheduler ${mode} worker returned no result: ${stdout}`)
  return result
}

async function runWorker(worker: string, mode: WorkerMode, input: ReturnType<typeof fixture>) {
  return finishWorker(startWorker(worker, mode, input), mode)
}

async function waitForFile(file: string, started: ReturnType<typeof startWorker>) {
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

function removeFixture(root: string) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
  }
}

test("a peer poller retains one busy Session due occurrence before one successor Fire", async () => {
  const input = fixture()
  const worker = path.join(import.meta.dir, "fixture", "scheduler-busy-session-process-worker.ts")
  let holder: ReturnType<typeof startWorker> | undefined
  try {
    const seeded = await runWorker(worker, "seed", input)
    if (!seeded.automationID || !seeded.nextRun) throw new Error("Seed worker returned no Automation identity")
    holder = startWorker(worker, "hold", input)
    await waitForFile(path.join(input.barrier, "ready.json"), holder)
    while (Date.now() <= seeded.nextRun) await Bun.sleep(25)

    const delayed = await runWorker(worker, "poll", input)
    const delayOwner = Identifier.deterministic(
      "call",
      `automation-busy-session-delay-v1\0${seeded.automationID}\0${seeded.nextRun}`,
    )
    expect({
      automationID: delayed.frontier?.id,
      originalDue: delayed.frontier?.next_run,
      delayedUntilFuture: (delayed.frontier?.lease_until ?? 0) > Date.now(),
      delayOwner: delayed.frontier?.lease_owner,
      pendingFire: delayed.frontier?.pending_fire_id,
      scheduledDue: delayed.frontier?.scheduled_due_at,
      attemptOrdinal: delayed.frontier?.attempt_ordinal,
      fireCount: delayed.facts?.fires.length,
      attemptCount: delayed.facts?.attempts.length,
      runCount: delayed.facts?.runs.length,
    }).toEqual({
      automationID: seeded.automationID,
      originalDue: seeded.nextRun,
      delayedUntilFuture: true,
      delayOwner,
      pendingFire: null,
      scheduledDue: null,
      attemptOrdinal: 0,
      fireCount: 0,
      attemptCount: 0,
      runCount: 0,
    })

    fs.writeFileSync(path.join(input.barrier, "release"), "ready")
    const settled = await finishWorker(holder, "hold")
    holder = undefined
    expect(settled.outcome).toBe("settled")

    const sqlite = new SQLite(input.databasePath)
    try {
      sqlite.run(
        "UPDATE engine_control_activation_lease SET expires_at=? WHERE target='automation' AND target_id=?",
        [Date.now() - 1, seeded.automationID],
      )
    } finally {
      sqlite.close()
    }

    const completed = await runWorker(worker, "poll", input)
    expect({
      automationID: completed.frontier?.id,
      fireFacts: completed.facts?.fires.map((fire) => ({ due: fire.scheduled_due_at, origin: fire.origin })),
      attempts: completed.facts?.attempts.map((attempt) => ({
        fireID: attempt.fire_id,
        ordinal: attempt.ordinal,
      })),
      runFireIDs: completed.facts?.runs.map((run) => run.fire_id),
      receipts: completed.facts?.receipts.map((receipt) => receipt.outcome),
    }).toEqual({
      automationID: seeded.automationID,
      fireFacts: [{ due: seeded.nextRun, origin: "scheduled" }],
      attempts: [{ fireID: completed.facts?.fires[0]?.id, ordinal: 1 }],
      runFireIDs: [completed.facts?.fires[0]?.id],
      receipts: ["succeeded"],
    })
  } finally {
    if (holder && holder.child.exitCode === null) {
      holder.child.kill()
      await holder.child.exited
    }
    removeFixture(input.root)
  }
}, 60_000)
