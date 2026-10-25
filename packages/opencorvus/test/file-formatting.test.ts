import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../src/project/instance"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { Session } from "../src/session"
import { Identifier } from "../src/id/id"
import { AttachmentStore } from "../src/storage/attachment-store"
import { WriteTool } from "../src/tool/write"
import { EditTool } from "../src/tool/edit"
import { ApplyPatchTool } from "../src/tool/apply_patch"
import { Tool } from "../src/tool/tool"
import { File } from "../src/file"
import { Server } from "../src/server/server"
import { Bus } from "../src/bus"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { prepareTaskProcessBinding, insertTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const original = "const x={a:1}\n"
const formatted = "const x = { a: 1 }\n"

async function projectWithFormatter<T>(fn: (directory: string, ctx: Tool.Context) => Promise<T>) {
  await using project = await memoryProject()
  const node = Bun.which("node")
  if (!node) throw new Error("The real formatter contract requires the installed Node.js runtime")
  const prettier = path.resolve(import.meta.dir, "../../../node_modules/prettier/bin/prettier.cjs")
  await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
  await fs.writeFile(
    path.join(project.path, ".opencorvus/opencorvus.jsonc"),
    JSON.stringify({
      formatter: { prettier: { command: [node, prettier, "--write", "$FILE"], extensions: [".js"], timeout: 10000 } },
    }),
  )
  await fs.writeFile(path.join(project.path, ".prettierrc.json"), JSON.stringify({ semi: false }))
  return await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Actual formatter result contract" })
      return fn(project.path, {
        sessionID: session.id,
        messageID: Identifier.ascending("message"),
        callID: "actual-formatter",
        agent: "coding",
        abort: new AbortController().signal,
        messages: [],
        metadata() {},
        executionSurface: Tool.executionSurface(["write", "edit", "apply_patch"], []),
        executionAuthority: {
          kind: "conversation",
          sessionID: session.id,
          projectID: Instance.project.id,
          directory: project.path,
        },
      })
    },
  })
}

test("text write reports the actual bytes after its configured native formatter finishes", async () => {
  await projectWithFormatter(async (directory, ctx) => {
    const filePath = path.join(directory, "written.js")
    const result = await (await WriteTool.init()).execute({ filePath, content: original }, ctx)
    const actual = await fs.readFile(filePath, "utf8")
    console.log("FORMAT_WRITE_FACT", JSON.stringify({ actual, reportedAfter: result.metadata.filediff?.after }))
    expect({ actual, after: result.metadata.filediff?.after, status: result.metadata.filediff?.status }).toEqual({
      actual: formatted,
      after: formatted,
      status: "added",
    })
  })
})

test("canonical attachment saves preserve their original bytes in a project with a formatter", async () => {
  await projectWithFormatter(async (directory, ctx) => {
    const bytes = Buffer.from(original),
      reference = await AttachmentStore.write(Instance.project.id, bytes, "text/javascript", "source.js")
    const filePath = path.join(directory, "attachment.js")
    const result = await (await WriteTool.init()).execute({ filePath, attachmentUrl: reference.url }, ctx)
    const actual = await fs.readFile(filePath)
    console.log(
      "FORMAT_ATTACHMENT_FACT",
      JSON.stringify({ original, actual: actual.toString("utf8"), declaredSourceBytes: result.metadata.bytes }),
    )
    expect({ bytes: actual, source: result.metadata.source }).toEqual({ bytes, source: reference })
  })
})

test("HTTP text saves return the actual formatted content and a revision usable by the next save", async () => {
  await projectWithFormatter(async (directory) => {
    const target = path.join(directory, "editor.js")
    await fs.writeFile(target, "const seed = 0\n")
    const headers = { "x-opencorvus-directory": directory, "content-type": "application/json" }
    const read = await Server.App().request("/file/content?path=editor.js", { headers })
    const loaded = (await read.json()) as File.Content
    const first = await Server.App().request("/file/content", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ path: "editor.js", content: original, expectedRevision: loaded.revision }),
    })
    const saved = (await first.json()) as File.Content
    await Bus.TestHooks.disposeOwnedState()
    const observed = await File.read("editor.js")
    const second = await Server.App().request("/file/content", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ path: "editor.js", content: "const next={b:2}\n", expectedRevision: saved.revision }),
    })
    const next = (await second.json()) as File.Content
    console.log(
      "FORMAT_HTTP_FACT",
      JSON.stringify({
        first: first.status,
        returned: saved.content,
        actual: observed.content,
        returnedRevision: saved.revision,
        actualRevision: observed.revision,
        second: second.status,
      }),
    )
    expect({
      first: first.status,
      returned: saved.content,
      actual: observed.content,
      returnedRevision: saved.revision,
      second: second.status,
      next: next.content,
    }).toEqual({
      first: 200,
      returned: formatted,
      actual: formatted,
      returnedRevision: observed.revision,
      second: 200,
      next: "const next = { b: 2 }\n",
    })
    expect(await fs.readFile(target, "utf8")).toBe(next.content)
  })
})

