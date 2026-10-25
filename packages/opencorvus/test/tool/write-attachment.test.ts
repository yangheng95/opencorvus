import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "../../src/bus"
import { File } from "../../src/file"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { WriteTool } from "../../src/tool/write"
import { Tool } from "../../src/tool/tool"
import { Identifier } from "../../src/id/id"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { prepareTaskProcessBinding, insertTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Database } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function context(): Promise<Tool.Context> {
  const session = await Session.create({ kind: "assistant", title: "Attachment write contract" })
  return {
    sessionID: session.id,
    messageID: Identifier.ascending("message"),
    callID: "attachment-write",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    executionSurface: Tool.executionSurface(["write"], []),
    executionAuthority: {
      kind: "conversation",
      sessionID: session.id,
      projectID: Instance.project.id,
      directory: Instance.directory,
    },
  }
}

test("write saves exact attachment bytes and publishes the actual local edit", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        bytes = Buffer.from([0, 255, 42, 128, 10, 0])
      const reference = await AttachmentStore.write(
        Instance.project.id,
        bytes,
        "application/octet-stream",
        "原始文件.bin",
      )
      const filePath = path.join(project.path, "交付", "原始文件.bin"),
        edits: unknown[] = []
      const unsubscribe = Bus.subscribe(File.Event.Edited, ({ properties }) => {
        edits.push(properties)
      })
      try {
        const result = await (await WriteTool.init()).execute({ filePath, attachmentUrl: reference.url }, ctx)
        expect(await fs.readFile(filePath)).toEqual(bytes)
        expect(result.metadata).toEqual({
          filepath: filePath,
          exists: false,
          source: reference,
          bytes: bytes.length,
          truncated: false,
        })
        expect(edits).toEqual([{ file: filePath, processAuthority: { kind: "host", cwd: project.path } }])
      } finally {
        unsubscribe()
      }
    },
  })
})

test("existing attachment destinations return FileConflictError and retain their actual bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        filePath = path.join(project.path, "existing.bin"),
        original = Buffer.from([1, 2, 3])
      await fs.writeFile(filePath, original)
      const reference = await AttachmentStore.write(
        Instance.project.id,
        Buffer.from([4, 5, 6]),
        "application/octet-stream",
        "new.bin",
      )
      const error = await (await WriteTool.init())
        .execute({ filePath, attachmentUrl: reference.url }, ctx)
        .catch((error) => error)
      expect(error).toMatchObject({ name: "FileConflictError", data: { path: filePath } })
      expect(await fs.readFile(filePath)).toEqual(original)
    },
  })
})

test("attachment writes enforce the execution Project and preserve current text writes", async () => {
  await using source = await memoryProject(),
    target = await memoryProject()
  const reference = await Instance.provide({
    directory: source.path,
    fn: () => AttachmentStore.write(Instance.project.id, Buffer.from([8, 9]), "application/octet-stream", "source.bin"),
  })
  await Instance.provide({
    directory: target.path,
    fn: async () => {
      const ctx = await context(),
        writer = await WriteTool.init()
      await expect(
        writer.execute({ filePath: path.join(target.path, "foreign.bin"), attachmentUrl: reference.url }, ctx),
      ).rejects.toThrow(`expected ${Instance.project.id}`)
      const filePath = path.join(target.path, "text.txt")
      const written = await writer.execute({ filePath, content: "字面文本\n" }, ctx)
      expect({ content: await fs.readFile(filePath, "utf8"), output: written.output }).toEqual({
        content: "字面文本\n",
        output: "Wrote file successfully.",
      })
    },
  })
})

test("concurrent attachment creates return one actual file and one explicit conflict", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        writer = await WriteTool.init(),
        filePath = path.join(project.path, "concurrent.bin")
      const bytes = [Buffer.from([11, 12]), Buffer.from([21, 22])]
      const references = await Promise.all(
        bytes.map((body, index) =>
          AttachmentStore.write(Instance.project.id, body, "application/octet-stream", `source-${index}.bin`),
        ),
      )
      const outcomes = await Promise.allSettled(
        references.map((reference) => writer.execute({ filePath, attachmentUrl: reference.url }, ctx)),
      )
      const saved = outcomes.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<
        Awaited<ReturnType<typeof writer.execute>>
      >
      const conflict = outcomes.find((result) => result.status === "rejected") as PromiseRejectedResult
      expect(conflict.reason).toMatchObject({ name: "FileConflictError", data: { path: filePath } })
      expect(await fs.readFile(filePath)).toEqual(
        bytes[references.findIndex((reference) => reference.sha === saved.value.metadata.source?.sha)]!,
      )
    },
  })
})

test("attachment writes use the Task native filesystem authority and exact workspace boundary", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        taskID = Identifier.ascending("task"),
        now = Date.now()
      const binding = await prepareTaskProcessBinding({
        mode: "native",
        taskID,
        projectID: Instance.project.id,
        rootDirectory: project.path,
        packageRevisionSHA256: "a".repeat(64),
        timeCreated: now,
      })
      Database.transaction((db) => {
        db.insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            source: "test",
            product_pillar: "work",
            title: "Attachment native write",
            request: "Save exact canonical bytes",
            priority: "normal",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run()
        insertTaskProcessBinding({ db, payload: binding })
      })
      ctx.executionAuthority = {
        kind: "task",
        taskID,
        sessionID: ctx.sessionID,
        projectID: Instance.project.id,
        directory: project.path,
      }
      const bytes = Buffer.from([10, 20, 30]),
        reference = await AttachmentStore.write(Instance.project.id, bytes, "application/octet-stream", "task.bin")
      const writer = await WriteTool.init(),
        filePath = path.join(project.path, "task.bin")
      await writer.execute({ filePath, attachmentUrl: reference.url }, ctx)
      expect(await fs.readFile(filePath)).toEqual(bytes)
      const error = await writer
        .execute({ filePath: path.join(project.path, "..", "outside-task.bin"), attachmentUrl: reference.url }, ctx)
        .catch((error) => error)
      expect(error).toMatchObject({ name: "TaskProcessBoundaryError", code: "TASK_PROCESS_BOUNDARY_VIOLATION" })
    },
  })
})
