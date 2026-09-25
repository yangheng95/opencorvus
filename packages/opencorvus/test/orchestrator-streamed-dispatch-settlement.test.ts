import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { findDispatchSettlementByDispatchID, assertTaskDispatchesSettledInTransaction } from "@/engine/dispatch-settlement"
import { delegatedWorkerAcceptanceSection } from "@/delegated-worker/context"
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
import { persistArchitectGoalProjection } from "@/engine/persist"
import { EngineGit } from "@/engine/git"
import { requireCurrentGoalContext, requireTask } from "@/engine/store"
import { EngineTaskTable } from "@/engine/engine.sql"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
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
import { listDispatchLineage } from "@/engine/dispatch-lineage"
import { waitForDetachedDispatchPipelinesForTest } from "@/orchestrator/dispatch-agent-tool"
import { controlTextSHA256, renderDispatchContinuationTurn } from "@/orchestrator/dispatch-turn-projection"
import { attachmentPromptSection } from "@/agent/prompt-projection"
import { AttachmentStore } from "@/storage/attachment-store"
import { appendTaskAttachment } from "@/engine/task-file-reference"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

function observedTask() {
  const task = Database.use((db) => db.select().from(EngineTaskTable).get())!
  return noActionTaskObservation(taskLifecycleProjection(task.id))
}

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