test("edit and patch publish their actual post-formatter comparison bodies", async () => {
  await projectWithFormatter(async (directory, ctx) => {
    const editor = path.join(directory, "edited.js")
    await (await WriteTool.init()).execute({ filePath: editor, content: "const x = 0\n" }, ctx)
    const edit = await (
      await EditTool.init()
    ).execute({ filePath: editor, oldString: "const x = 0", newString: "const x={a:1}" }, ctx)
    expect({ actual: await fs.readFile(editor, "utf8"), after: edit.metadata.filediff.after }).toEqual({
      actual: formatted,
      after: formatted,
    })
    const patch = await (
      await ApplyPatchTool.init()
    ).execute({ patchText: "*** Begin Patch\n*** Add File: patched.js\n+const x={a:1}\n*** End Patch" }, ctx)
    expect({
      actual: await fs.readFile(path.join(directory, "patched.js"), "utf8"),
      after: patch.metadata.files[0]?.after,
    }).toEqual({ actual: formatted, after: formatted })
  })
})

test("new edits, updated and moved patches, and file creation observe their completed formatter", async () => {
  await projectWithFormatter(async (directory, ctx) => {
    const edited = await (
      await EditTool.init()
    ).execute({ filePath: path.join(directory, "new-edit.js"), oldString: "", newString: original }, ctx)
    expect({
      actual: await fs.readFile(path.join(directory, "new-edit.js"), "utf8"),
      after: edited.metadata.filediff.after,
    }).toEqual({ actual: formatted, after: formatted })
    const patcher = await ApplyPatchTool.init()
    await fs.writeFile(path.join(directory, "updated.js"), "const x = 0\n")
    const updated = await patcher.execute(
      { patchText: "*** Begin Patch\n*** Update File: updated.js\n@@\n-const x = 0\n+const x={a:1}\n*** End Patch" },
      ctx,
    )
    expect({
      actual: await fs.readFile(path.join(directory, "updated.js"), "utf8"),
      after: updated.metadata.files[0]?.after,
    }).toEqual({ actual: formatted, after: formatted })
    const moved = await patcher.execute(
      {
        patchText:
          "*** Begin Patch\n*** Update File: updated.js\n*** Move to: moved-patch.js\n@@\n-const x = { a: 1 }\n+const next={b:2}\n*** End Patch",
      },
      ctx,
    )
    expect({
      actual: await fs.readFile(path.join(directory, "moved-patch.js"), "utf8"),
      after: moved.metadata.files[0]?.after,
    }).toEqual({ actual: "const next = { b: 2 }\n", after: "const next = { b: 2 }\n" })
    const created = await File.create({ path: "created.js", type: "file", content: original })
    await Bus.TestHooks.disposeOwnedState()
    expect({ path: created.path, actual: await fs.readFile(path.join(directory, created.path), "utf8") }).toEqual({
      path: "created.js",
      actual: formatted,
    })
  })
})

test("Task text writes finish the real native formatter within their recorded process authority", async () => {
  await projectWithFormatter(async (directory, ctx) => {
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
          source: "test",
          product_pillar: "work",
          title: "Native formatter contract",
          request: "Write formatted text",
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
      directory,
    }
    const result = await (
      await WriteTool.init()
    ).execute({ filePath: path.join(directory, "task.js"), content: original }, ctx)
    expect({
      actual: await fs.readFile(path.join(directory, "task.js"), "utf8"),
      after: result.metadata.filediff?.after,
    }).toEqual({ actual: formatted, after: formatted })
  })
})

test("copy, move and upload retain exact transferred bytes with a configured formatter", async () => {
  await projectWithFormatter(async (directory) => {
    await fs.writeFile(path.join(directory, "source.js"), original)
    await File.copy({ path: "source.js", newPath: "copied.js" })
    await Bus.TestHooks.disposeOwnedState()
    expect({
      source: await fs.readFile(path.join(directory, "source.js"), "utf8"),
      copy: await fs.readFile(path.join(directory, "copied.js"), "utf8"),
    }).toEqual({ source: original, copy: original })
    await File.move({ path: "copied.js", newPath: "moved.js" })
    await Bus.TestHooks.disposeOwnedState()
    expect(await fs.readFile(path.join(directory, "moved.js"), "utf8")).toBe(original)
    const uploaded = await File.upload({
      targetDir: "",
      files: [{ name: "uploaded.js", contentBase64: Buffer.from(original).toString("base64") }],
    })
    await Bus.TestHooks.disposeOwnedState()
    expect({
      actual: await fs.readFile(path.join(directory, "uploaded.js"), "utf8"),
      bytes: uploaded[0]?.bytes,
    }).toEqual({ actual: original, bytes: Buffer.byteLength(original) })
  })
})
