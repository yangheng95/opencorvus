import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { findDispatchSettlementByDispatchID, assertTaskDispatchesSettledInTransaction } from "@/engine/dispatch-settlement"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import path from "node:path"
import fs from "node:fs/promises"
import { IntentAnalysisAgent } from "@/intent-analysis/agent"
import { Auth } from "@/auth"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import {
  TestHooks as TaskControlTestHooks,
  taskRootIngressDebugProjection,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { EngineGit } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { Orchestrator } from "@/orchestrator/agent"
import { OrchestratorToolsTestHooks } from "@/orchestrator/tools"
import { orchestratorCommittedDecisionInParts } from "@/orchestrator/decision-tool-names"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { MessageStore } from "@/session/message-store"
import { toolResultControl } from "@/session/tool-result-control"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageTable, ProviderActivityRequestTable } from "@/session/session.sql"
import { Database, eq, inArray, sql } from "@/storage/db"
import { ApplicationSchemaSQLTestHooks } from "@/storage/ddl"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const model = { providerID: "streamed-dispatch", modelID: "settlement" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Streamed dispatch settlement",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
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
    api: { id: model.modelID, url: "https://streamed-dispatch.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-29",
  } as ProviderType.Model
}

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

for (const collection of [false, true]) {
for (const scenario of ["base", "advanced", "advanced-preparation-failure", "advanced-preparation-recovery", "advanced-authority-recovery", "advanced-attachment-recovery"] as const) {
if (collection && scenario === "advanced") continue
const dispatchToolName = collection ? "dispatch_agents" : "dispatch_agent"
const encodeDispatch = (request: any) => JSON.stringify(collection ? { team: [{ name: "worker", target: request.dispatch.target, responsibility: "Interpret one exact request", boundary: "Read-only Task evidence", expected_result: "Durable worker output", depends_on: [] }], dispatches: [request] } : request)
const attachmentRecovery = scenario === "advanced-attachment-recovery"
const authorityFailure = scenario === "advanced-authority-recovery"
const recoveryCase = scenario === "advanced-preparation-recovery" || authorityFailure
const preparationFails = scenario === "advanced-preparation-failure" || recoveryCase
const profile = collection && !attachmentRecovery ? "light" : scenario === "base" ? "base" : "advanced"
const activeProfile = collection && attachmentRecovery ? "attachment-collection" : profile
const targetID = collection && !attachmentRecovery ? "light-planner" : profile === "base" ? "base-planner" : "request-interpreter"
test(`${dispatchToolName}: ` + (attachmentRecovery ? "streamed invalid attachment input permits a corrected initial dispatch" : authorityFailure ? "streamed authority transaction rollback recovers the same reserved Session" : recoveryCase ? "streamed failed preparation continues the reserved worker and settles every dispatch" : preparationFails ? "streamed preparation failure permits the next model decision and durable re-read" : `${scenario} streamed dispatch commits a real child descriptor through the visible Tool boundary`), async () => {
  using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      if (collection) await ExpertSquadPackageManager.importDirectory({ projectDirectory: project.path, sourceDirectory: path.resolve(import.meta.dir, "../../../expert-squads/builtin/light"), installationScope: "project" })
      if (collection && attachmentRecovery) {
        // Advanced does not declare collection dispatch. This controlled package
        // explicitly declares it so the collection's Intent input contract is real.
        const sourceDirectory = path.join(project.path, "attachment-collection-package")
        await fs.cp(path.resolve(import.meta.dir, "../src/expert-squad/builtin/advanced"), sourceDirectory, { recursive: true })
        const manifestPath = path.join(sourceDirectory, "expert-squad.jsonc")
        const manifest = JSON.parse((await fs.readFile(manifestPath, "utf8")).replaceAll(":package:advanced:", ":package:attachment-collection:").replaceAll("advanced%2F", "attachment-collection%2F"))
        manifest.id = activeProfile
        manifest.namespace = "test"
        manifest.capability_projection.scheduler.capability_refs.push("capability:tool:platform:tool-registry:dispatch_agents")
        manifest.capability_projection.scheduler.capability_refs.sort()
        await fs.writeFile(manifestPath, JSON.stringify(manifest))
        await ExpertSquadPackageManager.importDirectory({ projectDirectory: project.path, sourceDirectory, installationScope: "project" })
      }
      await Config.updateProjectPatch({ prompt_profile: { active: activeProfile } })
      using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
        runner: async (input) =>
          await Orchestrator.processTask(
            input.taskID,
            input.event,
            input.signal,
            input.wakeID,
            input.activationID,
            input.predecessorID,
          ).then((finalMessageID) => ({ finalMessageID })),
      })


      const initialRequest = (refs: string[] = []) => encodeDispatch({
        dispatch: {
          target: targetID,
          work_scope: { kind: "task" },
          turn: {
            kind: "initial",
            workflow_subject: collection && !attachmentRecovery ? { kind: "direct" } : {
              kind: "virtual_workflow",
              workflow_id: profile === "base" ? "planner-parallel-delivery" : "greenfield-interface-delivery",
              node_id: targetID,
            },
            use_worktree: false,
            input: profile === "advanced" ? { reason: "Interpret the fictional local webpage request.", attachment_refs: refs } : {
              goal_ids: [],
              instruction: "Record one durable streamed dispatch receipt.",
              reason: "The Task requires its first package-owned workflow occurrence.",
            },
          },
        },
      })
      let failedDispatchID: string | undefined
      let capabilityProviderRequests = 0
      let rootProviderRequests = 0
      let workerProviderRequests = 0
      let releaseWorker!: () => void
      const workerGate = new Promise<void>((resolve) => {
        releaseWorker = resolve
      })
      const language = new MockLanguageModelV3({
        provider: model.providerID,
        modelId: model.modelID,
        async doStream(options) {
          const toolNames = Array.isArray(options.tools)
            ? options.tools.map((item) => item.name)
            : Object.keys(options.tools ?? {})
          if (collection && toolNames.includes("capability_search") && !toolNames.includes(dispatchToolName) && (rootProviderRequests === 0 || workerProviderRequests > 0)) {
            capabilityProviderRequests++
            const names = [dispatchToolName, "no_action"]
            return { stream: simulateReadableStream({ chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: `reveal_${capabilityProviderRequests}`, toolName: "capability_search", input: JSON.stringify({ queries: names, exact_refs: names.map((local_ref) => capabilityRef({ kind: "tool", source: "platform", owner_ref: "runtime-projection:orchestrator", local_ref })), deactivate_refs: [], limit: 5 }) },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
            ] }) }
          }
          if (toolNames.includes(dispatchToolName) && rootProviderRequests === 0) {
            rootProviderRequests++
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "dispatch-preamble" },
                  {
                    type: "text-delta",
                    id: "dispatch-preamble",
                    delta: "Dispatch the exact first workflow occurrence.",
                  },
                  { type: "text-end", id: "dispatch-preamble" },
                  {
                    type: "tool-call",
                    toolCallId: "call_streamed_dispatch",
                    toolName: dispatchToolName,
                    input: initialRequest(attachmentRecovery ? ["msg_wrong_attachment_identity"] : []),
                  },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ],
              }),
            }
          }
          if (attachmentRecovery && rootProviderRequests === 1 && toolNames.includes(dispatchToolName)) {
            rootProviderRequests++
            return { stream: simulateReadableStream({ chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: "call_correct_attachment_selection", toolName: dispatchToolName, input: initialRequest() },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
            ] }) }
          }
          if (recoveryCase && failedDispatchID && rootProviderRequests === 1 && toolNames.includes(dispatchToolName)) {
            rootProviderRequests++
            return { stream: simulateReadableStream({ chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: "call_recover_preparation", toolName: dispatchToolName, input: encodeDispatch({ dispatch: {
                target: targetID, work_scope: { kind: "task" },
                turn: { kind: "continuation", authority: { kind: "prior_dispatch", continuation_dispatch_id: failedDispatchID }, guidance: "The transient preparation fault is repaired; execute the exact reserved occurrence.", evidence_locators: [] },
              } }) },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
            ] }) }
          }
          if (toolNames.includes("no_action")) {
            rootProviderRequests++
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  {
                    type: "tool-call",
                    toolCallId: `call_lifecycle_reconciled_${rootProviderRequests}`,
                    toolName: "no_action",
                    input: JSON.stringify({ reason: "The worker lifecycle fact has no newly ready frontier." }),
                  },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ],
              }),
            }
          }
          workerProviderRequests++
          return {
            stream: new ReadableStream({
              async start(controller) {
                await workerGate
                for (const chunk of [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "worker-result" },
                  { type: "text-delta", id: "worker-result", delta: "The streamed dispatch receipt is durable." },
                  { type: "text-end", id: "worker-result" },
                  { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                ] as const) {
                  controller.enqueue(chunk)
                }
                controller.close()
              },
            }),
          }
        },
      })
      const resolvedModel = providerModel()
      const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(resolvedModel)
      const languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
      const providerSpy = spyOn(Provider, "getProvider").mockResolvedValue({
        id: model.providerID,
        name: "Streamed dispatch test",
        source: "custom",
        env: [],
        options: {},
        models: { [resolvedModel.id]: resolvedModel },
      } as never)
      const authSpy = spyOn(Auth, "get").mockResolvedValue(undefined)
      const gitPrepareSpy = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
      const gitCompleteSpy = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))

      const workerAdapter: any = collection ? DelegatedWorkerAgent : IntentAnalysisAgent
      const method = collection ? "run" : "analyze"
      const originalAnalyze = workerAdapter[method]
      const preparationSpy = preparationFails
        ? spyOn(workerAdapter, method).mockImplementation(async (input: any) => {
            if (!failedDispatchID) {
              failedDispatchID = input.dispatchTurn!.current_dispatch_id
              if (!authorityFailure) throw new Error("Injected preparation failure before child creation")
            }
            return originalAnalyze(input)
          })
        : undefined
      let authoritySessionID: string | undefined
      let authorityInsertedRow: { id: string } | undefined
      const authorityFailureMessage = "Injected authority failure after Session insertion before descriptor preparation"
      const originalPrepare = WorkerTurnDescriptor.prepare
      const authoritySpy = authorityFailure ? spyOn(WorkerTurnDescriptor, "prepare").mockImplementation((input) => {
        if (!authoritySessionID && input.payload.identity.agentID === targetID) {
          authoritySessionID = input.sessionID
          authorityInsertedRow = Database.use((db) => db.get<{ id: string }>(sql`SELECT id FROM session WHERE id=${input.sessionID}`))
          throw new Error(authorityFailureMessage)
        }
        return originalPrepare(input)
      }) : undefined
      try {
        const taskID = await EngineService.createTask(
          {
            requestID: `streamed-dispatch-${Identifier.ascending("artifact")}`,
            title: "Streamed dispatch settlement",
            request: "Produce one streamed dispatch and durable receipt",
            productPillar: "work",
            model: `${model.providerID}/${model.modelID}`,
            promptProfile: activeProfile,
          },
          { actor: "user" },
        )
        await waitForIngressDeliveryHooksForTest()
        const task = requireTask(taskID)
        const orchestrator = (await Session.children(task.session_id!)).find(
          (session) => session.kind === "orchestrator",
        )
        if (!orchestrator) throw new Error("Task-root Orchestrator Session was not created")
        await Database.awaitEffectIdle(30_000)
        const messages = await Session.messages({ sessionID: orchestrator.id })
        const assistantIDs = messages.filter((item) => item.info.role === "assistant").map((item) => item.info.id)
        const providerFacts = Database.use((db) =>
          assistantIDs.length === 0
            ? []
            : db
                .select({ id: ProviderActivityRequestTable.id, messageID: MessageTable.id })
                .from(ProviderActivityRequestTable)
                .innerJoin(MessageTable, eq(MessageTable.id, ProviderActivityRequestTable.assistant_message_id))
                .where(inArray(ProviderActivityRequestTable.assistant_message_id, assistantIDs))
                .all(),
        )
        const toolParts = messages.flatMap((message) => message.parts).filter((part) => part.type === "tool" && part.tool !== "capability_search")
        for (const part of toolParts) {
          if (!attachmentRecovery && part.tool === dispatchToolName && part.state.status === "error") throw new Error(JSON.stringify(part.state.failure))
        }
        expect({
          taskError: task.error,
          rootProviderRequests,
          providerFacts,
          dispatchReceipts: toolParts.filter((part) => part.tool === dispatchToolName).map((part) => part.state.status),
          calls: toolParts.map((part) => part.tool),
          ingress: taskRootIngressDebugProjection(taskID).map((entry) => entry.projection.state),
        }).toEqual({
          taskError: null,
          rootProviderRequests: preparationFails || attachmentRecovery ? 2 : 1,
          providerFacts: Array.from({ length: (preparationFails || attachmentRecovery ? 2 : 1) + capabilityProviderRequests }, () => ({ id: expect.any(String), messageID: assistantIDs[0] })),
          dispatchReceipts: attachmentRecovery ? [collection ? "completed" : "error", "completed"] : recoveryCase ? ["completed", "completed"] : ["completed"],
          calls: recoveryCase || attachmentRecovery ? [dispatchToolName, dispatchToolName] : preparationFails ? [dispatchToolName, "no_action"] : [dispatchToolName],
          ingress: ["resolved"],
        })
        const receipt = toolParts.filter((part) => part.tool === dispatchToolName).at(-1)!
        if (receipt.state.status !== "completed") throw new Error("Expected completed dispatch receipt")
        const value = JSON.parse(receipt.state.output)
        const accepted = collection ? value.members[0].outcome : value
        if (preparationFails && !recoveryCase) {
          expect(accepted).toMatchObject({ kind: "infrastructure_failure", operation: collection ? "delegated_worker_adapter" : "analyze_intent_adapter" })
          expect(orchestratorCommittedDecisionInParts(toolParts)).toBe("no_action")
          await Database.awaitEffectIdle(30_000)
          Database.close()
          Database.Client()
          const reopened = await MessageStore.get({ sessionID: orchestrator.id, messageID: assistantIDs[0]! })
          expect({ decision: orchestratorCommittedDecisionInParts(reopened.parts), projection: taskRootIngressDebugProjection(taskID)[0]!.projection.state })
            .toEqual({ decision: "no_action", projection: "resolved" })
          return
        }
        if (attachmentRecovery) {
          const rejected = toolParts.filter((part) => part.tool === dispatchToolName)[0]!
          if (collection && rejected.state.status === "completed") {
            expect(JSON.parse(rejected.state.output).members[0]).toMatchObject({ status: "failed", failure: { name: "PromptAttachmentReferenceError" } })
          } else if (rejected.state.status === "error") {
            expect(rejected.state.failure).toMatchObject({ name: "PromptAttachmentReferenceError" })
          } else throw new Error("Expected the exact attachment selection error")
          const lineages = Database.use((db) => db.all<{ payload: string }>(sql`SELECT payload FROM engine_artifact WHERE task_id=${taskID} AND kind='dispatch_lineage'`))
          expect(lineages.map((row) => { const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload; return { callID: payload.tool_call_id, input: payload.adapter_input } }))
            .toEqual([{ callID: "call_correct_attachment_selection", input: { reason: "Interpret the fictional local webpage request.", attachment_refs: [] } }])
        }
        expect(accepted.kind).toBe("accepted")
        expect((await Session.get(accepted.session_id)).parentID).toBe(orchestrator.id)
        if (collection) {
          const classify = (output: unknown) => Database.use((db) => db.get<{ accepted: number }>(sql`
            WITH input_task(task_id) AS (VALUES (${taskID})),
              request AS (SELECT id,data FROM tool_part_request WHERE id=${receipt.id}),
              outcome(data) AS (VALUES (${JSON.stringify({ outcome: "completed", output: JSON.stringify(output) })}))
            SELECT ${sql.raw(ApplicationSchemaSQLTestHooks.dispatchDecisionReceipt())} AS accepted FROM request,outcome`))!.accepted
          expect([
            classify(value),
            classify({ members: [...value.members, { status: "completed", outcome: { kind: "accepted" } }] }),
            classify({ members: { one: value.members[0] } }),
            classify({ members: [...value.members, { member_index: 1, name: "bad", target: targetID, status: "failed", failure: {} }] }),
            classify({ members: [...value.members, "malformed"] }),
            classify({ members: [...value.members, { member_index: 1, name: "bad", target: targetID, status: "completed", outcome: "malformed" }] }),
          ]).toEqual([1, 0, 0, 0, 0, 0])
        }
        expect(WorkerTurnDescriptor.latestForSession(accepted.session_id)?.payload.identity.agentID).toBe(
          targetID,
        )
        releaseWorker()
        for (const child of await Session.children(orchestrator.id)) {
          await SessionPrompt.waitForFinish(child.id, project.path)
        }
        await waitForIngressDeliveryHooksForTest()
        await SessionPrompt.waitForFinish(orchestrator.id, project.path)
        await Database.awaitEffectIdle(30_000)
        expect({ rootProviderRequests, workerProviderRequests }).toEqual({
          rootProviderRequests: recoveryCase || attachmentRecovery ? 3 : 2,
          workerProviderRequests: 1,
        })
        if (authorityFailure) expect({ sessionID: authoritySessionID, inserted: authorityInsertedRow }).toEqual({ sessionID: accepted.session_id, inserted: { id: accepted.session_id } })
        if (recoveryCase) {
          const preparationSettlement = findDispatchSettlementByDispatchID({ taskID, dispatchID: failedDispatchID! })!
          expect(preparationSettlement.payload.outcome).toMatchObject({ kind: "infrastructure_failure", operation: collection ? "delegated_worker_adapter" : "analyze_intent_adapter" })
          expect(preparationSettlement.payload.session_id).toBe(accepted.session_id)
          if (authorityFailure) expect(preparationSettlement.payload.outcome).toMatchObject({
            message: collection ? `Projected agent "${targetID}" failed via adapter "delegated_worker": ${authorityFailureMessage}` : authorityFailureMessage,
          })
          expect(WorkerTurnDescriptor.latestForSession(accepted.session_id)?.payload.dispatchTurn).toMatchObject({ workflow_occurrence_id: failedDispatchID, preparation_recovery: { source_dispatch_id: failedDispatchID, guidance: "The transient preparation fault is repaired; execute the exact reserved occurrence." } })
          const workerMessages = await Session.messages({ sessionID: accepted.session_id })
          expect(workerMessages.filter((entry) => entry.info.role === "user").flatMap((entry) => entry.parts).filter((part) => part.type === "text").map((part) => part.type === "text" ? part.text : "").join("\n")).toContain("The transient preparation fault is repaired; execute the exact reserved occurrence.")
          expect(Database.use((db) => { assertTaskDispatchesSettledInTransaction(db, taskID); return "settled" })).toBe("settled")
        }
      } finally {
        preparationSpy?.mockRestore()
        authoritySpy?.mockRestore()
        releaseWorker()
        gitCompleteSpy.mockRestore()
        gitPrepareSpy.mockRestore()
        authSpy.mockRestore()
        providerSpy.mockRestore()
        languageSpy.mockRestore()
        modelSpy.mockRestore()
      }
    },
  })
  await waitForIngressDeliveryHooksForTest()
  await Instance.disposeAll()
  await Database.awaitEffectIdle(30_000)
}, 60_000)
}

}