for (const { collection, selectGoals, delegatedSelection = false } of [
  { collection: false, selectGoals: false },
  { collection: true, selectGoals: false },
  { collection: false, selectGoals: true },
  { collection: false, selectGoals: true, delegatedSelection: true },
  { collection: true, selectGoals: true, delegatedSelection: true },
]) {
  test(`${collection ? "dispatch_agents" : "dispatch_agent"}: ${delegatedSelection ? "delegated selection and participant evidence" : selectGoals ? "workload selection and attachment" : "attachment"} continuation recovers the accepted Turn through streamed execution`, async () => {
    using _drain = Bus.TestHooks.suppressAutomaticDurableDrain()
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const dispatchToolName = collection ? "dispatch_agents" : "dispatch_agent"
        const profile = selectGoals && !delegatedSelection ? "advanced" : collection ? "light" : "base"
        const target = selectGoals && !delegatedSelection ? "workload-reviewer" : collection ? "light-planner" : "base-planner"
        const adapterID = selectGoals && !delegatedSelection ? "workload_analysis" : "delegated_worker"
        const goalID = Identifier.ascending("goal")
        const initialGoalID = Identifier.ascending("goal")
        if (collection && (!selectGoals || delegatedSelection))
          await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: path.resolve(import.meta.dir, "../../../expert-squads/builtin/light"),
            installationScope: "project",
          })
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
        const encode = (turn: unknown) => {
          const request = { dispatch: { target, work_scope: { kind: "task" }, turn } }
          return collection
            ? {
                team: [
                  {
                    name: "planner",
                    target,
                    responsibility: "Read the request",
                    boundary: "Read-only",
                    expected_result: "Requirement handoff",
                    depends_on: [],
                  },
                ],
                dispatches: [request],
              }
            : request
        }
        let phase = 0
        let serial = 0
        let producerReads = 0
        let reviewerStep = 0
        let reviewedInput = ""
        let reviewedOutput = ""
        const syntheticQuery = `synthetic evidence ${"x".repeat(300)} source records`
        const producerInput = { queries: [{ query: { text: syntheticQuery, mode: "substring" }, limit: 25, version_scope: "current" }] }
        let failedDispatchID: string | undefined
        const workerPrompts: unknown[] = []
        const guidance =
          "Continue the exact requirements with the original attachment and preserve pending browser acceptance."
        const toolStream = (toolName: string, input: unknown) => ({
          stream: simulateReadableStream({
            chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: `continuation_${++serial}`, toolName, input: JSON.stringify(input) },
              { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
            ],
          }),
        })
        const language = new MockLanguageModelV3({
          provider: model.providerID,
          modelId: model.modelID,
          async doStream(options) {
            const names = Array.isArray(options.tools)
              ? options.tools.map((item) => item.name)
              : Object.keys(options.tools ?? {})
            const expectingWorker =
              (phase === 1 && workerPrompts.length === 0) || (phase === 3 && workerPrompts.length === 1)
            if (
              collection &&
              !expectingWorker &&
              names.includes("capability_search") &&
              !names.includes(dispatchToolName)
            ) {
              return toolStream("capability_search", {
                queries: [dispatchToolName, "no_action"],
                exact_refs: [dispatchToolName, "no_action"].map((local_ref) =>
                  capabilityRef({
                    kind: "tool",
                    source: "platform",
                    owner_ref: "runtime-projection:orchestrator",
                    local_ref,
                  }),
                ),
                deactivate_refs: [],
                limit: 5,
              })
            }
            if (names.includes(dispatchToolName)) {
              const task = Database.use((db) => db.select().from(EngineTaskTable).get())!
              if (phase === 0) {
                if (delegatedSelection) Database.immediateTransaction(db => persistArchitectGoalProjection(db, {
                  taskID: task.id,
                  producer: { kind: "architect_turn", session_id: Identifier.ascending("session"), final_message_id: Identifier.ascending("message") },
                  observedArtifactLocators: [], sourceArtifactLocators: [],
                  architectGoals: [initialGoalID, goalID].map((id) => ({ goalID: id, llmID: id, title: `Selected contract ${id}`, objective: "Preserve original values outside the selected write range", acceptance_specs: [], owned_paths: [], priority: "blocking" as const, kind: "feature" as const })),
                  removals: [], graph: { contracts: [] }, fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] }, now: Date.now(),
                }))
                phase = 1
                return toolStream(
                  dispatchToolName,
                  encode({
                    kind: "initial",
                    workflow_subject: collection || selectGoals
                      ? { kind: "direct" }
                      : { kind: "virtual_workflow", workflow_id: "planner-parallel-delivery", node_id: target },
                    use_worktree: false,
                    input: selectGoals && !delegatedSelection ? { goal_ids: [], reason: "Review the currently selected workload" } : {
                      goal_ids: delegatedSelection ? [initialGoalID] : [],
                      instruction: "Read the original source and define the requirement.",
                      reason: "Prepare a typed handoff.",
                    },
                  }),
                )
              }
              const initial = listDispatchLineage(task.id)[0]!
              if (
                phase === 1 &&
                findDispatchSettlementByDispatchID({ taskID: task.id, dispatchID: initial.dispatchID })
              ) {
                const followup = await AttachmentStore.write(
                  Instance.project.id,
                  Buffer.from("Follow-up: keyboard input must work."),
                  "text/plain",
                  "followup.txt",
                )
                await appendTaskAttachment(task.id, { ...followup, intent: "task_input", source: "user-upload" })
                if (selectGoals && !delegatedSelection) Database.immediateTransaction(db => persistArchitectGoalProjection(db, {
                  taskID: task.id,
                  producer: { kind: "architect_turn", session_id: Identifier.ascending("session"), final_message_id: Identifier.ascending("message") },
                  observedArtifactLocators: [], sourceArtifactLocators: [],
                  architectGoals: [{ goalID, llmID: goalID, title: "Current workload", objective: "Review the selected workload", acceptance_specs: [], owned_paths: [], priority: "blocking", kind: "feature" }],
                  removals: [], graph: { contracts: [] }, fidelity: { sourceCoverage: [], referenceCoverage: [], assemblyOwners: [] }, now: Date.now(),
                }))
                phase = 2
                return toolStream(
                  dispatchToolName,
                  encode({
                    kind: "continuation",
                    authority: { kind: "prior_dispatch", continuation_dispatch_id: initial.dispatchID },
                    guidance,
                    ...(selectGoals ? { input: { goal_ids: [goalID], reason: "Review the newly selected current Goal", ...(delegatedSelection ? { instruction: "Review the exact preceding participant evidence" } : {}) } } : {}),
                    evidence_locators: [],
                  }),
                )
              }
              if (phase === 2 && failedDispatchID) {
                const failure = findDispatchSettlementByDispatchID({ taskID: task.id, dispatchID: failedDispatchID })!
                  .payload.outcome
                expect(failure).toMatchObject({
                  kind: "infrastructure_failure",
                  message: expect.stringContaining("Injected continuation preparation failure"),
                  worker_turn: { current_dispatch_id: initial.dispatchID },
                  recovery_authority: { dispatch_id: failedDispatchID },
                })
                if (failure.kind !== "infrastructure_failure" || !failure.worker_turn?.current_dispatch_id)
                  throw new Error("Recovery must expose accepted Turn authority")
                phase = 3
                return toolStream(
                  dispatchToolName,
                  encode({
                    kind: "continuation",
                    authority: {
                      kind: "prior_dispatch",
                      continuation_dispatch_id: failure.worker_turn.current_dispatch_id,
                    },
                    guidance,
                    ...(selectGoals ? { input: { goal_ids: [goalID], reason: "Review the newly selected current Goal", ...(delegatedSelection ? { instruction: "Review the exact preceding participant evidence" } : {}) } } : {}),
                    evidence_locators: [],
                  }),
                )
              }
              return toolStream("no_action", {
                observed_task: observedTask(),
                reason: "The current dispatch is already executing or settled.",
              })
            }
            if (delegatedSelection) {
              expect(names).toContain("read_agent_message")
              if (phase === 1 && producerReads < 17) {
                producerReads++
                return toolStream("artifact_search", producerReads === 1 ? producerInput : { queries: [{ query: { text: `${syntheticQuery} ${producerReads}`, mode: "substring" } }] })
              }
              if (phase === 3) {
                const task = Database.use((db) => db.select().from(EngineTaskTable).get())!
                const initial = listDispatchLineage(task.id)[0]!
                const outcome = findDispatchSettlementByDispatchID({ taskID: task.id, dispatchID: initial.dispatchID })!.payload.outcome
                if (outcome.kind !== "terminal_success") throw new Error("Producer must have a settled participant report")
                const message_ids = [outcome.final_message_id]
                if (reviewerStep++ === 0) return toolStream("read_agent_message", { message_ids })
                const reads = (await Session.messages({ sessionID: initial.payload.child_session_id })).flatMap(message =>
                  message.parts.flatMap(part => part.type === "tool" && part.tool === "read_agent_message" && part.state.status === "completed"
                    ? [JSON.parse(part.state.output)] : []))
                const last = reads.at(-1)
                if (!last) throw new Error("Reviewer did not receive the real shared reader result")
                if (reviewerStep === 2) {
                  expect(last.causal_tool_reference_index).toMatchObject({ complete: true, tool_count: 17 })
                  expect(last.causal_tool_reference_index.refs).toHaveLength(17)
                  expect(last.causal_tool_message_inventory).toHaveLength(16)
                  expect(last.inventory_next_before).toHaveLength(1)
                  return toolStream("read_agent_message", { message_ids, inventory_before: last.inventory_next_before })
                }
                const earliest = reads[1].causal_tool_message_inventory[0]
                const fact = earliest.tool_facts[0]
                if (reviewerStep === 3) {
                  expect(reads[0].causal_tool_reference_index.refs[0]).toMatchObject({
                    message_id: earliest.message_id,
                    part_id: fact.part_id,
                  })
                  expect(reads[1].causal_tool_message_inventory).toHaveLength(1)
                  return toolStream("read_agent_message", { message_ids, evidence_reads: [
                    { message_id: earliest.message_id, part_id: fact.part_id, field: "input", offset: 0, limit: 120 },
                    { message_id: earliest.message_id, part_id: fact.part_id, field: "output", offset: 0, limit: 8000 },
                  ] })
                }
                const inputRead = last.evidence_reads.find((read: any) => read.field === "input")
                if (!inputRead) throw new Error(JSON.stringify((await Session.messages({ sessionID: initial.payload.child_session_id })).flatMap(message => message.parts.filter(part => part.type === "tool" && part.state.status === "error"))))
                reviewedInput += inputRead.content
                reviewedOutput ||= last.evidence_reads.find((read: any) => read.field === "output")?.content ?? ""
                if (inputRead.next_offset !== null) return toolStream("read_agent_message", { message_ids, evidence_reads: [
                  { message_id: earliest.message_id, part_id: fact.part_id, field: "input", offset: inputRead.next_offset, limit: 120 },
                ] })
                expect(JSON.parse(reviewedInput)).toEqual(producerInput)
                expect(JSON.parse(reviewedOutput).results).toBeArray()
              }
            }
            workerPrompts.push(options.prompt)
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "worker" },
                  {
                    type: "text-delta",
                    id: "worker",
                    delta: "Requirements defined; real browser acceptance remains downstream work.",
                  },
                  { type: "text-end", id: "worker" },
                  { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                ],
              }),
            }
          },
        })
        const resolvedModel = providerModel()
        const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(resolvedModel)
        const languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
        const providerSpy = spyOn(Provider, "getProvider").mockResolvedValue({
          id: model.providerID,
          name: "Continuation test",
          source: "custom",
          env: [],
          options: {},
          models: { [resolvedModel.id]: resolvedModel },
        } as never)
        const authSpy = spyOn(Auth, "get").mockResolvedValue(undefined)
        const gitPrepareSpy = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
        const gitCompleteSpy = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))
        const prepare = WorkerTurnDescriptor.prepare
        const fault = spyOn(WorkerTurnDescriptor, "prepare").mockImplementation((input) => {
          if (input.payload.dispatchTurn?.kind === "continuation" && !failedDispatchID) {
            failedDispatchID = input.payload.dispatchTurn.current_dispatch_id
            throw new Error("Injected continuation preparation failure")
          }
          return prepare(input)
        })
        try {
          const taskID = await EngineService.createTask(
            {
              requestID: `attachment-continuation-${Identifier.ascending("artifact")}`,
              title: "Attachment continuation",
              request: "Define the game and preserve real browser verification as future acceptance.",
              productPillar: "work",
              model: `${model.providerID}/${model.modelID}`,
              promptProfile: profile,
              attachments: [
                {
                  mime: "text/markdown",
                  filename: "original-prd.md",
                  data: Buffer.from(
                    "# Original PRD\nThe timer lasts exactly 17 seconds.\nVerify play using real browser interaction.",
                  ).toString("base64"),
                },
              ],
            },
            { actor: "user" },
          )
          for (let i = 0; i < 4; i++) {
            await waitForIngressDeliveryHooksForTest()
            await waitForDetachedDispatchPipelinesForTest()
          }
          await Database.awaitEffectIdle(30_000)
          const lineages = listDispatchLineage(taskID)
          if (phase !== 3 || workerPrompts.length !== 2)
            throw new Error(
              JSON.stringify({
                phase,
                failedDispatchID,
                settlements: lineages.map(
                  (row) => findDispatchSettlementByDispatchID({ taskID, dispatchID: row.dispatchID })?.payload,
                ),
              }),
            )
          expect({ phase, workers: workerPrompts.length, dispatches: lineages.length }).toEqual({
            phase: 3,
            workers: 2,
            dispatches: 3,
          })
          const latest = lineages.at(-1)!
          const descriptor = WorkerTurnDescriptor.latestForSession(latest.payload.child_session_id)!
          expect(descriptor.payload.dispatchTurn).toMatchObject({
            kind: "continuation",
            current_dispatch_id: latest.dispatchID,
            source_dispatch_id: lineages[0]!.dispatchID,
            workflow_occurrence_id: lineages[0]!.dispatchID,
          })
          expect(lineages.map((row) => row.payload.child_session_id)).toEqual([
            descriptor.sessionID,
            descriptor.sessionID,
            descriptor.sessionID,
          ])
          expect({ subjects: descriptor.payload.dispatchTurn!.delivery_slice_revision_ids, input: latest.payload.adapter_input.goal_ids }).toEqual({ subjects: selectGoals ? [goalID] : [], input: selectGoals ? [goalID] : [] })
          const message = await MessageStore.get({
            sessionID: descriptor.sessionID,
            messageID: descriptor.payload.messageAuthority.user_message_id,
          })
          const expectedText = [
            renderDispatchContinuationTurn({ turn: descriptor.payload.dispatchTurn!, guidance, adapterInput: latest.payload.adapter_input }),
            ...(adapterID === "delegated_worker" ? [delegatedWorkerAcceptanceSection(
              latest.payload.delivery_slice_revision_ids.map(goalID => requireCurrentGoalContext({ taskID, goalID }).goal.goal),
            )] : []),
            attachmentPromptSection(requireTask(taskID).attachments ?? undefined),
          ].join("\n\n")
          expect(requireTask(taskID).attachments?.map((attachment) => attachment.filename)).toEqual([
            "original-prd.md",
            "followup.txt",
          ])
          expect(
            message.parts.map((part) => ({ type: part.type, text: part.type === "text" ? part.text : undefined })),
          ).toEqual([{ type: "text", text: expectedText }])
          if (delegatedSelection) {
            expect(lineages[0]!.payload.delivery_slice_revision_ids).toEqual([initialGoalID])
            expect(latest.payload.delivery_slice_revision_ids).toEqual([goalID])
            expect(JSON.stringify(workerPrompts[0])).toContain("Preserve original values outside the selected write range")
            expect(JSON.stringify(workerPrompts[1])).toContain(`Selected contract ${goalID}`)
            expect(JSON.parse(reviewedInput)).toEqual(producerInput)
            expect(JSON.parse(reviewedOutput).results).toBeArray()
          }
          expect(descriptor.payload.messageAuthority.control_text_parts).toEqual([
            { part_id: message.parts[0]!.id, text_sha256: controlTextSHA256(expectedText) },
          ])
          expect(JSON.stringify(workerPrompts[1])).toContain(JSON.stringify(expectedText).slice(1, -1))
          const failure = findDispatchSettlementByDispatchID({ taskID, dispatchID: failedDispatchID! })!
          expect(failure.payload.outcome).toEqual({
            kind: "infrastructure_failure",
            operation: `${adapterID}_adapter`,
            message: expect.stringContaining("Injected continuation preparation failure"),
            recovery_authority: {
              occurrence_status: "occurrence_committed",
              dispatch_id: failedDispatchID,
              dispatch_lineage_id: lineages[1]!.artifactID,
            },
            infrastructure_error: {
              source: "engine_artifact",
              artifact_id: expect.any(String),
              catalog_revision: expect.any(Number),
              expected_sha256: expect.any(String),
            },
            worker_turn: {
              descriptor_id: expect.any(String),
              descriptor_hash: expect.any(String),
              input_message_id: expect.any(String),
              current_dispatch_id: lineages[0]!.dispatchID,
            },
          })
          expect(
            findDispatchSettlementByDispatchID({ taskID, dispatchID: latest.dispatchID })!.payload.outcome,
          ).toMatchObject({ kind: selectGoals && !delegatedSelection ? "domain_incomplete" : "terminal_success", session_id: descriptor.sessionID })
          expect(
            Database.use((db) => {
              assertTaskDispatchesSettledInTransaction(db, taskID)
              return "settled"
            }),
          ).toBe("settled")
          Database.close()
          Database.Client()
          expect(findDispatchSettlementByDispatchID({ taskID, dispatchID: failedDispatchID! })).toEqual(failure)
          expect(WorkerTurnDescriptor.latestForSession(descriptor.sessionID)).toEqual(descriptor)
        } finally {
          fault.mockRestore()
          gitCompleteSpy.mockRestore()
          gitPrepareSpy.mockRestore()
          authSpy.mockRestore()
          providerSpy.mockRestore()
          languageSpy.mockRestore()
          modelSpy.mockRestore()
        }
      },
    })
  }, 60_000)
}

