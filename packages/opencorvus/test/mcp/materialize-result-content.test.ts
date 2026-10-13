import { afterEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import z from "zod"
import { materializeMcpToolResult } from "../../src/mcp/materialize"
import { Instance } from "../../src/project/instance"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { attachmentNameFromUrl } from "../../src/storage/attachment-reference"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function withRemoteResult<T>(result: CallToolResult, run: (received: CallToolResult) => Promise<T>) {
  const servers = new Set<McpServer>()
  const calls: string[] = []
  const http = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request) {
      const server = new McpServer({ name: "public-report-result", version: "1.0.0" })
      servers.add(server)
      server.registerTool(
        "report",
        {
          description: "Return the public report in its declared protocol representation.",
          inputSchema: {},
          ...(result.structuredContent !== undefined ? { outputSchema: z.object({}).catchall(z.unknown()) } : {}),
        },
        async () => {
          calls.push("report")
          return result
        },
      )
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })
      await server.connect(transport)
      return transport.handleRequest(request)
    },
  })
  const client = new Client({ name: "result-content-contract", version: "1.0.0" })
  try {
    await client.connect(new StreamableHTTPClientTransport(http.url))
    const listed = await client.listTools()
    expect(listed.tools.map((tool) => tool.name)).toEqual(["report"])
    const received = CallToolResultSchema.parse(await client.callTool({ name: "report", arguments: {} }))
    expect(received).toEqual(result)
    expect(calls).toEqual(["report"])
    return await run(received)
  } finally {
    await client.close()
    for (const server of servers) await server.close()
    await http.stop(true)
  }
}

const cases: Array<{ name: string; result: CallToolResult; text: string; isError: boolean }> = [
  {
    name: "structured-only report",
    result: { content: [], structuredContent: { total: 7, report: "public-report" } },
    text: '{"total":7,"report":"public-report"}',
    isError: false,
  },
  {
    name: "empty structured object",
    result: { content: [], structuredContent: {} },
    text: "{}",
    isError: false,
  },
  {
    name: "original text and independent structured fields",
    result: {
      content: [{ type: "text", text: 'Original\r\n  {"total":999}\n\n' }],
      structuredContent: { total: 7 },
    },
    text: 'Original\r\n  {"total":999}\n\n\n\n{"total":7}',
    isError: false,
  },
  {
    name: "explicit text copy and structured representation",
    result: { content: [{ type: "text", text: '{"total":7}' }], structuredContent: { total: 7 } },
    text: '{"total":7}\n\n{"total":7}',
    isError: false,
  },
  {
    name: "empty embedded text resource",
    result: {
      content: [{ type: "resource", resource: { uri: "file:///public/empty.txt", mimeType: "text/plain", text: "" } }],
    },
    text: "",
    isError: false,
  },
  {
    name: "ordered text around an empty embedded resource",
    result: {
      content: [
        { type: "text", text: "before" },
        { type: "resource", resource: { uri: "file:///public/empty.txt", mimeType: "text/plain", text: "" } },
        { type: "text", text: "after" },
      ],
    },
    text: "before\n\n\n\nafter",
    isError: false,
  },
  {
    name: "structured tool execution error",
    result: {
      content: [],
      isError: true,
      structuredContent: { error: { code: "REPORT_SCOPE_REQUIRED", message: "Use an approved report scope." } },
    },
    text: '{"error":{"code":"REPORT_SCOPE_REQUIRED","message":"Use an approved report scope."}}',
    isError: true,
  },
  {
    name: "minimal resource link with its original non-HTTP URI",
    result: {
      content: [{ type: "resource_link", uri: "reports://quarter/2026?team=%2Fa#summary", name: "quarter.json" }],
    },
    text: '{"type":"resource_link","uri":"reports://quarter/2026?team=%2Fa#summary","name":"quarter.json"}',
    isError: false,
  },
  {
    name: "ordered public resource link fields beside original text and structured error data",
    result: {
      content: [
        { type: "text", text: "Report reference follows.\r\n" },
        {
          type: "resource_link",
          uri: "file:///remote/public/report.csv",
          name: "report.csv",
          title: "",
          description: "Public zero-row report",
          mimeType: "text/csv",
          size: 0,
          _meta: { diagnostic: "opaque-client-value" },
          annotations: { audience: ["user"], priority: 0.7 },
        },
        { type: "text", text: "Original source description." },
      ],
      structuredContent: { error: "Export is incomplete; inspect the available report reference." },
      isError: true,
    },
    text: 'Report reference follows.\r\n\n\n{"type":"resource_link","uri":"file:///remote/public/report.csv","name":"report.csv","title":"","description":"Public zero-row report","mimeType":"text/csv","size":0}\n\nOriginal source description.\n\n{"error":"Export is incomplete; inspect the available report reference."}',
    isError: true,
  },
]

for (const example of cases)
  test(`materializes actual MCP ${example.name}`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: () =>
        withRemoteResult(example.result, async (received) => {
          const materialized = await materializeMcpToolResult({
            projectID: Instance.project.id,
            serverName: "public-reports",
            result: received,
          })
          expect(materialized).toEqual({
            text: example.text,
            attachments: [],
            metadata: { mcp_tool_result: { is_error: example.isError } },
          })
          expect(received).toEqual(example.result)
        }),
    })
  })

