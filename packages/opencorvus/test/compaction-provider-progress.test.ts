import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionCompaction } from "@/session/compaction"
import { CompactionUserText } from "@/session/compaction-user-text"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import { Message } from "@/session/message"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("streamed SDK progress survives saved notes and independent Project exhaustion through database reopening", async () => {
  await using first = await memoryProject("compaction-progress-summary")
  await using second = await memoryProject("compaction-progress-exhaustion")
  const executions = await Promise.allSettled([
    exercise(first.path, { stepLimit: 6, summary: true }),
    exercise(second.path, { stepLimit: 2, summary: false }),
  ])
  const failures = executions.filter((result) => result.status === "rejected")
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Streaming progress contracts failed",
    )
  const completed = executions.map((result) => {
    if (result.status !== "fulfilled") throw result.reason
    return result.value
  })
  Database.close()
  for (const result of completed) {
    await Instance.provide({
      directory: result.directory,
      fn: async () => {
        const reopened = await Session.messages({ sessionID: result.sessionID })
        expect(
          reopened.filter((message) => result.original.some((prior) => prior.info.id === message.info.id)),
        ).toEqual(result.original)
        const helper = reopened.findLast((message) => message.info.author === "compaction")!
        expect(helper.info).toMatchObject(
          result.summary
            ? { role: "assistant", summary: true, finish: "stop", parentID: result.sourceID }
            : {
                role: "assistant",
                summary: false,
                finish: "error",
                error: { name: "CompactionContinuationMissingError" },
              },
        )
        expect(SessionControl.get(result.controlID)?.status).toBe(result.summary ? "consumed" : "failed")
        if (result.summary) {
          expect(helper.parts.filter((part) => part.type === "text").map((part) => part.text)).toEqual([
            result.checkpoint,
          ])
          const selected = CompactionUserText.project(CompactionUserText.selection(reopened, helper.info.id), reopened)
          expect(
            selected.map((message) => ({
              id: message.info.id,
              role: message.info.role,
              text: message.parts.filter((part) => part.type === "text").map((part) => part.text),
            })),
          ).toEqual([{ id: result.authorityID, role: "user", text: [result.authority] }])
          expect(helper.parts.filter((part) => part.type === "compaction").map((part) => part.anchor_id)).toEqual([
            result.anchorID,
          ])
        }
      },
    })
  }
}, 90_000)