for (const collection of [false, true]) {
for (const scenario of ["base", "advanced", "advanced-preparation-failure", "advanced-preparation-recovery", "advanced-authority-recovery"] as const) {
if (collection && scenario === "advanced") continue
const dispatchToolName = collection ? "dispatch_agents" : "dispatch_agent"
const encodeDispatch = (request: any) => JSON.stringify(collection ? { team: [{ name: "worker", target: request.dispatch.target, responsibility: "Interpret one exact request", boundary: "Read-only Task evidence", expected_result: "Durable worker output", depends_on: [] }], dispatches: [request] } : request)
const authorityFailure = scenario === "advanced-authority-recovery"
const recoveryCase = scenario === "advanced-preparation-recovery" || authorityFailure
const preparationFails = scenario === "advanced-preparation-failure" || recoveryCase
const profile = collection ? "light" : scenario === "base" ? "base" : "advanced"
const activeProfile = profile
const targetID = collection ? "light-planner" : profile === "base" ? "base-planner" : "request-interpreter"
test(`${dispatchToolName}: ` + (authorityFailure ? "streamed authority transaction rollback recovers the same reserved Session" : recoveryCase ? "streamed failed preparation continues the reserved worker and settles every dispatch" : preparationFails ? "streamed preparation failure permits the next model decision and durable re-read" : `${scenario} streamed dispatch commits a real child descriptor through the visible Tool boundary`), async () => {
  using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      if (collection) await ExpertSquadPackageManager.importDirectory({ projectDirectory: project.path, sourceDirectory: path.resolve(import.meta.dir, "../../../expert-squads/builtin/light"), installationScope: "project" })
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


      const initialRequest = () => encodeDispatch({
        dispatch: {
          target: targetID,
          work_scope: { kind: "task" },
          turn: {
            kind: "initial",
            workflow_subject: collection ? { kind: "direct" } : {
              kind: "virtual_workflow",
              workflow_id: profile === "base" ? "planner-parallel-delivery" : "greenfield-interface-delivery",
              node_id: targetID,
            },
            use_worktree: false,
            input: profile === "advanced" ? { reason: "Interpret the fictional local webpage request." } : {
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
                    input: initialRequest(),
                  },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ],
              }),
            }
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
                    input: JSON.stringify({ observed_task: observedTask(), reason: "Reconcile the controlled test ingress against its current Task facts." }),
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
          if (part.tool === dispatchToolName && part.state.status === "error") throw new Error(JSON.stringify(part.state.failure))
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
          rootProviderRequests: preparationFails ? 2 : 1,
          providerFacts: Array.from({ length: (preparationFails ? 2 : 1) + capabilityProviderRequests }, () => ({ id: expect.any(String), messageID: assistantIDs[0] })),
          dispatchReceipts: recoveryCase ? ["completed", "completed"] : ["completed"],
          calls: recoveryCase ? [dispatchToolName, dispatchToolName] : preparationFails ? [dispatchToolName, "no_action"] : [dispatchToolName],
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
          rootProviderRequests: recoveryCase ? 3 : 2,
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
                            observed_task: observedTask(),
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
                        observed_task: observedTask(),
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