test("materializes mixed MCP text, image, resource and structured data with complete stored bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      // Protocol attachment bytes only; this test does not render or inspect UI.
      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=",
        "base64",
      )
      const binary = Buffer.from("public attachment bytes\r\n")
      const result: CallToolResult = {
        content: [
          { type: "text", text: "Report summary" },
          { type: "image", mimeType: "image/png", data: image.toString("base64") },
          {
            type: "resource",
            resource: { uri: "file:///public/details.txt", mimeType: "text/plain", text: "  detail\r\n" },
          },
          {
            type: "resource",
            resource: {
              uri: "file:///public/data.bin",
              mimeType: "application/octet-stream",
              blob: binary.toString("base64"),
            },
          },
        ],
        structuredContent: { total: 7, rows: ["first", "last"] },
      }
      await withRemoteResult(result, async (received) => {
        const materialized = await materializeMcpToolResult({
          projectID: Instance.project.id,
          serverName: "public-reports",
          result: received,
        })
        expect(materialized.text).toBe('Report summary\n\n  detail\r\n\n\n{"total":7,"rows":["first","last"]}')
        expect(materialized.metadata).toEqual({ mcp_tool_result: { is_error: false } })
        expect(materialized.attachments.map((attachment) => attachment.mime)).toEqual([
          "image/png",
          "application/octet-stream",
        ])
        const stored = materialized.attachments.map((attachment) => attachmentNameFromUrl(attachment.url)!)
        expect(stored.map((attachment) => attachment.projectID)).toEqual([Instance.project.id, Instance.project.id])
        expect(await AttachmentStore.read(Instance.project.id, stored[0]!.name)).toEqual(image)
        expect(await AttachmentStore.read(Instance.project.id, stored[1]!.name)).toEqual(binary)
        expect(received).toEqual(result)
      })
    },
  })
})

for (const mime of ["application/octet-stream", "text/csv"])
  test(`materializes an actual zero-byte MCP ${mime} resource with its mixed result`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const result: CallToolResult = {
          content: [
            { type: "text", text: "Public export succeeded; zero records." },
            { type: "resource", resource: { uri: "file:///public/empty.csv", mimeType: mime, blob: "" } },
          ],
          structuredContent: { records: 0 },
        }
        await withRemoteResult(result, async (received) => {
          const materialized = await materializeMcpToolResult({
            projectID: Instance.project.id,
            serverName: "public-reports",
            result: received,
          })
          expect(materialized.text).toBe('Public export succeeded; zero records.\n\n{"records":0}')
          expect(materialized.metadata).toEqual({ mcp_tool_result: { is_error: false } })
          expect(materialized.attachments).toHaveLength(1)
          const reference = materialized.attachments[0]!
          expect(reference).toMatchObject({ mime, size: 0, filename: "file:///public/empty.csv" })
          const located = attachmentNameFromUrl(reference.url)!
          expect(located.projectID).toBe(Instance.project.id)
          expect(await AttachmentStore.read(located.projectID, located.name)).toEqual(Buffer.alloc(0))
          expect(received).toEqual(result)
        })
      },
    })
  })

test("materializes actual MCP audio and the same resource bytes as canonical audio attachments", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      // A valid mono 8000 Hz 16-bit PCM WAV with eight silent samples.
      const data = "UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA"
      const audio = Buffer.from(data, "base64")
      for (const content of [
        { type: "resource" as const, resource: { uri: "file:///public/audio.wav", mimeType: "audio/wav", blob: data } },
        { type: "audio" as const, mimeType: "audio/wav", data },
      ]) {
        const result: CallToolResult = { content: [{ type: "text", text: "Public audio generated." }, content] }
        await withRemoteResult(result, async (received) => {
          const materialized = await materializeMcpToolResult({
            projectID: Instance.project.id,
            serverName: "public-reports",
            result: received,
            imageFilename: "screenshot.png",
          })
          expect(materialized.text).toBe("Public audio generated.")
          expect(materialized.metadata).toEqual({ mcp_tool_result: { is_error: false } })
          expect(materialized.attachments).toHaveLength(1)
          const reference = materialized.attachments[0]!
          expect(reference).toMatchObject({ mime: "audio/wav", size: 60 })
          const located = attachmentNameFromUrl(reference.url)!
          expect(located.projectID).toBe(Instance.project.id)
          expect(located.name.slice(-4)).toBe(".wav")
          expect(await AttachmentStore.read(located.projectID, located.name)).toEqual(audio)
          expect(received).toEqual(result)
        })
      }
    },
  })
})

test.each([
  [
    { type: "resource", resource: { uri: "file:///public/invalid.bin", blob: "!!!!" } },
    "MCP tool resource blob file:///public/invalid.bin: invalid base64 payload",
  ],
  [{ type: "image", mimeType: "image/png", data: "" }, "MCP tool image content: expected non-empty base64 payload"],
  [{ type: "audio", mimeType: "audio/wav", data: "" }, "MCP tool audio content: expected non-empty base64 payload"],
])("reports the exact binary decoder contract for %j", async (content, message) => {
  // Malformed Base64 is rejected by the SDK; empty image/audio strings pass
  // that schema but still fail the production decoder's nonempty media contract.
  await expect(
    materializeMcpToolResult({
      projectID: "prj_binary_decoder_contract",
      result: { content: [content] } as CallToolResult,
    }),
  ).rejects.toThrow(message)
})
