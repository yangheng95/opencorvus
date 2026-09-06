import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { and, eq, sql } from "drizzle-orm"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import { insertEngineArtifact } from "@/engine/artifact"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "@/engine/interaction-request"
import {
  EngineArtifactTable,
  EngineInteractionOutcomeTable,
  EngineInteractionRequestTable,
  EngineTaskRootIngressTable,
} from "@/engine/engine.sql"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import {
  agentCoordinationQuestionID,
  agentCoordinationQuestionAskedOccurrenceID,
  assertActiveAgentCoordinationActionInTransaction,
  countPendingAgentCoordinationRequests,
  createAgentCoordinationResponse,
  failAgentCoordinationAction,
  findAgentCoordinationAction,
  findAgentCoordinationRequest,
  listPendingAgentCoordinationRequests,
} from "@/engine/agent-coordination"
import { EngineInteraction } from "@/engine/interaction"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { findInteractionByExternal, listInteractions, pendingInteractionCounts, requireTask } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { createOrchestratorInteractionTools } from "@/orchestrator/interaction-tools"
import { createAnalyzeIntentTool } from "@/orchestrator/analyze-intent-tool"
import { controlTextSHA256, taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Question } from "@/question"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { Database } from "@/storage/db"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { EngineService, OperatorSteerTestHooks } from "@/task-api"
import { IntentAnalysisAgent } from "@/intent-analysis/agent"
import z from "zod"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "interaction-recovery-test",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createTaskFixture(title: string) {
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: root,
    now,
    title,
    request: `Exercise ${title}`,
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return { root, taskID, now }
}

async function waitForInteraction(externalID: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const interaction = findInteractionByExternal(externalID)
    if (interaction) return interaction
    await Bun.sleep(25)
  }
  throw new Error(`Interaction ${externalID} was not projected`)
}

async function waitForTaskInteraction(taskID: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const [interaction] = listInteractions(taskID)
    if (interaction) return interaction
    await Bun.sleep(25)
  }
  throw new Error(`Task ${taskID} interaction was not projected`)
}