async function exercise(directory: string, scenario: { stepLimit: number; summary: boolean }) {
  const target = { providerID: `progress-${scenario.stepLimit}`, modelID: `model-${scenario.stepLimit}` }
  const requests: any[] = []
  const authority = "Current user authority: keep the delivery as a draft; release still requires explicit approval."
  const evidence = "Measured source evidence. Historical details retain their exact source identity.\n".repeat(1500)
  let outputPartID = "",
    authorityPartID = ""
  const checkpoint =
    "Current user authority requires a draft and explicit approval before release. Two evidence ranges were read; the remaining source is unresolved and retains its exact Part locator. Continue from the recorded offset, preserving the original user instruction."
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      const index = requests.length
      requests.push(body)
      expect(body).toMatchObject({ model: target.modelID, stream: true })
      const emit = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `progress-${index}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      const calls = scenario.summary
        ? [
            {
              name: "ReadCompactionEvidence",
              input: { part_id: authorityPartID, field: "text", offset: 0, limit: authority.length },
            },
            { name: "RetainCompactionUserText", input: { excerpts: [{ part_id: authorityPartID, text: authority }] } },
            { name: "ReadCompactionEvidence", input: { part_id: outputPartID, field: "output", offset: 0, limit: 16 } },
            {
              name: "SaveCompactionNotes",
              input: {
                notes: `User ${authorityPartID}: ${authority} Read ${outputPartID} through UTF-16 offset 16; the remaining evidence is unresolved.`,
              },
            },
            {
              name: "ReadCompactionEvidence",
              input: { part_id: outputPartID, field: "output", offset: 16, limit: 16 },
            },
          ]
        : Array.from({ length: scenario.stepLimit }, (_, step) => ({
            name: "ReadCompactionEvidence",
            input: { part_id: outputPartID, field: "output", offset: step * 16, limit: 16 },
          }))
      const call = calls[index]
      const response = call
        ? emit(
            {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call_${index}`,
                  type: "function",
                  function: { name: call.name, arguments: JSON.stringify(call.input) },
                },
              ],
            },
            null,
          ) + emit({}, "tool_calls")
        : emit({ role: "assistant", content: checkpoint }, null) + emit({}, "stop")
      return new Response(response + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  try {
    return await Instance.provide({
      directory,
      fn: async () => {
        await Config.updateProjectPatch({
          model: `${target.providerID}/${target.modelID}`,
          agent: { compaction: { steps: scenario.stepLimit } },
          compaction: { tail_turns: 0, max_context_tokens: 19_000 },
          provider: {
            [target.providerID]: {
              name: "Local progress protocol checker",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${server.port}/v1`,
              models: {
                [target.modelID]: {
                  name: "Progress",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 256_000, output: 4_000 },
                },
              },
            },
          },
        })
        expect((await HelperAgentRegistry.get("compaction", { config: await Config.get() })).steps).toBe(
          scenario.stepLimit,
        )
        const session = await Session.create({ kind: "assistant", title: "Provider progress contract" })
        const history = await CompactionPolicyCase.history({ target, project: directory })
        const anchor = await history.user(
          session.id,
          "Prepare the delivery; preserve subsequent user corrections and original sources.",
        )
        const recorded = await history.assistant(session.id, anchor.id, "The source evidence remains available.", false)
        outputPartID = Identifier.ascending("part")
        await Session.updatePart({
          id: outputPartID,
          sessionID: session.id,
          messageID: recorded.id,
          type: "tool",
          tool: "ReadEvidence",
          callID: "source_read",
          state: {
            status: "completed",
            input: {},
            output: evidence,
            title: "Recorded evidence",
            metadata: {},
            time: { start: recorded.time.created, end: recorded.time.created + 1 },
          },
        })
        await Session.updateMessage({
          ...recorded,
          time: { ...recorded.time, completed: Math.max(Date.now(), recorded.time.created + 1) },
        })
        const current = await history.user(session.id, authority)
        authorityPartID = (await Session.messages({ sessionID: session.id }))
          .find((m) => m.info.id === current.id)!
          .parts.find((part) => part.type === "text")!.id
        const source = await history.user(
          session.id,
          "Consolidate the current state and preserve unresolved evidence references.",
        )
        const original = await Session.messages({ sessionID: session.id })
        const control = await SessionCompaction.create({
          sessionID: session.id,
          source,
          auto: scenario.summary,
          overflow: scenario.summary,
        })
        const execute = () =>
          SessionLoop.TestHooks.executeCompactionControl({
            control,
            sessionID: session.id,
            run: (abort) =>
              SessionCompaction.process(
                {
                  sessionID: session.id,
                  parentID: source.id,
                  messages: original,
                  abort,
                  auto: scenario.summary,
                  overflow: scenario.summary,
                  model: target,
                },
                { prepareProviderTool: SessionLoop.prepareProviderTool },
              ),
          })
        if (scenario.summary) expect(await execute()).toBe("continue")
        else await expect(execute()).rejects.toMatchObject({ name: "CompactionContinuationMissingError" })
        const progress = requests.map((request) => {
          const text = request.messages
            .flatMap((message: any) =>
              typeof message.content === "string"
                ? [message.content]
                : Array.isArray(message.content)
                  ? message.content.filter((part: any) => part.type === "text").map((part: any) => part.text)
                  : [],
            )
            .join("\n")
          const match = /<compaction-provider-progress>\s*(\{[^]*?\})\s*<\/compaction-provider-progress>/.exec(text)
          return match ? JSON.parse(match[1]!) : undefined
        })
        expect(progress).toEqual(
          Array.from({ length: scenario.stepLimit }, (_, completedSteps) => ({
            completedSteps,
            stepLimit: scenario.stepLimit,
            remainingSteps: scenario.stepLimit - completedSteps,
          })),
        )
        if (scenario.summary) {
          expect(
            requests[4].messages
              .filter((message: any) => message.role === "tool")
              .map((message: any) => JSON.parse(message.content).status),
          ).toEqual(["retained", "saved"])
        }
        return {
          directory,
          summary: scenario.summary,
          sessionID: session.id,
          sourceID: source.id,
          anchorID: anchor.id,
          authorityID: current.id,
          authority,
          checkpoint,
          original,
          controlID: control.id,
        }
      },
    })
  } catch (error) {
    console.error(`Compaction progress scenario ${scenario.stepLimit}`, error)
    throw error
  } finally {
    await server.stop(true)
  }
}
