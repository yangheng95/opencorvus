import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { MCP } from "../../src/mcp"
import { Instance } from "../../src/project/instance"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { WriteTool } from "../../src/tool/write"
import { Tool } from "../../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { startControlledStreamingProvider } from "../fixture/controlled-streaming-provider"

const model = { providerID: "session-attachment-contract", modelID: "session-prompt-owner-model" }
const resourceURI = "reports://public/input"
const wav = Buffer.from("UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA", "base64")
type FileInput = Omit<Message.FilePart, "id" | "messageID" | "sessionID">

afterEach(resetMemoryDatabase)

function resourceServer(contents: ReadResourceResult["contents"]) {
  const servers = new Set<McpServer>()
  const reads: string[] = []
  const http = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request) {
      const server = new McpServer({ name: "public-user-resources", version: "1.0.0" })
      servers.add(server)
      server.registerResource("public-input", resourceURI, {}, async (uri) => {
        reads.push(uri.href)
        return { contents }
      })
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      await server.connect(transport)
      return transport.handleRequest(request)
    },
  })
  return {
    url: http.url.href,
    reads,
    async close() {
      for (const server of servers) await server.close()
      await http.stop(true)
    },
  }
}

async function scope(
  run: (input: {
    session: Session.Info
    directory: string
    errors: Error[]
    provider: ReturnType<typeof startControlledStreamingProvider>
    resources: ReturnType<typeof resourceServer> | undefined
    send: (
      body: Record<string, unknown>,
      options?: { sessionID?: string; operation?: "message" | "command" },
    ) => Promise<Response>
    body: (files: FileInput[], messageID?: string) => Record<string, unknown>
  }) => Promise<void>,
  contents?: ReadResourceResult["contents"],
) {
  await using project = await memoryProject(`user-attachments-${Identifier.ascending("part")}`)
  const provider = startControlledStreamingProvider()
  const resources = contents === undefined ? undefined : resourceServer(contents)
  const release = setInterval(() => {
    for (const request of provider.requests) request.release()
  }, 5)
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateGlobalPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Public Session attachment contract",
              npm: "@ai-sdk/openai-compatible",
              api: provider.apiURL,
              models: {
                [model.modelID]: {
                  name: "Public Session attachment contract",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4096 },
                },
              },
            },
          },
        })
        await Config.updateProjectPatch({
          mcp: {
            browser: { enabled: false },
            computer: { enabled: false },
            ...(resources
              ? {
                  public_inputs: {
                    type: "remote" as const,
                    transport: "streamable-http" as const,
                    url: resources.url,
                    oauth: false as const,
                    timeout: 10_000,
                  },
                }
              : {}),
          },
          command: { "attachment-contract": { template: "Read the attached public input.", agent: "chat" } },
        })
        if (resources) {
          const catalog = await MCP.resources()
          expect(Object.values(catalog).map((item) => ({ uri: item.uri, client: item.client }))).toEqual([
            { uri: resourceURI, client: "public_inputs" },
          ])
        }
        const session = await Session.create({ kind: "assistant", title: "Public user attachments" })
        const errors: Error[] = []
        const app = new Hono().route("/session", SessionRoutes())
        app.onError((error, context) => {
          errors.push(error)
          return serverErrorResponse(error, context)
        })
        const send = (
          body: Record<string, unknown>,
          options?: { sessionID?: string; operation?: "message" | "command" },
        ) =>
          app.fetch(
            new Request(
              `http://opencorvus.test/session/${options?.sessionID ?? session.id}/${options?.operation ?? "message"}`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              },
            ),
          )
        const body = (files: FileInput[], messageID = Identifier.ascending("message")) => ({
          messageID,
          agent: "chat",
          model,
          parts: [{ type: "text", text: "Read the attached public input." }, ...files],
        })
        await run({ session, directory: project.path, errors, provider, resources, send, body })
      },
    })
  } finally {
    try {
      await Instance.disposeAll()
    } finally {
      clearInterval(release)
      for (const request of provider.requests) request.release()
      try {
        await resources?.close()
      } finally {
        await provider.server.stop(true)
      }
    }
  }
}

