#!/usr/bin/env bun
/**
 * Rewind unified-entrypoint benchmark.
 *
 * Run:
 *   bun packages/opencorvus/script/benchmark/rewind-checkpoint-benchmark.ts
 */
import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import {
  createManagedTemporaryDirectory,
  currentOpenCorvusRuntimePaths,
  removeManagedDirectoryTree,
} from "@opencorvus-ai/util/runtime-directories"
import type { Message as MessageType } from "../../src/session/message"

const benchmarkOwner = path.join(currentOpenCorvusRuntimePaths().temporary, "benchmarks")
const home = await createManagedTemporaryDirectory(benchmarkOwner, "rewind-")
process.env.OPENCORVUS_HOME = home

const { EngineTaskTable } = await import("../../src/engine/engine.sql")
const { Identifier } = await import("../../src/id/id")
const { Instance } = await import("../../src/project/instance")
const { Snapshot } = await import("../../src/snapshot")
const { Database } = await import("../../src/storage/db")
const { Filesystem } = await import("../../src/util/filesystem")
const { withStreamActivity } = await import("../../src/util/stream-activity")
const { Session } = await import("../../src/session")
const { rewindTask, clearRewindCursor } = await import("../../src/engine/rewind")
const { findTask } = await import("../../src/engine/store")
const { Log } = await import("../../src/util/log")

const SHA1_RE = /^[0-9a-f]{40}$/

type Step = {
  userMessageID: string
  expectedBeforeStep: string
}

type Scenario = {
  taskID: string
  sessionID: string
  filename: string
  steps: Step[]
  cursorAfterSecondStep: number
}

