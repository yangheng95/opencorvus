import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { SessionDeletionCleanupTestHooks } from "@/session/deletion-cleanup"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

async function seed(brokenBoundary = false, historicalDescriptor = false) {
  const session = await Session.create({ kind: "assistant", title: "Forked compaction evidence" })
  async function user(text: string, extra?: Message.User["extra"]) {
    const info = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: session.id,
      role: "user",
      author: "user",
      agent: "chat",
      model: { providerID: "local", modelID: "fork-contract" },
      ...(extra ? { extra } : {}),
      time: { created: Date.now() },
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: info.id,
      sessionID: session.id,
      type: "text",
      text,
    })
    return info
  }
  async function assistant(parentID: string, text: string, summary = false) {
    const info = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: session.id,
      parentID,
      role: "assistant",
      author: summary ? "compaction" : "chat",
      agent: summary ? "compaction" : "chat",
      summary,
      providerID: "local",
      modelID: "fork-contract",
      path: { cwd: Instance.directory, root: Instance.worktree },
      cost: 0,
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now() },
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: session.id,
      messageID: info.id,
      type: "step-start",
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: session.id,
      messageID: info.id,
      type: "text",
      text,
    })
    return info
  }
  const initial = await user(
    "Original durable request",
    historicalDescriptor
      ? {
          workerTurnDescriptor: {
            id: Identifier.ascending("worker_turn_descriptor"),
            hash: "unresolved-historical-reference",
          },
        }
      : undefined,
  )
  const earlier = await assistant(initial.id, "Earlier execution and evidence")
  const full = "Exact original bytes; trace=FORK-EVIDENCE-317; 中文😀\n".repeat(1800)
  const outputPath = path.join(
    ProjectRuntimePaths.rootSessionToolOutputDir(Instance.directory, session.id),
    Identifier.ascending("tool"),
  )
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, full)
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: earlier.id,
    type: "tool",
    tool: "read",
    callID: "call_original_evidence",
    state: {
      status: "completed",
      input: { path: "original-source" },
      title: "Original evidence",
      output: "Short stored preview",
      metadata: { truncated: true, outputPath },
      time: { start: 1, end: 2 },
    },
  })
  await Session.updateMessage({ ...earlier, finish: "stop", time: { ...earlier.time, completed: Date.now() } })
  const correction = await user("Current correction overrides the earlier value")
  const tail = await assistant(correction.id, "Latest verified evidence")
  await Session.updateMessage({ ...tail, finish: "stop", time: { ...tail.time, completed: Date.now() } })
  const summary = await assistant(correction.id, "Checkpoint retains current correction and exact evidence", true)
  const completed = await Session.updateMessage({
    ...summary,
    finish: "stop",
    time: { ...summary.time, completed: Date.now() },
  })
  await Session.publishCompactionCheckpoint({
    info: completed as Message.Assistant,
    part: {
      id: Identifier.ascending("part"),
      sessionID: session.id,
      messageID: completed.id,
      type: "compaction",
      auto: true,
      anchor_id: brokenBoundary ? Identifier.ascending("message") : initial.id,
      tail_start_id: tail.id,
    },
  })
  return { session, full, outputPath }
}

const texts = (messages: Message.WithParts[]) =>
  messages.map((m) =>
    m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n"),
  )

test.each(["fork", "side-chat"] as const)(
  "reconstructs the original anchor and retained tail after %s",
  async (purpose) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { session } = await seed()
        const expected = [
          "Original durable request",
          "Checkpoint retains current correction and exact evidence",
          "Current correction overrides the earlier value",
          "Latest verified evidence",
        ]
        expect(texts(await Message.filterCompacted(MessageStore.stream(session.id)))).toEqual(expected)
        const copied = await Session.fork({ sessionID: session.id, purpose })
        Database.close()
        const projected = await Message.filterCompacted(MessageStore.stream(copied.id))
        expect(texts(projected)).toEqual(expected)
        const marker = projected.flatMap((m) => m.parts).find((p) => p.type === "compaction")
        expect(marker).toMatchObject({ anchor_id: projected[0]!.info.id, tail_start_id: projected[3]!.info.id })
        expect(projected[1]!.info).toMatchObject({ parentID: projected[2]!.info.id })
      },
    })
  },
)

test("reports a typed integrity failure for a checkpoint pointing outside copied history", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { session } = await seed(true)
      await expect(Session.fork({ sessionID: session.id })).rejects.toMatchObject({
        name: "HostProcessingFaultError",
        message: expect.stringContaining("outside the copied history"),
      })
    },
  })
})

