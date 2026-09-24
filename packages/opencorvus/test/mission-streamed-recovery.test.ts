import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import type { DispatchLineagePayload } from "@/engine/dispatch-lineage-facts"
import { Config } from "@/config/config"
import { Database, eq } from "@/storage/db"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { requireTask, sessionIDsForTask } from "@/engine/store"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { TestHooks as Ingress, waitForIngressDeliveryHooksForTest } from "@/engine/task-root-ingress-delivery"
import { Orchestrator } from "@/orchestrator/agent"
import { readLatestTaskAcceptanceLedger } from "@/mission/acceptance-ledger"
import { ensureMissionSession } from "@/mission/session"
import { missionBoardProjection } from "@/mission/board"
import { openMissionExecutionWithWake, missionOperatorWakeReason } from "@/mission/execution-closure"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { SessionPrompt } from "@/session/prompt"
import { SessionStatus } from "@/session/status"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { auditSchedulerSessionDeliverySettlement } from "@/protocol/delivery"
import { WorkerTurnDescriptorTable } from "@/session/session.sql"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { databaseSnapshot } from "../script/benchmark/external-agent/runtime-evidence"
import { auditMissionOutcome, auditMissionQuiescence } from "../script/benchmark/external-agent/contract"
import { Server } from "@/server/server"