async function completed(
  response: Response,
  errors: Error[],
  provider: ReturnType<typeof startControlledStreamingProvider>,
) {
  const result = (await response.json()) as { info: Message.Assistant; parts: Message.Part[] }
  expect(response.status, errors.map((error) => error.message).join("\n")).toBe(200)
  expect(result.info).toMatchObject({
    role: "assistant",
    providerID: model.providerID,
    modelID: model.modelID,
    finish: "stop",
    time: { completed: expect.any(Number) },
  })
  expect(result.parts.filter((part) => part.type === "text").map((part) => part.text)).toEqual([
    expect.stringMatching(/^provider reply \d+$/),
  ])
  const request = provider.promptRequests().at(-1)!
  expect(request.body).toMatchObject({ model: model.modelID, stream: true })
  await request.responded
  return result
}

async function storedFile(input: {
  sessionID: string
  messageID: string
  projectID: string
  bytes: Buffer
  mime: string
}) {
  const saved = await MessageStore.get({ sessionID: input.sessionID, messageID: input.messageID })
  const files = saved.parts.filter((part): part is Message.FilePart => part.type === "file")
  expect(files.length).toBe(1)
  const file = files[0]!
  expect(file).toMatchObject({ sessionID: input.sessionID, messageID: input.messageID, mime: input.mime })
  const located = AttachmentStore.nameFromUrl(file.url)!
  expect(located.projectID).toBe(input.projectID)
  const verified = await AttachmentStore.readVerifiedReference({
    projectID: input.projectID,
    url: file.url,
    mime: input.mime,
  })
  expect(verified.bytes).toEqual(input.bytes)
  expect(verified.reference.size).toBe(input.bytes.length)
  return { saved, file }
}

for (const representation of ["canonical", "data", "file"] as const) {
  test(`public Session ${representation} attachment persists exact bytes through the real streaming processor`, async () => {
    await scope(async ({ session, directory, errors, provider, send, body }) => {
      const bytes = representation === "canonical" ? Buffer.alloc(0) : wav
      const mime = representation === "canonical" ? "text/csv" : "audio/wav"
      let url: string
      if (representation === "canonical")
        url = (await AttachmentStore.write(session.projectID, bytes, mime, "empty.csv")).url
      else if (representation === "data") url = `data:${mime};base64,${bytes.toString("base64")}`
      else {
        const file = path.join(directory, "public.wav")
        await fs.writeFile(file, bytes)
        url = pathToFileURL(file).href
      }
      const input = body([
        {
          type: "file",
          mime,
          url,
          filename: representation === "canonical" ? "empty.csv" : "public.wav",
          presentation: "attachment-index",
        },
      ])
      await completed(await send(input), errors, provider)
      await storedFile({
        sessionID: session.id,
        messageID: String(input.messageID),
        projectID: session.projectID,
        bytes,
        mime,
      })
      if (representation === "file") {
        const target = path.join(directory, "public.wav"),
          before = await fs.stat(target)
        const changed = Buffer.concat([bytes, Buffer.from("external update")])
        await fs.writeFile(target, changed)
        await fs.utimes(target, before.atime, before.mtime)
        const outcome = await (await WriteTool.init())
          .execute(
            { filePath: target, content: "replacement" },
            {
              sessionID: session.id,
              messageID: Identifier.ascending("message"),
              agent: "coding",
              messages: [],
              abort: new AbortController().signal,
              metadata() {},
              executionSurface: Tool.executionSurface(["write"], []),
              executionAuthority: { kind: "conversation", sessionID: session.id, projectID: session.projectID, directory },
            },
          )
          .catch(error => error)
        expect(outcome).toMatchObject({ name: "FileWriteConflictError", data: { path: target } })
        expect(await fs.readFile(target)).toEqual(changed)
      }
    })
  }, 60_000)
}

