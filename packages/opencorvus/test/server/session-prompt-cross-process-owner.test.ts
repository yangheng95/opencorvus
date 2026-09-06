import { afterEach, describe, expect, test } from "bun:test"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import fs from "node:fs/promises"
import path from "node:path"
import { Database as BunDatabase } from "bun:sqlite"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { observeRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { startControlledStreamingProvider as startStreamingProvider } from "../fixture/controlled-streaming-provider"

function readPromptOwner(runtime: string, sessionID: string) {
  const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
  try {
    const owner = sqlite
      .query<
        {
          generation: string
          owner_pid: number
          owner_process_instance_id: string
          owner_occurrence_id: string
        },
        [string]
      >(
        "SELECT generation, owner_pid, owner_process_instance_id, owner_occurrence_id FROM session_prompt_owner WHERE session_id = ?",
      )
      .get(sessionID)
    if (!owner) return undefined
    return {
      generation: owner.generation,
      pid: owner.owner_pid,
      observation: observeRuntimeProcessOccurrence({
        pid: owner.owner_pid,
        processInstanceID: owner.owner_process_instance_id,
        occurrenceID: owner.owner_occurrence_id,
      }),
    }
  } finally {
    sqlite.close()
  }
}

function readSessionLifecycle(runtime: string, sessionID: string) {
  const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
  try {
    return sqlite
      .query<
        { seq: number; emitted_at: number; payload: string },
        [string]
      >(
        "SELECT seq, emitted_at, payload FROM protocol_event " +
          "WHERE session_id = ? AND type = 'agent.execution.lifecycle' ORDER BY emitted_at, seq",
      )
      .all(sessionID)
  } finally {
    sqlite.close()
  }
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("durable cross-process Session prompt ownership", () => {
  test("a live backend serves duplicate and queued peer inputs through one Session owner", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process prompt owner test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-prompt-owner-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-prompt-owner-barrier-")
    const provider = startStreamingProvider()
    const worker = path.join(import.meta.dir, "..", "fixture", "session-prompt-owner-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: Array<{
      process: ReturnType<typeof Bun.spawn>
      pid: number
      label: string
      stdout: Promise<string>
      stderr: Promise<string>
    }> = []
    const spawn = (
      mode: "init" | "route" | "inspect",
      sessionID = "-",
      messageID = "-",
      label = "-",
      text = "-",
      hold = "release",
      ownerObservation = "none",
    ) => {
      const subprocess = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          provider.apiURL,
          text,
          hold,
          ownerObservation,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      const child = {
        process: subprocess,
        pid: subprocess.pid,
        label,
        stdout: new Response(subprocess.stdout).text(),
        stderr: new Response(subprocess.stderr).text(),
      }
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.process.exited,
        child.stdout,
        child.stderr,
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as any
    }
    const waitFor = async (
      predicate: () => boolean | Promise<boolean>,
      message: string,
      options?: { timeoutMilliseconds?: number; owner?: ReturnType<typeof spawn> },
    ) => {
      const deadline = Date.now() + (options?.timeoutMilliseconds ?? 30_000)
      while (!(await predicate())) {
        if (options?.owner && options.owner.process.exitCode !== null) {
          throw new Error(`${message}; owner process exited with code ${options.owner.process.exitCode}`)
        }
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    let diagnosticSessionID: string | undefined
    try {
      const initialized = await read(spawn("init"))
      const sessionID = String(initialized.sessionID)
      diagnosticSessionID = sessionID
      const firstMessageID = Identifier.ascending("message")
      const secondMessageID = Identifier.ascending("message")
      const owner = spawn("route", sessionID, firstMessageID, "owner", "first input", "hold")
      const duplicate = spawn("route", sessionID, firstMessageID, "duplicate", "first input", "hold")
      const queued = spawn("route", sessionID, secondMessageID, "queued", "second input", "hold", "block-once")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "owner.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "duplicate.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "queued.ready")).catch(() => undefined)),
        "Cross-process Session routes did not initialize",
      )
      await fs.writeFile(path.join(barrier, "owner.start"), "start")
      await waitFor(
        () => provider.promptRequests().length === 1,
        "Owner did not begin its first physical Provider Turn",
      )
      const beforePeers = readPromptOwner(runtime, sessionID)
      expect(beforePeers).toEqual(expect.objectContaining({ observation: "exact_live" }))

      await fs.writeFile(path.join(barrier, "duplicate.start"), "start")
      await Bun.sleep(250)
      const duringDuplicate = readPromptOwner(runtime, sessionID)
      expect({
        providerRequests: provider.promptRequests().length,
        ownerGeneration: duringDuplicate?.generation,
        ownerObservation: duringDuplicate?.observation,
      }).toEqual({
        providerRequests: 1,
        ownerGeneration: beforePeers?.generation,
        ownerObservation: "exact_live",
      })

      provider.promptRequests()[0]!.release()
      await provider.promptRequests()[0]!.responded
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "duplicate.response.json")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "owner.response.json")).catch(() => undefined)),
        "First-turn owner and duplicate routes did not settle",
      )
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "owner.idle-dispatch.json")).catch(() => undefined)),
        "Owner did not dispatch its exact idle lifecycle boundary",
        { owner },
      )
      const idleReceipt = JSON.parse(await fs.readFile(path.join(barrier, "owner.idle-dispatch.json"), "utf8"))
      expect(idleReceipt).toEqual({
        sessionID,
        inputMessageID: firstMessageID,
        owner: expect.objectContaining({ pid: owner.pid, observation: "exact_live" }),
      })
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "owner.standby")).catch(() => undefined)),
        "Owner did not publish its exact standby boundary after idle dispatch",
        { owner },
      )
      const standbyReceipt = JSON.parse(await fs.readFile(path.join(barrier, "owner.standby"), "utf8"))
      expect(standbyReceipt).toEqual({
        sessionID,
        standbyCount: 1,
        owner: expect.objectContaining({ pid: owner.pid, observation: "exact_live" }),
      })
      expect({
        providerRequests: provider.promptRequests().length,
        standbyOwner: readPromptOwner(runtime, sessionID),
      }).toEqual({
        providerRequests: 1,
        standbyOwner: expect.objectContaining({ pid: owner.pid, observation: "exact_live" }),
      })

      // Commit the next input only after backend A has returned the first
      // response and entered standby. Backend B has no process-local Bus path
      // to A; the durable SQLite wake is the production cross-process path.
      await fs.writeFile(path.join(barrier, "queued.start"), "start")
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "queued.owner-observation")).catch(() => undefined)),
        "Queued peer did not reach its out-of-transaction owner observation",
      )
      await waitFor(
        async () => {
          if (provider.promptRequests().length === 2) return true
          const response = await fs.readFile(path.join(barrier, "queued.response.json"), "utf8").catch(() => undefined)
          if (!response) return false
          const routeError = await fs
            .readFile(path.join(barrier, "queued.route-error.txt"), "utf8")
            .catch(() => "no route error")
          throw new Error(`Queued peer returned before Provider execution: ${response}\n${routeError}`)
        },
        "The standby durable owner did not observe the peer's next input",
      )
      await fs.writeFile(path.join(barrier, "queued.owner-observation-release"), "release")
      const queuedAfterStandby = await read(spawn("inspect", sessionID, secondMessageID, "queued-after-standby"))
      expect(
        queuedAfterStandby.messages.filter((message: any) => message.role === "user").map((message: any) => message.id),
      ).toEqual([firstMessageID, secondMessageID])
      provider.promptRequests()[1]!.release()
      await provider.promptRequests()[1]!.responded

      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "duplicate.response.json")).catch(() => undefined)),
        "Duplicate peer route did not settle from the owner's exact assistant reply",
      )
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "queued.response.json")).catch(() => undefined)),
        "Queued peer route did not settle from its exact next-turn assistant reply",
      )
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "owner.response.json")).catch(() => undefined)),
        "Owner route did not settle",
      )
      const responseSnapshots = Object.fromEntries(
        await Promise.all(
          ["owner", "duplicate", "queued"].map(async (label) => [
            label,
            JSON.parse(await fs.readFile(path.join(barrier, `${label}.response.json`), "utf8")),
          ]),
        ),
      )
      const duplicateRouteError = await fs
        .readFile(path.join(barrier, "duplicate.route-error.txt"), "utf8")
        .catch(() => undefined)
      expect({
        responses: responseSnapshots,
        currentOwner: readPromptOwner(runtime, sessionID),
        duplicateRouteError,
        childPIDs: { owner: owner.pid, duplicate: duplicate.pid, queued: queued.pid },
      }).toEqual(
        expect.objectContaining({
          responses: {
            owner: expect.objectContaining({ status: 200 }),
            duplicate: expect.objectContaining({ status: 200 }),
            queued: expect.objectContaining({ status: 200 }),
          },
          currentOwner: expect.objectContaining({ pid: owner.pid, observation: "exact_live" }),
          duplicateRouteError: undefined,
        }),
      )
      await Promise.all(
        ["owner", "duplicate", "queued"].map((label) => fs.writeFile(path.join(barrier, `${label}.exit`), "exit")),
      )
      const [ownerResult, duplicateResult, queuedResult] = await Promise.all([
        read(owner),
        read(duplicate),
        read(queued),
      ])
      await waitFor(
        () => readPromptOwner(runtime, sessionID)?.observation === "dead_or_reused",
        "Exited prompt owner process was not observed as dead",
      )
      expect(readPromptOwner(runtime, sessionID)).toEqual(expect.objectContaining({ observation: "dead_or_reused" }))
      const afterSecondTurn = await read(spawn("inspect", sessionID, secondMessageID, "after-second-turn"))
      expect(afterSecondTurn.messages.filter((message: any) => message.role === "assistant")).toEqual([
        expect.objectContaining({ parentID: firstMessageID, accepted: [firstMessageID], finish: "stop" }),
        expect.objectContaining({ parentID: secondMessageID, accepted: [secondMessageID], finish: "stop" }),
      ])
      const inspected = await read(spawn("inspect", sessionID, firstMessageID, "inspect"))

      expect({
        providerRequests: provider.promptRequests().length,
        ownerResult,
        duplicateResult,
        queuedResult,
        ownerAfterProcessExit: inspected.owner,
        assistants: inspected.messages.filter((message: any) => message.role === "assistant"),
      }).toEqual({
        providerRequests: 2,
        ownerResult: expect.objectContaining({ status: 200, parentID: firstMessageID, accepted: [firstMessageID] }),
        duplicateResult: expect.objectContaining({
          status: 200,
          assistantID: ownerResult.assistantID,
          parentID: firstMessageID,
          accepted: [firstMessageID],
        }),
        queuedResult: expect.objectContaining({ status: 200, parentID: secondMessageID, accepted: [secondMessageID] }),
        ownerAfterProcessExit: expect.objectContaining({ observation: "dead_or_reused" }),
        assistants: [
          expect.objectContaining({ parentID: firstMessageID, accepted: [firstMessageID], finish: "stop" }),
          expect.objectContaining({ parentID: secondMessageID, accepted: [secondMessageID], finish: "stop" }),
        ],
      })
    } catch (error) {
      const capture = <T>(read: () => T): T | { readError: string } => {
        try {
          return read()
        } catch (failure) {
          return { readError: failure instanceof Error ? failure.message : String(failure) }
        }
      }
      const readBarrier = async (name: string) =>
        await fs.readFile(path.join(barrier, name), "utf8").catch((failure: NodeJS.ErrnoException) =>
          failure.code === "ENOENT" ? undefined : `read failed: ${String(failure)}`,
        )
      const snapshot = {
        error: error instanceof Error ? error.message : String(error),
        owner: diagnosticSessionID ? capture(() => readPromptOwner(runtime, diagnosticSessionID!)) : undefined,
        lifecycle: diagnosticSessionID ? capture(() => readSessionLifecycle(runtime, diagnosticSessionID!)) : [],
        receipts: Object.fromEntries(
          await Promise.all(
            [
              "owner.response.json",
              "duplicate.response.json",
              "queued.response.json",
              "owner.idle-dispatch.json",
              "owner.standby",
              "owner.route-error.txt",
            ].map(async (name) => [name, await readBarrier(name)]),
          ),
        ),
        children: children.map((child) => ({ label: child.label, exitCode: child.process.exitCode })),
      }
      for (const child of children) {
        if (child.process.exitCode === null) child.process.kill()
      }
      await Promise.all(children.map((child) => child.process.exited))
      const outputs = await Promise.all(
        children
          .filter((child) => child.label !== "-")
          .map(async (child) => ({ label: child.label, stdout: await child.stdout, stderr: await child.stderr })),
      )
      throw new Error(`${JSON.stringify(snapshot, null, 2)}\n${JSON.stringify(outputs, null, 2)}`)
    } finally {
      for (const request of provider.requests) request.release()
      provider.server.stop(true)
      for (const child of children) {
        if (child.process.exitCode === null) child.process.kill()
        await child.process.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

  test("a standby owner settles a peer summarize request by its exact durable source", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process prompt summary test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-barrier-")
    const provider = startStreamingProvider()
    const worker = path.join(import.meta.dir, "..", "fixture", "session-prompt-owner-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (
      mode: "init" | "init-history" | "route" | "summarize" | "summarize-auto" | "inspect",
      sessionID = "-",
      messageID = "-",
      label = "-",
      text = "-",
      hold = "release",
    ) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          provider.apiURL,
          text,
          hold,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as any
    }
    const waitFor = async (predicate: () => boolean | Promise<boolean>, message: string) => {
      const deadline = Date.now() + 30_000
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    try {
      const initialized = await read(spawn("init-history"))
      const sessionID = String(initialized.sessionID)
      const messageID = Identifier.ascending("message")
      const owner = spawn("route", sessionID, messageID, "summary-owner", "input before summary", "hold")
      const summarizer = spawn("summarize", sessionID, "-", "summary-peer", "exact cross-process summary")
      const autoRepeat = spawn("summarize-auto", sessionID, "-", "summary-auto-repeat", "repeat exact summary")
      const manualRepeat = spawn("summarize", sessionID, "-", "summary-manual-repeat", "repeat exact summary")
      const secondManual = spawn("summarize", sessionID, "-", "summary-second-manual", "summarize new material")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "summary-owner.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "summary-peer.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "summary-auto-repeat.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "summary-manual-repeat.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "summary-second-manual.ready")).catch(() => undefined)),
        "Summary owner and peers did not initialize",
      )

      await fs.writeFile(path.join(barrier, "summary-owner.start"), "start")
      await waitFor(() => provider.promptRequests().length === 1, "Summary owner did not begin its first Turn")
      provider.promptRequests()[0]!.release()
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "summary-owner.response.json")).catch(() => undefined)),
        "Summary owner did not settle its first response",
      )
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "summary-owner.standby")).catch(() => undefined)),
        "Summary owner did not publish its exact standby boundary",
      )
      expect({
        providerRequests: provider.promptRequests().length,
        standbyOwner: readPromptOwner(runtime, sessionID),
      }).toEqual({
        providerRequests: 1,
        standbyOwner: expect.objectContaining({ pid: owner.pid, observation: "exact_live" }),
      })

      await fs.writeFile(path.join(barrier, "summary-peer.start"), "start")
      const summaryDeadline = Date.now() + 30_000
      while (
        provider.promptRequests().length !== 2 &&
        !(await fs.stat(path.join(barrier, "summary-peer.response.json")).catch(() => undefined))
      ) {
        if (Date.now() >= summaryDeadline) {
          const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
          const controls = sqlite
            .query("SELECT id, kind FROM session_control_record WHERE session_id = ?")
            .all(sessionID)
          const controlEvents = sqlite
            .query(
              "SELECT e.control_id, e.kind, e.payload FROM session_control_event e JOIN session_control_record r ON r.id = e.control_id WHERE r.session_id = ?",
            )
            .all(sessionID)
          const messages = sqlite
            .query("SELECT id, data FROM message WHERE session_id = ? ORDER BY time_created, id")
            .all(sessionID)
          sqlite.close()
          throw new Error(
            `Peer summarize route neither reached the Provider nor returned an error: ${JSON.stringify({ controls, controlEvents, ownerPID: owner.pid, summarizerPID: summarizer.pid, currentOwner: readPromptOwner(runtime, sessionID), providerKinds: provider.requests.map((request) => request.kind), messages })}`,
          )
        }
        await Bun.sleep(10)
      }
      if (provider.promptRequests().length !== 2) {
        const response = await fs.readFile(path.join(barrier, "summary-peer.response.json"), "utf8")
        const routeError = await fs
          .readFile(path.join(barrier, "summary-peer.route-error.txt"), "utf8")
          .catch(() => "no route error")
        throw new Error(`Standby summarize returned before Provider execution: ${response}\n${routeError}`)
      }
      provider.promptRequests()[1]!.release()
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "summary-peer.response.json")).catch(() => undefined)),
        "Summary peer did not settle from the exact durable summary",
      )
      const summarized = await read(summarizer)
      await waitFor(
        () => readPromptOwner(runtime, sessionID) === undefined,
        "Manual summary did not release the exact durable prompt owner",
      )

      await fs.writeFile(path.join(barrier, "summary-manual-repeat.start"), "start")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "summary-manual-repeat.response.json")).catch(() => undefined)),
        "Repeated manual summary did not settle from its exact durable control receipt",
      )
      const repeatedManual = await read(manualRepeat)
      await waitFor(
        () => readPromptOwner(runtime, sessionID) === undefined,
        "Repeated manual summary did not release its exact durable prompt owner",
      )

      await fs.writeFile(path.join(barrier, "summary-auto-repeat.start"), "start")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "summary-auto-repeat.response.json")).catch(() => undefined)),
        "Repeated auto summary did not settle from its exact durable control receipt",
      )
      while (autoRepeat.exitCode === null) {
        for (const request of provider.promptRequests().slice(2)) request.release()
        await Bun.sleep(10)
      }
      const repeatedAuto = await read(autoRepeat)

      const compactionProviderRequests = () =>
        provider
          .promptRequests()
          .filter((request) =>
            JSON.stringify(request.body).includes(
              "Write a concise natural-language continuation summary as an ordinary assistant message.",
            ),
          )
      await fs.writeFile(path.join(barrier, "summary-second-manual.start"), "start")
      await waitFor(
        () => compactionProviderRequests().length === 2,
        "Second real compaction did not reach the Provider for its new post-summary material",
      )
      compactionProviderRequests()[1]!.release()
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "summary-second-manual.response.json")).catch(() => undefined)),
        "Second real compaction did not settle its exact new summary",
      )
      const secondManualResult = await read(secondManual)
      await waitFor(
        () => readPromptOwner(runtime, sessionID) === undefined,
        "Second manual summary did not release its exact durable prompt owner",
      )
      const inspected = await read(spawn("inspect", sessionID, messageID, "summary-inspect"))
      const summaries = inspected.messages.filter((message: any) => message.summary === true)
      const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
      const summaryControlReceipts = sqlite
        .query(
          `SELECT r.id, r.kind, e.payload
           FROM session_control_record r
           JOIN session_control_event e ON e.control_id = r.id AND e.kind = 'amended'
           WHERE r.session_id = ? AND r.kind IN ('manual_summarize', 'compaction_request')
           ORDER BY r.time_created, r.id`,
        )
        .all(sessionID)
        .map((row: any) => ({ id: row.id, kind: row.kind, ...JSON.parse(row.payload) }))
      sqlite.close()
      const firstSummaryID = String(summaryControlReceipts[0]?.result_summary_message_id)
      const secondSummaryID = String(summaryControlReceipts[3]?.result_summary_message_id)
      expect({
        compactionProviderRequests: compactionProviderRequests().length,
        summarized,
        repeatedAuto,
        repeatedManual,
        secondManualResult,
        summaryIDs: summaries.map((message: any) => message.id).sort(),
        summaryControlReceipts,
      }).toEqual({
        compactionProviderRequests: 2,
        summarized: { status: 200, summarized: true },
        repeatedAuto: { status: 200, summarized: true },
        repeatedManual: { status: 200, summarized: true },
        secondManualResult: { status: 200, summarized: true },
        summaryIDs: [firstSummaryID, secondSummaryID].sort(),
        summaryControlReceipts: [
          expect.objectContaining({ kind: "manual_summarize", result_summary_message_id: firstSummaryID }),
          expect.objectContaining({ kind: "manual_summarize", result_summary_message_id: firstSummaryID }),
          expect.objectContaining({ kind: "compaction_request", result_summary_message_id: firstSummaryID }),
          expect.objectContaining({ kind: "manual_summarize", result_summary_message_id: secondSummaryID }),
        ],
      })
      expect(secondSummaryID).not.toBe(firstSummaryID)
      expect(summaries).toEqual([
        expect.objectContaining({ parentID: messageID, finish: "stop", summary: true }),
        expect.objectContaining({ parentID: messageID, finish: "stop", summary: true }),
      ])

      await fs.writeFile(path.join(barrier, "summary-owner.exit"), "exit")
      await read(owner)
    } finally {
      for (const request of provider.requests) request.release()
      provider.server.stop(true)
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

  test("a first summarize with no compactable material persists its exact failed control", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process no-material summary test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-empty-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-empty-barrier-")
    const provider = startStreamingProvider()
    const worker = path.join(import.meta.dir, "..", "fixture", "session-prompt-owner-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init-source-only" | "summarize", sessionID = "-", messageID = "-", label = "-") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          provider.apiURL,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as any
    }
    const waitFor = async (predicate: () => boolean | Promise<boolean>, message: string) => {
      const deadline = Date.now() + 30_000
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    try {
      const initialized = await read(spawn("init-source-only"))
      const sessionID = String(initialized.sessionID)
      const sourceMessageID = String(initialized.messageID)
      const summarizer = spawn("summarize", sessionID, "-", "summary-empty")
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "summary-empty.ready")).catch(() => undefined)),
        "No-material summarizer did not initialize",
      )
      await fs.writeFile(path.join(barrier, "summary-empty.start"), "start")
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "summary-empty.response.json")).catch(() => undefined)),
        "No-material summarizer did not settle its failed control",
      )
      const failure = await read(summarizer)
      const routeError = await fs.readFile(path.join(barrier, "summary-empty.route-error.txt"), "utf8")
      const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
      const failedControl = sqlite
        .query(
          `SELECT r.kind, r.payload AS request_payload, e.kind AS event_kind, e.payload AS event_payload
           FROM session_control_record r
           JOIN session_control_event e ON e.control_id = r.id AND e.kind = 'failed'
           WHERE r.session_id = ?
           ORDER BY r.time_created DESC, r.id DESC
           LIMIT 1`,
        )
        .get(sessionID) as { kind: string; request_payload: string; event_kind: string; event_payload: string }
      sqlite.close()
      expect({
        providerRequests: provider.promptRequests().length,
        failure,
        failedControl: {
          kind: failedControl.kind,
          request: JSON.parse(failedControl.request_payload),
          terminal: failedControl.event_kind,
          receipt: JSON.parse(failedControl.event_payload),
        },
        routeError,
      }).toEqual({
        providerRequests: 0,
        failure: expect.objectContaining({ status: 500, error: "UnknownError" }),
        failedControl: {
          kind: "manual_summarize",
          request: expect.objectContaining({ source_user_message_id: sourceMessageID }),
          terminal: "failed",
          receipt: {
            error: expect.stringContaining("SessionCompactionMaterialUnavailableError"),
          },
        },
        routeError: expect.stringContaining("SessionCompactionMaterialUnavailableError"),
      })
      expect(readPromptOwner(runtime, sessionID)).toBeUndefined()
    } finally {
      for (const request of provider.requests) request.release()
      provider.server.stop(true)
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

  test("a standby peer receives the exact failed summarize control terminal", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process prompt summary failure test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-failure-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-prompt-summary-failure-barrier-")
    const provider = startStreamingProvider({ failPromptFrom: 2 })
    const worker = path.join(import.meta.dir, "..", "fixture", "session-prompt-owner-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (
      mode: "init-history" | "route" | "summarize",
      sessionID = "-",
      messageID = "-",
      label = "-",
      text = "-",
      hold = "release",
    ) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          provider.apiURL,
          text,
          hold,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as any
    }
    const waitFor = async (predicate: () => boolean | Promise<boolean>, message: string) => {
      const deadline = Date.now() + 30_000
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    try {
      const initialized = await read(spawn("init-history"))
      const sessionID = String(initialized.sessionID)
      const firstMessageID = Identifier.ascending("message")
      const owner = spawn("route", sessionID, firstMessageID, "failure-owner", "first failure setup", "hold")
      const summarizer = spawn("summarize", sessionID, "-", "failure-summary", "fail this exact summary")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "failure-owner.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "failure-summary.ready")).catch(() => undefined)),
        "Summary failure workers did not initialize",
      )

      await fs.writeFile(path.join(barrier, "failure-owner.start"), "start")
      await waitFor(() => provider.promptRequests().length === 1, "Summary failure owner did not start")
      provider.promptRequests()[0]!.release()
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "failure-owner.standby")).catch(() => undefined)),
        "Summary failure owner did not reach its exact standby boundary",
      )

      await fs.writeFile(path.join(barrier, "failure-summary.start"), "start")
      const failureDeadline = Date.now() + 70_000
      while (!(await fs.stat(path.join(barrier, "failure-summary.response.json")).catch(() => undefined))) {
        if (Date.now() >= failureDeadline) {
          const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
          const controls = sqlite
            .query(
              "SELECT r.id, r.kind, e.kind AS event_kind, e.payload FROM session_control_record r LEFT JOIN session_control_event e ON e.control_id = r.id WHERE r.session_id = ?",
            )
            .all(sessionID)
          sqlite.close()
          throw new Error(
            `Peer summarize did not receive the failed control terminal: ${JSON.stringify({ promptRequests: provider.promptRequests().length, controls, owner: readPromptOwner(runtime, sessionID) })}`,
          )
        }
        await Bun.sleep(10)
      }
      const failure = await read(summarizer)
      const routeError = await fs.readFile(path.join(barrier, "failure-summary.route-error.txt"), "utf8")
      const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
      const failedControl = sqlite
        .query(
          "SELECT e.kind, e.payload FROM session_control_event e JOIN session_control_record r ON r.id = e.control_id WHERE r.session_id = ? ORDER BY e.time_created DESC LIMIT 1",
        )
        .get(sessionID) as { kind: string; payload: string }
      sqlite.close()
      expect({
        failure,
        failedControl: { ...failedControl, payload: JSON.parse(failedControl.payload) },
        routeError,
      }).toEqual({
        failure: expect.objectContaining({ status: 500, error: "UnknownError" }),
        failedControl: expect.objectContaining({
          kind: "failed",
          payload: expect.objectContaining({ error: expect.stringContaining("injected compaction provider failure") }),
        }),
        routeError: expect.stringContaining("SessionPromptSummaryControlError"),
      })

      await fs.writeFile(path.join(barrier, "failure-owner.exit"), "exit")
      await read(owner)
    } finally {
      for (const request of provider.requests) request.release()
      provider.server.stop(true)
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

  test("a peer takes over only after the exact owner process dies", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process prompt takeover test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-prompt-takeover-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-prompt-takeover-barrier-")
    const provider = startStreamingProvider()
    const worker = path.join(import.meta.dir, "..", "fixture", "session-prompt-owner-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init" | "route" | "inspect", sessionID = "-", messageID = "-", label = "-") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          provider.apiURL,
          "recover the exact input",
          mode === "route" ? "hold" : "release",
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as any
    }
    const waitFor = async (predicate: () => boolean | Promise<boolean>, message: string) => {
      const deadline = Date.now() + 30_000
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    try {
      const initialized = await read(spawn("init"))
      const sessionID = String(initialized.sessionID)
      const messageID = Identifier.ascending("message")
      const abandoned = spawn("route", sessionID, messageID, "abandoned")
      const recovery = spawn("route", sessionID, messageID, "recovery")
      await waitFor(
        async () =>
          Boolean(await fs.stat(path.join(barrier, "abandoned.ready")).catch(() => undefined)) &&
          Boolean(await fs.stat(path.join(barrier, "recovery.ready")).catch(() => undefined)),
        "Takeover routes did not initialize",
      )
      await fs.writeFile(path.join(barrier, "abandoned.start"), "start")
      await waitFor(() => provider.promptRequests().length === 1, "Abandoned owner did not start its Provider Turn")
      const before = readPromptOwner(runtime, sessionID)
      expect(before).toEqual(expect.objectContaining({ observation: "exact_live" }))

      abandoned.kill()
      await abandoned.exited
      provider.promptRequests()[0]!.release()

      await fs.writeFile(path.join(barrier, "recovery.start"), "start")
      await waitFor(
        () => provider.promptRequests().length === 2,
        "Recovery owner did not start exactly one replacement Turn",
      )
      provider.promptRequests()[1]!.release()
      await waitFor(
        async () => Boolean(await fs.stat(path.join(barrier, "recovery.response.json")).catch(() => undefined)),
        "Recovery route did not settle",
      )
      const during = readPromptOwner(runtime, sessionID)
      expect(during?.generation).not.toBe(before?.generation)
      expect(during).toEqual(expect.objectContaining({ observation: "exact_live" }))
      await fs.writeFile(path.join(barrier, "recovery.exit"), "exit")
      const recovered = await read(recovery)
      const after = await read(spawn("inspect", sessionID, messageID, "after"))
      const assistants = after.messages.filter((message: any) => message.role === "assistant")

      expect({
        providerRequests: provider.promptRequests().length,
        recovered,
        ownerAfterProcessExit: after.owner,
        assistants,
      }).toEqual({
        providerRequests: 2,
        recovered: expect.objectContaining({ status: 200, parentID: messageID, accepted: [messageID], finish: "stop" }),
        ownerAfterProcessExit: expect.objectContaining({ observation: "dead_or_reused" }),
        assistants: [
          expect.objectContaining({ parentID: messageID, accepted: [messageID], finish: "error" }),
          expect.objectContaining({ parentID: messageID, accepted: [messageID], finish: "stop" }),
        ],
      })
    } finally {
      for (const request of provider.requests) request.release()
      provider.server.stop(true)
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)
})
