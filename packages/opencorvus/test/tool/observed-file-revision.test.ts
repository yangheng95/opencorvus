import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import { ReadTool } from "../../src/tool/read"
import { WriteTool } from "../../src/tool/write"
import { EditTool } from "../../src/tool/edit"
import { Tool } from "../../src/tool/tool"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { Database } from "../../src/storage/db"
import { prepareTaskProcessBinding, insertTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { createCodebaseToolFactory } from "../../src/engine/codebase-tools"
import { Bus } from "../../src/bus"
import { File } from "../../src/file"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function context(directory: string): Promise<Tool.Context> {
  const session = await Session.create({ kind: "assistant", title: "Observed file revision contract" })
  return {
    sessionID: session.id,
    messageID: Identifier.ascending("message"),
    callID: "observed-file-revision",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    executionSurface: Tool.executionSurface(["read", "write", "edit"], []),
    executionAuthority: { kind: "conversation", sessionID: session.id, projectID: Instance.project.id, directory },
  }
}

async function nativeTask(ctx: Tool.Context, directory: string) {
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  const binding = await prepareTaskProcessBinding({
    mode: "native",
    taskID,
    projectID: Instance.project.id,
    rootDirectory: directory,
    packageRevisionSHA256: "a".repeat(64),
    timeCreated: now,
  })
  Database.transaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: ctx.sessionID,
        source: "test",
        product_pillar: "work",
        title: "Observed Task file revision",
        request: "Retain the exact bytes read",
        priority: "normal",
        time_created: now,
        time_updated: now,
      })
      .run()
    insertTaskProcessBinding({ db, payload: binding })
  })
  ctx.executionAuthority = { kind: "task", taskID, sessionID: ctx.sessionID, projectID: Instance.project.id, directory }
}

async function scope(fn: (directory: string, ctx: Tool.Context) => Promise<void>) {
  await using project = await memoryProject()
  await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
  await fs.writeFile(path.join(project.path, ".opencorvus/opencorvus.jsonc"), '{"formatter":false}')
  await Instance.provide({ directory: project.path, fn: async () => fn(project.path, await context(project.path)) })
}

for (const operation of ["write", "edit"] as const) {
  test(`${operation} reports a real content conflict when an external edit retains the original mtime`, async () => {
    await scope(async (directory, ctx) => {
      const target = path.join(directory, "shared.txt"),
        old = "alpha\n",
        external = "alpha\n外部修改\n"
      await fs.writeFile(target, old)
      const before = await fs.stat(target)
      const read = await (await ReadTool.init()).execute({ filePath: target }, ctx)
      expect(read.metadata.readType).toBe("text")
      await fs.writeFile(target, external)
      await fs.utimes(target, before.atime, before.mtime)
      const outcome = await (
        operation === "write"
          ? (await WriteTool.init()).execute({ filePath: target, content: "rewritten\n" }, ctx)
          : (await EditTool.init()).execute({ filePath: target, oldString: "alpha", newString: "rewritten" }, ctx)
      ).catch((error) => error)
      console.log(
        "OBSERVED_CONTENT_CONFLICT",
        JSON.stringify({ operation, outcome: outcome.name ?? "success", actual: await fs.readFile(target, "utf8") }),
      )
      expect(outcome).toMatchObject({ name: "FileWriteConflictError", data: { path: target } })
      expect(await fs.readFile(target, "utf8")).toBe(external)
      await (await ReadTool.init()).execute({ filePath: target }, ctx)
      const saved = await (await WriteTool.init()).execute({ filePath: target, content: external + "本次提交\n" }, ctx)
      expect({ after: saved.metadata.filediff?.after, actual: await fs.readFile(target, "utf8") }).toEqual({
        after: external + "本次提交\n",
        actual: external + "本次提交\n",
      })
    })
  })
}

test("unchanged bytes with a future file timestamp remain writable after their actual read", async () => {
  await scope(async (directory, ctx) => {
    const target = path.join(directory, "future.txt")
    await fs.writeFile(target, "original\n")
    const future = new Date(Date.now() + 86_400_000)
    await fs.utimes(target, future, future)
    await (await ReadTool.init()).execute({ filePath: target }, ctx)
    const saved = await (await WriteTool.init()).execute({ filePath: target, content: "saved\n" }, ctx)
    expect({ after: saved.metadata.filediff?.after, actual: await fs.readFile(target, "utf8") }).toEqual({
      after: "saved\n",
      actual: "saved\n",
    })
  })
})