test("public Session replay returns the same accepted input, reply and canonical file", async () => {
  await scope(async ({ session, errors, provider, send, body }) => {
    const bytes = Buffer.from("Exact public replay bytes.\r\n")
    const ref = await AttachmentStore.write(session.projectID, bytes, "text/plain", "replay.txt")
    const input = body([{ type: "file", mime: ref.mime, url: ref.url, filename: ref.filename }])
    const first = await completed(await send(input), errors, provider)
    const stored = await storedFile({
      sessionID: session.id,
      messageID: String(input.messageID),
      projectID: session.projectID,
      bytes,
      mime: ref.mime,
    })
    const second = await completed(await send(input), errors, provider)
    expect(second.info.id).toBe(first.info.id)
    expect(second.info.parentID).toBe(input.messageID)
    expect(await MessageStore.get({ sessionID: session.id, messageID: String(input.messageID) })).toEqual(stored.saved)
  })
}, 60_000)

test("public command keeps its explicit Session attachment project binding", async () => {
  await scope(async ({ session, errors, provider, send }) => {
    const bytes = Buffer.from("Public command attachment\n")
    const ref = await AttachmentStore.write(session.projectID, bytes, "text/plain", "command.txt")
    const messageID = Identifier.ascending("message")
    const response = await send(
      {
        messageID,
        command: "attachment-contract",
        arguments: "",
        parts: [{ type: "file", mime: ref.mime, url: ref.url, filename: ref.filename }],
      },
      { operation: "command" },
    )
    await completed(response, errors, provider)
    await storedFile({ sessionID: session.id, messageID, projectID: session.projectID, bytes, mime: ref.mime })
  })
}, 60_000)

test("public schema reports the caller's private byte project field as an unrecognized key", async () => {
  await scope(async ({ session, send, body }) => {
    const response = await send({ ...body([]), byteMaterializationProjectID: session.projectID })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      data: { message: "Request validation failed" },
      error: [{ code: "unrecognized_keys" }],
    })
  })
}, 60_000)

test("a foreign attachment reports its exact actual and expected projects", async () => {
  await using foreign = await memoryProject(`foreign-resource-${Identifier.ascending("part")}`)
  await scope(async ({ session, errors, send, body }) => {
    const ref = await Instance.provide({
      directory: foreign.path,
      fn: () =>
        AttachmentStore.write(Instance.project.id, Buffer.from("Foreign project bytes"), "text/plain", "foreign.txt"),
    })
    const actual = AttachmentStore.nameFromUrl(ref.url)!
    const response = await send(body([{ type: "file", mime: ref.mime, url: ref.url }]))
    expect(response.status).toBe(500)
    expect(errors.at(-1)?.message).toBe(
      `attachment belongs to project ${actual.projectID}, expected ${session.projectID}: ${ref.url}`,
    )
    expect(await response.json()).toMatchObject({
      data: { message: "Internal server error. See x-opencorvus-request-id for diagnostics." },
    })
  })
}, 60_000)

test("two coexisting projects bind identical attachment bytes to their own accepted Session", async () => {
  await using other = await memoryProject(`second-resource-${Identifier.ascending("part")}`)
  await scope(async ({ session, errors, provider, send, body }) => {
    const bytes = Buffer.from("Same bytes with two actual Project owners.\n")
    const mime = "text/plain"
    const inputFile: FileInput = {
      type: "file",
      mime,
      filename: "public.txt",
      url: `data:${mime};base64,${bytes.toString("base64")}`,
    }
    const first = body([inputFile])
    await completed(await send(first), errors, provider)
    const firstFile = await storedFile({
      sessionID: session.id,
      messageID: String(first.messageID),
      projectID: session.projectID,
      bytes,
      mime,
    })
    const second = await Instance.provide({
      directory: other.path,
      fn: async () => {
        await Config.updateProjectPatch({ mcp: { browser: { enabled: false }, computer: { enabled: false } } })
        const secondSession = await Session.create({ kind: "assistant", title: "Second public attachment owner" })
        const input = body([inputFile])
        await completed(await send(input, { sessionID: secondSession.id }), errors, provider)
        const stored = await storedFile({
          sessionID: secondSession.id,
          messageID: String(input.messageID),
          projectID: secondSession.projectID,
          bytes,
          mime,
        })
        return { session: secondSession, file: stored.file }
      },
    })
    expect([
      AttachmentStore.nameFromUrl(firstFile.file.url)?.projectID,
      AttachmentStore.nameFromUrl(second.file.url)?.projectID,
    ]).toEqual([session.projectID, second.session.projectID])
    expect(new Set([session.projectID, second.session.projectID]).size).toBe(2)
  })
}, 60_000)

