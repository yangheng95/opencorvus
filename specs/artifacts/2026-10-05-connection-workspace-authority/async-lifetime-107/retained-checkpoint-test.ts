import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { memoryProject } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"
import { Instance } from "../src/project/instance"
import { Config } from "../src/config/config"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import {
  configuredTaskProcessMode,
  prepareTaskProcessBinding,
  readTaskProcessBinding,
} from "../src/engine/task-execution-capsule-binding"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

async function task(project: string) {
  return await Instance.provide({
    directory: project,
    fn: async () => {
      const config = await Config.get()
      const revision = await PromptProfileResolver.resolveActivePackageRevision({ projectDirectory: project, config })
      const root = Session.prepareRootNext({ kind: "root", directory: project, title: "Owned checkpoint lifetime" })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      const binding = await prepareTaskProcessBinding({
        mode: configuredTaskProcessMode(),
        taskID,
        projectID: Instance.project.id,
        rootDirectory: project,
        packageRevisionSHA256: revision.packageDigest,
        timeCreated: now,
      })
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Owned checkpoint lifetime",
        request: "Native checkpoint callback lifetime only",
        productPillar: "code",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision: revision,
        executionCapsuleBinding: binding,
      })
      return { taskID, projectID: Instance.project.id, cwd: project, binding: readTaskProcessBinding(taskID) }
    },
  })
}
async function output(stream: NodeJS.ReadableStream | null) {
  let text = ""
  if (stream) for await (const chunk of stream) text += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
  return text
}

for (const role of ["mandatory", "auxiliary"] as const)
  test(`native ${role} checkpoint callback holds sameTask admission and preserves otherTask output`, async () => {
    const projectA = await memoryProject()
    const projectB = await memoryProject()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const deadlineAt = Date.now() + 15000
    const signal = AbortSignal.timeout(15000)
    const operations: Promise<unknown>[] = []
    const handles: ProcessSupervisor.Handle[] = []
    const receipts: string[] = []
    const bounded = async <T>(promise: Promise<T>, abort = signal): Promise<T> => {
      let listener!: () => void
      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            listener = () => reject(abort.reason)
            abort.addEventListener("abort", listener, { once: true })
            if (abort.aborted) listener()
          }),
        ])
      } finally {
        abort.removeEventListener("abort", listener)
      }
    }
    try {
      const [a, b] = await bounded(Promise.all([task(projectA.path), task(projectB.path)]))
      const checkpoint = ProcessSupervisor.withTaskCheckpointLease(a.taskID, async () => {
        receipts.push("checkpoint-entered")
        await fs.writeFile(path.join(projectA.path, "checkpoint-receipt.txt"), "entered")
        entered.resolve()
        await bounded(release.promise)
        await fs.writeFile(path.join(projectA.path, "checkpoint-receipt.txt"), "completed")
        receipts.push("checkpoint-completed")
        return "checkpoint-completed"
      })
      operations.push(checkpoint)
      await bounded(
        Promise.race([
          entered.promise,
          checkpoint.then(() => {
            throw new Error("Checkpoint settled before entry receipt")
          }),
        ]),
      )
      const spawn = async (identity: typeof a, label: string) => {
        const handle = await ProcessSupervisor.spawnTaskCommand(
          { taskID: identity.taskID, cwd: identity.cwd },
          {
            executable: process.execPath,
            args: [
              "-e",
              `process.stdout.write(JSON.stringify({marker:${JSON.stringify(label)},cwd:process.cwd()})+'\\n')`,
            ],
            taskCancellationRole: role,
            signal,
            deadlineAt,
          },
        )
        handles.push(handle)
        receipts.push(`${label}-admitted`)
        const [stdout, stderr, exitCode] = await Promise.all([
          output(handle.stdout),
          output(handle.stderr),
          handle.exited,
        ])
        if (handle.settled) await handle.settled
        else if (handle.outputSettled) await handle.outputSettled
        receipts.push(`${label}-settled`)
        return {
          taskID: identity.taskID,
          pid: handle.pid,
          stdout,
          stderr,
          exitCode,
          metric: ProcessSupervisor.taskMetricsSnapshot(identity.taskID),
        }
      }
      const same = spawn(a, "same-task")
      const other = spawn(b, "other-task")
      operations.push(same, other)
      const otherResult = await bounded(other)
      release.resolve()
      const [checkpointResult, sameResult] = await bounded(Promise.all([checkpoint, same]))
      const state = await fs.readFile(path.join(projectA.path, "checkpoint-receipt.txt"), "utf8")
      const facts = {
        role,
        a,
        b,
        receipts,
        checkpointResult,
        sameResult,
        otherResult,
        state,
        boundary:
          "real native Task binding and lease callbacks; data fixture Task creation without model execution epoch",
      }
      console.log(JSON.stringify(facts))
      expect({ checkpointResult, state }).toEqual({ checkpointResult: "checkpoint-completed", state: "completed" })
      expect({ exitCode: otherResult.exitCode, output: JSON.parse(otherResult.stdout) }).toEqual({
        exitCode: 0,
        output: { marker: "other-task", cwd: projectB.path },
      })
      expect({ exitCode: sameResult.exitCode, output: JSON.parse(sameResult.stdout) }).toEqual({
        exitCode: 0,
        output: { marker: "same-task", cwd: projectA.path },
      })
      expect(receipts.filter((value) => value === "checkpoint-completed" || value === "same-task-admitted")).toEqual([
        "checkpoint-completed",
        "same-task-admitted",
      ])
    } finally {
      release.resolve()
      for (const handle of handles) await ProcessSupervisor.disposeAndWaitForExit(handle, "owned107 baseline cleanup")
      const joined = await bounded(Promise.allSettled(operations), AbortSignal.timeout(15000))
      console.log(JSON.stringify({ role, joined: joined.map((value) => value.status) }))
      await projectB[Symbol.asyncDispose]()
      await projectA[Symbol.asyncDispose]()
    }
  }, 45000)

