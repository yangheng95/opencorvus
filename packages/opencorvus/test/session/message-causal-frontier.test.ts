import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { timelineMessageOrderKey, timelinePartOrderKey } from "@/timeline/order"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("allocates one monotonic persisted Message frontier when the caller clock moves backward", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Causal Message frontier" })
      const requestedFrontier = Date.now() + 60_000
      const first = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "build",
        model: { providerID: "test", modelID: "causal-frontier" },
        time: { created: requestedFrontier },
      })
      const second = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "build",
        model: { providerID: "test", modelID: "causal-frontier" },
        time: { created: requestedFrontier - 120_000 },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: second.id,
        type: "text",
        text: "Persist after its parent frontier",
      })

      const persisted = Database.use((db) => ({
        messages: db
          .select({ id: MessageTable.id, created: MessageTable.time_created })
          .from(MessageTable)
          .where(eq(MessageTable.session_id, session.id))
          .orderBy(MessageTable.time_created, MessageTable.id)
          .all(),
        part: db
          .select({ created: PartTable.time_created })
          .from(PartTable)
          .where(eq(PartTable.id, part.id))
          .get(),
      }))

      expect({
        firstCreated: first.time.created,
        secondCreated: second.time.created,
        persistedMessages: persisted.messages,
        partAtOrAfterParent: (persisted.part?.created ?? 0) >= second.time.created,
        returnedMessageOrderKeys: [first.orderKey, second.orderKey],
        canonicalMessageOrderKeys: [
          timelineMessageOrderKey({ info: first }),
          timelineMessageOrderKey({ info: second }),
        ],
        messageOrderIncreases: first.orderKey < second.orderKey,
        returnedPartOrderKey: part.orderKey,
        canonicalPartOrderKey: timelinePartOrderKey({ id: part.id, timeCreated: persisted.part!.created }),
      }).toEqual({
        firstCreated: requestedFrontier,
        secondCreated: requestedFrontier + 1,
        persistedMessages: [
          { id: first.id, created: requestedFrontier },
          { id: second.id, created: requestedFrontier + 1 },
        ],
        partAtOrAfterParent: true,
        returnedMessageOrderKeys: [
          timelineMessageOrderKey({ info: first }),
          timelineMessageOrderKey({ info: second }),
        ],
        canonicalMessageOrderKeys: [
          timelineMessageOrderKey({ info: first }),
          timelineMessageOrderKey({ info: second }),
        ],
        messageOrderIncreases: true,
        returnedPartOrderKey: timelinePartOrderKey({ id: part.id, timeCreated: persisted.part!.created }),
        canonicalPartOrderKey: timelinePartOrderKey({ id: part.id, timeCreated: persisted.part!.created }),
      })
    },
  })
})

class SequencePreflightError extends Error {}

test("retries an interrupted participant sequence as one complete durable cut", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Atomic participant sequence" })
      const creatorMessageID = Identifier.ascending("message")
      const creatorPartID = Identifier.ascending("part")
      const controlMessageID = Identifier.ascending("message")
      const controlPartID = Identifier.ascending("part")
      let interruptControlPreflight = true
      const entries = () => [
        {
          input: {
            sessionID: session.id,
            messageID: creatorMessageID,
            author: "user",
            agent: "chat",
            model: { providerID: "test", modelID: "atomic-sequence" },
            byteMaterializationProjectID: session.projectID,
            noReply: true as const,
            parts: [{ id: creatorPartID, type: "text" as const, text: "Creator" }],
          },
          hooks: {
            preflightBundle: () => {
              const occupied = Database.use((db) =>
                db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, creatorMessageID)).get(),
              )
              if (occupied) throw new Error(`Creator Message ${creatorMessageID} is occupied`)
            },
          },
        },
        {
          input: {
            sessionID: session.id,
            messageID: controlMessageID,
            author: "orchestrator",
            agent: "chat",
            model: { providerID: "test", modelID: "atomic-sequence" },
            byteMaterializationProjectID: session.projectID,
            noReply: true as const,
            parts: [{ id: controlPartID, type: "text" as const, text: "Control" }],
          },
          hooks: {
            preflightBundle: () => {
              if (interruptControlPreflight) throw new SequencePreflightError("Control preflight interrupted")
            },
          },
        },
      ]

      await expect(SessionPrompt.persistNoReplySequence(entries())).rejects.toBeInstanceOf(SequencePreflightError)
      interruptControlPreflight = false
      const published = await SessionPrompt.persistNoReplySequence(entries())
      const visible = await Session.messages({ sessionID: session.id })

      expect({
        published: published.map((message) => message.info.id),
        visible: visible.map((message) => message.info.id),
        causalOrder: published[0]!.info.time.created < published[1]!.info.time.created,
      }).toEqual({
        published: [creatorMessageID, controlMessageID],
        visible: [creatorMessageID, controlMessageID],
        causalOrder: true,
      })
    },
  })
})

test("serializes two composite owner processes onto one persisted Session Message frontier", async () => {
  await using project = await memoryProject()
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Message frontier process test requires the repository test runtime")
  const sharedRuntime = await createManagedTemporaryDirectory(processRoot, "message-frontier-runtime-")
  const barrier = await createManagedTemporaryDirectory(processRoot, "message-frontier-barrier-")
  const worker = path.join(import.meta.dir, "..", "fixture", "message-causal-frontier-process-worker.ts")
  const environment = {
    ...process.env,
    OPENCORVUS_HOME: sharedRuntime,
    OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
  }
  const children: ReturnType<typeof Bun.spawn>[] = []
  const spawn = (args: string[]) => {
    const child = Bun.spawn(
      [process.execPath, `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`, worker, ...args],
      {
        cwd: path.join(import.meta.dir, "..", ".."),
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    children.push(child)
    return child
  }
  const read = async (child: ReturnType<typeof spawn>) => {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(exitCode, stderr).toBe(0)
    return JSON.parse(stdout.trim()) as { sessionID?: string; id?: string; created?: number }
  }

  try {
    const initialized = await read(spawn(["init", project.path, barrier]))
    expect(initialized.sessionID).toBeString()
    const requestedCreated = Date.now() + 60_000
    const first = spawn(["race", project.path, barrier, initialized.sessionID!, String(requestedCreated)])
    const second = spawn(["race", project.path, barrier, initialized.sessionID!, String(requestedCreated)])
    const deadline = Date.now() + 30_000
    while ((await fs.readdir(barrier)).filter((entry) => entry.endsWith(".ready")).length < 2) {
      for (const child of [first, second]) {
        if (child.exitCode !== null) {
          const [stdout, stderr] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
          ])
          throw new Error(`Message frontier worker exited before barrier (${child.exitCode}): ${stderr || stdout}`)
        }
      }
      if (Date.now() >= deadline) throw new Error("Message frontier workers did not reach the barrier")
      await Bun.sleep(5)
    }
    await fs.writeFile(path.join(barrier, "go"), "go")
    const raced = await Promise.all([read(first), read(second)])
    expect(raced.map((item) => item.created).sort((left, right) => left! - right!)).toEqual([
      requestedCreated,
      requestedCreated + 1,
    ])
    expect(new Set(raced.map((item) => item.id)).size).toBe(2)
  } finally {
    for (const child of children) {
      if (child.exitCode === null) child.kill()
    }
    await Promise.allSettled(children.map((child) => child.exited))
    await removeManagedDirectoryTree(sharedRuntime)
    await removeManagedDirectoryTree(barrier)
  }
}, 60_000)
