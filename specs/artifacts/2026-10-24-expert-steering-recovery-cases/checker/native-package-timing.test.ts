import { test, expect } from "bun:test"
import fs from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { ProcessSupervisor } from "../../../../packages/opencorvus/src/shell/process-supervisor"
import { ExpertSquadRegistry } from "../../../../packages/opencorvus/src/expert-squad/registry"
import { introspectPackageToolInCapsule } from "../../../../packages/opencorvus/src/expert-squad/package-tool-capsule"
import { memoryProject, resetMemoryDatabase } from "../../../../packages/opencorvus/test/fixture/memory"
import { persistEstablishedTask } from "../../../../packages/opencorvus/test/fixture/engine-task"
import { prepareTaskProcessBinding } from "../../../../packages/opencorvus/src/engine/task-execution-capsule-binding"
import { Instance } from "../../../../packages/opencorvus/src/project/instance"
import { Session } from "../../../../packages/opencorvus/src/session"
import { Identifier } from "../../../../packages/opencorvus/src/id/id"

test("original frozen native workers settle with exact Task and Project provenance", async () => {
  const root = path.resolve(
    import.meta.dir,
    "../../../../.tmp-product-iteration/expert-steering-recovery",
    `native-package-timing-${Date.now()}`,
  )
  await fs.mkdir(path.dirname(root), { recursive: true })
  await fs.mkdir(root)
  const requests: any[] = [],
    timings: any[] = [],
    io: any[] = [],
    results: any[] = []
  const handles = new WeakMap<object, any>(),
    requestDirectories = new Map<string, any>()
  const originalHandles = new Set<ProcessSupervisor.Handle>()
  const restoreObserver = ProcessSupervisor.setWindowsRequestObserverForTest((request) => {
    const { request_id, ready_file, runtime_occurrence_id } = request
    if (typeof request_id !== "string" || typeof ready_file !== "string" || typeof runtime_occurrence_id !== "string")
      throw new TypeError("Original native request must expose its exact request, path and occurrence identity")
    const entry = {
      requestID: request_id,
      directory: path.dirname(ready_file),
      readyFile: ready_file,
      owner: runtime_occurrence_id,
    }
    requests.push(entry)
    requestDirectories.set(entry.directory, entry)
  })
  const originals = {
    rm: fs.rm,
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    spawn: ProcessSupervisor.spawnTaskCommand,
    dispose: ProcessSupervisor.disposeAndWaitForExit,
  }
  for (const name of ["rm", "readFile", "writeFile"] as const) {
    ;(fs as any)[name] = (...args: any[]) => {
      const candidate = String(args[0]),
        parent = path.dirname(candidate)
      const request = requestDirectories.get(candidate) ?? requestDirectories.get(parent)
      if (!request) return (originals[name] as any)(...args)
      const beganAt = Date.now(),
        start = performance.now(),
        entry: any = { requestID: request.requestID, operation: name, file: path.basename(candidate), beganAt }
      io.push(entry)
      const original = (originals[name] as any)(...args)
      void original.then(
        () => {
          entry.elapsedMs = performance.now() - start
          entry.outcome = "fulfilled"
        },
        (error: any) => {
          entry.elapsedMs = performance.now() - start
          entry.outcome = "rejected"
          entry.code = error.code
          entry.error = String(error)
        },
      )
      return original
    }
  }
  ProcessSupervisor.spawnTaskCommand = async (...args: Parameters<typeof originals.spawn>) => {
    const handle = await originals.spawn(...args),
      observed = performance.now()
    originalHandles.add(handle)
    let match: any
    for (let i = requests.length - 1; i >= 0 && i >= requests.length - 24; i--) {
      try {
        const ready = JSON.parse(readFileSync(requests[i].readyFile, "utf8"))
        if (ready.target_pid === handle.pid) {
          match = { ...requests[i], ready }
          break
        }
      } catch {}
    }
    if (!match) throw new Error(`Original native request for ${handle.pid} is unavailable`)
    const record: any = {
      ...match,
      pid: handle.pid,
      taskID: args[0].taskID,
      cwd: args[0].cwd,
      observerOverheadMs: performance.now() - observed,
      admittedAt: Date.now(),
    }
    handles.set(handle, record)
    timings.push(record)
    for (const [name, promise] of [
      ["physical", handle.exited],
      ["output", handle.outputSettled],
      ["settlement", handle.settled],
    ] as const) {
      void promise.then(
        (value) => {
          record[name] = { at: Date.now(), value }
        },
        (error) => {
          record[name] = { at: Date.now(), error: String(error) }
        },
      )
    }
    return handle
  }
  ProcessSupervisor.disposeAndWaitForExit = async (handle, label, options) => {
    const record = handles.get(handle),
      start = performance.now()
    if (record) record.disposal = { beganAt: Date.now(), label }
    try {
      const result = await originals.dispose(handle, label, options)
      if (record) record.disposal.exitCode = result
      return result
    } catch (error) {
      if (record) record.disposal.error = String(error)
      throw error
    } finally {
      if (record) record.disposal.elapsedMs = performance.now() - start
    }
  }
  const periodicSampling = false
  try {
    await using projectA = await memoryProject()
    await using projectB = await memoryProject()
    const loaded = await ExpertSquadRegistry.loadSourcePackage(
      path.resolve(import.meta.dir, "../../../../expert-squads/builtin/marketing-growth"),
    )
    const prepared = loaded.packageToolBundles.get("marketing-growth/shared/publish-marketing-growth-artifact")
    if (!prepared) throw new Error("Exact marketing-growth publisher is unavailable")
    const members = [] as any[]
    for (const project of [projectA, projectB])
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = Session.prepareRootNext({
            kind: "root",
            directory: Instance.directory,
            title: "Native timing",
          })
          const taskID = Identifier.ascending("task"),
            now = Date.now()
          persistEstablishedTask({
            taskID,
            rootSession: session,
            now,
            title: "Native timing",
            request: "Introspect original publisher",
            productPillar: "work",
            source: "test",
            priority: "normal",
            metadata: {},
            projectID: Instance.project.id,
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: loaded.manifest.namespace,
              id: loaded.manifest.id,
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            executionCapsuleBinding: await prepareTaskProcessBinding({
              mode: "native",
              taskID,
              projectID: Instance.project.id,
              rootDirectory: project.path,
              packageRevisionSHA256: loaded.packageDigest,
              timeCreated: now,
            }),
          })
          members.push({ taskID, projectID: Instance.project.id, cwd: project.path })
        },
      })
    for (let round = 0; round < 24; round++) {
      if (round % 4 === 0) await Bun.sleep(10_000)
      const parallel = round < 8 ? 1 : 8
      const outcomes = await Promise.allSettled(
        Array.from({ length: parallel }, async (_, index) => {
          const member = members[(round + index) % 2]
          await Instance.provide({
            directory: member.cwd,
            fn: async () => {
              const value = await introspectPackageToolInCapsule({ prepared, taskID: member.taskID, cwd: member.cwd })
              results.push({ ...member, round, description: value.description, type: value.inputSchema.type })
            },
          })
        }),
      )
      const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))
      if (failures.length) throw new AggregateError(failures, "Original native package calls failed")
      console.log(
        JSON.stringify({ round, workers: results.length, latestDisposal: timings.at(-1)?.disposal, periodicSampling }),
      )
    }
    expect(results.map((x) => ({ description: x.description, type: x.type }))).toEqual(
      Array.from({ length: 136 }, () => ({
        description:
          "Validate and publish one strict marketing-growth Artifact ABI value with exact selected predecessors and immutable resources.",
        type: "object",
      })),
    )
    const keys = (entries: any[]) => entries.map((x) => `${x.taskID}|${x.cwd}`).sort()
    expect(keys(timings)).toEqual(keys(results))
  } finally {
    await Promise.allSettled(
      [...originalHandles].flatMap((handle) => [handle.dispose(), handle.exited, handle.outputSettled, handle.settled]),
    )
    ProcessSupervisor.spawnTaskCommand = originals.spawn
    ProcessSupervisor.disposeAndWaitForExit = originals.dispose
    for (const name of ["rm", "readFile", "writeFile"] as const) (fs as any)[name] = originals[name]
    restoreObserver()
    await fs.writeFile(
      path.join(root, "observations.json"),
      JSON.stringify({ periodicSampling, requests, timings, io, results }, null, 2),
    )
    console.log(
      JSON.stringify({
        root,
        workers: results.length,
        observed: timings.length,
        errors: timings.filter((x) => x.disposal?.error),
        slowIO: io.filter((x) => x.elapsedMs > 100),
        periodicSampling,
      }),
    )
    await resetMemoryDatabase()
  }
}, 180_000)
