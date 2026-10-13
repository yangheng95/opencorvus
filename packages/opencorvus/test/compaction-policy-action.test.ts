import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { CompactionPolicyCase } from "../script/compaction-policy-case"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { Provider } from "@/provider/provider"
import { Database } from "@/storage/db"
import { MessageStore } from "@/session/message-store"
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

test("an interrupted policy round resumes its exact original source after reopening", async () => {
  await exercise("policy-grant", 2, false, true)
})

test("a budget-interrupted compacted action resumes its saved checkpoint and unanswered input", async () => {
  await exercise("policy-grant", 1, false, false, true)
}, 60_000)

test("tight compaction and a complete full-history control execute under their declared separate budgets", async () => {
  await exercise("policy-revoke", 1, false, false, false, true)
}, 60_000)

test("an interrupted middle checkpoint resumes its original input and finishes later planned rounds", async () => {
  await exercise("policy-grant", 3, false, true)
}, 90_000)

test("an interrupted middle probe resumes its original action and finishes later planned rounds", async () => {
  await exercise("policy-grant", 3, false, false, true)
}, 90_000)

async function exercise(
  name: CompactionPolicyCase.Name,
  rounds: number,
  wrong: boolean,
  interrupted = false,
  probeInterrupted = false,
  pressure = false,
) {
  const corpus = CompactionPolicyCase.definition(name, `local-${name}`)
  const requests: any[] = []
  const entries: any[] = []
  let compactorRequests = 0
  const target = { providerID: "policy-local", modelID: `gpt-policy-${name}` }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      requests.push(body)
      expect(body).toMatchObject({ model: target.modelID, stream: true })
      if (probeInterrupted && requests.length === 3) {
        return Response.json(
          { error: { message: "E2E_REQUEST_BUDGET_EXHAUSTED", type: "invalid_request_error" } },
          { status: 400 },
        )
      }
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
        compactorRequests++
        if (compactorRequests === 1 && !pressure) {
          const userContent = body.messages
            .filter((message: any) => message.role === "user")
            .map((message: any) => message.content)
            .join("\n")
          expect(userContent).toContain(corpus.longUpdate)
        }
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
          compaction: { tail_turns: 0, max_context_tokens: pressure ? 19_000 : 256_000 },
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
        let operations = 0
        const common = {
          name,
          nonce: `local-${name}`,
          rounds,
          fullContextTokens: pressure ? 256_000 : undefined,
          project: project.path,
          model: await Provider.getModel(target.providerID, target.modelID),
          requestCount: () => requests.length,
          exhausted: () => false,
          redact: (value) => value,
          inactive: <T>(run: (signal: AbortSignal) => Promise<T>) => {
            operations++
            return run(
              interrupted && operations === 4
                ? AbortSignal.abort(new Error("LOCAL_POLICY_COMPACTION_INTERRUPTION"))
                : new AbortController().signal,
            )
          },
          async record(entry: Record<string, unknown>) {
            if (!entries.includes(entry)) entries.push(entry)
          },
        }
        await CompactionPolicyCase.run(common)
        const resumed: any[] = []
        if (probeInterrupted) {
          const cut = entries[0]
          expect(cut.lanes.map((lane: any) => lane.status)).toEqual(["passed", "error"])
          const source = await MessageStore.get({ sessionID: cut.sessionID, messageID: cut.sourceID })
          Database.close()
          await CompactionPolicyCase.run({
            ...common,
            resume: CompactionPolicyCase.Resume.parse({
              sessionID: cut.sessionID,
              anchorID: cut.anchorID,
              updateID: cut.updateID,
              sourceID: cut.sourceID,
              round: cut.round,
            }),
            resumeProbe: cut,
            async record(entry) {
              if (!resumed.includes(entry)) resumed.push(entry)
            },
          })
          expect(resumed[0]).toMatchObject({
            status: "passed",
            resumedProbe: { sessionID: cut.lanes[1].sessionID, failedAssistantID: cut.lanes[1].assistantMessageID },
          })
          expect(resumed[0].lanes[0]).toEqual(cut.lanes[0])
          expect(await MessageStore.get({ sessionID: cut.sessionID, messageID: cut.sourceID })).toEqual(source)
        }
        if (interrupted) {
          expect(entries.map((entry) => entry.status)).toEqual(["passed", "error"])
          const cut = entries.at(-1)!
          const source = await MessageStore.get({ sessionID: cut.sessionID, messageID: cut.sourceID })
          Database.close()
          await CompactionPolicyCase.run({
            ...common,
            resume: CompactionPolicyCase.Resume.parse({
              sessionID: cut.sessionID,
              anchorID: cut.anchorID,
              updateID: cut.updateID,
              sourceID: cut.sourceID,
              round: cut.round,
            }),
            inactive: (run) => run(new AbortController().signal),
            async record(entry) {
              if (!resumed.includes(entry)) resumed.push(entry)
            },
          })
          expect(resumed).toHaveLength(rounds - cut.round + 1)
          expect(resumed[0]).toMatchObject({
            sessionID: cut.sessionID,
            sourceID: cut.sourceID,
            anchorID: cut.anchorID,
            updateID: cut.updateID,
            round: 2,
            status: "passed",
          })
          expect(await MessageStore.get({ sessionID: cut.sessionID, messageID: cut.sourceID })).toEqual(source)
        }
        console.log(
          JSON.stringify({
            scenario: "policy-action-mechanics",
            name,
            wrong,
            interrupted,
            pressure,
            requests: requests.length,
            entries,
            resumed,
          }),
        )
        expect(entries).toHaveLength(probeInterrupted ? 1 : interrupted ? 2 : rounds)
        const graded = probeInterrupted ? resumed : interrupted ? [entries[0], ...resumed] : entries
        expect(graded.map((entry) => entry.status)).toEqual(Array(rounds).fill(wrong ? "failed" : "passed"))
        expect(requests).toHaveLength(rounds * 3 + (probeInterrupted ? 1 : 0))
        if (pressure) {
          expect(
            requests[1].messages
              .filter((message: any) => message.role === "user")
              .map((message: any) => message.content)
              .join("\n"),
          ).toContain(corpus.longUpdate)
        }
        for (const entry of graded) {
          expect(entry.compactionCapacity).toEqual({ status: "known", tokens: pressure ? 19_000 : 256_000 })
          expect(entry.checkpoint).toMatchObject({ status: "valid_checkpoint", processExitCode: 0 })
          expect(entry.reopen).toBe("exact projection identities")
          expect(entry.lanes.map((lane: any) => lane.lane)).toEqual(["full", "compacted"])
          expect(entry.lanes[0].contextCapacity).toEqual({ status: "known", tokens: 256_000 })
          expect(entry.lanes[1].contextCapacity).toEqual({ status: "known", tokens: pressure ? 19_000 : 256_000 })
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
        expect((await Config.get()).compaction?.max_context_tokens).toBe(pressure ? 19_000 : 256_000)
      },
    })
  } finally {
    await Instance.disposeAll()
    await server.stop(true)
  }
}
