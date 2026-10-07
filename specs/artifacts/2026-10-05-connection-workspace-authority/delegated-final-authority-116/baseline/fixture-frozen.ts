import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { createAgentCoordinationRequest } from "@/engine/agent-coordination"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { withHandoffDrainToolResultControl } from "@/session/tool-result-control"
import {
  readAgentMessages,
  projectSelectedDispatchReportQuotes,
  TaskEvidenceSourceError,
} from "@/tool/read-agent-message"
import { persistEstablishedTask } from "./fixture/engine-task"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Real backend data primitives; no Provider, SDK model, native worker or UI qualification.
test("reads a physically coordinated worker final and its canonical Tool facts", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
        prompt_profile: { active: "base" },
      })
      const { workerCapability: cap } = await PromptProfileResolver.resolveWorkerTurnProjection({
        projectDirectory: project.path,
        config,
        agentID: "base-researcher",
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now(),
        request = "Read the assigned public sources independently."
      const root = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Worker final authority",
        metadata: { taskConfigSnapshot: config },
      })
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: root.title,
        request,
        productPillar: "work",
        source: "test",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision: cap.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: cap.packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const worker = await Session.create({
        kind: cap.identity.sessionKind,
        parentID: root.id,
        title: cap.identity.agentID,
      })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: worker.id,
        role: "user",
        author: "orchestrator",
        agent: cap.identity.agentID,
        model: { providerID: "fixture", modelID: "metadata-only" },
        time: { created: Date.now() },
      })
      const control = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: input.id,
        type: "text",
        kind: "user_content",
        text: request,
      })
      if (control.type !== "text") throw new Error("Expected actual control TextPart")
      const dispatchID = Identifier.ascending("artifact")
      const workflow = selectedWorkflowBinding({
        projection: { packageRevision: cap.packageRevision, virtualWorkflows: {} },
        workflowID: null,
      })
      const lineage = recordTestDispatchLineage({
        origin: createDispatchLineageOrigin({
          dispatchID,
          taskID,
          orchestratorSessionID: root.id,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: "call_dispatch_baseline",
          targetAgentID: cap.identity.agentID,
          projectedWorkerIdentity: cap.identity,
          workScope: { kind: "task" },
          workflowBinding: workflow,
          workflowNodeID: null,
          adapterInput: { question: request },
        }),
        childSessionID: worker.id,
      })
      const descriptor = WorkerTurnDescriptor.create({
        sessionID: worker.id,
        payload: {
          identity: cap.identity,
          expertSquadID: cap.expertSquadID,
          packageRevision: cap.packageRevision,
          model: { selection: "explicit", providerID: "fixture", modelID: "metadata-only" },
          prompt: { systemMode: "complete", systemSha256: controlTextSHA256("Worker final backend fixture") },
          tools: {
            enabled: cap.builtInToolIDs,
            stageOwned: [],
            stageMaterializers: {},
            coordinationHandoff: "request_orchestrator_decision",
          },
          output: { format: "text", resultMode: "reply" },
          lifecycle: { taskID, workScope: { kind: "task" } },
          messageAuthority: {
            user_message_id: input.id,
            control_text_parts: [{ part_id: control.id, text_sha256: controlTextSHA256(control.text) }],
          },
          dispatchTurn: {
            kind: "initial",
            current_dispatch_id: dispatchID,
            workflow_binding: workflow,
            workflow_node_id: null,
            workflow_occurrence_id: dispatchID,
            delivery_slice_revision_ids: [],
            evidence_locators: [],
            task_authority: {
              task_id: taskID,
              root_session_id: root.id,
              request_sha256: controlTextSHA256(request),
              initial_control_text_parts: [],
            },
          },
        },
      })
      const final = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: worker.id,
        parentID: input.id,
        role: "assistant",
        author: cap.identity.agentID,
        agent: cap.identity.agentID,
        providerID: "fixture",
        modelID: "metadata-only",
        time: { created: Date.now() },
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      if (final.role !== "assistant") throw new Error("Expected actual assistant final Message")
      const body = "The sources are readable; confirm the assigned research boundary before continuing."
      const text = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: final.id,
        type: "text",
        text: body,
      })
      const toolInput = {
        summary: "Confirm the assigned boundary",
        details: body,
        blocking: true,
        requested_decision: "Confirm the exact research boundary",
        severity: "blocked" as const,
      }
      const callID = "call_coordinate_baseline"
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: final.id,
        type: "tool",
        tool: "request_orchestrator_decision",
        callID,
        state: { status: "running", input: toolInput, time: { start: Date.now() } },
      })
      if (part.type !== "tool" || part.state.status !== "running")
        throw new Error("Expected actual running coordination Tool")
      const coordination = await createAgentCoordinationRequest({
        taskID,
        sessionID: worker.id,
        agent: cap.identity.agentID,
        workerBinding: {
          identity: cap.identity,
          expertSquadID: cap.expertSquadID,
          workerTurnDescriptorID: descriptor.id,
          workerTurnDescriptorHash: descriptor.hash,
        },
        messageID: final.id,
        callID,
        summary: toolInput.summary,
        details: body,
        blocking: true,
        requestedDecision: toolInput.requested_decision,
        toolInput,
        severity: "blocked",
      })
      const output = JSON.stringify({ requestID: coordination.payload.request_id, summary: toolInput.summary })
      await Session.updatePart({
        ...part,
        state: {
          status: "completed",
          input: toolInput,
          output,
          title: "Coordination recorded",
          metadata: withHandoffDrainToolResultControl(
            {},
            { requestID: coordination.payload.request_id, dispatchLineageID: lineage.artifactID },
          ),
          time: { start: part.state.time.start, end: Date.now() },
        },
      })
      await Session.updateMessage({ ...final, finish: "tool-calls", time: { ...final.time, completed: Date.now() } })
      const status = await publishSettledSessionTerminalStatus({
        session: worker,
        taskID,
        inputMessageID: input.id,
        status: { type: "terminal", reason: "coordinated", final_message_id: final.id },
      })
      const settlement = recordDispatchSettlement({
        taskID,
        dispatchID,
        outcome: DispatchOutcome.coordination({
          sessionID: worker.id,
          requestID: coordination.payload.request_id,
          dispatchLineageID: lineage.artifactID,
        }),
      })
      const full = await MessageStore.get({ sessionID: worker.id, messageID: final.id })
      const event = ProtocolStore.latestSessionOccurrenceEvent(worker.id, "agent.execution.lifecycle", input.id)
      const capture = async (run: () => Promise<unknown>) => {
        try {
          return { kind: "read", value: await run() }
        } catch (error) {
          return {
            kind: "error",
            name: error instanceof Error ? error.name : "unknown",
            message: error instanceof Error ? error.message : String(error),
            typed: error instanceof TaskEvidenceSourceError,
          }
        }
      }
      const read = await capture(async () =>
        JSON.parse(await readAgentMessages(taskID, { sources: [{ kind: "dispatch_result", message_id: final.id }] })),
      )
      const quotes = await capture(() =>
        projectSelectedDispatchReportQuotes(taskID, [
          { source: "session_message", session_id: worker.id, message_id: final.id },
        ]),
      )
      console.log(
        JSON.stringify({
          case: "coordinated-final-116",
          taskID,
          projectID: worker.projectID,
          inputID: input.id,
          finalID: final.id,
          textID: text.id,
          toolID: part.id,
          descriptor,
          lineage,
          status,
          event,
          settlement,
          full,
          read,
          quotes,
        }),
      )
      expect(status).toMatchObject({ type: "terminal", reason: "coordinated", final_message_id: final.id })
      expect(full.parts.map((item) => item.id)).toEqual([text.id, part.id])
      expect(read).toMatchObject({
        kind: "read",
        value: {
          messages: [
            {
              message_id: final.id,
              session_id: worker.id,
              author: cap.identity.agentID,
              text: [body],
              tool_facts: [
                { part_id: part.id, call_id: callID, tool_name: "request_orchestrator_decision", status: "completed" },
              ],
            },
          ],
        },
      })
      expect(quotes).toMatchObject({
        kind: "read",
        value: { reports: [{ message_id: final.id, session_id: worker.id, text: { content: body } }] },
      })
    },
  })
}, 30_000)
