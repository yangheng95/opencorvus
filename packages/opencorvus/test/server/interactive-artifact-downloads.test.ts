import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { publishInteractiveArtifact, findInteractiveArtifact } from "../../src/interactive-artifact/persist"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Server } from "../../src/server/server"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function completedDelivery(renderer: "file-preview@1" | "presentation@1", declaredSha?: string) {
  const session = await Session.create({ kind: "assistant", title: "Source download ownership" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    time: { created: 1 },
    agent: "coding",
    model: { providerID: "fixture", modelID: "fixture" },
  })
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    parentID: user.id,
    role: "assistant",
    author: "coding",
    agent: "coding",
    time: { created: 2 },
    providerID: "fixture",
    modelID: "fixture",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  // Transport fixtures only; actual Office/PDF file validity is covered by the
  // native lifecycle and real UI acceptance, not these small byte arrays.
  const source = await AttachmentStore.write(
    Instance.project.id,
    Buffer.from([0, 1, 2, 255]),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "源文件.docx",
  )
  const preview = await AttachmentStore.write(
    Instance.project.id,
    Buffer.from("%PDF-1.7\n"),
    "application/pdf",
    "预览.pdf",
  )
  const record = await publishInteractiveArtifact({
    sessionID: session.id,
    messageID: message.id,
    payload:
      renderer === "file-preview@1"
        ? { schemaVersion: "1", renderer, title: "Download ownership", kind: "pdf", source: preview }
        : {
            schemaVersion: "1",
            renderer,
            title: "Download ownership",
            aspectRatio: "16:9",
            slides: [{ id: "slide-1", title: "Review", markdown: "Native source accompanies this review." }],
          },
  })
  const tool = {
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: message.id,
    type: "tool" as const,
    tool: "work_artifact_deliver",
    callID: Identifier.ascending("part"),
    state: {
      status: "completed" as const,
      input: { source_url: source.url },
      output: "Completed delivery fixture",
      title: "Delivered",
      metadata: { artifactID: record.id, sourceSha: declaredSha ?? source.sha },
      time: { start: 3, end: 4 },
      attachments: [source, preview].map((reference) => ({
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: message.id,
        type: "file" as const,
        url: reference.url,
        mime: reference.mime,
        filename: reference.filename,
      })),
    },
  }
  await Session.persistCompletedToolResult({
    tool,
    display: [
      {
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: message.id,
        type: "interactive-artifact",
        artifactID: record.id,
      },
    ],
  })
  return { record, source, preview }
}

test("completed file and presentation cards project their exact Tool source alongside the persisted preview", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      for (const renderer of ["file-preview@1", "presentation@1"] as const) {
        const { record, source } = await completedDelivery(renderer)
        expect(
          findInteractiveArtifact({
            sessionID: record.sessionID,
            artifactID: record.id,
            projectID: Instance.project.id,
          }),
        ).toEqual({ ...record, downloads: [{ url: source.url, mime: source.mime, filename: source.filename }] })
      }
    },
  })
})

test("cold HTTP artifact reads retain canonical source downloads and original PDF identity", async () => {
  await using project = await memoryProject()
  const { record, source, preview } = await Instance.provide({
    directory: project.path,
    fn: () => completedDelivery("file-preview@1"),
  })
  await Instance.disposeAll()
  const response = await Server.App().request(`/session/${record.sessionID}/interactive-artifact/${record.id}`, {
    headers: { "x-opencorvus-directory": project.path },
  })
  expect({ status: response.status, body: await response.json() }).toEqual({
    status: 200,
    body: { ...record, downloads: [{ url: source.url, mime: source.mime, filename: source.filename }] },
  })
  const downloaded = await Server.App().request(source.url)
  expect({
    status: downloaded.status,
    mime: downloaded.headers.get("content-type"),
    bytes: [...new Uint8Array(await downloaded.arrayBuffer())],
    preview: (record.payload as { source: unknown }).source,
  }).toEqual({ status: 200, mime: source.mime, bytes: [0, 1, 2, 255], preview })
})

test("a declared source without matching completed Tool bytes maps to an explicit artifact corruption error", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { record } = await completedDelivery("file-preview@1", "a".repeat(64))
      expect(() =>
        findInteractiveArtifact({ sessionID: record.sessionID, artifactID: record.id, projectID: Instance.project.id }),
      ).toThrow("no attachment matching its declared source identity")
    },
  })
})
