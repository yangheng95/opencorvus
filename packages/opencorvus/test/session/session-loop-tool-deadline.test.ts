import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { EngineConfig } from "../../src/engine/config"
import { Provider } from "../../src/provider/provider"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Database } from "../../src/storage/db"
import { ToolPartProgressTable } from "../../src/session/session.sql"
import { createExecutionCancellationOrigin } from "../../src/session/prompt/cancellation"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { BashTool } from "../../src/tool/bash"
import { Tool } from "../../src/tool/tool"
import type { ToolExecutionDeadline } from "../../src/tool/execution-deadline"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"

test("the real SessionLoop and Bash executor commit a finite deadline and settle a silent command", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const ref = { providerID: "managed-bash", modelID: "local-fixture" }
      await Config.updateProjectPatch({
        model: `${ref.providerID}/${ref.modelID}`,
        permission_mode: "full_access",
        provider: {
          [ref.providerID]: {
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              [ref.modelID]: {
                name: "Managed Bash fixture",
                tool_call: true,
                limit: { context: 128000, output: 4096 },
              },
            },
          },
        },
      })
      const script = path.join(project.path, "owned-operation.cjs")
      const artifact = path.join(project.path, "actual-result.txt")
      await fs.writeFile(
        script,
        `setTimeout(()=>{require('node:fs').writeFileSync(${JSON.stringify(artifact)},${JSON.stringify("owned command completed\n")});console.log('OWNED_COMMAND_COMPLETED')},2200)`,
      )
      const command = `${quote(process.execPath.replaceAll("\\", "/"))} ${quote(script.replaceAll("\\", "/"))}`
      let sent = false
      const usage = {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      }
      using provider = spyOn(Provider, "getLanguage").mockResolvedValue(
        new MockLanguageModelV3({
          doStream: async (options) => {
            const run = !sent && options.tools?.some((tool) => tool.type === "function" && tool.name === "bash")
            if (run) sent = true
            return {
              stream: simulateReadableStream({
                chunks: run
                  ? [
                      { type: "stream-start", warnings: [] },
                      {
                        type: "tool-call",
                        toolCallId: "real-managed-bash",
                        toolName: "bash",
                        input: JSON.stringify({
                          command,
                          timeout: 10000,
                          description: "Execute owned silent operation",
                        }),
                      },
                      { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                    ]
                  : [
                      { type: "stream-start", warnings: [] },
                      { type: "text-start", id: "done" },
                      { type: "text-delta", id: "done", delta: "Operation completed." },
                      { type: "text-end", id: "done" },
                      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                    ],
              }),
            }
          },
        }),
      )
      using engine = spyOn(EngineConfig, "get").mockResolvedValue({
        ...EngineConfig.defaults,
        activity: { ...EngineConfig.defaults.activity, session_llm_idle_ms: 1000, session_tool_idle_ms: 1000 },
      })
      const session = await Session.create({ kind: "assistant", title: "Owned managed Bash" })
      try {
        await SessionPrompt.prompt({
          sessionID: session.id,
          author: "user",
          agent: "coding",
          model: ref,
          parts: [{ type: "text", text: "Run the owned local operation and report its actual result." }],
        })
        console.info("managed-bash: actual prompt reply received")
        const parts = (await Session.messages({ sessionID: session.id })).flatMap((message) => message.parts)
        const bash = parts.find((part) => part.type === "tool" && part.tool === "bash")
        expect(bash).toMatchObject({
          type: "tool",
          state: {
            status: "completed",
            metadata: { exit: 0 },
            output: expect.stringContaining("OWNED_COMMAND_COMPLETED"),
          },
        })
        expect(await fs.readFile(artifact, "utf8")).toBe("owned command completed\n")
        const progress = Database.use((db) => db.select().from(ToolPartProgressTable).all())
        expect(
          progress.find((row) => row.request_part_id === bash?.id && row.metadata?.execution_deadline),
        ).toMatchObject({
          metadata: {
            execution_deadline: { deadline_at: expect.any(Number), settlement_deadline_at: expect.any(Number) },
          },
        })
      } finally {
        await SessionPrompt.cancel(
          session.id,
          project.path,
          createExecutionCancellationOrigin({
            actor: "runtime",
            source: "process.shutdown",
            surface: "managed-bash-test",
            reason: "Close this owned resident test Session",
            targetSessionID: session.id,
          }),
        )
        await SessionPrompt.waitForFinish(session.id, project.path)
      }
    },
  })
}, 40_000)

for (const boundary of ["timeout", "caller-abort"] as const) {
  test(`the real Bash ${boundary} settles inside its published cleanup bound`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const script = path.join(project.path, "owned-wait.cjs")
        await fs.writeFile(script, "console.log('OWNED_CHILD_READY');setInterval(()=>{},1000)")
        const session = await Session.create({ kind: "assistant", title: `Owned Bash ${boundary}` })
        const controller = new AbortController()
        let observed: ToolExecutionDeadline | undefined
        let settledAt = 0
        const ctx: Tool.Context = {
          sessionID: session.id,
          messageID: "msg_owned_deadline",
          callID: "call_owned_deadline",
          agent: "coding",
          abort: controller.signal,
          messages: [],
          metadata() {},
          executionAuthority: await resolveSessionExecutionAuthority({
            sessionID: session.id,
            projectID: Instance.project.id,
            expected: { kind: "conversation" },
          }),
          executionSurface: Tool.executionSurface(["bash"], []),
          extra: {
            toolExecutionDeadlineObserver: async (deadline: ToolExecutionDeadline) => {
              observed = deadline
              return {
                async [Symbol.asyncDispose]() {
                  settledAt = Date.now()
                },
              }
            },
            bashOutputObserver: ({ output }: { output: string }) => {
              if (boundary === "caller-abort" && output.includes("OWNED_CHILD_READY")) {
                controller.abort(new DOMException("Cancel this owned child", "AbortError"))
              }
            },
          },
        }
        const result = await (
          await BashTool.init()
        ).execute(
          {
            command: `${quote(process.execPath.replaceAll("\\", "/"))} ${quote(script.replaceAll("\\", "/"))}`,
            timeout: boundary === "timeout" ? 1000 : 10_000,
            description: "Exercise owned physical cleanup",
          },
          ctx,
        )
        expect(result.metadata).toMatchObject({ exit: expect.any(Number), background: false })
        expect(result.output).toContain(
          boundary === "timeout"
            ? "bash tool terminated command after exceeding timeout 1000 ms"
            : "User aborted the command",
        )
        expect(observed?.signal.reason).toMatchObject({ name: boundary === "timeout" ? "TimeoutError" : "AbortError" })
        expect(settledAt).toBeGreaterThan(0)
        expect(settledAt).toBeLessThanOrEqual(observed!.settlementDeadlineAt)
      },
    })
  }, 30_000)
}