test("keeps historical execution references read-only in an independent side context", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { session } = await seed(false, true)
      // A descriptor claim on an ordinary execution anchor requires real owned
      // authority. The same opaque historical reference in a side copy grants none.
      await expect(Message.filterCompacted(MessageStore.stream(session.id))).rejects.toMatchObject({
        name: "CompactionTaskAuthorityError",
      })
      const side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
      const projected = await Message.filterCompacted(MessageStore.stream(side.id))
      expect(texts(projected)).toEqual([
        "Original durable request",
        "Checkpoint retains current correction and exact evidence",
        "Current correction overrides the earlier value",
        "Latest verified evidence",
      ])
      expect(projected[0]!.info).toMatchObject({
        extra: { workerTurnDescriptor: { hash: "unresolved-historical-reference" } },
      })
    },
  })
})

test("copies the completed reply's exact accepted steering batch", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Accepted steering closure" })
      const first = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "chat",
        model: { providerID: "local", modelID: "closure" },
        time: { created: Date.now() },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: first.id,
        type: "text",
        text: "Initial input",
      })
      const reply = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        parentID: first.id,
        role: "assistant",
        author: "chat",
        agent: "chat",
        modelID: "closure",
        providerID: "local",
        time: { created: Date.now() },
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      })
      const { orderKey: _orderKey, ...firstInput } = first
      const steering = await Session.updateMessage({
        ...firstInput,
        id: Identifier.ascending("message"),
        time: { created: Date.now() },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: steering.id,
        type: "text",
        text: "Current authoritative correction",
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: reply.id,
        type: "text",
        text: "Completed using both inputs",
      })
      await Session.updateMessage({
        ...reply,
        parentID: steering.id,
        acceptedInputMessageIDs: [first.id, steering.id],
        finish: "stop",
        time: { ...reply.time, completed: Date.now() },
      })
      const side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
      Database.close()
      const messages = await Session.messages({ sessionID: side.id })
      expect(texts(messages)).toEqual([
        "Initial input",
        "Completed using both inputs",
        "Current authoritative correction",
      ])
      const inputs = messages.filter((m) => m.info.role === "user").map((m) => m.info.id)
      expect(messages.map((m) => m.info.time.created)).toEqual([first, reply, steering].map((m) => m.time.created))
      expect(messages.find((m) => m.info.role === "assistant")?.info).toMatchObject({
        parentID: inputs.at(-1),
        acceptedInputMessageIDs: inputs,
      })
      await expect(Session.fork({ sessionID: session.id, messageID: steering.id })).rejects.toMatchObject({
        name: "HostProcessingFaultError",
      })
    },
  })
})

test("retains independent side-chat source evidence when deleting its standalone source", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { session, full } = await seed()
      const side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
      const deletion = await EngineService.deleteSession(session.id, { projectID: session.projectID })
      const messages = await Session.messages({ sessionID: side.id })
      const part = messages
        .flatMap((m) => m.parts)
        .find((p) => p.type === "tool") as CompactionEvidenceReader.CompletedToolPart
      const evidence = await CompactionEvidenceReader.authoritativeOutput(part).catch((error) => ({
        error: error.code,
      }))
      expect({ deletion, evidence }).toMatchObject({
        deletion: { ok: true, status: "tombstoned", sessionHistoryRetained: true },
        evidence: { source: "truncation-file", output: full },
      })
    },
  })
})

test("rolls back physical deletion when an independent copy commits before its fence", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { session, full } = await seed()
      let side: Session.Info | undefined
      using hook = SessionDeletionCleanupTestHooks.installBeforeManifestCreate(async (id) => {
        if (id === session.id && !side) side = await Session.fork({ sessionID: session.id, purpose: "side-chat" })
      })
      await expect(EngineService.deleteSession(session.id, { projectID: session.projectID })).rejects.toMatchObject({
        name: "SessionDeletionRuntimeNotSettledError",
      })
      expect(await EngineService.deleteSession(session.id, { projectID: session.projectID })).toMatchObject({
        status: "tombstoned",
        sessionHistoryRetained: true,
      })
      if (!side) throw new Error("Concurrent side conversation was not created")
      const part = (await Session.messages({ sessionID: side.id }))
        .flatMap((m) => m.parts)
        .find((p) => p.type === "tool") as CompactionEvidenceReader.CompletedToolPart
      expect(await CompactionEvidenceReader.authoritativeOutput(part)).toEqual({
        source: "truncation-file",
        output: full,
      })
    },
  })
})

test("physically deletes a standalone source when only another Project declares a reference", async () => {
  await using sourceProject = await memoryProject("fork-source-project")
  await using otherProject = await memoryProject("fork-other-project")
  const { session } = await Instance.provide({ directory: sourceProject.path, fn: seed })
  await Instance.provide({
    directory: otherProject.path,
    fn: async () => {
      await Session.create({
        kind: "assistant",
        title: "Foreign metadata is outside source ownership",
        metadata: {
          sideChat: { sourceSessionID: session.id, inheritedMessageIDs: [] },
        },
      })
    },
  })
  await Instance.provide({
    directory: sourceProject.path,
    fn: async () => {
      expect(await EngineService.deleteSession(session.id, { projectID: session.projectID })).toMatchObject({
        ok: true,
        status: "physically_deleted",
        sessionHistoryRetained: false,
      })
    },
  })
})