// Fault injection stops only an exact production dispatch admission. Tool
// declarations, streaming Tool execution, SessionLoop coordination, Tool Part
// persistence and Task ingress reduction all remain the production path.
for (const collection of [false, true]) {
for (const secondFails of [false, true]) {
  const dispatchToolName = collection ? "dispatch_agents" : "dispatch_agent"
  const profile = collection ? "light" : "base"
  test(
    `${dispatchToolName}: ` + (secondFails
      ? "streamed failed dispatch siblings release their claims before an exclusive no_action receipt"
      : "streamed dispatch success survives a late sibling failure and persists the exclusive decision conflict"),
    async () => {
      using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          if (collection) await ExpertSquadPackageManager.importDirectory({ projectDirectory: project.path, sourceDirectory: path.resolve(import.meta.dir, "../../../expert-squads/builtin/light"), installationScope: "project" })
          await Config.updateProjectPatch({ prompt_profile: { active: profile } })
          using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
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
          const firstClaimed = Promise.withResolvers<void>()
          const secondClaimed = Promise.withResolvers<void>()
          const firstFailure = Promise.withResolvers<void>()
          const secondFailure = Promise.withResolvers<void>()
          const workerFinish = Promise.withResolvers<void>()
          let workerFinished = false
          const order: string[] = []
          let rootSessionID = ""
          let secondDispatch: { dispatchID: string; childSessionID: string } | undefined
          let dispatchStreamStarted = false
          let rootAssistantID = ""
          const waitForPart = async (callID: string, status: "completed" | "error") => {
            const deadline = Date.now() + 15_000
            while (Date.now() < deadline) {
              const messages = rootSessionID ? await Session.messages({ sessionID: rootSessionID }) : []
              for (const message of messages) {
                const part = message.parts.find((part) => part.type === "tool" && part.callID === callID)
                if (part?.type === "tool" && part.state.status === status) {
                  rootAssistantID = message.info.id
                  return part
                }
              }
              await Bun.sleep(10)
            }
            const observed = rootSessionID ? (await Session.messages({ sessionID: rootSessionID })).flatMap((message) => message.parts)
              .filter((part) => part.type === "tool")
              .map((part) => part.type === "tool" ? { callID: part.callID, status: part.state.status,
                detail: part.state.status === "error" ? part.state.failure : part.state.status === "completed" ? part.state.output.slice(0, 800) : undefined } : undefined) : []
            throw new Error(`Timed out waiting for persisted ${callID}:${status}; order=${JSON.stringify(order)}; observed=${JSON.stringify(observed)}`)
          }
          using _dispatchAdmission = OrchestratorToolsTestHooks.replaceAfterDispatchLineageClaim(
            async ({ lineage }) => {
              const callID = collection && lineage.payload.tool_call_id === "call_stagger_collection"
                ? lineage.payload.collection_member_index === 0 ? "call_stagger_a" : "call_stagger_b"
                : lineage.payload.tool_call_id
              if (callID !== "call_stagger_a" && callID !== "call_stagger_b") return
              rootSessionID = lineage.payload.orchestrator_session_id
              order.push(`${callID}:claimed`)
              if (callID === "call_stagger_a") {
                firstClaimed.resolve()
                await firstFailure.promise
              } else {
                secondDispatch = { dispatchID: lineage.dispatchID, childSessionID: lineage.payload.child_session_id }
                secondClaimed.resolve()
                if (!secondFails) return
                await secondFailure.promise
              }
              const error = new Error(`Injected exact admission failure for ${callID}`)
              error.name = "StaggeredDispatchAdmissionError"
              throw error
            },
          )
          const toolCall = (callID: string, toolName: string, input: unknown) => ({
            type: "tool-call" as const,
            toolCallId: callID,
            toolName,
            input: JSON.stringify(input),
          })
          const dispatchInput = (name: string) => ({
            dispatch: {
              target: collection ? "light-planner" : "base-planner",
              work_scope: { kind: "task" },
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                use_worktree: false,
                input: {
                  goal_ids: [],
                  instruction: `Read-only independent evidence partition ${name}.`,
                  reason: `The requested analysis has independent partition ${name}.`,
                },
              },
            },
          })
          const finish = {
            type: "finish" as const,
            finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
            usage,
          }
          const language = new MockLanguageModelV3({
            provider: model.providerID,
            modelId: model.modelID,
            async doStream(options) {
              const toolNames = Array.isArray(options.tools)
                ? options.tools.map((tool) => tool.name)
                : Object.keys(options.tools ?? {})
              if (toolNames.length === 1 && toolNames[0] === "capability_search" &&
                (!collection || !dispatchStreamStarted || secondFails || workerFinished)) {
                const names = dispatchStreamStarted ? ["no_action"] : [dispatchToolName, "no_action"]
                return {
                  stream: simulateReadableStream({
                    chunks: [
                      { type: "stream-start", warnings: [] },
                      toolCall(`call_stagger_reveal_${dispatchStreamStarted}`, "capability_search", {
                        queries: names,
                        exact_refs: names.map((local_ref) =>
                          capabilityRef({
                            kind: "tool",
                            source: "platform",
                            owner_ref: "runtime-projection:orchestrator",
                            local_ref,
                          }),
                        ),
                        deactivate_refs: [],
                        limit: 5,
                      }),
                      finish,
                    ],
                  }),
                }
              }
              if (toolNames.includes(dispatchToolName) && !dispatchStreamStarted) {
                dispatchStreamStarted = true
                return {
                  stream: new ReadableStream({
                    async start(controller) {
                      try {
                        controller.enqueue({ type: "stream-start", warnings: [] })
                        if (collection) {
                          controller.enqueue(toolCall("call_stagger_collection", dispatchToolName, {
                            team: ["A", "B"].map((name) => ({
                              name, target: "light-planner", responsibility: `Evidence partition ${name}`,
                              boundary: "Read-only Task evidence", expected_result: "Durable worker output", depends_on: [],
                            })),
                            dispatches: [dispatchInput("A"), dispatchInput("B")],
                          }))
                          await firstClaimed.promise
                        } else {
                          controller.enqueue(toolCall("call_stagger_a", dispatchToolName, dispatchInput("A")))
                          await firstClaimed.promise
                          controller.enqueue(toolCall("call_stagger_b", dispatchToolName, dispatchInput("B")))
                        }
                        await secondClaimed.promise
                        if (!secondFails) {
                          if (collection) {
                            const deadline = Date.now() + 15_000
                            while (!WorkerTurnDescriptor.findForDispatch({ sessionID: secondDispatch!.childSessionID, dispatchID: secondDispatch!.dispatchID })) {
                              if (Date.now() >= deadline) throw new Error("Collection survivor descriptor was not committed")
                              await Bun.sleep(10)
                            }
                            order.push("call_stagger_b:descriptor_committed")
                          } else {
                            await waitForPart("call_stagger_b", "completed")
                            order.push("call_stagger_b:durable_completed")
                          }
                        }
                        firstFailure.resolve()
                        if (collection) {
                          secondFailure.resolve()
                          await waitForPart("call_stagger_collection", "completed")
                          order.push("collection:durable_completed")
                        } else {
                          await waitForPart("call_stagger_a", "error")
                          order.push("call_stagger_a:durable_error")
                          if (secondFails) {
                            secondFailure.resolve()
                            await waitForPart("call_stagger_b", "error")
                            order.push("call_stagger_b:durable_error")
                          }
                        }
                        controller.enqueue(
                          toolCall("call_stagger_c", "no_action", {
                            reason: "Reconcile the observed dispatch outcomes in this exact ingress.",
                          }),
                        )
                        controller.enqueue(finish)
                        controller.close()
                      } catch (error) {
                        controller.error(error)
                      }
                    },
                  }),
                }
              }
              if (toolNames.includes("no_action")) {
                return {
                  stream: simulateReadableStream({
                    chunks: [
                      { type: "stream-start", warnings: [] },
                      toolCall(`call_stagger_lifecycle_${Identifier.ascending("call")}`, "no_action", {
                        reason: "The current lifecycle fact has been reconciled.",
                      }),
                      finish,
                    ],
                  }),
                }
              }
              return {
                stream: new ReadableStream({
                  async start(controller) {
                    await workerFinish.promise
                    for (const chunk of [
                      { type: "stream-start", warnings: [] },
                      { type: "text-start", id: "staggered-worker" },
                      { type: "text-delta", id: "staggered-worker", delta: "Independent partition B is examined." },
                      { type: "text-end", id: "staggered-worker" },
                      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                    ])
                      controller.enqueue(chunk)
                    controller.close()
                  },
                }),
              }
            },
          })
          const resolvedModel = providerModel()
          const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(resolvedModel)
          const languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
          const providerSpy = spyOn(Provider, "getProvider").mockResolvedValue({
            id: model.providerID,
            name: "Streamed dispatch test",
            source: "custom",
            env: [],
            options: {},
            models: { [resolvedModel.id]: resolvedModel },
          } as never)
          const authSpy = spyOn(Auth, "get").mockResolvedValue(undefined)
          const gitPrepareSpy = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
          const gitCompleteSpy = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))
          try {
            const taskID = await EngineService.createTask(
              {
                requestID: `staggered-dispatch-${Identifier.ascending("artifact")}`,
                title: "Staggered streamed dispatch decisions",
                request: "Analyze two independent read-only evidence partitions",
                productPillar: "work",
                model: `${model.providerID}/${model.modelID}`,
                promptProfile: profile,
              },
              { actor: "user" },
            )
            await waitForIngressDeliveryHooksForTest()
            const finalPart = await waitForPart("call_stagger_c", secondFails ? "completed" : "error")
            const assistant = await MessageStore.get({ sessionID: rootSessionID, messageID: rootAssistantID })
            const expectedDecision = secondFails ? "no_action" : dispatchToolName
            expect(order).toEqual(
              collection
                ? ["call_stagger_a:claimed", "call_stagger_b:claimed", ...(!secondFails ? ["call_stagger_b:descriptor_committed"] : []), "collection:durable_completed"]
                : secondFails
                ? [
                    "call_stagger_a:claimed",
                    "call_stagger_b:claimed",
                    "call_stagger_a:durable_error",
                    "call_stagger_b:durable_error",
                  ]
                : [
                    "call_stagger_a:claimed",
                    "call_stagger_b:claimed",
                    "call_stagger_b:durable_completed",
                    "call_stagger_a:durable_error",
                  ],
            )
            expect(orchestratorCommittedDecisionInParts(assistant.parts)).toBe(expectedDecision)
            expect(
              assistant.parts
                .filter(
                  (part) =>
                    part.type === "tool" &&
                    part.callID.startsWith("call_stagger_") &&
                    part.tool !== "capability_search",
                )
                .map((part) => (part.type === "tool" ? { callID: part.callID, status: part.state.status } : undefined)),
            ).toEqual(collection ? [
              { callID: "call_stagger_collection", status: "completed" },
              { callID: "call_stagger_c", status: secondFails ? "completed" : "error" },
            ] : [
              { callID: "call_stagger_a", status: "error" },
              { callID: "call_stagger_b", status: secondFails ? "error" : "completed" },
              { callID: "call_stagger_c", status: secondFails ? "completed" : "error" },
            ])
            if (collection) {
              const part = await waitForPart("call_stagger_collection", "completed")
              if (part.state.status !== "completed") throw new Error("Expected the completed collection receipt")
              const members = JSON.parse(part.state.output).members
              expect(members.map((member: any) => ({ index: member.member_index, status: member.status, kind: member.outcome.kind }))).toEqual([
                { index: 0, status: "completed", kind: "infrastructure_failure" },
                { index: 1, status: "completed", kind: secondFails ? "infrastructure_failure" : "accepted" },
              ])
            }
            if (finalPart.state.status === "error") {
              expect(finalPart.state.failure.name).toBe("ToolTurnExecutionConflictError")
            } else if (finalPart.state.status === "completed") {
              expect(toolResultControl(finalPart.state.metadata)).toEqual({ kind: "immediate_park" })
            }
            if (!secondFails) {
              const descriptor = WorkerTurnDescriptor.findForDispatch({
                sessionID: secondDispatch!.childSessionID,
                dispatchID: secondDispatch!.dispatchID,
              })
              expect(descriptor?.payload.dispatchTurn?.current_dispatch_id).toBe(secondDispatch!.dispatchID)
            }
            const ingress = taskRootIngressDebugProjection(taskID)[0]!
            expect(ingress.projection.state).toBe("resolved")
            workerFinished = true
            workerFinish.resolve()
            for (const child of await Session.children(rootSessionID)) {
              await SessionPrompt.waitForFinish(child.id, project.path)
            }
            await waitForIngressDeliveryHooksForTest()
            await SessionPrompt.waitForFinish(rootSessionID, project.path)
            await Database.awaitEffectIdle(30_000)
            Database.close()
            Database.Client()
            const reopened = await MessageStore.get({ sessionID: rootSessionID, messageID: assistant.info.id })
            expect({
              assistantID: reopened.info.id,
              decision: orchestratorCommittedDecisionInParts(reopened.parts),
              ingressState: taskRootIngressDebugProjection(taskID)[0]!.projection.state,
            }).toEqual({ assistantID: assistant.info.id, decision: expectedDecision, ingressState: "resolved" })
          } finally {
            firstFailure.resolve()
            secondFailure.resolve()
            workerFinished = true
            workerFinish.resolve()
            gitCompleteSpy.mockRestore()
            gitPrepareSpy.mockRestore()
            authSpy.mockRestore()
            providerSpy.mockRestore()
            languageSpy.mockRestore()
            modelSpy.mockRestore()
          }
        },
      })
      await waitForIngressDeliveryHooksForTest()
      await Instance.disposeAll()
      await Database.awaitEffectIdle(30_000)
    },
    90_000,
  )
}
}
