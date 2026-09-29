import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { listDispatchLineage } from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID } from "@/engine/dispatch-settlement"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { TestHooks as Ingress, waitForIngressDeliveryHooksForTest } from "@/engine/task-root-ingress-delivery"
import { EngineGit } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Orchestrator } from "@/orchestrator/agent"
import { waitForDetachedDispatchPipelinesForTest } from "@/orchestrator/dispatch-agent-tool"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

for (const usePatch of [false, true])
  test(`Base root produces and repairs through ${usePatch ? "apply_patch" : "write/edit"}, then the same independent reviewer verifies the change`, async () => {
    using drain = Bus.TestHooks.suppressAutomaticDurableDrain()
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const selected = { providerID: "owner-contract", modelID: usePatch ? "gpt-owner-contract" : "streamed-owner" }
        await Config.updateProjectPatch({ prompt_profile: { active: "base" }, permission_mode: "full_access" })
        using ingress = Ingress.replaceTaskIngressRunner({
          runner: async (input) => ({
            finalMessageID: await Orchestrator.processTask(
              input.taskID,
              input.event,
              input.signal,
              input.wakeID,
              input.activationID,
              input.predecessorID,
            ),
          }),
        })
        const filePath = path.join(project.path, "delivery.txt")
        let rootStep = 0
        let reviewerStep = 0
        let sequence = 0
        let taskID = ""
        const observedValues: string[] = []
        const originSources: string[] = []
        const usage = {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        }
        const call = (toolName: string, input: unknown) => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: `owner_${++sequence}`, toolName, input: JSON.stringify(input) },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
            ],
          }),
        })
        const finish = (text: string) => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "answer" },
              { type: "text-delta", id: "answer", delta: text },
              { type: "text-end", id: "answer" },
              { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
            ],
          }),
        })
        const language = new MockLanguageModelV3({
          provider: selected.providerID,
          modelId: selected.modelID,
          async doStream(options) {
            const names = Array.isArray(options.tools)
              ? options.tools.map((item) => item.name)
              : Object.keys(options.tools ?? {})
            taskID ||= Database.use((db) => db.select().from(EngineTaskTable).get())!.id
            if (sequence > 30) throw new Error(`Unexpected owner loop ${rootStep}/${reviewerStep}`)
            const lineages = listDispatchLineage(taskID)
            const latest = lineages.at(-1)
            if (names.includes("dispatch_agent")) {
              if (taskLifecycleProjection(taskID).status !== "active")
                return call("no_action", {
                  observed_task: noActionTaskObservation(taskLifecycleProjection(taskID)),
                  reason: "Current terminal result reconciled.",
                })
              const step = rootStep++
              if (step === 0) {
                expect(names).toContain(usePatch ? "apply_patch" : "write")
                return usePatch
                  ? call("apply_patch", {
                      patchText: `*** Begin Patch\n*** Add File: ${filePath.replaceAll("\\", "/")}\n+value=1\n*** End Patch`,
                    })
                  : call("write", { filePath, content: "value=1\n" })
              }
              if (step === 1 || step === 5) return call("read", { filePath })
              if (step === 2 || step === 6)
                return call("dispatch_agent", {
                  dispatch: {
                    target: "base-tester",
                    work_scope: { kind: "task" },
                    turn:
                      step === 2
                        ? {
                            kind: "initial",
                            workflow_subject: {
                              kind: "virtual_workflow",
                              workflow_id: "execution-verification",
                              node_id: "base-tester",
                            },
                            use_worktree: false,
                            input: {
                              goal_ids: [],
                              instruction:
                                "Independently verify delivery.txt contains value=2. Read the root's original Tool facts and the current file.",
                              reason: "Independent verification of original outcome.",
                            },
                          }
                        : {
                            kind: "continuation",
                            authority: { kind: "prior_dispatch", continuation_dispatch_id: latest!.dispatchID },
                            guidance:
                              "The owner repaired the value. Verify that original obligation and preservation of this single file; inspect this dispatch's root evidence.",
                            evidence_locators: [],
                          },
                  },
                })
              if (step === 3 || step === 7) {
                const finalID = findDispatchSettlementByDispatchID({ taskID, dispatchID: latest!.dispatchID })!.payload
                  .outcome.final_message_id!
                return call("read_agent_message", { sources: [{ kind: "dispatch_result", message_id: finalID }] })
              }
              if (step === 4)
                return usePatch
                  ? call("apply_patch", {
                      patchText: `*** Begin Patch\n*** Update File: ${filePath.replaceAll("\\", "/")}\n@@\n-value=1\n+value=2\n*** End Patch`,
                    })
                  : call("edit", { filePath, oldString: "value=1", newString: "value=2" })
              if (step === 8) {
                const finalID = findDispatchSettlementByDispatchID({ taskID, dispatchID: latest!.dispatchID })!.payload
                  .outcome.final_message_id!
                return call("manage_task", {
                  action: "complete_task",
                  summary: "Owner repair independently verified.",
                  workflow_id: "execution-verification",
                  evidence_locators: [
                    { source: "session", session_id: latest!.payload.orchestrator_session_id },
                    { source: "session_message", session_id: latest!.payload.child_session_id, message_id: finalID },
                  ],
                  deliverable_artifact_locators: [],
                  accepted_delivery_slice_revision_ids: [],
                })
              }
              throw new Error(`Unexpected root step ${step}`)
            }
            const step = reviewerStep++
            if (step % 3 === 0) {
              const source = { kind: "dispatch_origin", dispatch_id: latest!.dispatchID }
              expect(JSON.stringify(options.prompt)).toContain(latest!.dispatchID)
              originSources.push(latest!.dispatchID)
              return call("read_agent_message", { sources: [source] })
            }
            if (step % 3 === 1) {
              const messages = await Session.messages({ sessionID: latest!.payload.child_session_id })
              const evidence = messages
                .flatMap((message) => message.parts)
                .filter(
                  (part) =>
                    part.type === "tool" && part.tool === "read_agent_message" && part.state.status === "completed",
                )
                .at(-1)!
              if (evidence.type !== "tool" || evidence.state.status !== "completed")
                throw new Error("Missing root evidence")
              const value = JSON.parse(evidence.state.output)
              expect(value.origins[0].source).toEqual({ kind: "dispatch_origin", dispatch_id: latest!.dispatchID })
              expect(
                value.causal_tool_reference_index.refs.map((ref: { tool_name: string }) => ref.tool_name),
              ).toContain(usePatch ? "apply_patch" : "write")
              return call("read", { filePath })
            }
            const value = await fs.readFile(filePath, "utf8")
            observedValues.push(value)
            return finish(
              value === "value=2\n"
                ? "Verified original requested value=2 from the current file. Owner evidence and current read agree."
                : "Original value=2 obligation is unmet: current file contains value=1. Preserve the file identity and repair only its value.",
            )
          },
        })
        const model = {
          id: selected.modelID,
          providerID: selected.providerID,
          name: "Owner execution contract",
          limit: { context: 1_000_000, input: 900_000, output: 4096 },
          cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
          capabilities: {
            toolcall: true,
            attachment: false,
            reasoning: false,
            temperature: true,
            interleaved: false,
            input: { text: true, image: false, audio: false, video: false, pdf: false },
            output: { text: true, image: false, audio: false, video: false, pdf: false },
          },
          api: { id: selected.modelID, url: "https://owner-contract.test.invalid", npm: "@ai-sdk/anthropic" },
          options: {},
          headers: {},
          status: "active",
          release_date: "2026-09-30",
        } as Provider.Model
        using modelSpy = spyOn(Provider, "getModel").mockResolvedValue(model)
        using languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
        using providerSpy = spyOn(Provider, "getProvider").mockResolvedValue({
          id: selected.providerID,
          name: "Owner contract",
          source: "custom",
          env: [],
          options: {},
          models: { [model.id]: model },
        } as never)
        using authSpy = spyOn(Auth, "get").mockResolvedValue(undefined)
        using prepareGit = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
        using completeGit = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))
        taskID = await EngineService.createTask(
          {
            requestID: "direct-owner-delivery",
            title: "Direct owner delivery",
            request: "Write delivery.txt with value=2 and independently verify the result.",
            productPillar: "work",
            model: `${selected.providerID}/${selected.modelID}`,
            promptProfile: "base",
          },
          { actor: "user" },
        )
        for (let index = 0; index < 6; index++) {
          await waitForIngressDeliveryHooksForTest()
          await waitForDetachedDispatchPipelinesForTest()
        }
        await Database.awaitEffectIdle(30_000)
        if (taskLifecycleProjection(taskID).status !== "completed") {
          const task = requireTask(taskID)
          console.error("OWNER_TRACE", {
            rootStep,
            reviewerStep,
            taskError: task.error,
            taskStatus: taskLifecycleProjection(taskID).status,
          })
        }
        expect(await fs.readFile(filePath, "utf8")).toBe("value=2\n")
        expect(observedValues).toEqual(["value=1\n", "value=2\n"])
        const lineages = listDispatchLineage(taskID)
        expect(lineages.map((entry) => entry.payload.target_agent_id)).toEqual(["base-tester", "base-tester"])
        expect(new Set(lineages.map((entry) => entry.payload.child_session_id)).size).toBe(1)
        expect(originSources).toEqual(lineages.map((entry) => entry.dispatchID))
        expect(taskLifecycleProjection(taskID).status).toBe("completed")
        const decisions = Database.use((db) =>
          db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, taskID)).all(),
        ).filter((row) => row.kind === "task_completion_decision")
        expect(decisions).toHaveLength(1)
      },
    })
  }, 120_000)
