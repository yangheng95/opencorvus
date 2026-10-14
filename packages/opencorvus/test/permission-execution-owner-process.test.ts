import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"

for (const scenario of ["live-same-project", "live-two-projects", "dead-unexpired", "dead-expired"] as const) {
  test(`permission execution retains exact physical authority: ${scenario}`, async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw Error("The formal isolated process runtime is required")
    const parentStartedAt = Date.now(), caseDeadlineAt = parentStartedAt + 600000
    const rawWrapperDeadline = process.env.OPENCORVUS_PERMISSION_OWNER_DEADLINE_AT
    const wrapperDeadlineAt = rawWrapperDeadline === undefined ? undefined : Number(rawWrapperDeadline)
    if (wrapperDeadlineAt !== undefined && (!Number.isSafeInteger(wrapperDeadlineAt) || wrapperDeadlineAt <= parentStartedAt))
      throw Error("The supplied original permission-process wrapper deadline must be a future integer")
    const parentDeadlineAt = wrapperDeadlineAt === undefined ? caseDeadlineAt : Math.min(wrapperDeadlineAt, caseDeadlineAt)
    const closeBy = parentDeadlineAt - 60000
    const assertSetupAdmission = () => {
      if (Date.now() >= closeBy) throw Error("Original permission-process setup reached the parent close reserve")
    }
    assertSetupAdmission()
    const scope = await createManagedTemporaryDirectory(processRoot, "permission-execution-owner-")
    const runtime = path.join(scope, "runtime")
    const externalEvidence = process.env.OPENCORVUS_PERMISSION_OWNER_EVIDENCE
    if (externalEvidence && !path.isAbsolute(externalEvidence)) throw Error("Evidence root must be an explicit absolute directory")
    const evidence = path.join(externalEvidence ?? scope, scenario)
    await fs.mkdir(runtime)
    await fs.mkdir(evidence, { recursive: false })
    assertSetupAdmission()
    const packageDirectory = path.resolve(import.meta.dir, "..")
    await fs.copyFile(import.meta.filename, path.join(evidence, "actual-test.ts"))
    await fs.copyFile(path.join(import.meta.dir, "fixture/permission-execution-owner-process-worker.ts"), path.join(evidence, "actual-worker.ts"))
    await fs.copyFile(path.join(packageDirectory, "src/permission/authority.ts"), path.join(evidence, "actual-authority.ts"))
    const owner = { scenario, parentStartedAt, caseDeadlineAt, parentDeadlineAt,
      wrapperDeadlineAt: wrapperDeadlineAt ?? null, outerDeadlineObserved: wrapperDeadlineAt !== undefined,
      closeBy, parentPID: process.pid, evidence }
    await fs.writeFile(path.join(evidence, "parent-owner.json"), JSON.stringify(owner, null, 2))
    assertSetupAdmission()
    const resourceCalls: any[] = []
    const resources = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, async fetch(request) {
      if (Date.now() >= closeBy) return new Response("Original resource admission deadline elapsed", { status: 503 })
      const label = new URL(request.url).pathname === "/a.csv" ? "a" : new URL(request.url).pathname === "/b.csv" ? "b" : undefined
      if (!label) return new Response("Unknown public resource", { status: 404 })
      const released = Promise.withResolvers<void>(), settled = Promise.withResolvers<void>()
      const holdDeadlineAt = Math.min(Date.now() + 30000, closeBy)
      const fact: any = { label, arrivedAt: Date.now(), holdDeadlineAt, release: released.resolve, settled: settled.promise }
      resourceCalls.push(fact)
      const timeout = setTimeout(() => { fact.deadlineAt = Date.now(); released.resolve() }, Math.max(0, holdDeadlineAt - Date.now()))
      const aborted = () => { fact.abortedAt = Date.now(); released.resolve() }
      request.signal.addEventListener("abort", aborted, { once: true })
      try {
        await fs.writeFile(path.join(evidence, `${label}-resource-arrived.json`), JSON.stringify({ label, arrivedAt: fact.arrivedAt }))
        await released.promise
        fact.responseConstructedAt = Date.now()
        return fact.deadlineAt
          ? new Response("Original public resource hold deadline elapsed", { status: 504 })
          : new Response(`owner,value\n${label.toUpperCase()},${label === "a" ? 3 : 7}\n`, { headers: { "content-type": "text/plain; charset=utf-8" } })
      } finally { clearTimeout(timeout); request.signal.removeEventListener("abort", aborted); settled.resolve() }
    } })
    const resourceA = `http://127.0.0.1:${resources.port}/a.csv`, resourceB = `http://127.0.0.1:${resources.port}/b.csv`
    let providerA: ReturnType<typeof startControlledStreamingProvider> | undefined
    let providerB: ReturnType<typeof startControlledStreamingProvider> | undefined
    try {
      assertSetupAdmission()
      providerA = startControlledStreamingProvider({ firstPromptToolCall: { name: "webfetch", arguments: { url: resourceA, format: "text" } } })
      assertSetupAdmission()
      providerB = startControlledStreamingProvider({ firstPromptToolCall: { name: "webfetch", arguments: { url: resourceB, format: "text" } } })
      assertSetupAdmission()
    } catch (error) {
      await providerA?.server.stop(true)
      await providerB?.server.stop(true)
      await resources.stop(true)
      throw error
    }
    const providers = [providerA, providerB]
    const releaseProvider = setInterval(() => { for (const provider of providers) for (const request of provider.requests) request.release() }, 10)
    const children: any[] = [], operations: Promise<number | null | undefined>[] = []
    async function run(mode: "start" | "peer" | "crash" | "recover") {
      assertSetupAdmission()
      const startedAt = Date.now(), deadlineAt = Math.min(startedAt + 180000, closeBy)
      const args = [`--config=${path.join(packageDirectory, "test/empty-bunfig.toml")}`,
        `--tsconfig-override=${path.join(packageDirectory, "tsconfig.json")}`,
        path.join(import.meta.dir, "fixture/permission-execution-owner-process-worker.ts"), mode, scenario, runtime, evidence,
        providerA!.apiURL, providerB!.apiURL, resourceA, resourceB, String(deadlineAt)]
      const child: any = { mode, executable: process.execPath, args, cwd: packageDirectory, startedAt, deadlineAt,
        parentDeadlineAt, wrapperDeadlineAt: wrapperDeadlineAt ?? null, outerDeadlineObserved: wrapperDeadlineAt !== undefined }
      children.push(child)
      await fs.writeFile(path.join(evidence, `${mode}-spawn.json`), JSON.stringify(child, null, 2))
      let handle: any
      try {
        const result = await NodeProcess.run({ command: { executable: process.execPath, args }, cwd: packageDirectory,
          env: { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_RUNTIME_MEMORY_METRICS_INTERVAL_MS: "300000" },
          ownership: "owned_tree", windowsHide: true, stdin: "ignore", deadlineAt, nothrow: true,
          onSpawned(value) { handle = value; child.pid = value.pid; child.occurrenceID = value.occurrenceID } })
        await fs.writeFile(path.join(evidence, `${mode}-stdout.log`), result.stdout)
        await fs.writeFile(path.join(evidence, `${mode}-stderr.log`), result.stderr)
        child.receipt = result.receipt
        await handle.settled; await handle.outputSettled
        child.physicalJoined = true; child.outputJoined = true; child.requestSettled = true
        return result.receipt.exitCode
      } finally {
        if (handle && !child.physicalJoined) {
          child.receipt = await handle.terminate("aborted")
          await handle.settled; await handle.outputSettled
          child.physicalJoined = true; child.outputJoined = true; child.emergencyOwnHandle = true
        }
        child.endedAt = Date.now()
        await fs.writeFile(path.join(evidence, `${mode}-physical-owner.json`), JSON.stringify(child, null, 2))
      }
    }
    function start(mode: "start" | "peer" | "crash" | "recover") {
      const operation = run(mode)
      operations.push(operation)
      void operation.catch(() => undefined)
      return operation
    }
    async function read(name: string): Promise<any> { return JSON.parse(await fs.readFile(path.join(evidence, name), "utf8")) }
    async function waitForFile(name: string) {
      const deadline = Math.min(Date.now() + 60000, closeBy)
      for (;;) {
        try { return await read(name) }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
        if (children.some(child => child.endedAt && child.receipt?.exitCode !== 0))
          throw Error(`Owned child failed before ${name}; inspect its original receipt and stderr`)
        if (Date.now() >= deadline) throw Error(`Original preparation window elapsed: ${name}`)
        await Bun.sleep(100)
      }
    }
    function releaseResources() { for (const call of resourceCalls) { call.releasedAt ??= Date.now(); call.release() } }
    let caseFailed = false, caseError: unknown
    try {
      if (scenario.startsWith("live-")) {
        const a = start("start")
        const originalA = await waitForFile("a-ready.json")
        const b = start("peer")
        const originalB = await waitForFile("b-ready.json")
        releaseResources()
        const completedA = await waitForFile("a-completed.json")
        const completedB = await waitForFile("b-completed.json")
        await fs.writeFile(path.join(evidence, "close-live"), "Both original public inputs reached their natural final replies.\n")
        expect(await Promise.all([a, b])).toEqual([0, 0])
        for (const [label, original, completed] of [["a", originalA, completedA], ["b", originalB, completedB]] as const) {
          const csv = `owner,value\n${label.toUpperCase()},${label === "a" ? 3 : 7}\n`
          expect(original.snapshot.osObservation).toBe("exact_live")
          expect(original.snapshot.lease.owner_occurrence_id).toBe(original.snapshot.runtimeIdentity.occurrenceID)
          expect(structuredClone(completed.snapshot.tool)).toMatchObject({ id: original.snapshot.tool.id,
            state: { status: "completed", output: csv } })
          expect(structuredClone(completed.snapshot.result.result)).toMatchObject({ kind: "json", value: { output: csv } })
          expect(completed.snapshot.ledger.map((row: any) => row.event_type)).toEqual([
            "requested", "allowed_once", "execution_started", "execution_succeeded",
          ])
          expect(completed.snapshot.lease.id).toBe(original.snapshot.lease.id)
          expect(completed.snapshot.lease.expires_at).toBeLessThan(completed.snapshot.grant.expires_at)
          expect(completed.completed.info.acceptedInputMessageIDs).toEqual([(await read(`${label}-input.json`)).input.messageID])
          const expectedProjects = scenario === "live-same-project"
            ? [originalA.request.id, originalB.request.id].sort() : [original.request.id]
          expect(completed.history.body.filter((row: any) => row.event_type === "requested").map((row: any) => row.request_id).sort())
            .toEqual(expectedProjects)
        }
      } else {
        expect(await start("crash")).toBe(23)
        const original = await read("a-ready.json")
        if (scenario === "dead-expired") {
          const waitStartedAt = Date.now(), expiresAt = original.snapshot.lease.expires_at
          if (expiresAt + 60000 >= parentDeadlineAt) throw Error("Original parent has no expiry observation reserve")
          while (Date.now() <= expiresAt) await Bun.sleep(Math.min(1000, expiresAt - Date.now() + 1))
          await fs.writeFile(path.join(evidence, "actual-expiry-wait.json"), JSON.stringify({ waitStartedAt, originalExpiresAt: expiresAt, observedAt: Date.now() }))
        }
        expect(await start("recover")).toBe(0)
        const recovered = await read("recovered.json")
        expect(recovered.snapshot.osObservation).toBe("dead_or_reused")
        expect(recovered.snapshot.runtimeIdentity).toEqual(original.snapshot.runtimeIdentity)
        expect(recovered.snapshot.start).toEqual(original.snapshot.start)
        expect(recovered.snapshot.grant).toEqual(original.snapshot.grant)
        expect(recovered.snapshot.ledger.map((row: any) => row.event_type)).toEqual([
          "requested", "allowed_once", "execution_started", "outcome_unknown",
        ])
        const terminal = recovered.snapshot.ledger.find((row: any) => row.event_type === "outcome_unknown")
        expect(structuredClone(terminal)).toMatchObject({ request_id: original.request.id,
          attempt_id: original.snapshot.start.attempt_id, outcome_slot: original.snapshot.start.attempt_id,
          source_event_id: original.snapshot.start.id })
        expect(recovered.snapshot.lease.id).toBe(original.snapshot.lease.id)
        if (scenario === "dead-expired") expect(recovered.snapshot.lease.expires_at).toBe(original.snapshot.lease.expires_at)
        else expect(recovered.snapshot.lease.expires_at).toBe(terminal.time_created)
      }
    } catch (error) {
      caseFailed = true; caseError = error
      throw error
    } finally {
      const cleanupErrors: unknown[] = []
      async function settleCleanup(action: () => unknown | Promise<unknown>) {
        try { await action(); return true }
        catch (error) { cleanupErrors.push(error); return false }
      }
      await settleCleanup(() => fs.writeFile(path.join(evidence, "stop-requested"), "Original parent closes this exact scope.\n"))
      await settleCleanup(releaseResources)
      for (const operation of await Promise.allSettled(operations)) {
        if (operation.status === "rejected" && operation.reason !== caseError) cleanupErrors.push(operation.reason)
      }
      clearInterval(releaseProvider)
      const providerClosures: Array<{ responsesJoined: boolean; closed: boolean }> = []
      for (const provider of providers) {
        for (const request of provider.requests) request.release()
        const responsesJoined = await settleCleanup(() => Promise.all(provider.requests.map(request => request.responded)))
        const closed = await settleCleanup(() => provider.server.stop(true))
        providerClosures.push({ responsesJoined, closed })
      }
      const resourceHandlersJoined = await settleCleanup(() => Promise.all(resourceCalls.map(call => call.settled)))
      const resourceClosed = await settleCleanup(() => resources.stop(true))
      const closure = { ...owner, children, resourceCalls: resourceCalls.map(({ release, settled, ...fact }) => fact),
        physicalJoined: children.every(child => child.physicalJoined === true), outputJoined: children.every(child => child.outputJoined === true),
        requestSettled: children.every(child => child.requestSettled === true),
        providerResponsesJoined: providerClosures.every(provider => provider.responsesJoined),
        providersClosed: providerClosures.every(provider => provider.closed), resourceHandlersJoined, resourceClosed, endedAt: Date.now() }
      let managedDirectoryRemoved = false
      try {
        await settleCleanup(() => fs.writeFile(path.join(evidence, "provider-requests.json"), JSON.stringify(providers.flatMap((provider, index) =>
          provider.requests.map(request => {
            const value = request.body
            const bodyState = value === undefined ? "unavailable" : value === null ? "null" : Array.isArray(value) ? "array" : typeof value
            const receipt = { provider: index === 0 ? "a" : "b", index: request.index, kind: request.kind, bodyState }
            if (bodyState !== "object") return receipt
            const body = value as Record<string, unknown>
            return { ...receipt,
              ...(typeof body.model === "string" ? { model: body.model } : {}),
              ...(typeof body.stream === "boolean" ? { stream: body.stream } : {}),
              ...(Array.isArray(body.tools) ? { declaredTools: body.tools.map(tool =>
                typeof tool?.function?.name === "string" ? tool.function.name : null) } : {}) }
          })), null, 2)))
      } finally {
        try {
          await settleCleanup(() => fs.writeFile(path.join(evidence, "cleanup.json"), JSON.stringify({ ...closure,
            errors: cleanupErrors.map(String) }, null, 2)))
        } finally {
          if (closure.physicalJoined && closure.outputJoined && closure.requestSettled && closure.providersClosed &&
            closure.providerResponsesJoined && closure.resourceHandlersJoined && closure.resourceClosed)
            managedDirectoryRemoved = await settleCleanup(() => removeManagedDirectoryTree(scope))
        }
      }
      console.log("permission-execution-owner-evidence " + JSON.stringify({ ...closure, managedDirectoryRemoved,
        errors: cleanupErrors.map(String) }))
      if (cleanupErrors.length) throw new AggregateError(caseFailed ? [caseError, ...cleanupErrors] : cleanupErrors,
        `Permission process ${scenario} cleanup or evidence export failed`)
    }
  }, 540000)
}