const model = { providerID: "recovery-stream", modelID: "deterministic" }
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Only the model transport is scripted. Mission admission, tools, worker
// adapters, checkpoints, messages, claims, delivery and acceptance are real.
test("a Mission recovers a committed side effect, corrects a stale continuation and starts its independent verifier", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({
        model: `${model.providerID}/${model.modelID}`,
        prompt_profile: { active: "base" },
        provider: {
          [model.providerID]: {
            name: "Recovery transport",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              [model.modelID]: {
                name: "Recovery transport",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1_000_000, output: 4096 },
              },
            },
          },
        },
      })
      using _ingress = Ingress.replaceTaskIngressRunner({
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
      const mission = await ensureMissionSession({
        missionID: "streamed-recovery",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      let taskID = ""
      let missionStep = 0
      let developerStep = 0
      let testerStep = 0
      let rootStep = 0
      let sequence = 0
      let staleSourceAttempted = false
      let sourceCorrected = false
      const calls: string[] = []
      const failures: string[] = []
      let selectedRef = ""
      const readRefs: string[] = []

      const stream = (chunks: any[]) => ({
        stream: simulateReadableStream({ chunks: [{ type: "stream-start", warnings: [] }, ...chunks] }),
      })
      const call = (toolName: string, input: unknown) => {
        calls.push(toolName)
        return stream([
          { type: "tool-call", toolCallId: `recovery-${++sequence}`, toolName, input: JSON.stringify(input) },
          { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
        ])
      }
      const answer = (text: string) =>
        stream([
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: text },
          { type: "text-end", id: "answer" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
        ])
      const published = (agent: string, phase: string) =>
        call("artifact_publish", {
          artifact_type: `base/${agent === "developer" ? "development" : "test"}-report`,
          schema_version: 1,
          label: `${agent}-${phase}`,
          payload_json: JSON.stringify({ result: phase, verified: agent === "tester" }),
          resource_set: null,
          source_read_refs: [],
        })
      const lineage = (agent: string) =>
        Database.use((db) => db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, taskID)).all())
          .filter((r) => r.kind === "dispatch_lineage")
          .map((r) => ({ id: r.id, ...(r.payload as DispatchLineagePayload) }))
          .filter((r) => r.target_agent_id === agent)
          .sort((a, b) => a.time_created - b.time_created)
          .at(-1)
      const dispatch = (agent: string, repair: boolean, sourceOverride?: string) => {
        const previous = lineage(agent)
        const obligation = repair ? { acceptance_gap_id: "gap-delivery", criterion_ids: ["deliver-and-verify"] } : {}
        return call("dispatch_agent", {
          dispatch: {
            target: agent,
            work_scope: { kind: "task" },
            turn: previous
              ? {
                  kind: "continuation",
                  authority: { kind: "prior_dispatch", continuation_dispatch_id: sourceOverride ?? previous.dispatch_id },
                  guidance: "Preserve the committed operation, finish delivery, and verify the final result.",
                  evidence_locators: [],
                  ...obligation,
                }
              : {
                  kind: "initial",
                  workflow_subject: { kind: "virtual_workflow", workflow_id: "execution-verification", node_id: agent },
                  use_worktree: false,
                  ...obligation,
                  input:
                    agent === "base-developer"
                      ? { goal_ids: [], reason: "Complete the requested result." }
                      : {
                          goal_ids: [],
                          instruction: "Independently verify the latest delivery.",
                          reason: "Delivery requires independent verification.",
                        },
                },
          },
        })
      }
      const language = new MockLanguageModelV3({
        provider: model.providerID,
        modelId: model.modelID,
        async doStream(options) {
          const names = Array.isArray(options.tools)
            ? options.tools.map((t) => t.name)
            : Object.keys(options.tools ?? {})
          const system = options.prompt
            .filter((p) => p.role === "system")
            .map((p) => p.content)
            .join("\n")
          if (sequence > 60) throw new Error(`Recovery exceeded its expected tool sequence: ${calls.join(",")}`)
          if (names.includes("dispatch_agent")) {
            rootStep++
            taskID ||= Database.use((db) => db.select().from(EngineTaskTable).get())!.id
            if (taskLifecycleProjection(taskID).status !== "active")
              return call("no_action", { observed_task: noActionTaskObservation(taskLifecycleProjection(taskID)), reason: "The terminal Task receipt is reconciled." })
            const developer = lineage("base-developer")
            const tester = lineage("base-tester")
            const repair = readLatestTaskAcceptanceLedger(taskID)
            if (repair) {
              const definition = Array.isArray(options.tools)
                ? options.tools.find((candidate) => candidate.name === "dispatch_agent")
                : (options.tools as Record<string, unknown> | undefined)?.dispatch_agent
              expect(JSON.stringify(definition)).toContain(
                "put `acceptance_gap_id` and `criterion_ids` inside `dispatch.turn`",
              )
              expect(JSON.stringify(definition)).toContain("deliver-and-verify")
            }
            const rows = Database.use((db) =>
              db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, taskID)).all(),
            )
            const outcome = (dispatchID: string) =>
              rows
                .filter((r) => r.kind === "dispatch_settlement")
                .map((r) => r.payload as Record<string, any>)
                .find((r) => r.dispatch_id === dispatchID)?.outcome
            if (!developer) return dispatch("base-developer", false)
            if (!repair && outcome(developer.dispatch_id))
              return call("manage_task", {
                action: "fail_task",
                error: "The transport ended after a committed operation; independent verification is still owed.",
              })
            if (repair && !developer.continuation_of_dispatch_id) return dispatch("base-developer", true)
            if (repair && outcome(developer.dispatch_id)?.kind === "terminal_success" && !tester) {
              if (!staleSourceAttempted) {
                staleSourceAttempted = true
                const initial = rows.filter((row) => row.kind === "dispatch_lineage")
                  .map((row) => row.payload as DispatchLineagePayload)
                  .find((row) => row.target_agent_id === "base-developer" && !row.continuation_of_dispatch_id)!
                return dispatch("base-developer", true, initial.dispatch_id)
              }
              if (!sourceCorrected) {
                const rootSession = (await Session.children(requireTask(taskID).session_id!)).find((row) => row.kind === "orchestrator")!
                const errors = (await Session.messages({ sessionID: rootSession.id })).flatMap((message) => message.parts)
                  .filter((part) => part.type === "tool" && part.tool === "dispatch_agent" && part.state.status === "error")
                expect(errors.map((part) => part.type === "tool" && part.state.status === "error" ? part.state.failure.message : "")).toEqual([
                  expect.stringContaining(`exact current dispatch is ${developer.dispatch_id}`),
                ])
                sourceCorrected = true
                return dispatch("base-developer", true)
              }
              return dispatch("base-tester", true)
            }
            if (tester && outcome(tester.dispatch_id)?.kind === "terminal_success")
              return call("manage_task", {
                action: "complete_task",
                summary: "Recovered delivery independently verified.",
                workflow_id: "execution-verification",
                evidence_locators: [],
                deliverable_artifact_locators: [],
                accepted_delivery_slice_revision_ids: [],
              })
            return call("no_action", { observed_task: noActionTaskObservation(taskLifecycleProjection(taskID)), reason: "The exact lifecycle receipt has already been reconciled." })
          }
          if (system.includes("# Base Developer")) {
            const step = developerStep++
            if (step === 0) {
              const publication = published("developer", "committed-before-disconnect")
              const reader = publication.stream.getReader()
              return {
                stream: new ReadableStream({
                  async start(controller) {
                    try {
                      while (true) {
                        const next = await reader.read()
                        if (next.done) break
                        if (next.value.type !== "finish") controller.enqueue(next.value)
                      }
                      const until = Date.now() + 15_000
                      while (Date.now() < until) {
                        const rows = Database.use((db) =>
                          db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, taskID)).all(),
                        )
                        if (rows.some((r) => r.label === "developer-committed-before-disconnect")) break
                        await Bun.sleep(10)
                      }
                      controller.error(new Error("socket connection was closed unexpectedly"))
                    } catch (e) {
                      controller.error(e)
                    }
                  },
                }),
              }
            }
            if (step === 1) return published("developer", "recovered-final-delivery")
            return answer("The prior committed operation was preserved and final delivery is ready.")
          }
          if (system.includes("# Base Tester")) {
            if (testerStep++ === 0) {
              const rows = Database.use((db) =>
                db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.task_id, taskID)).all(),
              )
              expect(rows.filter((r) => r.label === "developer-committed-before-disconnect")).toHaveLength(1)
              expect(rows.filter((r) => r.label === "developer-recovered-final-delivery")).toHaveLength(1)
              return published("tester", "verified-final-delivery")
            }
            return answer("Verified the preserved operation and final delivery.")
          }
          // Compaction is also streamed through the real model boundary.
          if (!names.includes("panel_create_task"))
            return answer(
              "Preserve the committed operation and current acceptance obligation; verify the recovered delivery.",
            )
          const messages = await Session.messages({ sessionID: mission.id })
          const completed = messages
            .flatMap((m) => m.parts)
            .filter((p) => p.type === "tool" && p.state.status === "completed")
          const outputs = (name: string) =>
            completed
              .filter((p) => p.type === "tool" && p.tool === name)
              .map((p) => JSON.parse((p as any).state.output))
          const completion = outputs("panel_complete_mission").at(-1)
          if (completion) {
            if (completion.kind !== "mission_completed") throw new Error(JSON.stringify(completion))
            return answer("The Mission accepted the recovered delivery and independent verification.")
          }
          for (const m of messages)
            for (const p of m.parts)
              if (p.type === "tool" && p.state.status === "error") failures.push(JSON.stringify(p.state))
          if (failures.length) throw new Error(failures.join("\n"))
          taskID ||= outputs("panel_create_task").at(-1)?.task_id ?? ""
          const step = missionStep++
          if (step > 0 && taskID && taskLifecycleProjection(taskID).status === "active") {
            missionStep--
            return answer("The Task is still running; its terminal delivery owns the next acceptance decision.")
          }
          if (step === 4 && !names.includes("panel_resume_task")) {
            missionStep--
            return call("capability_search", {
              exact_refs: [
                { kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: "panel_resume_task" },
              ],
            })
          }
          if (step === 0)
            return call("panel_create_task", {
              title: "Recover delivery and independently verify",
              request:
                "Publish one durable operation receipt, preserve it across disconnection, and independently verify final delivery.",
              promptProfile: "base",
            })
          if (!taskID)
            throw new Error(`Created Task identity unavailable: ${JSON.stringify(outputs("panel_create_task"))}`)
          if (step === 1 || step === 5) return call("panel_query_task", { taskIDs: [taskID] })
          if (step === 2 || step === 6)
            return call("panel_query_task_artifacts", {
              queries: [{
                taskID,
                page_number: 1,
                artifact_types: [step === 2 ? "base/development-report" : "base/test-report"],
              }],
            })
          if (step === 3 || step === 7) {
            const batch = outputs("panel_query_task_artifacts").at(-1)
            expect(batch).toMatchObject({ complete: true, results: [{ request_index: 0 }] })
            const catalog = batch.results[0].value
            const entries = catalog.entries
            const entry = entries.find(
              (e: any) => e.artifact_type === (step === 3 ? "base/development-report" : "base/test-report"),
            )
            selectedRef = entry?.artifact_locator_ref
            if (!selectedRef) throw new Error(`Missing real catalog reference: ${JSON.stringify(catalog)}`)
            return call("panel_read_task_artifact", {
              reads: [{
                taskID,
                artifact_transport_version: 2,
                artifact_locator_ref: selectedRef,
                byte_offset: 0,
                max_bytes: 65536,
                delivery: "inline",
              }],
            })
          }
          const readBatch = outputs("panel_read_task_artifact").at(-1)
          expect(readBatch).toMatchObject({ complete: true, results: [{ request_index: 0 }] })
          const read = readBatch.results[0].value
          if (!read?.complete) throw new Error(`Incomplete real acceptance read: ${JSON.stringify(read)}`)
          readRefs.push(read.artifact_read_ref)
          if (step === 4)
            return call("panel_resume_task", {
              taskID,
              acceptance_gap: {
                gap_id: "gap-delivery",
                current_ledger_revision_artifact_id: null,
                criteria: [
                  {
                    criterion_id: "deliver-and-verify",
                    state: "open",
                    disposition: "failed",
                    finding: "The operation committed but delivery and independent verification remain incomplete.",
                    responsibility: {
                      kind: "workflow_node",
                      workflow_id: "execution-verification",
                      workflow_node_id: "base-developer",
                    },
                    observation_evidence_read_refs: [read.artifact_read_ref],
                    repair_evidence_read_refs: [],
                    resolution_evidence_read_refs: [],
                    invalidating_evidence_read_refs: [],
                    irreducible_blocker_evidence_read_refs: [],
                    repair_action: {
                      operation: "finish-and-verify",
                      target: "durable-delivery",
                      expected_evidence_kind: "independent-verification",
                      parameters: {},
                    },
                  },
                ],
              },
            })
          return call("panel_complete_mission", {
            summary: "Recovered delivery verified.",
            task_acceptances: [{ task_id: taskID, evidence_read_refs: [read.artifact_read_ref] }],
          })
        },
      })
      await Provider.getModel(model.providerID, model.modelID)
      const languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
      try {
        const text =
          "Publish one durable operation receipt, preserve it across disconnection, and independently verify final delivery."
        await openMissionExecutionWithWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: "streamed-recovery-request",
          acceptedInput: {
            text,
            model: `${model.providerID}/${model.modelID}`,
            attachments: [],
            configPatch: { model: `${model.providerID}/${model.modelID}`, prompt_profile: null },
            context: { surface: "panel" },
          },
          wake: (admission) =>
            SessionWake.wakeWithReceipt({
              sessionID: mission.id,
              messageID: admission.messageID,
              textPartID: admission.textPartID,
              controlID: admission.controlID,
              prompt: text,
              author: "user",
              agent: "mission",
              model,
              surface: "panel",
              userAuthored: true,
              reason: missionOperatorWakeReason(admission, mission.missionID),
              commitBundle: admission.commitBundle,
              preflightBundle: admission.preflightBundle,
              ownerPreflight: admission.ownerPreflight,
              ownerLifecycle: admission.ownerLifecycle,
            }),
        })
        const deadline = Date.now() + 75_000
        while (Date.now() < deadline) {
          const messages = await Session.messages({ sessionID: mission.id })
          const errors = messages.flatMap((m) => m.parts).filter((p) => p.type === "tool" && p.state.status === "error")
          if (errors.length) {
            const workerMessages = taskID
              ? (
                  await Promise.all(sessionIDsForTask(taskID).map((sessionID) => Session.messages({ sessionID })))
                ).flat()
              : []
            throw new Error(
              JSON.stringify({
                missionErrors: errors.map((p) => (p as any).state),
                calls,
                task: taskID ? taskLifecycleProjection(taskID) : null,
                workerErrors: workerMessages
                  .flatMap((m) => [
                    { message: m.info.id, agent: m.info.agent, error: (m.info as any).error },
                    ...m.parts
                      .filter((p) => p.type === "tool" && p.state.status === "error")
                      .map((p) => ({ tool: (p as any).tool, error: (p as any).state.failure })),
                  ])
                  .filter((x) => x.error),
              }),
            )
          }
          if (
            messages.some((m) =>
              m.parts.some(
                (p) => p.type === "tool" && p.tool === "panel_complete_mission" && p.state.status === "completed",
              ),
            )
          )
            break
          await Bun.sleep(25)
        }
        await waitForIngressDeliveryHooksForTest()
        const occurrence = SessionStatus.executionOccurrence(mission.id)!
        await SessionStatus.waitForExecutionSettlement({
          sessionID: mission.id,
          inputMessageID: occurrence.inputMessageID,
          owner: occurrence.owner!,
        })
        expect(SessionStatus.getExecution(mission.id, occurrence.inputMessageID)).toMatchObject({ type: "idle" })
        expect(auditSchedulerSessionDeliverySettlement(mission.id).passed).toBe(true)
        const readProjection = async (route: string) => {
          const url = new URL(route, "http://localhost")
          url.searchParams.set("directory", project.path)
          const response = await Server.App().request(url.toString(), {
            headers: { "x-opencorvus-directory": project.path },
          })
          expect(response.status).toBe(200)
          return response.json() as Promise<any>
        }
        const [missionRecords, missionStatus, missionTranscript, taskBoard, taskTranscript] = await Promise.all([
          readProjection("/mission?limit=100"),
          readProjection(`/mission/${mission.missionID}/status`),
          readProjection(`/session/${mission.id}/message`),
          readProjection(`/task/${taskID}/board?sync=0`),
          readProjection(`/task/${taskID}/transcript`),
        ])
        const missionRecord = missionRecords.find((item: any) => item.missionID === mission.missionID)
        const creationMessage = missionTranscript.find((message: any) => message.parts.some((part: any) =>
          part.type === "tool" && part.tool === "panel_create_task" && part.state.status === "completed"))
        const postCreationReply = missionTranscript.find((message: any) => message.info.role === "assistant" &&
          message.info.parentID === creationMessage?.info.parentID && message.info.finish === "stop" &&
          message.parts.some((part: any) => part.type === "text" && part.text.startsWith("The Task is still running;")))
        expect(postCreationReply?.info).toMatchObject({ role: "assistant", parentID: creationMessage.info.parentID,
          time: { completed: expect.any(Number) }, finish: "stop" })
        expect(
          auditMissionOutcome({
            missionRecord,
            missionStatus,
            missionTranscript,
            taskTranscripts: [{ task_id: taskID, lifecycle_status: taskBoard.task.status, transcript: taskTranscript }],
          }),
        ).toMatchObject({
          passed: true,
          scored_terminal: true,
          explicit_complete_mission: true,
          completion_receipt_matches: true,
        })
        expect(
          auditMissionQuiescence({
            missionRecord,
            missionStatus,
            taskBoards: [{ task_id: taskID, board: taskBoard }],
          }),
        ).toMatchObject({ passed: true, mission_completed: true, task_count: 1 })
        expect({ taskID, calls, failures, rootStep, developerStep, testerStep }).toMatchObject({
          taskID: expect.any(String),
          failures: [],
          developerStep: 4,
          testerStep: 2,
        })
        expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "completed", epoch: 2 })
        expect(readLatestTaskAcceptanceLedger(taskID)?.revision.execution_epoch).toBe(2)
        const descriptors = Database.use((db) =>
          db.select().from(WorkerTurnDescriptorTable).where(eq(WorkerTurnDescriptorTable.task_id, taskID)).all(),
        )
        expect(descriptors.map((d) => ({ agent: d.agent, turn: (d.payload as any).dispatchTurn.kind }))).toEqual([
          { agent: "base-developer", turn: "initial" },
          { agent: "base-developer", turn: "continuation" },
          { agent: "base-developer", turn: "continuation" },
          { agent: "base-tester", turn: "initial" },
        ])
        expect(
          missionBoardProjection(mission, {
            interruptible: false,
            pendingInteractions: 0,
            taskLifecycleStatuses: ["completed"],
          }),
        ).toMatchObject({ lane: "completed" })
        const snapshot = databaseSnapshot(Database.Path())
        expect(snapshot.tables.worker_turn_descriptor?.map((row: any) => row.id)).toEqual(descriptors.map((d) => d.id))
        expect(
          snapshot.tables.part
            ?.filter((row: any) => row.tool === "artifact_publish")
            .map((row: any) => row.state_status),
        ).toEqual(["completed", "completed", "completed"])
      } catch (error) {
        console.error("RECOVERY_FAILURE", error)
        throw error
      } finally {
        const sessions = [...new Set([mission.id, ...(taskID ? sessionIDsForTask(taskID) : [])])]
        for (const sessionID of sessions)
          SessionPrompt.cancel(
            sessionID,
            project.path,
            createExecutionCancellationOrigin({
              actor: "runtime",
              source: "process.shutdown",
              surface: "recovery-test",
              reason: "Release the isolated runtime after acceptance assertions.",
              targetSessionID: sessionID,
            }),
          )
        await Promise.all(sessions.map((sessionID) => SessionPrompt.waitForFinish(sessionID, project.path)))
        languageSpy.mockRestore()
      }
    },
  })
}, 120_000)
