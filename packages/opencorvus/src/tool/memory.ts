import z from "zod"
import { Memory } from "@/memory"
import { SessionMemory } from "@/memory/session-memory"
import { Instance } from "@/project/instance"
import { Tool } from "./tool"

const MemoryKinds = ["note", "episode", "fact", "lesson", "profile"] as const

const DESCRIPTION = `Memory access for the current Session document and reusable project knowledge.

Session memory is exactly one read-only Markdown checkpoint named \`MEMORY.MD\`, generated only by successful conversation compaction. Project semantic memory stores reusable knowledge across Sessions.

Never store credentials, application programming interface (API) keys, tokens, passwords, private keys, or other secrets in either memory surface. Required behavior belongs in AGENTS.md or checked-in project records, not generated memory.

Before answering about prior work, decisions, dates, or project history, search project semantic memory. Use \`session_read\` only when the current compaction checkpoint is directly relevant; never attempt to mutate it.

Actions:
- **session_read**: Read the current Session MEMORY.MD.
- **search**: Search reusable project semantic memory.
- **get**: Retrieve a project semantic-memory file by ID.
- **write**: Save reusable project knowledge.
- **list**: Browse project semantic-memory files.
- **delete**: Remove a project semantic-memory file by ID.`

export const MemoryTool = Tool.define("memory", {
  description: DESCRIPTION,
  parameters: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("session_read"),
    }),
    z.object({
      action: z.literal("search"),
      query: z.string().describe("Keywords, phrases, or a question about reusable project knowledge"),
      maxResults: z
        .preprocess((value) => (typeof value === "string" ? Number(value) : value), z.number().int().min(1).max(50).optional())
        .describe("Maximum number of ranked memory search results to return"),
      minScore: z
        .preprocess((value) => (typeof value === "string" ? Number(value) : value), z.number().min(0).max(1).optional())
        .describe("Minimum relevance score from 0 to 1"),
    }),
    z.object({
      action: z.literal("get"),
      fileId: z.string().describe("Project semantic-memory file ID to retrieve"),
    }),
    z.object({
      action: z.literal("write"),
      title: z.string().describe("Short descriptive title"),
      content: z.string().describe("Markdown content containing reusable project knowledge"),
      kind: z.enum(MemoryKinds).optional().describe("Semantic-memory kind"),
      key: z.string().optional().describe("Stable identifier for idempotent project-memory upserts"),
    }),
    z.object({
      action: z.literal("list"),
    }),
    z.object({
      action: z.literal("delete"),
      fileId: z.string().describe("Project semantic-memory file ID to delete"),
    }),
  ]),
  async execute(params, ctx) {
    const projectId = Instance.project.id

    await ctx.ask({
      permission: "memory",
      patterns: ["*"],
      always: ["*"],
      metadata: { action: params.action },
    })

    switch (params.action) {
      case "session_read": {
        const document = await SessionMemory.read(ctx.sessionID)
        return {
          title: document ? SessionMemory.filename : "Session memory empty",
          output: JSON.stringify({ document }),
          metadata: {},
        }
      }

      case "search": {
        const results = Memory.search({
          query: params.query,
          projectId,
          limit: params.maxResults,
          minScore: params.minScore,
        })
        const formatted = results.map((result) => ({
          fileId: result.fileId,
          fileTitle: result.fileTitle,
          kind: result.kind,
          source: result.source,
          importance: result.importance,
          confidence: result.confidence,
          score: Number(result.score.toFixed(4)),
          snippet: result.content.slice(0, 700),
          citation: `memory:${result.fileId}`,
        }))
        return {
          title: formatted.length > 0 ? `${formatted.length} memories found` : "No memories found",
          output: JSON.stringify({ results: formatted, query: params.query }),
          metadata: {},
        }
      }

      case "get": {
        const file = Memory.getFileInProject({ fileId: params.fileId, projectId })
        if (!file) {
          return {
            title: "Not found",
            output: JSON.stringify({ error: `Memory file ${params.fileId} not found` }),
            metadata: {},
          }
        }
        const chunks = Memory.getChunksInProject({ fileId: params.fileId, projectId })
        return {
          title: file.title,
          output: JSON.stringify({
            fileId: file.id,
            title: file.title,
            source: file.source,
            kind: file.kind,
            key: file.key,
            importance: file.importance,
            confidence: file.confidence,
            text: chunks.map((chunk) => chunk.content).join("\n\n"),
          }),
          metadata: {},
        }
      }

      case "write": {
        const file = Memory.writeFile({
          title: params.title,
          content: params.content,
          source: "agent",
          projectId,
          kind: params.kind,
          key: params.key,
        })
        return {
          title: `Saved: ${params.title}`,
          output: JSON.stringify({
            fileId: file.id,
            title: params.title,
            kind: file.kind,
            key: file.key,
            importance: file.importance,
            confidence: file.confidence,
          }),
          metadata: {},
        }
      }

      case "list": {
        const files = Memory.listFiles({ projectId })
        return {
          title: `${files.length} memory files`,
          output: JSON.stringify({
            files: files.map((file) => ({
              id: file.id,
              title: file.title,
              source: file.source,
              kind: file.kind,
              key: file.key,
              importance: file.importance,
              confidence: file.confidence,
              created: new Date(file.timeCreated).toISOString(),
            })),
          }),
          metadata: {},
        }
      }

      case "delete": {
        const file = Memory.deleteFileInProject({ fileId: params.fileId, projectId })
        if (!file) {
          return {
            title: "Not found",
            output: JSON.stringify({ error: `Memory file ${params.fileId} not found` }),
            metadata: {},
          }
        }
        return {
          title: `Deleted: ${file.title}`,
          output: JSON.stringify({ deleted: true, fileId: params.fileId, title: file.title }),
          metadata: {},
        }
      }
    }
  },
})
