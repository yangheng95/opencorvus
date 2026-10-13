import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { CompactionNativeReference } from "../script/compaction-native-reference"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { streamText } from "@/llm/api"
import { Session } from "@/session"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

const target = { providerID: "openai", modelID: "gpt-6.1-sol" }
const nativeItem = { type: "compaction", id: "cmp_original_state", encrypted_content: "opaque-local-完整-state" }

function response(
  mode: "native" | "text" | "progress" | "incomplete" | "action",
  options?: { text?: string; action: CompactionPolicyCase.Action },
) {
  const events: unknown[] = [
    { type: "response.created", response: { id: `resp_${mode}`, created_at: 1, model: target.modelID } },
  ]
  if (["native", "progress", "incomplete"].includes(mode)) {
    events.push(
      { type: "response.output_item.added", output_index: 0, item: { ...nativeItem, encrypted_content: "" } },
      { type: "response.compaction.compacting", sequence_number: 2, item_id: nativeItem.id, output_index: 0 },
    )
    if (mode !== "progress") events.push({ type: "response.output_item.done", output_index: 0, item: nativeItem })
  }
  if (mode === "text") {
    const text = options?.text ?? "Replayed."
    const item = { type: "message", id: "msg_replay", role: "assistant", content: [{ type: "output_text", text }] }
    events.push(
      { type: "response.output_item.added", output_index: 0, item },
      { type: "response.output_text.delta", item_id: item.id, output_index: 0, delta: text },
      { type: "response.output_item.done", output_index: 0, item },
    )
  }
  if (mode === "action") {
    const item = {
      type: "function_call",
      id: "fc_action",
      call_id: "call_action",
      status: "completed",
      name: CompactionPolicyCase.toolName,
      arguments: JSON.stringify(options!.action),
    }
    events.push(
      { type: "response.output_item.added", output_index: 0, item: { ...item, arguments: "" } },
      { type: "response.function_call_arguments.delta", output_index: 0, item_id: item.id, delta: item.arguments },
      { type: "response.output_item.done", output_index: 0, item },
    )
  }
  events.push({
    type: mode === "incomplete" ? "response.incomplete" : "response.completed",
    response: {
      ...(mode === "incomplete" ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
      usage: { input_tokens: 100, output_tokens: 10 },
    },
  })
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  })
}

