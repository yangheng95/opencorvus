import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { materializeMcpToolResult } from "../packages/opencorvus/src/mcp/materialize"
import { AttachmentStore } from "../packages/opencorvus/src/storage/attachment-store"
import { attachmentNameFromUrl } from "../packages/opencorvus/src/storage/attachment-reference"
import { Instance } from "../packages/opencorvus/src/project/instance"
import { Message } from "../packages/opencorvus/src/session/message"
import { decodeRawBase64Payload, decodeCanonicalBase64Payload } from "../packages/opencorvus/src/util/base64"
import { memoryProject, resetMemoryDatabase } from "../packages/opencorvus/test/fixture/memory"
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { Client } = await import(require.resolve("@modelcontextprotocol/sdk/client/index.js"))
const { StreamableHTTPClientTransport } = await import(require.resolve("@modelcontextprotocol/sdk/client/streamableHttp.js"))
const { McpServer } = await import(require.resolve("@modelcontextprotocol/sdk/server/mcp.js"))
const { WebStandardStreamableHTTPServerTransport } = await import(require.resolve("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"))
const { CallToolResultSchema } = await import(require.resolve("@modelcontextprotocol/sdk/types.js"))
const { z } = await import(require.resolve("zod"))
afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })
const model = { id: "offline-contract-model", providerID: "openai", api: { id: "offline-contract-model", npm: "@ai-sdk/openai" }, capabilities: { input: { text: true, image: true, audio: true, video: false, pdf: true } } } as any
const wave = Buffer.alloc(60)
wave.write("RIFF"); wave.writeUInt32LE(52, 4); wave.write("WAVEfmt ", 8); wave.writeUInt32LE(16, 16)
wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28)
wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write("data", 36); wave.writeUInt32LE(16, 40)
const results: Record<string, any> = {
  "empty-blob": { content: [{ type: "resource", resource: { uri: "file:///public/empty.bin", mimeType: "application/octet-stream", blob: "" } }] },
  "mixed-empty-blob": { content: [{ type: "text", text: "Public export succeeded; zero records." }, { type: "resource", resource: { uri: "file:///public/empty.csv", mimeType: "text/csv", blob: "" } }], structuredContent: { records: 0 } },
  "audio-block": { content: [{ type: "text", text: "Public audio generated." }, { type: "audio", data: wave.toString("base64"), mimeType: "audio/wav" }] },
  "audio-resource-control": { content: [{ type: "text", text: "Public audio generated." }, { type: "resource", resource: { uri: "file:///public/audio.wav", blob: wave.toString("base64"), mimeType: "audio/wav" } }] },
  "resource-link": { content: [{ type: "text", text: "Found the public report." }, { type: "resource_link", uri: "https://example.com/public/report.csv", name: "report.csv", title: "Public report", description: "Published report data", mimeType: "text/csv", size: 0 }] },
  "empty-text-control": { content: [{ type: "resource", resource: { uri: "file:///public/empty.txt", mimeType: "text/plain", text: "" } }] },
  "text-link-control": { content: [{ type: "text", text: "Public report: https://example.com/public/report.csv" }] },
}
test("observes actual SDK content boundaries and existing downstream representations", async () => {
  await using project = await memoryProject()
  const servers = new Set<any>()
  const calls: string[] = []
  const http = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, async fetch(request) {
    const server = new McpServer({ name: "public-content-boundary", version: "1.0.0" })
    servers.add(server)
    server.registerTool("report", { description: "Return one public protocol representation.", inputSchema: { variant: z.enum(Object.keys(results)) } }, async ({ variant }: any) => { calls.push(variant); return results[variant] })
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    return transport.handleRequest(request)
  } })
  const port = http.port
  const client = new Client({ name: "content-probe", version: "1.0.0" })
  const observations: any[] = []
  let downstream: any
  try {
    await client.connect(new StreamableHTTPClientTransport(http.url))
    await client.listTools()
    await Instance.provide({ directory: project.path, fn: async () => {
      for (const [variant, original] of Object.entries(results)) {
        const received = CallToolResultSchema.parse(await client.callTool({ name: "report", arguments: { variant } }))
        expect(received).toEqual(original)
        try {
          const materialized = await materializeMcpToolResult({ projectID: Instance.project.id, serverName: "public-reports", result: received })
          const projected = await Message.toolResultToModelOutput({ output: materialized.text, attachments: materialized.attachments }, model)
          observations.push({ variant, sdkAccepted: true, materialized, projected })
          for (const attachment of materialized.attachments) {
            const located = attachmentNameFromUrl(attachment.url)!
            expect(await AttachmentStore.read(located.projectID, located.name)).toEqual(wave)
          }
        } catch (error) {
          observations.push({ variant, sdkAccepted: true, failure: { name: (error as Error).name, message: (error as Error).message } })
        }
      }
      const empty = await AttachmentStore.write(Instance.project.id, Buffer.alloc(0), "text/csv", "empty.csv")
      const located = attachmentNameFromUrl(empty.url)!
      expect(await AttachmentStore.read(located.projectID, located.name)).toEqual(Buffer.alloc(0))
      const projected = await Message.toolResultToModelOutput({ output: "Public export succeeded; zero records.", attachments: [empty] }, model)
      let rawDecode: any
      try { rawDecode = { bytes: decodeRawBase64Payload("", "MCP zero-byte probe").length } } catch (error) { rawDecode = { name: (error as Error).name, message: (error as Error).message } }
      downstream = { emptyStoredReference: empty, emptyModelOutput: projected, rawDecode, canonicalEmptyDecodeBytes: decodeCanonicalBase64Payload("", "durable zero-byte control").length }
      expect(empty.size).toBe(0)
      expect(projected.type).toBe("text")
    } })
    expect(calls).toEqual(Object.keys(results))
  } finally {
    await client.close()
    const closed = await Promise.allSettled([...servers].map((server) => server.close()))
    await http.stop(true)
    expect(closed.map((result) => result.status)).toEqual(closed.map(() => "fulfilled"))
    await fs.writeFile(path.join(import.meta.dir, "probe-observation.json"), JSON.stringify({ observedAt: new Date().toISOString(), pid: process.pid, port, calls, observations, downstream, serverOwners: closed.length, closed: closed.map((result) => result.status), boundary: "Actual loopback SDK, production materializer/store/model-output conversion; no Provider/model call or UI" }, null, 2))
  }
  console.log(JSON.stringify({ calls: calls.length, observations: observations.map((item) => ({ variant: item.variant, failure: item.failure, text: item.materialized?.text, attachments: item.materialized?.attachments.map((item: any) => ({ mime: item.mime, size: item.size })), projected: item.projected })) , downstream }, null, 2))
}, 60000)
