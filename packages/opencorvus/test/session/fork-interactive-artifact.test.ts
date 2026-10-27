import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { Identifier } from "../../src/id/id"
import { findInteractiveArtifact, publishInteractiveArtifact, updateMcpAppToolLifecycle } from "../../src/interactive-artifact/persist"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import type { Message } from "../../src/session/message"
import { InteractiveArtifactTable, MessageTable, PartTable, SessionTable } from "../../src/session/session.sql"
import { Server } from "../../src/server/server"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { Database, eq, sql } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const table = {
  schemaVersion: "1", renderer: "table@1", title: "Original value types",
  columns: [{ id: "passed", label: "Passed", dataType: "boolean" }],
  rows: [{ passed: "false" }, { passed: false }, { passed: null }],
}

async function delivery(payload: unknown, attachments: Message.FilePart[] = [], sourceSha?: string) {
  const session = await Session.create({ kind: "assistant", title: "Artifact copy source" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, role: "user", author: "user",
    agent: "chat", model: { providerID: "test", modelID: "copy" }, time: { created: 1 },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, role: "assistant", author: "chat", agent: "chat",
    parentID: user.id, acceptedInputMessageIDs: [user.id], providerID: "test", modelID: "copy",
    cost: 0, tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    path: { cwd: Instance.directory, root: Instance.worktree }, time: { created: 2 },
  })
  const artifact = await publishInteractiveArtifact({ sessionID: session.id, messageID: assistant.id, payload })
  const tool: Message.ToolPart = {
    id: Identifier.ascending("part"), sessionID: session.id, messageID: assistant.id,
    type: "tool", callID: "original-delivery", tool: "work_artifact_deliver",
    state: {
      status: "completed", input: {}, title: "Delivered", output: `Original artifact ${artifact.id}`,
      metadata: { artifactID: artifact.id, ...(sourceSha ? { sourceSha } : {}) }, time: { start: 3, end: 4 },
      attachments: attachments.map(part => ({ ...part, sessionID: session.id, messageID: assistant.id })),
    },
  }
  await Session.persistCompletedToolResult({ tool, display: [0, 1].map(() => ({
    id: Identifier.ascending("part"), sessionID: session.id, messageID: assistant.id,
    type: "interactive-artifact", artifactID: artifact.id,
  })) })
  await Session.updateMessage({ ...assistant, finish: "stop", time: { ...assistant.time, completed: 5 } })
  return { session, artifact, tool }
}

async function copied(sessionID: string) {
  const messages = await Session.messages({ sessionID })
  const assistant = messages.find(message => message.info.role === "assistant")!
  const displays = assistant.parts.filter((part): part is Message.InteractiveArtifactPart => part.type === "interactive-artifact")
  return { assistant, displays, record: findInteractiveArtifact({ sessionID, artifactID: displays[0]!.artifactID, projectID: Instance.project.id })! }
}

test("ordinary, bounded, repeated and side forks own complete table snapshots with real route identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const source = await delivery(table)
    const cut = await Session.updateMessage({
      id: Identifier.ascending("message"), sessionID: source.session.id, role: "user", author: "user",
      agent: "chat", model: { providerID: "test", modelID: "copy" }, time: { created: 6 },
    })
    const ordinary = await Session.fork({ sessionID: source.session.id })
    const bounded = await Session.fork({ sessionID: source.session.id, messageID: cut.id })
    const repeated = await Session.fork({ sessionID: ordinary.id })
    const side = await Session.fork({ sessionID: source.session.id, purpose: "side-chat" })
    const snapshots = [source.artifact.id]
    for (const fork of [ordinary, bounded, repeated, side]) {
      const copy = await copied(fork.id)
      snapshots.push(copy.record.id)
      const tool = copy.assistant.parts.find((part): part is Message.ToolPart => part.type === "tool")!
      const response = await Server.App().request(`/session/${fork.id}/interactive-artifact/${copy.record.id}`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect({
        status: response.status, body: await response.json(), displayIDs: copy.displays.map(part => part.artifactID),
        bindings: copy.displays.map(part => part.toolPartID), toolOutput: tool.state.status === "completed" && tool.state.output,
      }).toEqual({
        status: 200, body: { ...source.artifact, id: copy.record.id, sessionID: fork.id, messageID: copy.assistant.info.id },
        displayIDs: [copy.record.id, copy.record.id], bindings: [tool.id, tool.id],
        toolOutput: `Original artifact ${source.artifact.id}`,
      })
    }
    expect(new Set(snapshots).size).toBe(5)
    expect((await Session.messages({ sessionID: bounded.id })).map(message => message.info.role)).toEqual(["user", "assistant"])
    const wrong = await Server.App().request(`/session/${side.id}/interactive-artifact/${source.artifact.id}`, {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: wrong.status, body: await wrong.json() }).toEqual({
      status: 404, body: { name: "NotFoundError", data: { message: `Interactive artifact not found: ${source.artifact.id}` } },
    })
    const sideCopy = await copied(side.id)
    Database.immediateTransaction(db => db.delete(SessionTable).where(eq(SessionTable.id, source.session.id)).run())
    expect(findInteractiveArtifact({ sessionID: side.id, artifactID: sideCopy.record.id, projectID: Instance.project.id })).toEqual(sideCopy.record)
  } })
}, 60_000)