type BenchCase = {
  name: string
  anchor: "message" | "cursorTime"
  resetWorktree: boolean
  expectedFile: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function benchmarkIdleMs() {
  const raw = process.env.REWIND_BENCH_IDLE_TIMEOUT_MS
  if (!raw) return 120_000
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid REWIND_BENCH_IDLE_TIMEOUT_MS=${raw}`)
  return value
}

async function makeRepo(label: string) {
  const dir = await createManagedTemporaryDirectory(path.join(home, "tmp"), `repository-${label}-`)
  await $`git init`.cwd(dir).quiet()
  await $`git commit --allow-empty -m ${"root-" + label}`.cwd(dir).quiet()
  return dir
}

async function createScenario(root: string): Promise<Scenario> {
  const sessionID = (await Session.create({ kind: "root", title: "rewind benchmark root" })).id
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.use((db) =>
    db
      .insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: sessionID,
        source: "benchmark",
        title: "rewind benchmark task",
        request: "rewind benchmark task",
        priority: "normal",
        time_created: now,
        time_updated: now,
      })
      .run(),
  )

  const filename = path.join(root, "doc.txt")
  await Filesystem.write(filename, "S0")

  const steps: Step[] = []
  let cursorAfterSecondStep = 0

  for (let i = 1; i <= 4; i++) {
    const userMsg = await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "user",
      sessionID,
      agent: "default",
      model: { providerID: "openai", modelID: "gpt-4" },
      time: { created: Date.now() },
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: userMsg.id,
      sessionID,
      type: "text",
      text: `step-${i} request`,
    })
    await sleep(2)

    const preEditHash = await Snapshot.track()
    assert(typeof preEditHash === "string" && SHA1_RE.test(preEditHash), `invalid pre-edit hash at step ${i}`)

    const assistantMsg: MessageType.Assistant = {
      id: Identifier.ascending("message"),
      role: "assistant",
      sessionID,
      mode: "default",
      agent: "default",
      path: { cwd: root, root },
      cost: 0,
      tokens: { output: 0, input: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      modelID: "gpt-4",
      providerID: "openai",
      parentID: userMsg.id,
      time: { created: Date.now() },
      finish: "end_turn",
    }
    await Session.updateMessage(assistantMsg)
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: assistantMsg.id,
      sessionID,
      type: "text",
      text: `step-${i} reply`,
    })
    await sleep(2)
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: assistantMsg.id,
      sessionID,
      type: "patch",
      hash: preEditHash,
      files: [filename.replaceAll("\\", "/")],
    })

    await Filesystem.write(filename, `S${i}`)
    if (i === 2) {
      cursorAfterSecondStep = Date.now()
      await sleep(2)
    }

    steps.push({
      userMessageID: userMsg.id,
      expectedBeforeStep: `S${i - 1}`,
    })
  }

  assert((await fs.readFile(filename, "utf-8")) === "S4", "scenario did not finish at S4")
  return { taskID, sessionID, filename, steps, cursorAfterSecondStep }
}

async function runCase(item: BenchCase) {
  const dir = await makeRepo(item.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase())
  return await Instance.provide({
    directory: dir,
    fn: async () => {
      const scenario = await createScenario(dir)
      const target = scenario.steps[2]!
      const result = await rewindTask({
        taskID: scenario.taskID,
        anchor:
          item.anchor === "message"
            ? {
                kind: "message",
                sessionID: scenario.sessionID,
                messageID: target.userMessageID,
              }
            : {
                kind: "cursorTime",
                cursorTime: scenario.cursorAfterSecondStep,
                anchorEventID: `bench-${item.name}`,
              },
        resetWorktree: item.resetWorktree,
        reason: `benchmark ${item.name}`,
      })

      assert(result.resetWorktree === item.resetWorktree, `${item.name}: resetWorktree mismatch`)
      assert(result.anchorKind === item.anchor, `${item.name}: anchorKind mismatch`)
      const file = await fs.readFile(scenario.filename, "utf-8")
      assert(file === item.expectedFile, `${item.name}: file=${file}, expected=${item.expectedFile}`)
      assert(findTask(scenario.taskID)?.rewind_cursor_time === result.cursorTime, `${item.name}: cursor not persisted`)

      await clearRewindCursor(scenario.taskID)
      assert(findTask(scenario.taskID)?.rewind_cursor_time === null, `${item.name}: cursor not cleared`)
      const fileAfterClear = await fs.readFile(scenario.filename, "utf-8")
      assert(fileAfterClear === item.expectedFile, `${item.name}: clear changed file state`)

      return { cursorTime: result.cursorTime, rewindCount: result.rewindCount, file }
    },
  })
}

async function runWithIdleSignal<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener("abort", onAbort, { once: true })
  })
  try {
    return await Promise.race([work, aborted])
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  }
}

const cases: BenchCase[] = [
  { name: "message.resetWorktree.true", anchor: "message", resetWorktree: true, expectedFile: "S2" },
  { name: "message.resetWorktree.false", anchor: "message", resetWorktree: false, expectedFile: "S4" },
  { name: "cursorTime.resetWorktree.true", anchor: "cursorTime", resetWorktree: true, expectedFile: "S2" },
  { name: "cursorTime.resetWorktree.false", anchor: "cursorTime", resetWorktree: false, expectedFile: "S4" },
]

const idleMs = benchmarkIdleMs()
const activity = withStreamActivity({ idleMs, label: "rewind-checkpoint-benchmark" })
let pass = 0
let fail = 0
const cleanupErrors: string[] = []
const started = Date.now()

try {
  for (const item of cases) {
    activity.observe()
    const t0 = Date.now()
    try {
      const metrics = await runWithIdleSignal(runCase(item), activity.signal)
      activity.observe()
      console.log(`[ok]   ${item.name} dur=${Date.now() - t0}ms ${JSON.stringify(metrics)}`)
      pass++
    } catch (error) {
      const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
      console.log(`[fail] ${item.name} dur=${Date.now() - t0}ms\n        ${message.replace(/\n/g, "\n        ")}`)
      fail++
      if (activity.timedOut()) break
    }
  }
} finally {
  activity.dispose()
  try {
    await Instance.disposeAll()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    cleanupErrors.push(`instance.disposeAll: ${message}`)
    console.log(`[cleanup] instance.disposeAll failed: ${message}`)
  } finally {
    try {
      Database.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      cleanupErrors.push(`database.close: ${message}`)
      console.log(`[cleanup] database close failed: ${message}`)
    }
    try {
      await Log.close()
      await removeManagedDirectoryTree(home)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      cleanupErrors.push(`managed-directory.remove: ${message}`)
      console.log(`[cleanup] managed benchmark directory removal failed: ${message}`)
    }
  }
}

console.log(
  `\nresult: pass=${pass} fail=${fail} cleanup_fail=${cleanupErrors.length} total=${pass + fail} elapsed=${Date.now() - started}ms idleMs=${idleMs}`,
)
process.exit(fail > 0 || cleanupErrors.length > 0 ? 1 : 0)
