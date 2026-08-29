import { afterEach, describe, expect, spyOn, test } from "bun:test"
import z from "zod"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageStore } from "../src/session/message-store"
import { ToolPartProgressTable } from "../src/session/session.sql"
import { SessionStatus } from "../src/session/status"
import { Database } from "../src/storage/db"
import { createBatchTool } from "../src/tool/batch"
import { Tool } from "../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Batch child durable progress", () => {
  test("executes fixed ordinary targets and maps dynamic-mode targets to the Batch input-error contract", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Batch fixed-mode targets" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: "test", modelID: "test" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const ordinary = await Tool.define("bash", {
          description: "Execute one fixed ordinary target",
          parameters: z.object({ value: z.string() }),
          executionMode: "ordinary",
          async execute({ value }) {
            return { title: "Ordinary", output: value, metadata: { value } }
          },
        }).init()
        const actionAware = await Tool.define("action_aware", {
          description: "Resolve coordination from each action",
          parameters: z.object({ action: z.enum(["query", "mutation"]) }),
          executionMode: (input) =>
            (input as { action: string }).action === "query" ? "ordinary" : "turn_control_exclusive",
          async execute({ action }) {
            return { title: "Action aware", output: action, metadata: { action } }
          },
        }).init()
        const batch = await createBatchTool([
          { id: "bash", ...ordinary },
          { id: "action_aware", ...actionAware },
        ]).init()
        const ordinaryInput = batch.parameters.parse({
          tool_calls: [{ tool: "bash", parameters: { value: "completed" } }],
        })
        const result = await batch.execute(ordinaryInput, {
          sessionID: session.id,
          messageID: assistant.id,
          callID: "call_fixed_batch_target",
          agent: "coding",
          abort: new AbortController().signal,
          messages: [],
          executionAuthority: {
            kind: "conversation",
            sessionID: session.id,
            projectID: Instance.project.id,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["batch", "bash", "action_aware"], []),
          metadata() {},
        })
        const dynamicInput = batch.parameters.safeParse({
          tool_calls: [{ tool: "action_aware", parameters: { action: "query" } }],
        })
        const inputError = dynamicInput.success
          ? "unexpected-success"
          : batch.formatValidationError?.(dynamicInput.error) ?? dynamicInput.error.message

        expect(inputError).toBe(
          "Invalid parameters for tool 'batch':\n" +
            '  - tool_calls.0.tool: Invalid input: expected "bash"\n' +
            "  - tool_calls.0.parameters.value: Invalid input: expected string, received undefined\n\n" +
            "Expected payload format:\n" +
            '  {"tool_calls":[{"tool":"tool_name","parameters":{...}},...]}',
        )
        expect(result).toEqual({
          title: "Batch execution (1/1 successful)",
          output: "All 1 tools executed successfully.\n\nKeep using the batch tool for optimal performance in your next response!",
          attachments: [],
          display: [],
          metadata: {
            totalCalls: 1,
            successful: 1,
            failed: 0,
            tools: ["bash"],
            details: [{ tool: "bash", success: true }],
            truncated: false,
          },
        })
      },
    })
  })

  test("persists child metadata and renews the owning Session after commit", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Batch progress" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: "test", modelID: "test" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const child = await Tool.define("bash", {
          description: "Emit real child progress",
          parameters: z.object({ value: z.string() }),
          async execute({ value }, ctx) {
            ctx.metadata({ title: "Child running", metadata: { output_bytes: 40_000 } })
            return { title: "Child complete", output: value, metadata: { output_bytes: 40_000 } }
          },
        }).init()
        const batch = await createBatchTool([{ id: "bash", ...child }]).init()
        const observe = spyOn(SessionStatus, "observeActivity")
        let observed: string[]
        try {
          await batch.execute(
            { tool_calls: [{ tool: "bash", parameters: { value: "done" } }] },
            {
              sessionID: session.id,
              messageID: assistant.id,
              callID: "call_batch_progress",
              agent: "coding",
              abort: new AbortController().signal,
              messages: [],
              executionAuthority: {
                kind: "conversation",
                sessionID: session.id,
                projectID: Instance.project.id,
                directory: project.path,
              },
              executionSurface: Tool.executionSurface(["batch", "bash"], []),
              metadata() {},
            },
          )
          observed = observe.mock.calls.map((call) => call[0])
        } finally {
          observe.mockRestore()
        }

        const progress = Database.use((db) => db.select().from(ToolPartProgressTable).all())
        const parts = await MessageStore.parts(assistant.id)
        expect({ observed, progress, parts }).toMatchObject({
          observed: [session.id],
          progress: [
            {
              request_part_id: expect.any(String),
              title: "Child running",
              metadata: { output_bytes: 40_000 },
              time_created: expect.any(Number),
            },
          ],
          parts: [
            {
              type: "tool",
              tool: "bash",
              state: { status: "completed", output: "done" },
            },
          ],
        })
      },
    })
  }, 30_000)
})