async function exercise(
  mode: "native" | "progress" | "incomplete" | "matrix",
  policy?: CompactionPolicyCase.Name,
  providerID = "openai",
) {
  const target = { providerID, modelID: "gpt-6.1-sol" }
  const requests: any[] = []
  const corpus = policy ? CompactionPolicyCase.definition(policy, `native-local-${policy}`) : undefined
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      requests.push(body)
      if (mode === "matrix") {
        if (body.input.at(-1).type === "compaction_trigger") return response("native")
        if (body.tools.some((tool: any) => tool.name === "ReadCompactionEvidence"))
          return response("text", { text: corpus!.update, action: corpus!.expected })
        return response("action", { action: corpus!.expected })
      }
      return response(requests.length === 1 ? mode : "text")
    },
  })
  try {
    await using project = await memoryProject(`native-reference-${mode}`)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: `${target.providerID}/${target.modelID}`,
          enabled_providers: [target.providerID],
          compaction: { tail_turns: 0, max_context_tokens: 256_000 },
          provider: {
            [target.providerID]: {
              npm: "@ai-sdk/openai",
              api: `http://127.0.0.1:${server.port}/v1`,
              options: { apiKey: "local-reference-transport" },
              models: {
                [target.modelID]: {
                  name: "Local native protocol",
                  tool_call: true,
                  limit: { context: 256_000, output: 16_000 },
                },
              },
            },
          },
        })
        const model = await Provider.getModel(target.providerID, target.modelID)
        if (providerID !== "openai") {
          // This assertion targets the shared Provider transport's Azure ID
          // behavior. The reference compactor above binds OpenAI's namespace.
          for (const store of [false, true]) {
            const stream = streamText({
              model: await Provider.getLanguage(model),
              messages: [
                {
                  role: "assistant",
                  content: [
                    {
                      type: "custom",
                      kind: "openai.compaction",
                      providerOptions: {
                        azure: {
                          type: "compaction",
                          itemId: nativeItem.id,
                          encryptedContent: nativeItem.encrypted_content,
                        },
                      },
                    },
                  ],
                },
              ],
              providerOptions: { azure: { store } },
              timeoutMs: 30_000,
            })
            for await (const part of stream.stream) if (part.type === "error") throw part.error
          }
          expect(requests[0].input).toEqual([nativeItem])
          expect(requests[1].input).toEqual([{ type: "item_reference", id: nativeItem.id }])
          console.log(
            JSON.stringify({
              scenario: "azure-provider-native-wire",
              requests: requests.map((body) => ({ store: body.store, input: body.input })),
            }),
          )
          return
        }
        if (mode === "matrix") {
          installDefaultControlPlaneToolLoaders()
          const entries: any[] = []
          await CompactionPolicyCase.run({
            name: policy!,
            nonce: `native-local-${policy}`,
            rounds: 1,
            compareNative: true,
            project: project.path,
            model,
            requestCount: () => requests.length,
            exhausted: () => false,
            redact: (value) => value,
            inactive: (run) => run(AbortSignal.timeout(60_000)),
            async record(entry) {
              if (!entries.includes(entry)) entries.push(entry)
            },
          })
          console.log(JSON.stringify({ scenario: "native-policy-matrix", policy, requests: requests.length, entries }))
          expect(entries).toHaveLength(1)
          expect(entries[0]).toMatchObject({
            status: "passed",
            nativeReference: { itemID: nativeItem.id, finish: "stop" },
          })
          expect(
            entries[0].lanes.map((lane: any) => ({ lane: lane.lane, status: lane.status, code: lane.code })),
          ).toEqual(
            ["full", "compacted", "native"].map((lane) => ({ lane, status: "passed", code: "POLICY_ACTION_MATCH" })),
          )
          expect(requests).toHaveLength(5)
          expect(requests[4].input.find((item: any) => item.type === "compaction")).toEqual(nativeItem)
          return
        }
        const session = await Session.create({ kind: "assistant", title: "Native reference" })
        const authored = await CompactionPolicyCase.history({ target, project: project.path })
        const user = await authored.user(session.id, "Preserve TRACE-NATIVE-731 and the current draft authorization.")
        const input: Omit<LLM.StreamInput, "tools"> = {
          user,
          sessionID: session.id,
          model,
          agentID: "chat",
          agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("chat")),
          system: [],
          messages: [{ role: "user", content: "Preserve TRACE-NATIVE-731 and the current draft authorization." }],
          abort: AbortSignal.timeout(30_000),
        }
        const compact = CompactionNativeReference.compact({
          stream: input,
          artifactPath: path.join(project.path, "native-output.json"),
        })
        if (mode !== "native") {
          const error = await compact.catch((error) => error)
          expect(error).toMatchObject({ name: "NativeCompactionReferenceError", code: "NATIVE_COMPACTION_INCOMPLETE" })
          console.log(JSON.stringify({ scenario: mode, code: error.code, requests: requests.length }))
          return
        }
        const result = await compact
        expect(result.report).toMatchObject({
          itemID: nativeItem.id,
          encryptedCharacters: nativeItem.encrypted_content.length,
          finish: "stop",
          reopen: "exact returned native response and replay content",
        })
        for (const store of [false, true]) {
          const replay = await LLM.stream({
            ...input,
            model: { ...model, options: { ...model.options, store } },
            messages: [...result.messages, { role: "user", content: "Continue the recorded task." }],
            tools: {},
          })
          for await (const part of replay.stream) if (part.type === "error") throw part.error
          expect(await replay.text).toBe("Replayed.")
        }
        console.log(
          JSON.stringify({
            scenario: "native-state-wire",
            requests: requests.map((body) => ({
              model: body.model,
              stream: body.stream,
              store: body.store,
              input: body.input.filter((item: any) =>
                ["compaction", "compaction_trigger", "item_reference"].includes(item.type),
              ),
            })),
            report: result.report,
          }),
        )
        expect(requests[0]).toMatchObject({ model: target.modelID, stream: true, store: false })
        expect(requests[0].input.at(-1)).toEqual({ type: "compaction_trigger" })
        expect(requests[1].input.find((item: any) => item.type === "compaction")).toEqual(nativeItem)
        expect(requests[2].input.find((item: any) => item.type === "item_reference")).toEqual({
          type: "item_reference",
          id: nativeItem.id,
        })
      },
    })
  } finally {
    await server.stop(true)
  }
}

test("native output survives artifact reopening and exact streamed replay", () => exercise("native"), 60_000)
test(
  "Azure-compatible inline native state and stored references retain exact identity",
  () => exercise("native", undefined, "azure-native-reference"),
  60_000,
)
test("progress-only native output returns its typed incomplete result", () => exercise("progress"), 60_000)
test("output-limited native output returns its typed incomplete result", () => exercise("incomplete"), 60_000)
for (const name of CompactionPolicyCase.names)
  test(`native/full/portable ${name} grades actual Tool effects`, () => exercise("matrix", name), 120_000)