test("native Task reads retain the exact file revision before a later edit", async () => {
  await scope(async (directory, ctx) => {
    await nativeTask(ctx, directory)
    const target = path.join(directory, "task.txt")
    await fs.writeFile(target, "initial\n")
    const before = await fs.stat(target)
    await (await ReadTool.init()).execute({ filePath: target }, ctx)
    await fs.writeFile(target, "task external\n")
    await fs.utimes(target, before.atime, before.mtime)
    const outcome = await (await WriteTool.init())
      .execute({ filePath: target, content: "task overwritten\n" }, ctx)
      .catch((error) => error)
    expect(outcome).toMatchObject({ name: "FileWriteConflictError", data: { path: target } })
    expect(await fs.readFile(target, "utf8")).toBe("task external\n")
  })
})

test("a Task codebase range error keeps the actual read-required write contract", async () => {
  await scope(async (directory, ctx) => {
    await nativeTask(ctx, directory)
    const target = path.join(directory, "range.txt")
    await fs.writeFile(target, "only line\n")
    const reader = createCodebaseToolFactory(directory).materializeExact("read")!
    const options = { toolCallId: "range", messages: [], context: {}, opencorvus: { sessionID: ctx.sessionID } }
    const result = await reader.execute!({ filePath: "range.txt", offset: 99 }, options)
    expect(result).toBe("Error: offset 99 is past end of file (2 lines).")
    const outcome = await (await WriteTool.init())
      .execute({ filePath: target, content: "overwritten\n" }, ctx)
      .catch((error) => error)
    expect(outcome).toMatchObject({
      name: "Error",
      message: `You must read file ${target} before overwriting it. Use the Read tool first`,
    })
    expect(await fs.readFile(target, "utf8")).toBe("only line\n")
  })
})

test("a successful Task codebase read observes the same byte version used by the native writer", async () => {
  await scope(async (directory, ctx) => {
    await nativeTask(ctx, directory)
    const target = path.join(directory, "codebase.txt")
    await fs.writeFile(target, "observed\n")
    const reader = createCodebaseToolFactory(directory).materializeExact("read")!
    const options = { toolCallId: "codebase", messages: [], context: {}, opencorvus: { sessionID: ctx.sessionID } }
    expect(await reader.execute!({ filePath: "codebase.txt" }, options)).toBe("    1 | observed\n    2 | ")
    const saved = await (await WriteTool.init()).execute({ filePath: target, content: "updated\n" }, ctx)
    expect({ before: saved.metadata.filediff?.before, actual: await fs.readFile(target, "utf8") }).toEqual({
      before: "observed\n",
      actual: "updated\n",
    })
  })
})

test("an observer's later file update is compared with the writer's actual captured commit", async () => {
  await scope(async (directory, ctx) => {
    const target = path.join(directory, "observer.txt")
    const unsubscribe = Bus.subscribe(File.Event.Edited, async (event) => {
      if (event.properties.file === target) await fs.writeFile(target, "observer update\n")
    })
    const writer = await WriteTool.init()
    let saved: Awaited<ReturnType<typeof writer.execute>>
    try {
      saved = await writer.execute({ filePath: target, content: "writer commit\n" }, ctx)
    } finally {
      unsubscribe()
    }
    expect(saved.metadata.filediff?.after).toBe("writer commit\n")
    expect(await fs.readFile(target, "utf8")).toBe("observer update\n")
    const outcome = await writer
      .execute({ filePath: target, content: "next writer commit\n" }, ctx)
      .catch((error) => error)
    expect(outcome).toMatchObject({ name: "FileWriteConflictError", data: { path: target } })
  })
})

test("parallel Sessions retain their own read versions and a fresh read admits the successor edit", async () => {
  await scope(async (directory, first) => {
    const second = await context(directory),
      target = path.join(directory, "sessions.txt")
    await fs.writeFile(target, "shared\n")
    const reader = await ReadTool.init()
    await Promise.all([reader.execute({ filePath: target }, first), reader.execute({ filePath: target }, second)])
    await (await WriteTool.init()).execute({ filePath: target, content: "first session\n" }, first)
    const writer = await WriteTool.init()
    const outcome = await writer
      .execute({ filePath: target, content: "second stale\n" }, second)
      .catch((error) => error)
    expect(outcome).toMatchObject({ name: "FileWriteConflictError", data: { path: target } })
    await reader.execute({ filePath: target }, second)
    const saved = await writer.execute({ filePath: target, content: "second refreshed\n" }, second)
    expect({ before: saved.metadata.filediff?.before, actual: await fs.readFile(target, "utf8") }).toEqual({
      before: "first session\n",
      actual: "second refreshed\n",
    })
  })
})