test("an empty data URL retains the explicit nonempty upload decoder error", async () => {
  await scope(async ({ errors, send, body }) => {
    const response = await send(
      body([{ type: "file", mime: "text/csv", filename: "empty.csv", url: "data:text/csv;base64," }]),
    )
    expect(response.status).toBe(500)
    expect(errors.at(-1)?.message).toBe(
      "SessionPrompt.createUserMessage data URL file part empty.csv: expected non-empty base64 payload",
    )
  })
}, 60_000)

const resourceCases: Array<{
  name: string
  contents: ReadResourceResult["contents"]
  texts: string[]
  bytes?: Buffer
  mime?: string
}> = [
  { name: "empty text", contents: [{ uri: resourceURI, text: "" }], texts: [""] },
  {
    name: "nonempty text",
    contents: [{ uri: resourceURI, text: "  Public resource\r\n" }],
    texts: ["  Public resource\r\n"],
  },
  {
    name: "empty CSV blob",
    contents: [{ uri: resourceURI, mimeType: "text/csv", blob: "" }],
    texts: ["[Binary content: text/csv]"],
    bytes: Buffer.alloc(0),
    mime: "text/csv",
  },
  {
    name: "ordered mixed text, empty text and binary",
    contents: [
      { uri: resourceURI, text: "First\r\n" },
      { uri: "reports://empty", text: "" },
      { uri: "reports://audio", mimeType: "audio/wav", blob: wav.toString("base64") },
      { uri: "reports://tail", text: "Last  " },
    ],
    texts: ["First\r\n", "", "[Binary content: audio/wav]", "Last  "],
    bytes: wav,
    mime: "audio/wav",
  },
]

for (const scenario of resourceCases) {
  test(`official SDK user resource ${scenario.name} persists every actual content item through the public prompt`, async () => {
    await scope(async ({ session, errors, provider, resources, send, body }) => {
      const source = {
        type: "resource" as const,
        clientName: "public_inputs",
        uri: resourceURI,
        text: { value: resourceURI, start: 0, end: resourceURI.length },
      }
      const input = body([
        { type: "file", mime: "application/octet-stream", filename: "public-input", url: resourceURI, source },
      ])
      await completed(await send(input), errors, provider)
      const saved = await MessageStore.get({ sessionID: session.id, messageID: String(input.messageID) })
      expect(saved.parts.filter((part) => part.type === "text").map((part) => part.text)).toEqual([
        "Read the attached public input.",
        `Reading MCP resource: public-input (${resourceURI})`,
        ...scenario.texts,
      ])
      expect(resources!.reads).toEqual([resourceURI])
      if (scenario.bytes !== undefined) {
        const { file } = await storedFile({
          sessionID: session.id,
          messageID: String(input.messageID),
          projectID: session.projectID,
          bytes: scenario.bytes,
          mime: scenario.mime!,
        })
        expect(file.source).toEqual(source)
        expect(file.filename).toBe("public-input")
      }
    }, scenario.contents)
  }, 60_000)
}

test("an SDK resource with no content reports the existing explicit empty-result error", async () => {
  await scope(async ({ errors, send, body }) => {
    const response = await send(
      body([
        {
          type: "file",
          mime: "text/plain",
          url: resourceURI,
          source: {
            type: "resource",
            clientName: "public_inputs",
            uri: resourceURI,
            text: { value: resourceURI, start: 0, end: resourceURI.length },
          },
        },
      ]),
    )
    expect(response.status).toBe(500)
    expect(errors.at(-1)?.message).toBe(
      `MCP resource public_inputs/${resourceURI} did not return usable text or blob content`,
    )
  }, [])
}, 60_000)