describe("recovered pending interaction ownership", () => {
  test("commits Interaction request and outcome with their canonical Protocol facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID, now } = await createTaskFixture("atomic interaction publication")
        const externalID = `atomic-interaction-${Identifier.ascending("artifact")}`
        const requestInput = {
          taskID,
          sessionID: root.id,
          externalID,
          requestType: "question" as const,
          title: "Atomic interaction",
          body: "Commit the request and event together",
          payload: { questions: [] },
          eventSource: "test.atomic-interaction",
          eventSummary: "Atomic interaction requested",
          timeCreated: now,
        }
        const footprint = () =>
          Database.use((db) => ({
            requests: db.select().from(EngineInteractionRequestTable).all().length,
            outcomes: db.select().from(EngineInteractionOutcomeTable).all().length,
            events: db
              .select({ type: ProtocolEventTable.type })
              .from(ProtocolEventTable)
              .all()
              .map((row) => row.type)
              .filter((type) => type.startsWith("interaction."))
              .sort(),
          }))
        const before = footprint()

        Database.use((db) =>
          db.run(
            sql.raw(`
              CREATE TEMP TRIGGER arc019_fail_interaction_requested
              BEFORE INSERT ON protocol_event
              WHEN NEW.type = 'interaction.requested'
              BEGIN SELECT RAISE(ABORT, 'injected interaction.requested commit failure'); END
            `),
          ),
        )
        try {
          expect(() => Database.transaction((db) => insertEngineInteractionRequest(db, requestInput))).toThrow(
            "injected interaction.requested commit failure",
          )
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_interaction_requested")))
        }
        expect(footprint()).toEqual(before)

        const interactionID = Database.transaction((db) => insertEngineInteractionRequest(db, requestInput))
        const interaction = findInteractionByExternal(externalID)
        expect(interaction?.id).toBe(interactionID)
        Database.use((db) =>
          db.run(
            sql.raw(`
              CREATE TEMP TRIGGER arc019_fail_interaction_resolved
              BEFORE INSERT ON protocol_event
              WHEN NEW.type = 'interaction.resolved'
              BEGIN SELECT RAISE(ABORT, 'injected interaction.resolved commit failure'); END
            `),
          ),
        )
        try {
          expect(() =>
            Database.transaction((db) =>
              resolveEngineInteractionRequest(db, {
                row: interaction!,
                status: "answered",
                response: { answers: [["accepted"]] },
                eventSource: "test.atomic-interaction",
                timeResolved: now + 1,
              }),
            ),
          ).toThrow("injected interaction.resolved commit failure")
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_interaction_resolved")))
        }
        expect(footprint()).toEqual({
          requests: before.requests + 1,
          outcomes: before.outcomes,
          events: ["interaction.requested"],
        })

        Database.transaction((db) =>
          resolveEngineInteractionRequest(db, {
            row: interaction!,
            status: "answered",
            response: { answers: [["accepted"]] },
            eventSource: "test.atomic-interaction",
            timeResolved: now + 1,
          }),
        )
        expect(footprint()).toEqual({
          requests: before.requests + 1,
          outcomes: before.outcomes + 1,
          events: ["interaction.requested", "interaction.resolved"],
        })
      },
    })
  }, 30_000)

  test("restores the exact ordinary durable Question and retains a durable Permission after restart", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const { root, taskID } = await createTaskFixture("ordinary recovered waiters")
        const questionID = Identifier.ascending("question")
        void Question.ask({
          sessionID: root.id,
          requestID: questionID,
          questions: [{ header: "Recovery", question: "Choose the recovery action", options: [] }],
          expireOnDeadline: false,
        })
        const question = await waitForInteraction(questionID)
        let resolvePermission!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolvePermission = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) =>
          resolvePermission(properties),
        )
        const pendingExecution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: root.id,
            messageID: "msg_recovered_permission",
            toolCallID: "call_recovered_permission",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "write",
            args: { filePath: "recovery.txt", content: "fixture" },
          },
          async () => undefined,
        ).catch((error) => error)
        const request = await asked
        stopAsked()
        const permission = await waitForInteraction(request.id)
        expect([question.status, permission.status]).toEqual(["pending", "pending"])
        return {
          projectID: Instance.project.id,
          taskID,
          questionID,
          questionInteractionID: question.id,
          permissionID: request.id,
          pendingExecution,
        }
      },
    })

    await Instance.disposeAll()
    expect(await created.pendingExecution).toBeInstanceOf(PermissionAuthority.PermissionPausedError)
    expect({
      permission: findInteractionByExternal(created.permissionID)?.status,
      question: findInteractionByExternal(created.questionID)?.status,
    }).toEqual({ permission: "pending", question: "pending" })

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const timeResolved = Date.now()
        expect(
          await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved,
          }),
        ).toEqual({
          abandoned: [],
          retainedRecoverableQuestions: [
            {
              interactionID: created.questionInteractionID,
              externalID: created.questionID,
            },
          ],
          retainedRecoverablePermissions: [
            {
              interactionID: findInteractionByExternal(created.permissionID)!.id,
              externalID: created.permissionID,
            },
          ],
          retainedControlPlaneGates: [],
          unreconciled: [],
        })
        expect((await Question.list()).map((item) => item.id)).toContain(created.questionID)
        expect({
          pendingCount: pendingInteractionCounts([created.taskID]).get(created.taskID) ?? 0,
          secondPass: await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved: timeResolved + 1,
          }),
        }).toEqual({
          pendingCount: 2,
          secondPass: {
            abandoned: [],
            retainedRecoverableQuestions: [
              {
                interactionID: created.questionInteractionID,
                externalID: created.questionID,
              },
            ],
            retainedRecoverablePermissions: [
              {
                interactionID: findInteractionByExternal(created.permissionID)!.id,
                externalID: created.permissionID,
              },
            ],
            retainedControlPlaneGates: [],
            unreconciled: [],
          },
        })
      },
    })
  }, 30_000)

  test("retains an exact durable A2A ask_user lineage and accepts its restored real reply", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("recoverable A2A question")
        const worker = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "A2A question worker",
        })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "A2A question orchestrator",
        })
        const workerInput = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: "test-worker",
          model: { providerID: "test", modelID: "test-model" },
        })
        const workerInputPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: workerInput.id,
          type: "text",
          text: "Ask the operator for the exact recovery choice",
        })
        const dispatchID = Identifier.ascending("artifact")
        const workflowBinding = selectedWorkflowBinding({
          projection: { packageRevision, virtualWorkflows: {} },
          workflowID: null,
        })
        recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: "test-worker",
            projectedWorkerIdentity: {
              agentID: "test-worker",
              baseRole: "delegated-worker",
              sessionKind: "delegated-worker",
              dispatchAdapterID: "delegated_worker",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "a".repeat(64),
            },
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: null,
            adapterInput: { reason: "Recover the exact A2A question" },
          }),
          childSessionID: worker.id,
        })
        const workerDescriptor = WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            identity: {
              agentID: "test-worker",
              baseRole: "delegated-worker",
              sessionKind: "delegated-worker",
              dispatchAdapterID: "delegated_worker",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "a".repeat(64),
            },
            expertSquadID: packageRevision.id,
            packageRevision,
            model: { selection: "explicit", providerID: "test", modelID: "test-model" },
            prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
            tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: workerInput.id,
              control_text_parts: [
                { part_id: workerInputPart.id, text_sha256: controlTextSHA256(workerInputPart.text) },
              ],
            },
            dispatchTurn: {
              kind: "initial",
              current_dispatch_id: dispatchID,
              workflow_binding: workflowBinding,
              workflow_node_id: null,
              workflow_occurrence_id: dispatchID,
              delivery_slice_revision_ids: [],
              evidence_locators: [],
              task_authority: {
                task_id: taskID,
                root_session_id: root.id,
                request_sha256: taskRequestSHA256(requireTask(taskID).request),
                initial_control_text_parts: [],
              },
            },
          },
        })
        const callID = "call_recoverable_a2a_question"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const requestID = Identifier.ascending("artifact")
        const responseReason = "Ask the operator for the exact recovery choice"
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "respond_agent_coordination",
          state: {
            status: "running",
            input: { request_id: requestID, decision: "ask_user", reason: responseReason },
            time: { start: now + 1 },
          },
        })
        const dispatch = async () => "accepted" as const
        const steerInput = {
          request_id: requestID,
          message: "Ask the operator for the exact recovery choice",
        }
        const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
        if (!processRoot) throw new Error("Operator-steer process test requires the repository test runtime")
        const barrier = await createManagedTemporaryDirectory(processRoot, "operator-steer-race-")
        const processWorker = path.join(import.meta.dir, "fixture", "operator-steer-process-worker.ts")
        const children = ["first", "second"].map((label) =>
          Bun.spawn(
            [
              process.execPath,
              `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
              processWorker,
              project.path,
              taskID,
              worker.id,
              requestID,
              steerInput.message,
              barrier,
              label,
            ],
            {
              cwd: path.join(import.meta.dir, ".."),
              env: process.env,
              stdout: "pipe",
              stderr: "pipe",
            },
          ),
        )
        try {
          const deadline = Date.now() + 30_000
          while ((await fs.readdir(barrier)).filter((entry) => entry.endsWith(".ready")).length !== children.length) {
            for (const child of children) {
              if (child.exitCode === null) continue
              const [stdout, stderr] = await Promise.all([
                new Response(child.stdout).text(),
                new Response(child.stderr).text(),
              ])
              throw new Error(`Operator-steer process worker exited before the barrier (${child.exitCode}): ${stderr || stdout}`)
            }
            if (Date.now() >= deadline) throw new Error("Operator-steer process workers did not reach the barrier")
            await Bun.sleep(5)
          }
          await fs.writeFile(path.join(barrier, "go"), "go")
          const raced = await Promise.all(
            children.map(async (child) => {
              const [stdout, stderr, exitCode] = await Promise.all([
                new Response(child.stdout).text(),
                new Response(child.stderr).text(),
                child.exited,
              ])
              expect(exitCode, stderr).toBe(0)
              return JSON.parse(stdout.trim()) as Awaited<ReturnType<typeof EngineService.operatorSteerAgentSession>>
            }),
          )
          expect(raced[0]).toEqual(raced[1])
          expect((await fs.readdir(barrier)).filter((entry) => entry.endsWith(".dispatch"))).toHaveLength(1)
        } finally {
          await removeManagedDirectoryTree(barrier)
        }
        const accepted = await EngineService.operatorSteerAgentSession(taskID, worker.id, steerInput, dispatch)
        expect(await EngineService.operatorSteerAgentSession(taskID, worker.id, steerInput, dispatch)).toEqual(accepted)
        expect(
          Database.use((db) => ({
            requests: db
              .select({ id: EngineArtifactTable.id })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, requestID))
              .all().length,
            requestedEvents: db
              .select({ id: ProtocolEventTable.id })
              .from(ProtocolEventTable)
              .where(
                and(
                  eq(ProtocolEventTable.type, "agent.coordination.requested"),
                  eq(ProtocolEventTable.correlation_id, requestID),
                ),
              )
              .all().length,
            ingresses: db
              .select({ id: EngineTaskRootIngressTable.id })
              .from(EngineTaskRootIngressTable)
              .where(
                and(
                  eq(EngineTaskRootIngressTable.task_id, taskID),
                  eq(EngineTaskRootIngressTable.source, "engine_artifact"),
                  eq(EngineTaskRootIngressTable.source_id, requestID),
                ),
              )
              .all().length,
          })),
        ).toEqual({ requests: 1, requestedEvents: 1, ingresses: 1 })
        await expect(
          EngineService.operatorSteerAgentSession(
            taskID,
            worker.id,
            { ...steerInput, message: "Changed caller request must conflict" },
            dispatch,
          ),
        ).rejects.toMatchObject({ name: "OperatorSteerRequestConflictError" })
        let releaseTarget!: () => void
        let targetReached!: () => void
        const targetBarrier = new Promise<void>((resolve) => (targetReached = resolve))
        const targetRelease = new Promise<void>((resolve) => (releaseTarget = resolve))
        using _targetHook = OperatorSteerTestHooks.replaceAfterTargetPreflight(async () => {
          targetReached()
          await targetRelease
        })
        const coherentRequestID = Identifier.ascending("artifact")
        const coherentAcceptance = EngineService.operatorSteerAgentSession(
          taskID,
          worker.id,
          { request_id: coherentRequestID, message: "Freeze the newest coherent dispatch snapshot" },
          dispatch,
        )
        await targetBarrier
        const nextDispatchID = Identifier.ascending("artifact")
        const nextLineage = recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID: nextDispatchID,
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: "test-worker",
            projectedWorkerIdentity: workerDescriptor.payload.identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: null,
            adapterInput: { reason: "Advance the coherent operator target" },
          }),
          childSessionID: worker.id,
        })
        const nextDescriptor = WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            ...workerDescriptor.payload,
            dispatchTurn: {
              ...workerDescriptor.payload.dispatchTurn!,
              current_dispatch_id: nextDispatchID,
              workflow_occurrence_id: nextDispatchID,
            },
          },
        })
        releaseTarget()
        await coherentAcceptance
        const coherent = findAgentCoordinationRequest({ taskID, requestID: coherentRequestID })
        expect(coherent?.payload).toMatchObject({
          dispatch_lineage_id: nextLineage.artifactID,
          worker_binding: { workerTurnDescriptorID: nextDescriptor.id, workerTurnDescriptorHash: nextDescriptor.hash },
        })
        const original = findAgentCoordinationRequest({ taskID, requestID })
        if (!original) throw new Error("Original operator steer request was not persisted")
        const { status: _status, ...originalFact } = original.payload
        const insertRawOperatorRequest = (overrides: Record<string, unknown>, timeCreated: number) => {
          const rawRequestID = Identifier.ascending("artifact")
          Database.transaction((db) =>
            insertEngineArtifact(db, {
              id: rawRequestID,
              taskID,
              kind: "agent_coordination_request",
              label: "pending",
              payload: {
                ...originalFact,
                request_id: rawRequestID,
                operator_steer_id: rawRequestID,
                created_at: timeCreated,
                ...overrides,
              },
              timeCreated,
            }),
          )
          return rawRequestID
        }
        expect(() => insertRawOperatorRequest({}, 1.5)).toThrow(
          "invalid immutable agent coordination request fact",
        )
        expect(() => insertRawOperatorRequest({}, Number.MAX_SAFE_INTEGER + 1)).toThrow(
          "invalid immutable agent coordination request fact",
        )
        expect(() => insertRawOperatorRequest({ summary: "" }, Date.now())).toThrow(
          "invalid immutable agent coordination request fact",
        )
        expect(() =>
          Database.transaction((db) => {
            const boundaryID = Identifier.ascending("artifact")
            insertEngineArtifact(db, {
              id: boundaryID,
              taskID,
              kind: "agent_coordination_request",
              label: "pending",
              payload: {
                ...originalFact,
                request_id: boundaryID,
                operator_steer_id: boundaryID,
                created_at: Number.MAX_SAFE_INTEGER,
              },
              timeCreated: Number.MAX_SAFE_INTEGER,
            })
            expect(
              db.select({ id: EngineArtifactTable.id }).from(EngineArtifactTable).where(eq(EngineArtifactTable.id, boundaryID)).get(),
            ).toEqual({ id: boundaryID })
            throw new Error("rollback valid coordination boundary fixture")
          }),
        ).toThrow("rollback valid coordination boundary fixture")
        const mixedRequestID = Identifier.ascending("artifact")
        const mixedNow = Date.now()
        expect(() =>
          Database.transaction((db) =>
            insertEngineArtifact(db, {
              id: mixedRequestID,
              taskID,
              kind: "agent_coordination_request",
              label: "pending",
              payload: {
                ...originalFact,
                request_id: mixedRequestID,
                operator_steer_id: mixedRequestID,
                operator_message: "Raw mixed descriptor and lineage must fail",
                details: "Raw mixed descriptor and lineage must fail",
                dispatch_lineage_id: nextLineage.artifactID,
                created_at: mixedNow,
              },
              timeCreated: mixedNow,
            }),
          ),
        ).toThrow("invalid immutable agent coordination request fact")
        const operatorDerivedMutations: Array<Record<string, unknown>> = [
          { details: "Changed scheduler-visible details" },
          { requested_decision: "cancel_worker" },
          { blocking: false },
          { severity: "info" },
          { summary: "Changed scheduler-visible summary" },
          { operator_message: "" },
          { delivery_slice_subject: "" },
          { delivery_slice_subject: 42 },
        ]
        for (const mutation of operatorDerivedMutations) {
          const mutatedRequestID = Identifier.ascending("artifact")
          const mutatedNow = Date.now()
          expect(() =>
            Database.transaction((db) =>
              insertEngineArtifact(db, {
                id: mutatedRequestID,
                taskID,
                kind: "agent_coordination_request",
                label: "pending",
                payload: {
                  ...originalFact,
                  request_id: mutatedRequestID,
                  operator_steer_id: mutatedRequestID,
                  created_at: mutatedNow,
                  ...mutation,
                },
                timeCreated: mutatedNow,
              }),
            ),
          ).toThrow("invalid immutable agent coordination request fact")
        }
        const rawActionCallID = "call_raw_coordination_action_contract"
        const rawActionPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: message.id,
          type: "tool",
          callID: rawActionCallID,
          tool: "respond_agent_coordination",
          state: {
            status: "running",
            input: {
              request_id: coherentRequestID,
              decision: "cancel_worker",
              reason: "Exact raw action reason",
            },
            time: { start: mixedNow },
          },
        })
        const insertRawActionPair = (
          actionOverrides: Record<string, unknown>,
          timing: {
            responseCreatedAt?: number
            responseTimeCreated?: number
            actionCreatedAt?: number
            actionTimeCreated?: number
          } = {},
        ) => {
          const responseID = Identifier.ascending("artifact")
          const rawActionID = Identifier.ascending("artifact")
          const rawNow = Date.now()
          const responseCreatedAt = timing.responseCreatedAt ?? rawNow
          const responseTimeCreated = timing.responseTimeCreated ?? responseCreatedAt
          const actionCreatedAt = timing.actionCreatedAt ?? rawNow
          const actionTimeCreated = timing.actionTimeCreated ?? actionCreatedAt
          Database.transaction((db) => {
            insertEngineArtifact(db, {
              id: responseID,
              taskID,
              kind: "agent_coordination_response",
              label: "cancel_worker",
              payload: {
                response_id: responseID,
                request_id: coherentRequestID,
                frontier_id: coherentRequestID,
                previous_failed_outcome_id: null,
                action_id: rawActionID,
                task_id: taskID,
                execution_epoch: 1,
                orchestrator_session_id: orchestrator.id,
                orchestrator_message_id: message.id,
                orchestrator_tool_call_id: rawActionCallID,
                orchestrator_tool_part_id: rawActionPart.id,
                decision: "cancel_worker",
                reason: "Exact raw action reason",
                created_at: responseCreatedAt,
              },
              timeCreated: responseTimeCreated,
            })
            insertEngineArtifact(db, {
              id: rawActionID,
              taskID,
              kind: "agent_coordination_action",
              label: "cancel_worker",
              payload: {
                action_id: rawActionID,
                request_id: coherentRequestID,
                response_id: responseID,
                task_id: taskID,
                execution_epoch: 1,
                orchestrator_session_id: orchestrator.id,
                orchestrator_message_id: message.id,
                orchestrator_tool_call_id: rawActionCallID,
                orchestrator_tool_part_id: rawActionPart.id,
                action: "cancel_worker",
                decision: "cancel_worker",
                target_session_id: worker.id,
                target_agent: "test-worker",
                reason: "Exact raw action reason",
                created_at: actionCreatedAt,
                ...actionOverrides,
              },
              timeCreated: actionTimeCreated,
            })
          })
        }
        expect(() => insertRawActionPair({}, { responseCreatedAt: 1.5 })).toThrow(
          "invalid immutable agent coordination response fact",
        )
        expect(() => insertRawActionPair({}, { actionCreatedAt: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
          "invalid immutable agent coordination action fact",
        )
        expect(() => insertRawActionPair({ reason: "Changed action reason" })).toThrow(
          "invalid immutable agent coordination action fact",
        )
        expect(() => insertRawActionPair({ delivery_slice_subject: "changed-slice" })).toThrow(
          "invalid immutable agent coordination action fact",
        )
        expect(() => insertRawActionPair({ delivery_slice_subject: 42 })).toThrow(
          "invalid immutable agent coordination action fact",
        )
        await Session.updatePart({
          ...rawActionPart,
          state: {
            status: "completed",
            input: {
              request_id: coherentRequestID,
              decision: "cancel_worker",
              reason: "Exact raw action reason",
            },
            output: "Raw contract checks completed",
            title: "Raw coordination contract checked",
            metadata: {},
            time: { start: mixedNow, end: Date.now() },
          },
        })
        let frontierID = coherentRequestID
        let lastFailedResponseID = ""
        let lastFailedActionID = ""
        let lastFailedOutcomeID = ""
        let lastFailedOutcomeTime = Date.now()
        for (let index = 0; index < 96; index += 1) {
          const responseID = Identifier.ascending("artifact")
          const actionID = Identifier.ascending("artifact")
          const outcomeID = Identifier.ascending("artifact")
          const callID = `call_bounded_coordination_retry_${index}`
          const reason = `Bounded coordination retry ${index}`
          const toolInput = { request_id: coherentRequestID, decision: "cancel_worker", reason }
          const toolStartedAt = Date.now()
          const part = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: orchestrator.id,
            messageID: message.id,
            type: "tool",
            callID,
            tool: "respond_agent_coordination",
            state: {
              status: "running",
              input: toolInput,
              time: { start: toolStartedAt },
            },
          })
          const now = Math.max(Date.now(), lastFailedOutcomeTime + 1)
          Database.transaction((db) => {
            insertEngineArtifact(db, {
              id: responseID,
              taskID,
              kind: "agent_coordination_response",
              label: "cancel_worker",
              payload: {
                response_id: responseID,
                request_id: coherentRequestID,
                frontier_id: frontierID,
                previous_failed_outcome_id: frontierID === coherentRequestID ? null : frontierID,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                orchestrator_session_id: orchestrator.id,
                orchestrator_message_id: message.id,
                orchestrator_tool_call_id: callID,
                orchestrator_tool_part_id: part.id,
                decision: "cancel_worker",
                reason,
                created_at: now,
              },
              timeCreated: now,
            })
            insertEngineArtifact(db, {
              id: actionID,
              taskID,
              kind: "agent_coordination_action",
              label: "cancel_worker",
              payload: {
                action_id: actionID,
                request_id: coherentRequestID,
                response_id: responseID,
                task_id: taskID,
                execution_epoch: 1,
                orchestrator_session_id: orchestrator.id,
                orchestrator_message_id: message.id,
                orchestrator_tool_call_id: callID,
                orchestrator_tool_part_id: part.id,
                action: "cancel_worker",
                decision: "cancel_worker",
                target_session_id: worker.id,
                target_agent: "test-worker",
                reason,
                created_at: now,
              },
              timeCreated: now,
            })
            insertEngineArtifact(db, {
              id: outcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "failed",
              payload: {
                outcome_id: outcomeID,
                request_id: coherentRequestID,
                response_id: responseID,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "cancel_worker",
                status: "failed",
                result: { retry_index: index },
                error: reason,
                created_at: now,
              },
              timeCreated: now,
            })
          })
          await Session.updatePart({
            ...part,
            state: {
              status: "completed",
              input: toolInput,
              output: reason,
              title: "Failed coordination attempt recorded",
              metadata: {},
              time: { start: toolStartedAt, end: Date.now() },
            },
          })
          frontierID = outcomeID
          lastFailedResponseID = responseID
          lastFailedActionID = actionID
          lastFailedOutcomeID = outcomeID
          lastFailedOutcomeTime = now
        }
        const deepPending = listPendingAgentCoordinationRequests(taskID, undefined, { limit: 64 }).find(
          (row) => row.artifactID === coherentRequestID,
        )
        expect(deepPending?.payload).toMatchObject({
          status: "pending",
          last_failed_response_id: lastFailedResponseID,
          last_failed_action_id: lastFailedActionID,
          last_action_error: "Bounded coordination retry 95",
        })
        const frontierRows = Database.Client().all<{ id: string }>(sql`
          SELECT outcome.id FROM engine_artifact outcome
          WHERE outcome.task_id=${taskID}
            AND outcome.kind='agent_coordination_action_outcome'
            AND outcome.id IN (
              SELECT (
                SELECT candidate.id
                FROM engine_artifact candidate INDEXED BY engine_agent_coordination_outcome_request_idx
                WHERE candidate.task_id=${taskID}
                  AND candidate.kind='agent_coordination_action_outcome'
                  AND json_extract(candidate.payload,'$.request_id')=selected.value
                  AND json_extract(candidate.payload,'$.status')='failed'
                ORDER BY candidate.time_created DESC, candidate.id DESC
                LIMIT 1
              )
              FROM json_each(${JSON.stringify([coherentRequestID])}) selected
            )
        `)
        expect(frontierRows).toEqual([{ id: lastFailedOutcomeID }])
        expect(
          Database.Client()
            .all<{ detail: string }>(sql`
              EXPLAIN QUERY PLAN
              SELECT outcome.id FROM engine_artifact outcome
              WHERE outcome.task_id=${taskID}
                AND outcome.kind='agent_coordination_action_outcome'
                AND outcome.id IN (
                  SELECT (
                    SELECT candidate.id
                    FROM engine_artifact candidate INDEXED BY engine_agent_coordination_outcome_request_idx
                    WHERE candidate.task_id=${taskID}
                      AND candidate.kind='agent_coordination_action_outcome'
                      AND json_extract(candidate.payload,'$.request_id')=selected.value
                      AND json_extract(candidate.payload,'$.status')='failed'
                    ORDER BY candidate.time_created DESC, candidate.id DESC
                    LIMIT 1
                  )
                  FROM json_each(${JSON.stringify([coherentRequestID])}) selected
                )
            `)
            .map((row) => row.detail)
            .join("\n"),
        ).toContain("engine_agent_coordination_outcome_request_idx")
        for (let index = 0; index < 65; index += 1) {
          await EngineService.operatorSteerAgentSession(
            taskID,
            worker.id,
            {
              request_id: Identifier.ascending("artifact"),
              message: `Bounded pending coordination page ${index}`,
            },
            dispatch,
          )
        }
        expect({
          total: countPendingAgentCoordinationRequests(taskID),
          page: listPendingAgentCoordinationRequests(taskID, undefined, { limit: 64 }).length,
          sessionPage: listPendingAgentCoordinationRequests(taskID, undefined, {
            sessionID: worker.id,
            limit: 64,
          }).length,
        }).toEqual({ total: 67, page: 64, sessionPage: 64 })
        const pendingPlan = Database.Client().all<{ detail: string }>(sql`
          EXPLAIN QUERY PLAN
          SELECT id FROM engine_artifact
          WHERE task_id=${taskID}
            AND kind='agent_coordination_request'
            AND json_extract(payload,'$.execution_epoch')=${1}
            AND NOT EXISTS (
              SELECT 1 FROM engine_artifact action INDEXED BY engine_agent_coordination_action_request_idx
              WHERE action.task_id=engine_artifact.task_id
                AND action.kind='agent_coordination_action'
                AND json_extract(action.payload,'$.request_id')=engine_artifact.id
                AND NOT EXISTS (
                  SELECT 1 FROM engine_artifact failed INDEXED BY engine_agent_coordination_outcome_action_idx
                  WHERE failed.task_id=action.task_id
                    AND failed.kind='agent_coordination_action_outcome'
                    AND json_extract(failed.payload,'$.action_id')=action.id
                    AND json_extract(failed.payload,'$.status')='failed'
                )
            )
          ORDER BY time_created,id
          LIMIT 64
        `)
        const pendingSessionPlan = Database.Client().all<{ detail: string }>(sql`
          EXPLAIN QUERY PLAN
          SELECT id FROM engine_artifact
          WHERE task_id=${taskID}
            AND kind='agent_coordination_request'
            AND json_extract(payload,'$.execution_epoch')=${1}
            AND json_extract(payload,'$.session_id')=${worker.id}
            AND NOT EXISTS (
              SELECT 1 FROM engine_artifact action INDEXED BY engine_agent_coordination_action_request_idx
              WHERE action.task_id=engine_artifact.task_id
                AND action.kind='agent_coordination_action'
                AND json_extract(action.payload,'$.request_id')=engine_artifact.id
                AND NOT EXISTS (
                  SELECT 1 FROM engine_artifact failed INDEXED BY engine_agent_coordination_outcome_action_idx
                  WHERE failed.task_id=action.task_id
                    AND failed.kind='agent_coordination_action_outcome'
                    AND json_extract(failed.payload,'$.action_id')=action.id
                    AND json_extract(failed.payload,'$.status')='failed'
                )
            )
          ORDER BY time_created,id
          LIMIT 64
        `)
        expect({
          task: pendingPlan.map((entry) => entry.detail),
          session: pendingSessionPlan.map((entry) => entry.detail),
        }).toMatchObject({
          task: expect.arrayContaining([
            expect.stringContaining("engine_agent_coordination_request_epoch_idx"),
            expect.stringContaining("engine_agent_coordination_action_request_idx"),
            expect.stringContaining("engine_agent_coordination_outcome_action_idx"),
          ]),
          session: expect.arrayContaining([
            expect.stringContaining("engine_agent_coordination_request_session_idx"),
            expect.stringContaining("engine_agent_coordination_action_request_idx"),
            expect.stringContaining("engine_agent_coordination_outcome_action_idx"),
          ]),
        })
        const rollbackCallID = "call_bounded_coordination_clock_rollback"
        const rollbackReason = "Causal clock rollback retry"
        const rollbackInput = {
          request_id: coherentRequestID,
          decision: "cancel_worker" as const,
          reason: rollbackReason,
        }
        const rollbackPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: message.id,
          type: "tool",
          callID: rollbackCallID,
          tool: "respond_agent_coordination",
          state: { status: "running", input: rollbackInput, time: { start: Date.now() } },
        })
        expect(() =>
          Database.transaction((db) => {
            const responseID = Identifier.ascending("artifact")
            insertEngineArtifact(db, {
              id: responseID,
              taskID,
              kind: "agent_coordination_response",
              label: "cancel_worker",
              payload: {
                response_id: responseID,
                request_id: coherentRequestID,
                frontier_id: lastFailedOutcomeID,
                previous_failed_outcome_id: lastFailedOutcomeID,
                action_id: Identifier.ascending("artifact"),
                task_id: taskID,
                execution_epoch: 1,
                orchestrator_session_id: orchestrator.id,
                orchestrator_message_id: message.id,
                orchestrator_tool_call_id: rollbackCallID,
                orchestrator_tool_part_id: rollbackPart.id,
                decision: "cancel_worker",
                reason: rollbackReason,
                created_at: lastFailedOutcomeTime,
              },
              timeCreated: lastFailedOutcomeTime,
            })
          }),
        ).toThrow("invalid immutable agent coordination response fact")
        const rollbackResponse = await createAgentCoordinationResponse({
          taskID,
          requestID: coherentRequestID,
          orchestratorSessionID: orchestrator.id,
          orchestratorMessageID: message.id,
          orchestratorToolCallID: rollbackCallID,
          orchestratorToolPartID: rollbackPart.id,
          decision: "cancel_worker",
          reason: rollbackReason,
          now: 1,
        })
        expect(rollbackResponse.timeCreated).toBe(lastFailedOutcomeTime + 1)
        await failAgentCoordinationAction({
          taskID,
          actionID: rollbackResponse.payload.action_id,
          error: rollbackReason,
          now: 1,
        })
        const rollbackOutcome = Database.Client()
          .select()
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, taskID),
              eq(EngineArtifactTable.kind, "agent_coordination_action_outcome"),
              sql`json_extract(${EngineArtifactTable.payload}, '$.action_id')=${rollbackResponse.payload.action_id}`,
            ),
          )
          .get()!
        expect(rollbackOutcome.time_created).toBe(rollbackResponse.timeCreated)
        expect(
          listPendingAgentCoordinationRequests(taskID, undefined, { limit: 64 }).find(
            (row) => row.artifactID === coherentRequestID,
          )?.payload,
        ).toMatchObject({
          status: "pending",
          last_failed_response_id: rollbackResponse.artifactID,
          last_failed_action_id: rollbackResponse.payload.action_id,
          last_action_error: rollbackReason,
        })
        await Session.updatePart({
          ...rollbackPart,
          state: {
            status: "completed",
            input: rollbackInput,
            output: rollbackReason,
            title: "Causal retry recorded",
            metadata: {},
            time: { start: rollbackPart.state.time.start, end: Date.now() },
          },
        })
        const response = await createAgentCoordinationResponse({
          taskID,
          requestID,
          orchestratorSessionID: orchestrator.id,
          orchestratorMessageID: message.id,
          orchestratorToolCallID: callID,
          orchestratorToolPartID: part.id,
          decision: "ask_user",
          reason: responseReason,
          now: now + 1,
        })
        const actionID = response.payload.action_id
        const questionID = agentCoordinationQuestionID(actionID)
        expect(() =>
          Database.use((db) =>
            db.update(EngineArtifactTable).set({ label: "mutated" }).where(eq(EngineArtifactTable.id, requestID)).run(),
          ),
        ).toThrow("immutable")
        const insertFailedRawOutcome = (error: string, createdAt: number) => {
          const outcomeID = Identifier.ascending("artifact")
          Database.transaction((db) =>
            insertEngineArtifact(db, {
              id: outcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "failed",
              payload: {
                outcome_id: outcomeID,
                request_id: requestID,
                response_id: response.payload.response_id,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "ask_user",
                status: "failed",
                error,
                created_at: createdAt,
              },
              timeCreated: createdAt,
            }),
          )
        }
        expect(() => insertFailedRawOutcome("", Date.now())).toThrow(
          "invalid immutable agent coordination action outcome fact",
        )
        expect(() => insertFailedRawOutcome("bounded failure", 1.5)).toThrow(
          "invalid immutable agent coordination action outcome fact",
        )
        const fabricatedOutcomeID = Identifier.ascending("artifact")
        expect(() =>
          Database.transaction((db) =>
            insertEngineArtifact(db, {
              id: fabricatedOutcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "completed",
              payload: {
                outcome_id: fabricatedOutcomeID,
                request_id: requestID,
                response_id: response.payload.response_id,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "ask_user",
                status: "completed",
                result: {
                  question_id: questionID,
                  interaction_id: Identifier.ascending("interaction"),
                  interaction_status: "answered",
                },
                created_at: now + 2,
              },
              timeCreated: now + 2,
            }),
          ),
        ).toThrow("invalid immutable agent coordination action outcome fact")
        const borrowedQuestionID = Identifier.ascending("question")
        const borrowedPromise = Question.ask({
          sessionID: orchestrator.id,
          requestID: borrowedQuestionID,
          questions: [{ header: "Other", question: "This belongs to another occurrence", options: [] }],
          expireOnDeadline: false,
        })
        const borrowedInteraction = await waitForInteraction(borrowedQuestionID)
        await EngineService.replyInteraction(borrowedInteraction.id, { answers: [["other"]], autoReply: false })
        await borrowedPromise
        const borrowedOutcomeID = Identifier.ascending("artifact")
        expect(() =>
          Database.transaction((db) =>
            insertEngineArtifact(db, {
              id: borrowedOutcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "completed",
              payload: {
                outcome_id: borrowedOutcomeID,
                request_id: requestID,
                response_id: response.payload.response_id,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "ask_user",
                status: "completed",
                result: {
                  question_id: borrowedQuestionID,
                  interaction_id: borrowedInteraction.id,
                  interaction_status: "answered",
                },
                created_at: now + 3,
              },
              timeCreated: now + 3,
            }),
          ),
        ).toThrow("invalid immutable agent coordination action outcome fact")
        void Question.ask({
          sessionID: orchestrator.id,
          requestID: questionID,
          tool: { messageID: message.id, callID },
          questions: [
            {
              header: "A2A question",
              question:
                `${responseReason}\n\nWorker request: Operator steer for test-worker session ${worker.id}\n` +
                "Ask the operator for the exact recovery choice",
              options: [],
              custom: true,
            },
          ],
          expireOnDeadline: false,
          acceptanceEffects: (db) =>
            assertActiveAgentCoordinationActionInTransaction(db, {
              taskID,
              actionID,
              executionEpoch: 1,
              action: "ask_user",
            }),
          acceptanceOccurrenceID: agentCoordinationQuestionAskedOccurrenceID(actionID),
        })
        const interaction = await waitForInteraction(questionID)
        const alternateTerminalOccurrence = `bus-occurrence:question-terminal:alternate-${questionID}`
        const alternateInteractionOutcomeID = Identifier.ascending("interaction")
        const alternateActionOutcomeID = Identifier.ascending("artifact")
        const alternateAt = Date.now()
        expect(() =>
          Database.transaction((db) => {
            db.insert(BusPublicationOutboxTable)
              .values({
                occurrence_id: alternateTerminalOccurrence,
                project_id: Instance.project.id,
                directory: project.path,
                event_type: "question.replied",
                properties: {
                  requestID: questionID,
                  sessionID: orchestrator.id,
                  answers: [["alternate-occurrence"]],
                  timeResolved: alternateAt,
                },
                time_created: alternateAt,
              })
              .run()
            db.insert(EngineInteractionOutcomeTable)
              .values({
                id: alternateInteractionOutcomeID,
                interaction_id: interaction.id,
                source_occurrence_id: alternateTerminalOccurrence,
                outcome: null,
                response: null,
                time_created: null,
              })
              .run()
            insertEngineArtifact(db, {
              id: alternateActionOutcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "completed",
              payload: {
                outcome_id: alternateActionOutcomeID,
                request_id: requestID,
                response_id: response.payload.response_id,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "ask_user",
                status: "completed",
                result: {
                  question_id: questionID,
                  interaction_id: interaction.id,
                  interaction_status: "answered",
                },
                created_at: alternateAt,
              },
              timeCreated: alternateAt,
            })
          }),
        ).toThrow("invalid immutable agent coordination action outcome fact")
        const spoofedInteractionOutcomeID = Identifier.ascending("interaction")
        const spoofedActionOutcomeID = Identifier.ascending("artifact")
        const spoofedAt = Date.now()
        expect(() =>
          Database.transaction((db) => {
            db.insert(EngineInteractionOutcomeTable)
              .values({
                id: spoofedInteractionOutcomeID,
                interaction_id: interaction.id,
                source_occurrence_id: null,
                outcome: "answered",
                response: { answers: [["forged-inline-answer"]] },
                time_created: spoofedAt,
              })
              .run()
            insertEngineArtifact(db, {
              id: spoofedActionOutcomeID,
              taskID,
              kind: "agent_coordination_action_outcome",
              label: "completed",
              payload: {
                outcome_id: spoofedActionOutcomeID,
                request_id: requestID,
                response_id: response.payload.response_id,
                action_id: actionID,
                task_id: taskID,
                execution_epoch: 1,
                action: "ask_user",
                status: "completed",
                result: {
                  question_id: questionID,
                  interaction_id: interaction.id,
                  interaction_status: "answered",
                },
                created_at: spoofedAt,
              },
              timeCreated: spoofedAt,
            })
          }),
        ).toThrow("invalid immutable agent coordination action outcome fact")
        expect(
          Database.use((db) =>
            db
              .select()
              .from(BusPublicationOutboxTable)
              .where(eq(BusPublicationOutboxTable.occurrence_id, agentCoordinationQuestionAskedOccurrenceID(actionID)))
              .get(),
          ),
        ).toMatchObject({
          occurrence_id: agentCoordinationQuestionAskedOccurrenceID(actionID),
          event_type: "question.asked",
          properties: {
            id: questionID,
            sessionID: orchestrator.id,
            tool: { messageID: message.id, callID },
          },
        })
        return {
          projectID: Instance.project.id,
          taskID,
          rootSessionID: orchestrator.id,
          actionID,
          questionID,
          interactionID: interaction.id,
          messageID: message.id,
          callID,
        }
      },
    })

    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const receipt = await EngineInteraction.reconcileRecoveredPendingWaiters({
          projectID: created.projectID,
          timeResolved: Date.now(),
        })
        expect(receipt).toEqual({
          abandoned: [],
          retainedRecoverablePermissions: [],
          retainedRecoverableQuestions: [
            {
              interactionID: created.interactionID,
              externalID: created.questionID,
              actionID: created.actionID,
            },
          ],
          retainedControlPlaneGates: [],
          unreconciled: [],
        })
        const recoveredRequest = (await Question.list()).find((item) => item.id === created.questionID)!
        const restored = Question.ask({
          sessionID: recoveredRequest.sessionID,
          requestID: recoveredRequest.id,
          tool: recoveredRequest.tool,
          questions: recoveredRequest.questions,
          ...(recoveredRequest.automatic ? { automatic: recoveredRequest.automatic } : {}),
          expiry: recoveredRequest.expiry ?? null,
          timeCreated: recoveredRequest.timeCreated,
        })
        expect(
          await EngineService.replyInteraction(created.interactionID, {
            answers: [["resume"]],
            autoReply: false,
          }),
        ).toMatchObject({
          id: created.interactionID,
          taskID: created.taskID,
          externalID: created.questionID,
          type: "question",
          status: "answered",
          response: { answers: [["resume"]] },
        })
        expect(await restored).toEqual([["resume"]])
        expect(await SessionLoop.terminalizeRecoveredIncompleteAssistant(created.rootSessionID)).toBe(true)
        const recoveredAction = findAgentCoordinationAction({ taskID: created.taskID, actionID: created.actionID })
        expect(recoveredAction?.payload).toMatchObject({
          status: "completed",
          action: "ask_user",
          result: {
            question_id: created.questionID,
            interaction_id: created.interactionID,
            interaction_status: "answered",
          },
        })
        const recoveredAssistant = (await Session.messages({ sessionID: created.rootSessionID })).find(
          (entry) => entry.info.id === created.messageID,
        )
        const recoveredPart = recoveredAssistant?.parts.find(
          (entry) => entry.type === "tool" && entry.callID === created.callID,
        )
        expect({ finish: recoveredAssistant?.info.role === "assistant" ? recoveredAssistant.info.finish : undefined, part: recoveredPart }).toMatchObject({
          finish: "tool-calls",
          part: { type: "tool", state: { status: "completed" } },
        })
        if (recoveredPart?.type !== "tool" || recoveredPart.state.status !== "completed") {
          throw new Error("Recovered coordination Tool Part did not complete")
        }
        expect(recoveredPart.state.time.end).toBeGreaterThanOrEqual(recoveredAction!.payload.completed_at!)
      },
    })
  }, 90_000)

  test("opens a project holding an activity-reconciliation gate and answers it after recovery", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("activity reconciliation gate")
        // The Task-root control plane inserts this gate directly: its external
        // identity is a durable locator, never a Question ID.
        const externalID = `task-root-activity-reconciliation-v1:${Identifier.ascending("artifact")}`
        const interactionID = Database.transaction((db) =>
          insertEngineInteractionRequest(db, {
            taskID,
            sessionID: root.id,
            externalID,
            requestType: "question",
            title: "外部操作结果待确认",
            body: "外部操作已发出，但进程在结果收据落盘前中断。",
            payload: {
              activity_reconciliation: {
                ingress_id: Identifier.ascending("artifact"),
                request_id: Identifier.ascending("artifact"),
                assistant_message_id: Identifier.ascending("message"),
              },
              questions: [
                {
                  header: "结果确认",
                  question: "是否确认该外部操作的最终结果无法从权威来源确定？",
                  options: [
                    {
                      value: "acknowledge_unknown",
                      label: "确认结果未知",
                      description: "不会重放外部操作。",
                    },
                  ],
                },
              ],
            },
            eventSource: "task-control.activity-reconciliation",
            eventSummary: "External activity outcome requires operator reconciliation",
            timeCreated: now,
          }),
        )
        return { projectID: Instance.project.id, taskID, externalID, interactionID }
      },
    })

    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        // Recovery must neither restore this as a Question nor fail the pass:
        // a poisoned pass is what made project open permanently unreachable.
        expect(
          await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved: Date.now(),
          }),
        ).toEqual({
          abandoned: [],
          retainedRecoverableQuestions: [],
          retainedRecoverablePermissions: [],
          retainedControlPlaneGates: [{ interactionID: created.interactionID, externalID: created.externalID }],
          unreconciled: [],
        })
        expect((await Question.list()).map((item) => item.id)).not.toContain(created.externalID)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        expect(
          await EngineService.replyInteraction(created.interactionID, {
            answers: [["acknowledge_unknown"]],
            autoReply: false,
          }),
        ).toMatchObject({
          id: created.interactionID,
          externalID: created.externalID,
          type: "question",
          status: "answered",
        })
      },
    })
  }, 30_000)

  test("binds an ordinary Orchestrator question to its persisted physical ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("bound Orchestrator question")
        const callID = "call_bound_orchestrator_question"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "question",
          state: {
            status: "running",
            input: { questions: [{ header: "Scope", question: "Choose scope" }] },
            time: { start: now + 1 },
          },
        })
        const questionTool = createOrchestratorInteractionTools({
          taskID,
          agentSessionID: root.id,
          allowedRootMessages: [],
        }).question
        if (!questionTool.execute) throw new Error("question tool is missing its executor")
        const output = questionTool.execute(
          {
            questions: [
              {
                header: "Scope",
                question: "Choose the exact scope",
                options: [{ value: "bounded", label: "Bounded", description: "Use the bounded scope." }],
              },
            ],
          },
          {
            toolCallId: callID,
            messages: [],
            abortSignal: new AbortController().signal,
            opencorvus: {
              sessionID: root.id,
              messageID: message.id,
              toolCallID: callID,
              toolPartID: part.id,
              visibleToolName: "question",
            },
          } as never,
        )
        const interaction = await waitForTaskInteraction(taskID)
        expect(interaction.payload.tool).toEqual({ messageID: message.id, callID })
        await EngineService.replyInteraction(interaction.id, {
          answers: [["bounded"]],
          autoReply: false,
        })
        expect(await output).toBe('User answered:\n"Choose the exact scope" -> Bounded [bounded]')
      },
    })
  }, 30_000)

  test("binds an analyze_intent blocker clarification to the physical dispatch ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("bound intent clarification")
        const callID = "call_bound_intent_clarification"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "dispatch_agent",
          state: {
            status: "running",
            input: { dispatch: { target: "intent-fixture" } },
            time: { start: now + 1 },
          },
        })
        const analysisSession = await Session.create({
          kind: "intent-analysis",
          parentID: root.id,
          title: "Intent analysis fixture",
        })
        const analysisParent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: analysisSession.id,
          role: "user",
          author: "orchestrator",
          time: { created: now + 2 },
          agent: "intent-fixture",
          model: { providerID: "test", modelID: "test-model" },
        })
        const analysisFinal = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: analysisSession.id,
          role: "assistant",
          author: "intent-fixture",
          parentID: analysisParent.id,
          time: { created: now + 3, completed: now + 4 },
          agent: "intent-fixture",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const analyze = spyOn(IntentAnalysisAgent, "analyze").mockImplementation(
          async () =>
            ({
              sessionID: analysisSession.id,
              finalMessageID: analysisFinal.id,
              facts: {
                slots: [],
                missing: ["scope"],
                clarifications: [
                  {
                    header: "Scope",
                    question: "Which scope should the implementation use?",
                    options: [
                      { value: "bounded", label: "Bounded", description: "Use the bounded implementation scope." },
                    ],
                    multiple: false,
                    custom: false,
                    why_needed: "The implementation boundary must be explicit.",
                    priority: "blocker",
                  },
                ],
              },
            }) as never,
        )
        try {
          const analyzeTool = createAnalyzeIntentTool({
            inputSchema: z.object({ reason: z.string(), attachment_refs: z.array(z.string()) }),
            taskID,
            agentSessionID: root.id,
            requireTask: () => requireTask(taskID),
          }).analyze_intent
          if (!analyzeTool.execute) throw new Error("analyze_intent is missing its executor")
          const dispatchSignal = new AbortController().signal
          const output = analyzeTool.execute({ reason: "Resolve the implementation scope", attachment_refs: [] }, {
            agentID: "intent-fixture",
            projectedAgent: {
              identity: { agentID: "intent-fixture" },
              packageRevision,
              virtualWorkflows: {},
              capabilityOwner: "package",
              label: "Intent fixture",
              builtInToolIDs: [],
              projectedToolIDs: [],
            },
            workScope: { kind: "task" },
            existingSessionID: analysisSession.id,
            signal: dispatchSignal,
            dispatch: {
              dispatchID: "dispatch_intent_fixture",
              existingSessionID: analysisSession.id,
              deliverySliceRevisionIDs: [],
              adapterInput: {},
              signal: dispatchSignal,
              turn: {
                kind: "initial",
                current_dispatch_id: "dispatch_intent_fixture",
                workflow_binding: {
                  kind: "direct",
                  package_revision: {
                    scope: packageRevision.scope,
                    project_id: packageRevision.projectID,
                    namespace: packageRevision.namespace,
                    id: packageRevision.id,
                    version: packageRevision.version,
                    package_digest: packageRevision.packageDigest,
                  },
                },
                workflow_node_id: null,
                workflow_occurrence_id: "occurrence_intent_fixture",
                delivery_slice_revision_ids: [],
                evidence_locators: [],
                task_authority: {
                  task_id: taskID,
                  root_session_id: root.id,
                  request_sha256: taskRequestSHA256(requireTask(taskID).request),
                  initial_control_text_parts: [],
                },
              },
              observeSession() {},
              commitSession() {},
            },
            toolOptions: {
              toolCallId: callID,
              opencorvus: {
                sessionID: root.id,
                messageID: message.id,
                toolCallID: callID,
                toolPartID: part.id,
                visibleToolName: "dispatch_agent",
              },
            },
          } as never)
          const interaction = await waitForTaskInteraction(taskID)
          expect(interaction.payload.tool).toEqual({ messageID: message.id, callID })
          await EngineService.replyInteraction(interaction.id, {
            answers: [["bounded"]],
            autoReply: false,
          })
          expect(await output).toEqual({
            kind: "terminal_success",
            session_id: analysisSession.id,
            final_message_id: analysisFinal.id,
          })
        } finally {
          analyze.mockRestore()
        }
      },
    })
  }, 30_000)
})
