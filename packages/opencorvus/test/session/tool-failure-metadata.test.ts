import { expect, test } from "bun:test"
import { ExaMcpFailure } from "@/tool/exa-mcp"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { Database, eq } from "@/storage/db"
import { ToolPartOutcomeTable } from "@/session/session.sql"
import { memoryProject } from "../fixture/memory"

test("ordinary errors retain the explicit caller diagnostic record", () => {
  const failure = toolFailureCauseFromUnknown({
    error: new Error("Actual ordinary failure"),
    originSite: "owned.origin",
    classification: "tool-execution",
    data: {},
  })
  expect(failure).toEqual({
    kind: "tool-execution",
    name: "Error",
    message: "Actual ordinary failure",
    originSite: "owned.origin",
    classification: "tool-execution",
    data: {},
  })
})

test("named provider diagnostics and caller provenance persist in the actual Tool outcome", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Owned protocol failure" })
      const messageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: messageID,
        sessionID: session.id,
        role: "assistant",
        author: "build",
        agent: "build",
        parentID: Identifier.ascending("message"),
        time: { created: Date.now() },
        path: { cwd: project.path, root: project.path },
        modelID: "contract",
        providerID: "contract",
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      })
      const result = {
        content: [{ type: "text" as const, text: "Actual quota diagnostic" }],
        _meta: { "ai.exa/rateLimited": true },
      }
      const error = new ExaMcpFailure({
        code: "rate_limited",
        toolName: "get_code_context_exa",
        message: "Code search: Actual quota diagnostic",
        result,
      })
      const failure = toolFailureCauseFromUnknown({
        error,
        originSite: "session.processor.tool-error",
        classification: "tool-execution",
        data: { toolCallId: "owned-call", toolName: "external_code_search" },
      })
      expect(failure).toEqual({
        kind: "tool-execution",
        name: "ExaMcpFailure",
        message: error.message,
        originSite: "session.processor.tool-error",
        classification: "tool-execution",
        data: {
          toolCallId: "owned-call",
          toolName: "external_code_search",
          canonical_error_metadata: { code: "rate_limited", toolName: "get_code_context_exa", result },
        },
      })
      const base = {
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID,
        type: "tool" as const,
        tool: "external_code_search",
        callID: "owned-call",
      }
      const start = Date.now()
      await Session.updatePart({
        ...base,
        state: { status: "pending", input: { query: "owned" }, raw: '{"query":"owned"}', time: { start } },
      })
      await Session.updatePart({
        ...base,
        state: { status: "error", input: { query: "owned" }, failure, time: { start, end: Date.now() } },
      })
      const stored = Database.use((db) =>
        db
          .select({ data: ToolPartOutcomeTable.data })
          .from(ToolPartOutcomeTable)
          .where(eq(ToolPartOutcomeTable.request_part_id, base.id))
          .get(),
      )
      expect(stored?.data).toMatchObject({ outcome: "failed", failure })
    },
  })
})
