import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "../../src/bus"
import { File } from "../../src/file"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { WriteTool } from "../../src/tool/write"
import { EditTool } from "../../src/tool/edit"
import { Tool } from "../../src/tool/tool"
import { Identifier } from "../../src/id/id"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { prepareTaskProcessBinding, insertTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Database } from "../../src/storage/db"
import { FileTime } from "../../src/file/time"
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
      const textPath = path.join(project.path, "task.txt")
      const textResult = await writer.execute({ filePath: textPath, content: "Task实际文本\n" }, ctx)
      expect(textResult.metadata.filediff).toEqual({
        file: textPath,
        before: "",
        after: "Task实际文本\n",
        status: "added",
        additions: 1,
        deletions: 0,
      })
      expect(await fs.readFile(textPath, "utf8")).toBe("Task实际文本\n")
      const error = await writer
        .execute({ filePath: path.join(project.path, "..", "outside-task.bin"), attachmentUrl: reference.url }, ctx)
        .catch((error) => error)
      expect(error).toMatchObject({ name: "TaskProcessBoundaryError", code: "TASK_PROCESS_BOUNDARY_VIOLATION" })
    },
  })
})

test("text writes deliver the actual added and overwritten file comparisons", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        writer = await WriteTool.init(),
        filePath = path.join(project.path, "说明.txt")
      const first = await writer.execute({ filePath, content: "第一行\n第二行\n第三行\n" }, ctx)
      expect(first.metadata.filediff).toEqual({
        file: filePath,
        before: "",
        after: "第一行\n第二行\n第三行\n",
        status: "added",
        additions: 3,
        deletions: 0,
      })
      expect(await fs.readFile(filePath, "utf8")).toBe(first.metadata.filediff?.after)
      const replaced = await writer.execute({ filePath, content: "新正文\n" }, ctx)
      expect(replaced.metadata.filediff).toEqual({
        file: filePath,
        before: "第一行\n第二行\n第三行\n",
        after: "新正文\n",
        status: "modified",
        additions: 1,
        deletions: 3,
      })
      expect(await fs.readFile(filePath, "utf8")).toBe(replaced.metadata.filediff?.after)
    },
  })
})

test("text comparison after is read from actual UTF-8 file bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        filePath = path.join(project.path, "encoding.txt")
      const result = await (await WriteTool.init()).execute({ filePath, content: "\uD800\n" }, ctx)
      expect({ comparison: result.metadata.filediff?.after, bytes: [...(await fs.readFile(filePath))] }).toEqual({
        comparison: "\uFFFD\n",
        bytes: [239, 191, 189, 10],
      })
    },
  })
})

test("parallel sessions serialize a new text destination and return the current read-before-overwrite error", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const contexts = [await context(), await context()],
        writer = await WriteTool.init(),
        filePath = path.join(project.path, "shared.txt")
      const results = await Promise.allSettled(
        contexts.map((ctx, index) => writer.execute({ filePath, content: `Session ${index}\n` }, ctx)),
      )
      const completed = results.filter((result) => result.status === "fulfilled"),
        rejected = results.filter((result) => result.status === "rejected")
      expect({ completed: completed.length, rejected: rejected.length }).toEqual({ completed: 1, rejected: 1 })
      expect(rejected[0]?.reason).toMatchObject({
        name: "Error",
        message: `You must read file ${filePath} before overwriting it. Use the Read tool first`,
      })
      expect(await fs.readFile(filePath, "utf8")).toBe(completed[0]?.value.metadata.filediff?.after)
    },
  })
})

test("a canceled queued write settles as AbortError with the current file intact", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        filePath = path.join(project.path, "canceled.txt"),
        controller = new AbortController()
      await fs.writeFile(filePath, "Current file\n")
      let release!: () => void, entered!: () => void
      const ready = new Promise<void>((resolve) => {
        entered = resolve
      })
      const held = FileTime.withLock(filePath, () => {
        entered()
        return new Promise<void>((resolve) => {
          release = resolve
        })
      })
      await ready
      const writer = await WriteTool.init()
      const outcome = writer
        .execute({ filePath, content: "Canceled content\n" }, { ...ctx, abort: controller.signal })
        .catch((error) => error)
      controller.abort(new DOMException("Caller canceled queued write", "AbortError"))
      release()
      await held
      expect(await outcome).toMatchObject({ name: "AbortError", message: "Caller canceled queued write" })
      expect(await fs.readFile(filePath, "utf8")).toBe("Current file\n")
    },
  })
})

