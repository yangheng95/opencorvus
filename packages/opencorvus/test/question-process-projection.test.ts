import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { startControlledStreamingProvider } from "./fixture/controlled-streaming-provider"
import { SessionPendingQuestion } from "../src/engine/model"

test("ordinary Question process recovery projects the complete current replyable set", async () => {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw Error("Question process projection requires the repository isolated runtime")
  const parentDeadlineAt = Date.now() + 600000
  const scope = await createManagedTemporaryDirectory(processRoot, "question-process-projection-")
  const runtime = path.join(scope, "runtime")
  const evidence = path.join(scope, "evidence")
  await fs.mkdir(runtime)
  await fs.mkdir(evidence)
  const provider = startControlledStreamingProvider({
    firstPromptToolCall: {
      name: "question",
      arguments: {
        questions: [
          {
            header: "Public recovery",
            question: "Which public Cedar answer should be retained?",
            options: [{ value: "cedar", label: "Cedar", description: "Public Cedar example" }],
            custom: true,
          },
        ],
      },
    },
  })
  const controlProvider = startControlledStreamingProvider({
    firstPromptToolCall: {
      name: "question",
      arguments: {
        questions: [
          {
            header: "Current owner",
            question: "Which actual current Cedar answer should be recorded?",
            options: [],
            custom: true,
          },
        ],
      },
    },
  })
  const providers = [provider, controlProvider]
  const release = setInterval(() => {
    for (const owned of providers) for (const request of owned.requests) request.release()
  }, 5)
  const children: any[] = []
  let allJoined = true
  async function run(mode: "crash" | "recover") {
    if (Date.now() + 60000 >= parentDeadlineAt) throw Error("Original parent close reserve reached")
    const startedAt = Date.now(),
      deadlineAt = Math.min(startedAt + 180000, parentDeadlineAt - 60000)
    const cwd = path.resolve(import.meta.dir, "..")
    const args = [
      `--config=${path.join(cwd, "test/empty-bunfig.toml")}`,
      `--tsconfig-override=${path.join(cwd, "tsconfig.json")}`,
      path.join(import.meta.dir, "fixture", "question-process-projection-worker.ts"),
      mode,
      runtime,
      evidence,
      provider.apiURL,
      String(deadlineAt),
    ]
    const env = {
      ...process.env,
      OPENCORVUS_HOME: runtime,
      OPENCORVUS_QUESTION_PROJECTION_CONTROL_URL: controlProvider.apiURL,
    }
    const facts: any = {
      mode,
      startedAt,
      deadlineAt,
      executable: process.execPath,
      args,
      cwd,
      environmentNames: Object.keys(env).sort(),
    }
    children.push(facts)
    await fs.writeFile(path.join(evidence, `${mode}-spawn.json`), JSON.stringify(facts, null, 2))
    let handle: any
    allJoined = false
    try {
      const result = await NodeProcess.run({
        command: { executable: process.execPath, args },
        cwd,
        env,
        ownership: "owned_tree",
        windowsHide: true,
        stdin: "ignore",
        deadlineAt,
        nothrow: true,
        onSpawned(child) {
          handle = child
          facts.pid = child.pid
          facts.occurrenceID = child.occurrenceID
        },
      })
      await fs.writeFile(path.join(evidence, `${mode}-stdout.log`), result.stdout)
      await fs.writeFile(path.join(evidence, `${mode}-stderr.log`), result.stderr)
      facts.receipt = result.receipt
      facts.stdout = result.stdout
      facts.stderr = result.stderr
      await handle.settled
      await handle.outputSettled
      facts.physicalJoined = true
      facts.outputJoined = true
      facts.requestSettled = true
      allJoined = true
      if (result.receipt.exitCode !== (mode === "crash" ? 23 : 0)) {
        console.error(JSON.stringify({ mode, receipt: result.receipt, stdout: result.stdout, stderr: result.stderr }))
      }
      return result.receipt.exitCode
    } finally {
      if (handle && !facts.physicalJoined) {
        facts.receipt = await handle.terminate("aborted")
        await handle.settled
        await handle.outputSettled
        facts.physicalJoined = true
        facts.outputJoined = true
        facts.emergencyOwnHandle = true
        allJoined = true
      }
      facts.endedAt = Date.now()
      await fs.writeFile(path.join(evidence, `${mode}-process-owner.json`), JSON.stringify(facts, null, 2))
    }
  }
  try {
    expect(await run("crash")).toBe(23)
    const checkpoint = JSON.parse(await fs.readFile(path.join(evidence, "checkpoint.json"), "utf8"))
    expect(structuredClone(checkpoint.tool)).toMatchObject({
      type: "tool",
      tool: "question",
      state: { status: "running" },
    })
    expect(checkpoint.publication.original.properties).toEqual(checkpoint.request)
    expect(await run("recover")).toBe(0)
    const observed = JSON.parse(await fs.readFile(path.join(evidence, "recover-observation.json"), "utf8"))
    const request = checkpoint.request
    expect(structuredClone(observed.reply)).toMatchObject({
      status: 404,
      body: { name: "NotFoundError", data: { message: `Question request not found: ${request.id}` } },
    })
    expect(observed.publication.ownerObservation).toBe("dead_or_reused")
    expect(observed.publication.original).toEqual(checkpoint.publication.original)
    expect(observed.originalTool).toEqual(checkpoint.tool)
    expect(structuredClone(observed.control.pending.tool)).toMatchObject({ callID: "call_controlled_recovery_next" })
    expect(structuredClone(observed.control.reply)).toMatchObject({ status: 200, body: true })
    expect(structuredClone(observed.control.completed)).toMatchObject({
      status: 200,
      body: { info: { role: "assistant", finish: "stop" } },
    })
    expect(structuredClone(observed.control.tool)).toMatchObject({
      type: "tool",
      tool: "question",
      state: { status: "completed", metadata: { answers: [["Actual current Cedar answer"]] } },
    })
    const live = new Map(
      SessionPendingQuestion.array()
        .parse(observed.connected.payload.conversationSnapshot.pendingQuestions)
        .map((item) => [item.id, item]),
    )
    for (const event of observed.pendingEvents) {
      if (event.type === "question.asked") {
        const pending = SessionPendingQuestion.parse(event.payload)
        live.set(pending.id, pending)
      }
      if (["question.replied", "question.rejected", "question.expired", "question.abandoned"].includes(event.type)) {
        live.delete(event.payload.requestID)
      }
    }
    const canonical = SessionPendingQuestion.array().parse(observed.control.canonical.body.pendingQuestions)
    const liveIDs = [...live.keys()]
    const canonicalIDs = canonical.map((item) => item.id)
    expect(canonical.map(({ orderKey, ...request }) => request)).toEqual([observed.control.pending])
    await fs.writeFile(
      path.join(evidence, "projection-comparison.json"),
      JSON.stringify(
        {
          liveIDs,
          canonicalIDs,
          reply: observed.reply,
          reconnectedIDs: observed.reconnected.payload.conversationSnapshot.pendingQuestions.map(
            (item: any) => item.id,
          ),
        },
        null,
        2,
      ),
    )
    // Positive completeness contract. A real live Asked must name a current
    // canonical pending request; this is the original regression red.
    console.log(
      JSON.stringify({
        observation: "ordinary Question process projection",
        originalRequest: request,
        originalTool: observed.originalTool,
        originalPublication: observed.publication.original,
        currentRequest: observed.control.pending,
        currentReply: observed.control.reply,
        currentTool: observed.control.tool,
        currentAssistant: observed.control.completed,
        liveIDs,
        canonicalIDs,
        oldReply: observed.reply,
        reconnected: observed.reconnected.payload.conversationSnapshot.pendingQuestions,
      }),
    )
    expect([...live.values()].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      canonical.sort((a, b) => a.id.localeCompare(b.id)),
    )
  } finally {
    clearInterval(release)
    for (const owned of providers) {
      for (const request of owned.requests) request.release()
      await Promise.all(owned.requests.map((request) => request.responded))
      await owned.server.stop(true)
    }
    await fs.writeFile(
      path.join(evidence, "controlled-provider.json"),
      JSON.stringify(
        providers.flatMap((owned, providerIndex) =>
          owned.requests.map((request) => ({
            providerIndex,
            index: request.index,
            kind: request.kind,
            body: request.body,
          })),
        ),
        null,
        2,
      ),
    )
    const cleanup: any = {
      children,
      providerClosed: true,
      endedAt: Date.now(),
      originalParentDeadlineAt: parentDeadlineAt,
      allJoined,
    }
    const closed = await fs
      .readFile(path.join(evidence, "recover-closed.json"), "utf8")
      .then(JSON.parse)
      .catch(() => undefined)
    console.log(
      JSON.stringify({
        observation: "Question process owners closed",
        ...cleanup,
        restartClosed: closed,
        providerRequests: providers.flatMap((owned, providerIndex) =>
          owned.requests.map((request) => ({
            providerIndex,
            index: request.index,
            kind: request.kind,
            model: request.body.model,
            stream: request.body.stream,
          })),
        ),
      }),
    )
    if (allJoined) await removeManagedDirectoryTree(scope)
  }
}, 600000)
