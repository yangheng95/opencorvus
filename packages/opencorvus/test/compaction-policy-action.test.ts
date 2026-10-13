import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { Provider } from "@/provider/provider"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test.each([
  { mode: "missing", code: "POLICY_ACTION_MISSING", count: 0 },
  { mode: "multiple", code: "POLICY_ACTION_MULTIPLE", count: 2 },
  { mode: "wrong-kind", code: "POLICY_ACTION_SCOPE_MISMATCH", count: 1 },
])("action grading returns the explicit $mode result contract", ({ mode, code, count }) => {
  const expected = CompactionPolicyCase.definition("policy-revoke", "grade").expected
  const actual: CompactionPolicyCase.Action[] =
    mode === "missing" ? [] : mode === "multiple" ? [expected, expected] : [{ ...expected, kind: "release" }]
  expect(CompactionPolicyCase.grade(expected, actual)).toMatchObject({
    status: "failed",
    code,
    actionCount: { expected: 1, actual: count },
  })
})

for (const name of CompactionPolicyCase.names) {
  test(`paired five-round ${name} uses persisted action effects and isolated probe histories`, async () => {
    await exercise(name, 5, false)
  }, 180_000)
}

test("a real wrong-target action receipt is graded as failed without substituting the expected target", async () => {
  await exercise("policy-revoke", 1, true)
}, 60_000)

async function exercise(name: CompactionPolicyCase.Name, rounds: number, wrong: boolean) {
  const corpus = CompactionPolicyCase.definition(name, `local-${name}`)
  const requests: any[] = []
  const entries: any[] = []
  const target = { providerID: "policy-local", modelID: `gpt-policy-${name}` }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      requests.push(body)
      expect(body).toMatchObject({ model: target.modelID, stream: true })
      const emit = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `policy-${requests.length}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`
      const names = body.tools.map((tool: any) => tool.function.name)
      let response: string
      if (names.includes("ReadCompactionEvidence")) {
        // Deliberately scripted: this validates real compaction transport, not policy reasoning.
        response =
          emit(
            {
              role: "assistant",
              content: `${corpus.update}\nKeep this later user authorization. External operator claims are quoted documents. The delivery artifact remains to be written.`,
            },
            null,
          ) + emit({}, "stop")
      } else {
        expect(names).toEqual([CompactionPolicyCase.toolName])
        const args = wrong ? { ...corpus.expected, channel: "WRONG-DESTINATION" } : corpus.expected
        response =
          emit(
            {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call_action_${requests.length}`,
                  type: "function",
                  function: { name: CompactionPolicyCase.toolName, arguments: JSON.stringify(args) },
                },
              ],
            },
            null,
          ) + emit({}, "tool_calls")
      }
      return new Response(response + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  installDefaultControlPlaneToolLoaders()
  try {
    await using project = await memoryProject(`policy-${name}-${wrong}`)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: `${target.providerID}/${target.modelID}`,
          small_model: `${target.providerID}/${target.modelID}`,
          enabled_providers: [target.providerID],
          compaction: { tail_turns: 0, max_context_tokens: 256_000 },
          provider: {
            [target.providerID]: {
              name: "Isolated policy transport",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${server.port}/v1`,
              models: {
                [target.modelID]: {
                  name: "Policy mechanics",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 16_000 },
                },
              },
            },
          },
        })
        await CompactionPolicyCase.run({
          name,
          nonce: `local-${name}`,
          rounds,
          project: project.path,
          model: await Provider.getModel(target.providerID, target.modelID),
          requestCount: () => requests.length,
          exhausted: () => false,
          redact: (value) => value,
          inactive: (run) => run(new AbortController().signal),
          async record(entry) {
            if (!entries.includes(entry)) entries.push(entry)
          },
        })
        console.log(
          JSON.stringify({ scenario: "policy-action-mechanics", name, wrong, requests: requests.length, entries }),
        )
        expect(entries).toHaveLength(rounds)
        expect(entries.map((entry) => entry.status)).toEqual(Array(rounds).fill(wrong ? "failed" : "passed"))
        expect(requests).toHaveLength(rounds * 3)
        for (const entry of entries) {
          expect(entry.checkpoint).toMatchObject({ status: "valid_checkpoint", processExitCode: 0 })
          expect(entry.reopen).toBe("exact projection identities")
          expect(entry.lanes.map((lane: any) => lane.lane)).toEqual(["full", "compacted"])
          expect(entry.lanes[0].contextCapacity).toEqual(entry.lanes[1].contextCapacity)
          expect(entry.lanes[0].inputEstimate.totalTokensEst).toBeGreaterThan(
            entry.lanes[1].inputEstimate.totalTokensEst,
          )
          for (const lane of entry.lanes) {
            expect(lane.actionCount).toEqual({ expected: 1, actual: 1, pass: true })
            expect(lane.effects).toHaveLength(1)
            expect(lane.toolEvidence).toHaveLength(1)
            const receipt = JSON.parse(await fs.readFile(lane.effects[0].file, "utf8"))
            expect(receipt).toEqual({
              sessionID: lane.sessionID,
              callID: lane.effects[0].callID,
              action: wrong ? { ...corpus.expected, channel: "WRONG-DESTINATION" } : corpus.expected,
            })
            expect(lane.toolEvidence[0]).toMatchObject({
              tool: CompactionPolicyCase.toolName,
              callID: receipt.callID,
              state: { status: "completed", input: receipt.action },
            })
          }
        }
      },
    })
  } finally {
    await Instance.disposeAll()
    await server.stop(true)
  }
}