test("a copied native delivery resolves original attachment bytes through its remapped Tool binding", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const source = await AttachmentStore.write(Instance.project.id, Buffer.from([0, 1, 2, 255]), "application/octet-stream", "original.bin")
    const preview = await AttachmentStore.write(Instance.project.id, Buffer.from("%PDF-1.7\n"), "application/pdf", "preview.pdf")
    const original = await delivery({ schemaVersion: "1", renderer: "file-preview@1", title: "Native delivery", kind: "pdf", source: preview }, [source, preview].map(ref => ({
      id: Identifier.ascending("part"), sessionID: "", messageID: "", type: "file", url: ref.url, mime: ref.mime, filename: ref.filename,
    })), source.sha)
    const side = await Session.fork({ sessionID: original.session.id, purpose: "side-chat" })
    const copy = await copied(side.id)
    Database.immediateTransaction(db => db.delete(SessionTable).where(eq(SessionTable.id, original.session.id)).run())
    const record = findInteractiveArtifact({ sessionID: side.id, artifactID: copy.record.id, projectID: Instance.project.id })!
    const downloaded = await Server.App().request(record.downloads![0]!.url)
    expect({ downloads: record.downloads, payload: record.payload, status: downloaded.status, bytes: [...new Uint8Array(await downloaded.arrayBuffer())] }).toEqual({
      downloads: [{ url: source.url, mime: source.mime, filename: source.filename }], payload: original.artifact.payload,
      status: 200, bytes: [0, 1, 2, 255],
    })
  } })
}, 60_000)

test("MCP copies retain verified resource snapshots and settle their own lifecycle", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const html = "<!doctype html><p>Original MCP resource</p>"
    const source = await delivery({
      schemaVersion: "1", renderer: "mcp-app@1", title: "MCP snapshot",
      server: { id: "test", configDigest: createHash("sha256").update("real fixture configuration").digest("hex"), authority: { kind: "configured" } },
      tool: { name: "review", definition: {}, lifecycle: { status: "running", input: {} } },
      resource: { uri: "ui://review/index", mimeType: "text/html;profile=mcp-app", html, sha: createHash("sha256").update(html).digest("hex"), metadata: {} },
    })
    const side = await Session.fork({ sessionID: source.session.id, purpose: "side-chat" })
    const copy = await copied(side.id)
    const updated = updateMcpAppToolLifecycle({ sessionID: side.id, artifactID: copy.record.id, projectID: Instance.project.id, lifecycle: { status: "completed", input: {}, result: { content: [{ type: "text", text: "Settled copy" }] } } })
    expect({ original: findInteractiveArtifact({ sessionID: source.session.id, artifactID: source.artifact.id, projectID: Instance.project.id }), copied: copy.record.payload, lifecycle: updated.payload.renderer === "mcp-app@1" && updated.payload.tool.lifecycle }).toEqual({
      original: source.artifact, copied: source.artifact.payload, lifecycle: { status: "completed", input: {}, result: { content: [{ type: "text", text: "Settled copy" }] } },
    })
  } })
}, 60_000)

test("artifact insertion failure rolls back the complete fork and retry commits all owned rows", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const source = await delivery(table)
    const footprint = () => Database.use(db => ({
      sessions: db.select().from(SessionTable).all(), messages: db.select().from(MessageTable).all(),
      parts: db.select().from(PartTable).all(), artifacts: db.select().from(InteractiveArtifactTable).all(),
    }))
    const before = footprint()
    Database.use(db => db.run(sql.raw(`CREATE TEMP TRIGGER fail_copied_artifact AFTER INSERT ON interactive_artifact BEGIN SELECT RAISE(ABORT,'injected copied artifact failure'); END`)))
    try { await expect(Session.fork({ sessionID: source.session.id })).rejects.toThrow("injected copied artifact failure") }
    finally { Database.use(db => db.run(sql.raw("DROP TRIGGER fail_copied_artifact"))) }
    expect(footprint()).toEqual(before)
    const fork = await Session.fork({ sessionID: source.session.id })
    expect((await copied(fork.id)).record.payload).toEqual(source.artifact.payload)
  } })
}, 60_000)

test("an unavailable owned payload returns its canonical corruption identity and preserves the source", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const source = await delivery(table)
    Database.immediateTransaction(db => db.delete(InteractiveArtifactTable).where(eq(InteractiveArtifactTable.id, source.artifact.id)).run())
    const original = await Session.messages({ sessionID: source.session.id })
    await expect(Session.fork({ sessionID: source.session.id, purpose: "side-chat" })).rejects.toMatchObject({
      name: "InteractiveArtifactCorruptionError",
      data: { artifactID: source.artifact.id, message: `Copied Message ${source.artifact.messageID} has no owned interactive artifact ${source.artifact.id}` },
    })
    expect(await Session.messages({ sessionID: source.session.id })).toEqual(original)
  } })
}, 60_000)
