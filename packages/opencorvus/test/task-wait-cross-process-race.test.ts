import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

type WorkerMode = "seed" | "due-blocked" | "operator" | "reconcile"

function startWorker(input: {
  worker: string
  mode: WorkerMode
  projectPath: string
  taskKey: string
  home: string
  barrier?: string
}) {
  const child = Bun.spawn(
    [
      process.execPath,
      `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
      input.worker,
      input.mode,
      input.projectPath,
      input.taskKey,
      ...(input.barrier ? [input.barrier] : []),
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
  if (exitCode !== 0) throw new Error(`Task wait ${mode} worker failed (${exitCode}): ${stderr || stdout}`)
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
  if (!result) throw new Error(`Task wait ${mode} worker returned no result: ${stdout}`)
  return result as {
    mode: WorkerMode
    taskID: string
    projectID?: string
    wait?: { id: string; dueAt: number; status: string }
    waits?: Array<{ id: string; status: string; ingressID?: string }>
    activatedWakeIDs?: string[]
    activatedCount?: number
    result?: { wake_status: string; ingress_id?: string; user_message?: { info?: { id?: string } } }
  }
}

function runWorker(input: Parameters<typeof startWorker>[0]) {
  return finishWorker(startWorker(input), input.mode)
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

function initializeGitProject(projectPath: string) {
  mkdirSync(projectPath, { recursive: true })
  const initialized = Bun.spawnSync(["git", "init"], { cwd: projectPath, stdout: "pipe", stderr: "pipe" })
  if (initialized.exitCode !== 0) {
    throw new Error(`Could not initialize Task wait race fixture: ${initialized.stderr.toString()}`)
  }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "opencorvus-task-wait-race-"))
  const home = path.join(root, "home")
  const projectA = path.join(root, "project-a")
  const projectB = path.join(root, "project-b")
  const barrier = path.join(root, "barrier")
  mkdirSync(home, { recursive: true })
  mkdirSync(barrier, { recursive: true })
  initializeGitProject(projectA)
  initializeGitProject(projectB)
  return { root, home, projectA, projectB, barrier, databasePath: path.join(home, "data", "opencorvus.db") }
}

function removeFixture(root: string) {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EBUSY") throw error
  }
}

test("due wait and operator ingress converge once across a killed owner while another Project progresses", async () => {
  const input = fixture()
  const worker = path.join(import.meta.dir, "fixture", "task-wait-ingress-race-process-worker.ts")
  let blocked: ReturnType<typeof startWorker> | undefined
  try {
    const seedA = await runWorker({
      worker,
      mode: "seed",
      projectPath: input.projectA,
      taskKey: "project-a",
      home: input.home,
    })
    const seedB = await runWorker({
      worker,
      mode: "seed",
      projectPath: input.projectB,
      taskKey: "project-b",
      home: input.home,
    })
    if (!seedA.wait || !seedB.wait) throw new Error("Task wait race seed returned no durable wait")
    await Bun.sleep(Math.max(0, Math.max(seedA.wait.dueAt, seedB.wait.dueAt) - Date.now() + 100))

    blocked = startWorker({
      worker,
      mode: "due-blocked",
      projectPath: input.projectA,
      taskKey: "project-a",
      home: input.home,
      barrier: input.barrier,
    })
    const readyFile = path.join(input.barrier, "due-owner-ready.json")
    await waitForFile(readyFile, blocked)
    const claimed = JSON.parse(fs.readFileSync(readyFile, "utf8")) as {
      taskID: string
      waitID: string
      wakeID: string
      activationID: string
    }

    const operatorStarted = startWorker({
      worker,
      mode: "operator",
      projectPath: input.projectA,
      taskKey: "project-a",
      home: input.home,
    })
    const projectBResult = await runWorker({
      worker,
      mode: "reconcile",
      projectPath: input.projectB,
      taskKey: "project-b",
      home: input.home,
    })
    const operatorResult = await finishWorker(operatorStarted, "operator")
    expect(blocked.child.exitCode).toBeNull()

    blocked.child.kill()
    await blocked.child.exited
    const leaseDatabase = new SQLite(input.databasePath, { readonly: true })
    const killedLease = leaseDatabase
      .query<{ expiresAt: number }, [string]>(
        "SELECT expires_at AS expiresAt FROM engine_control_activation_lease WHERE id=?",
      )
      .get(claimed.activationID)
    leaseDatabase.close()
    if (!killedLease) throw new Error(`Killed activation ${claimed.activationID} was not persisted`)
    await Bun.sleep(Math.max(0, killedLease.expiresAt - Date.now() + 75))

    const restarted = await runWorker({
      worker,
      mode: "reconcile",
      projectPath: input.projectA,
      taskKey: "project-a",
      home: input.home,
    })

    const sqlite = new SQLite(input.databasePath, { readonly: true })
    try {
      const settlementFor = (waitID: string) =>
        sqlite
          .query<{ waitID: string; ingressID: string; disposition: string }, [string]>(
            "SELECT wait_id AS waitID, ingress_id AS ingressID, disposition FROM engine_task_wait_settlement WHERE wait_id=?",
          )
          .all(waitID)
      const waitIngressesFor = (waitID: string) =>
        sqlite
          .query<{ id: string }, [string]>(
            "SELECT id FROM engine_task_root_ingress WHERE source='inline' AND json_extract(inline_payload,'$.taskWaitWake.jobID')=? ORDER BY id",
          )
          .all(waitID)
      const settlementA = settlementFor(seedA.wait.id)
      const settlementB = settlementFor(seedB.wait.id)
      const dueIngressesA = waitIngressesFor(seedA.wait.id)
      const dueIngressesB = waitIngressesFor(seedB.wait.id)
      const operatorIngressID = operatorResult.result?.ingress_id
      const operatorIngress = operatorIngressID
        ? sqlite
            .query<{ id: string; taskID: string; source: string }, [string]>(
              "SELECT id, task_id AS taskID, source FROM engine_task_root_ingress WHERE id=?",
            )
            .get(operatorIngressID)
        : undefined
      const dueActivationCount = sqlite
        .query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM engine_control_activation_lease WHERE target='task_root_ingress' AND target_id=?",
        )
        .get(claimed.wakeID)!.count
      expect({
        isolatedProjects: [seedA.projectID, seedB.projectID],
        claimed,
        projectB: {
          activatedWakeIDs: projectBResult.activatedWakeIDs,
          wait: projectBResult.waits?.map(({ id, status, ingressID }) => ({ id, status, ingressID })),
          settlement: settlementB,
          dueIngresses: dueIngressesB,
        },
        operator: { wakeStatus: operatorResult.result?.wake_status, ingress: operatorIngress },
        restart: {
          activatedCount: restarted.activatedCount,
          activatedWakeIDs: restarted.activatedWakeIDs,
          wait: restarted.waits?.map(({ id, status, ingressID }) => ({ id, status, ingressID })),
          dueActivationCount,
        },
        projectA: { settlement: settlementA, dueIngresses: dueIngressesA },
      }).toEqual({
        isolatedProjects: [seedA.projectID, seedB.projectID],
        claimed: {
          taskID: seedA.taskID,
          waitID: seedA.wait.id,
          wakeID: dueIngressesA[0]?.id,
          activationID: claimed.activationID,
        },
        projectB: {
          activatedWakeIDs: [dueIngressesB[0]?.id],
          wait: [{ id: seedB.wait.id, status: "due_ingress_accepted", ingressID: dueIngressesB[0]?.id }],
          settlement: [
            { waitID: seedB.wait.id, ingressID: dueIngressesB[0]?.id, disposition: "due_ingress_accepted" },
          ],
          dueIngresses: [{ id: dueIngressesB[0]?.id }],
        },
        operator: {
          wakeStatus: "accepted",
          ingress: { id: operatorIngressID, taskID: seedA.taskID, source: "message" },
        },
        restart: {
          activatedCount: 2,
          activatedWakeIDs: [claimed.wakeID, operatorIngressID],
          wait: [{ id: seedA.wait.id, status: "due_ingress_accepted", ingressID: claimed.wakeID }],
          dueActivationCount: 2,
        },
        projectA: {
          settlement: [
            { waitID: seedA.wait.id, ingressID: claimed.wakeID, disposition: "due_ingress_accepted" },
          ],
          dueIngresses: [{ id: claimed.wakeID }],
        },
      })
      expect(new Set([seedA.projectID, seedB.projectID]).size).toBe(2)
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