test("parallel writes from one session record their actual ordered file endpoints", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        writer = await WriteTool.init(),
        filePath = path.join(project.path, "ordered.txt")
      const results = await Promise.all(
        ["First\n", "Second\n"].map((content) => writer.execute({ filePath, content }, ctx)),
      )
      const observations = results.map((result) => result.metadata.filediff!),
        created = observations.find((item) => item.status === "added")!,
        modified = observations.find((item) => item.status === "modified")!
      expect(observations.map((item) => item.status).sort()).toEqual(["added", "modified"])
      expect(observations.map((item) => item.after).sort()).toEqual(["First\n", "Second\n"])
      expect({ before: created.before, nextBefore: modified.before }).toEqual({ before: "", nextBefore: created.after })
      expect(await fs.readFile(filePath, "utf8")).toBe(modified.after)
    },
  })
})

test("parallel projects retain their own actual text files and observations", async () => {
  await using first = await memoryProject(),
    second = await memoryProject()
  const values = await Promise.all(
    [first, second].map((project, index) =>
      Instance.provide({
        directory: project.path,
        fn: async () => {
          const ctx = await context(),
            filePath = path.join(project.path, "same-name.txt"),
            content = `Project ${index}\n`
          const result = await (await WriteTool.init()).execute({ filePath, content }, ctx)
          return { filePath, content: await fs.readFile(filePath, "utf8"), observation: result.metadata.filediff }
        },
      }),
    ),
  )
  expect(values).toEqual(
    [first, second].map((project, index) => ({
      filePath: path.join(project.path, "same-name.txt"),
      content: `Project ${index}\n`,
      observation: {
        file: path.join(project.path, "same-name.txt"),
        before: "",
        after: `Project ${index}\n`,
        status: "added",
        additions: 1,
        deletions: 0,
      },
    })),
  )
})

test.skipIf(process.platform !== "win32")("Windows path casing aliases share the actual file write order", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        writer = await WriteTool.init()
      const paths = [path.join(project.path, "Alias.txt"), path.join(project.path, "alias.txt")]
      const results = await Promise.all(
        paths.map((filePath, index) => writer.execute({ filePath, content: `Alias ${index}\n` }, ctx)),
      )
      const observations = results.map((result) => result.metadata.filediff!),
        created = observations.find((item) => item.status === "added")!,
        modified = observations.find((item) => item.status === "modified")!
      expect(observations.map((item) => item.status).sort()).toEqual(["added", "modified"])
      expect(observations.map((item) => item.after).sort()).toEqual(["Alias 0\n", "Alias 1\n"])
      expect({ before: created.before, nextBefore: modified.before }).toEqual({ before: "", nextBefore: created.after })
      expect(await fs.readFile(paths[0], "utf8")).toBe(modified.after)
    },
  })
})

test("write and edit share the same actual file interval while parallel Tool calls settle", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ctx = await context(),
        filePath = path.join(project.path, "cross-tool.txt"),
        writer = await WriteTool.init(),
        editor = await EditTool.init()
      const initial = "Anchor Initial\n"
      await fs.writeFile(filePath, initial)
      expect(await fs.readFile(filePath, "utf8")).toBe(initial)
      FileTime.read(ctx.sessionID, filePath, Buffer.from(initial))
      const [written, edited] = await Promise.all([
        writer.execute({ filePath, content: "Anchor Written\n" }, ctx),
        editor.execute({ filePath, oldString: "Anchor", newString: "Checked" }, ctx),
      ])
      const observations = [written.metadata.filediff!, edited.metadata.filediff],
        first = observations.find((item) => item.before === initial)!,
        last = observations.find((item) => item !== first)!
      expect(written.metadata.filediff?.after).toBe("Anchor Written\n")
      expect(edited.metadata.filediff.after).toBe(edited.metadata.filediff.before.replace("Anchor", "Checked"))
      expect(first.after).toBe(last.before)
      expect(await fs.readFile(filePath, "utf8")).toBe(last.after)
    },
  })
})