for (const role of ["mandatory", "auxiliary"] as const)
  test(`native ${role} checkpoint rejection retains the original error and admits its next legal Task command`, async () => {
    const project = await memoryProject()
    const release = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const signal = AbortSignal.timeout(15000)
    const original = new Error("Owned checkpoint callback failure")
    const handles: ProcessSupervisor.Handle[] = []
    const order: string[] = []
    const bounded = async <T>(promise: Promise<T>, abort = signal): Promise<T> => {
      let listener!: () => void
      try {
        return await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            listener = () => reject(abort.reason)
            abort.addEventListener("abort", listener, { once: true })
            if (abort.aborted) listener()
          }),
        ])
      } finally {
        abort.removeEventListener("abort", listener)
      }
    }
    let checkpoint: Promise<unknown> | undefined
    let next: Promise<unknown> | undefined
    try {
      const identity = await bounded(task(project.path))
      checkpoint = ProcessSupervisor.withTaskCheckpointLease(identity.taskID, async () => {
        await fs.writeFile(path.join(project.path, "rejected-checkpoint.txt"), "prepared")
        entered.resolve()
        await bounded(release.promise)
        order.push("checkpoint-rejected")
        throw original
      })
      const observed = checkpoint.then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error) => ({ status: "rejected" as const, error }),
      )
      await bounded(
        Promise.race([
          entered.promise,
          observed.then(() => {
            throw new Error("Checkpoint settled before entry")
          }),
        ]),
      )
      next = (async () => {
        const handle = await ProcessSupervisor.spawnTaskCommand(
          { taskID: identity.taskID, cwd: identity.cwd },
          {
            executable: process.execPath,
            args: ["-e", "process.stdout.write('LEGAL_AFTER_REJECTION')"],
            taskCancellationRole: role,
            signal,
            deadlineAt: Date.now() + 15000,
          },
        )
        handles.push(handle)
        order.push("next-admitted")
        const [stdout, exitCode] = await Promise.all([output(handle.stdout), handle.exited, output(handle.stderr)])
        if (handle.settled) await handle.settled
        else if (handle.outputSettled) await handle.outputSettled
        return { stdout, exitCode }
      })()
      release.resolve()
      const [failed, result] = await bounded(Promise.all([observed, next]))
      console.log(JSON.stringify({ role, order, failure: failed.status, result }))
      expect(failed.status).toBe("rejected")
      if (failed.status !== "rejected") throw new Error("Expected current checkpoint callback rejection")
      expect(failed.error).toBe(original)
      expect({ order, result }).toEqual({
        order: ["checkpoint-rejected", "next-admitted"],
        result: { stdout: "LEGAL_AFTER_REJECTION", exitCode: 0 },
      })
    } finally {
      release.resolve()
      for (const handle of handles) await ProcessSupervisor.disposeAndWaitForExit(handle, "owned107 rejection cleanup")
      await bounded(
        Promise.allSettled([...(checkpoint ? [checkpoint] : []), ...(next ? [next] : [])]),
        AbortSignal.timeout(15000),
      )
      await project[Symbol.asyncDispose]()
    }
  }, 45000)
