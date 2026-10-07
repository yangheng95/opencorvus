import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { memoryProject } from "../packages/opencorvus/test/fixture/memory"
import { persistEstablishedTask } from "../packages/opencorvus/test/fixture/engine-task"
import { Instance } from "../packages/opencorvus/src/project/instance"
import { Config } from "../packages/opencorvus/src/config/config"
import { Session } from "../packages/opencorvus/src/session"
import { Identifier } from "../packages/opencorvus/src/id/id"
import { PromptProfileResolver } from "../packages/opencorvus/src/expert-squad/prompt-profile-resolver"
import { configuredTaskProcessMode, prepareTaskProcessBinding, readTaskProcessBinding } from "../packages/opencorvus/src/engine/task-execution-capsule-binding"
import { ProcessSupervisor } from "../packages/opencorvus/src/shell/process-supervisor"

const evidence = path.resolve(import.meta.dir, "../specs/artifacts/2026-10-05-connection-workspace-authority/async-lifetime-107")
async function task(project: string) {
  return await Instance.provide({ directory: project, fn: async () => {
    const config = await Config.get()
    const revision = await PromptProfileResolver.resolveActivePackageRevision({ projectDirectory: project, config })
    const root = Session.prepareRootNext({ kind: "root", directory: project, title: "Owned checkpoint lifetime" })
    const taskID = Identifier.ascending("task")
    const now = Date.now()
    const binding = await prepareTaskProcessBinding({ mode: configuredTaskProcessMode(), taskID, projectID: Instance.project.id, rootDirectory: project, packageRevisionSHA256: revision.packageDigest, timeCreated: now })
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Owned checkpoint lifetime", request: "Native checkpoint callback lifetime only", productPillar: "code", metadata: {}, projectID: Instance.project.id, packageRevision: revision, executionCapsuleBinding: binding })
    return { taskID, projectID: Instance.project.id, cwd: project, binding: readTaskProcessBinding(taskID) }
  } })
}
async function output(stream: NodeJS.ReadableStream | null) {
  let text = ""
  if (stream) for await (const chunk of stream) text += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk)
  return text
}

for (const role of ["mandatory", "auxiliary"] as const) test(`native ${role} checkpoint callback holds sameTask admission and preserves otherTask output`, async () => {
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
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { listener = () => reject(abort.reason); abort.addEventListener("abort", listener, { once: true }); if(abort.aborted) listener() })]) }
    finally { abort.removeEventListener("abort", listener) }
  }
  try {
    const [a,b] = await bounded(Promise.all([task(projectA.path), task(projectB.path)]))
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
    await bounded(Promise.race([entered.promise, checkpoint.then(() => { throw new Error("Checkpoint settled before entry receipt") })]))
    const spawn = async (identity: typeof a, label: string) => {
      const handle = await ProcessSupervisor.spawnTaskCommand({ taskID: identity.taskID, cwd: identity.cwd }, { executable: process.execPath, args: ["-e", `process.stdout.write(JSON.stringify({marker:${JSON.stringify(label)},cwd:process.cwd()})+'\\n')`], taskCancellationRole: role, signal, deadlineAt })
      handles.push(handle)
      receipts.push(`${label}-admitted`)
      const [stdout,stderr,exitCode] = await Promise.all([output(handle.stdout), output(handle.stderr), handle.exited])
      if (handle.settled) await handle.settled
      else if (handle.outputSettled) await handle.outputSettled
      receipts.push(`${label}-settled`)
      return { taskID: identity.taskID, pid: handle.pid, stdout, stderr, exitCode, metric: ProcessSupervisor.taskMetricsSnapshot(identity.taskID) }
    }
    const same = spawn(a,"same-task")
    const other = spawn(b,"other-task")
    operations.push(same,other)
    const otherResult = await bounded(other)
    release.resolve()
    const [checkpointResult,sameResult] = await bounded(Promise.all([checkpoint,same]))
    const state = await fs.readFile(path.join(projectA.path,"checkpoint-receipt.txt"),"utf8")
    const facts = { role, a,b, receipts, checkpointResult, sameResult, otherResult, state, boundary: "real native Task binding and lease callbacks; data fixture Task creation without model execution epoch" }
    await fs.writeFile(path.join(evidence,`checkpoint-${role}-${crypto.randomUUID()}.json`),JSON.stringify(facts,null,2),{flag:"wx"})
    console.log(JSON.stringify(facts))
    expect({checkpointResult,state}).toEqual({checkpointResult:"checkpoint-completed",state:"completed"})
    expect({exitCode:otherResult.exitCode,output:JSON.parse(otherResult.stdout)}).toEqual({exitCode:0,output:{marker:"other-task",cwd:projectB.path}})
    expect({exitCode:sameResult.exitCode,output:JSON.parse(sameResult.stdout)}).toEqual({exitCode:0,output:{marker:"same-task",cwd:projectA.path}})
    expect(receipts.filter(value=>value==="checkpoint-completed"||value==="same-task-admitted")).toEqual(["checkpoint-completed","same-task-admitted"])
  } finally {
    release.resolve()
    for (const handle of handles) await ProcessSupervisor.disposeAndWaitForExit(handle,"owned107 baseline cleanup")
    const joined = await bounded(Promise.allSettled(operations),AbortSignal.timeout(15000))
    console.log(JSON.stringify({role,joined:joined.map(value=>value.status)}))
    await projectB[Symbol.asyncDispose]()
    await projectA[Symbol.asyncDispose]()
  }
}, 45000)
