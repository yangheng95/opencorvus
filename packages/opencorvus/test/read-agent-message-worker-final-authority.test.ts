import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { createAgentCoordinationRequest, createAgentCoordinationResponse } from "@/engine/agent-coordination"
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
import { SessionStatus } from "@/session/status"
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
for (const mode of ["coordinated", "completed", "error", "aborted", "pending", "no_final"] as const) {
  const reason = mode === "pending" || mode === "no_final" ? "completed" : mode
  test(`qualifies actual ${mode} worker occurrence evidence`, async () => {
    await using project = await memoryProject()
    await using foreignProject = mode === "coordinated" ? await memoryProject() : null
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
        let toolFacts: { part_id: string; call_id: string; tool_name: string; status: string }[] = []
        let partIDs = [text.id]
        let coordinationRequestID: string | undefined
        if (reason === "coordinated") {
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
          coordinationRequestID = coordination.payload.request_id
          partIDs.push(part.id)
          toolFacts.push({
            part_id: part.id,
            call_id: callID,
            tool_name: "request_orchestrator_decision",
            status: "completed",
          })
        }
        await Session.updateMessage({
          ...final,
          finish: reason === "coordinated" ? "tool-calls" : "stop",
          time: { ...final.time, completed: Date.now() },
        })
        const status =
          mode === "pending"
            ? await (async () => {
                await SessionStatus.set(worker.id, { type: "streaming" }, { taskID, inputMessageID: input.id })
                return SessionStatus.getExecution(worker.id, input.id)
              })()
            : await publishSettledSessionTerminalStatus({
                session: worker,
                taskID,
                inputMessageID: input.id,
                status: {
                  type: "terminal",
                  reason,
                  ...(mode === "no_final" ? {} : { final_message_id: final.id }),
                  ...(reason === "error" ? { error: "Fixture worker operation failed after its visible report" } : {}),
                },
              })
        const settlement = coordinationRequestID
          ? recordDispatchSettlement({
              taskID,
              dispatchID,
              outcome: DispatchOutcome.coordination({
                sessionID: worker.id,
                requestID: coordinationRequestID,
                dispatchLineageID: lineage.artifactID,
              }),
            })
          : { qualification: "Physical terminal data contract; dispatch post-Turn settlement not exercised" }
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
            case: `${mode}-final-116`,
            taskID,
            projectID: worker.projectID,
            inputID: input.id,
            finalID: final.id,
            textID: text.id,
            toolFacts,
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
        if (mode === "pending" || mode === "no_final") {
          expect(read).toMatchObject({
            kind: "error",
            name: "TaskEvidenceSourceError",
            typed: true,
            message: `Message ${final.id} is not a physically settled worker final for Task ${taskID}`,
          })
          expect(status).toMatchObject(
            mode === "pending" ? { type: "streaming" } : { type: "terminal", reason: "completed" },
          )
          return
        }
        expect(status).toMatchObject({ type: "terminal", reason, final_message_id: final.id })
        expect(full.parts.map((item) => item.id)).toEqual(partIDs)
        expect(read).toMatchObject({
          kind: "read",
          value: {
            messages: [
              {
                message_id: final.id,
                session_id: worker.id,
                author: cap.identity.agentID,
                text: [body],
                ...(mode === "coordinated" ? { tool_facts: toolFacts } : {}),
              },
            ],
          },
        })
        expect(quotes).toMatchObject({
          kind: "read",
          value: { reports: [{ message_id: final.id, session_id: worker.id, text: { content: body } }] },
        })
        const { orderKey: inputOrderKey, ...inputFields } = input
        const { orderKey: finalOrderKey, ...finalFields } = final
        const wrongInput = await Session.updateMessage({
          ...inputFields,
          id: Identifier.ascending("message"),
          time: { created: Date.now() },
        })
        const wrongFinal = await Session.updateMessage({
          ...finalFields,
          id: Identifier.ascending("message"),
          parentID: wrongInput.id,
          finish: "stop",
          time: { created: Date.now(), completed: Date.now() },
        })
        await expect(
          readAgentMessages(taskID, { sources: [{ kind: "dispatch_result", message_id: wrongFinal.id }] }),
        ).rejects.toMatchObject({
          name: "TaskEvidenceSourceError",
          code: "TASK_EVIDENCE_SOURCE_INVALID",
          message: `Message ${wrongFinal.id} is not a physically settled worker final for Task ${taskID}`,
        })
        if (mode === "coordinated") {
          if (!coordinationRequestID) throw new Error("Expected accepted coordination request")
          const responseCallID = "call_resolve_coordination_116"
          const responseSession = await Session.create({
            kind: "orchestrator",
            parentID: root.id,
            title: "Resolve exact worker coordination",
          })
          const responseReason = "Continue the exact accepted worker after confirming its boundary."
          const responseInput = await Session.updateMessage({
            ...inputFields,
            id: Identifier.ascending("message"),
            sessionID: responseSession.id,
            author: "orchestrator",
            agent: "orchestrator",
            time: { created: Date.now() },
          })
          const responseAssistant = await Session.updateMessage({
            ...finalFields,
            id: Identifier.ascending("message"),
            sessionID: responseSession.id,
            parentID: responseInput.id,
            author: "orchestrator",
            agent: "orchestrator",
            time: { created: Date.now() },
          })
          const responsePart = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: responseSession.id,
            messageID: responseAssistant.id,
            type: "tool",
            callID: responseCallID,
            tool: "respond_agent_coordination",
            state: {
              status: "running",
              input: { decision: "redispatch", request_id: coordinationRequestID, reason: responseReason },
              time: { start: Date.now() },
            },
          })
          const response = await createAgentCoordinationResponse({
            taskID,
            requestID: coordinationRequestID,
            orchestratorSessionID: responseSession.id,
            orchestratorMessageID: responseAssistant.id,
            orchestratorToolCallID: responseCallID,
            orchestratorToolPartID: responsePart.id,
            decision: "redispatch",
            reason: responseReason,
          })
          const nextInput = await Session.updateMessage({
            ...inputFields,
            id: Identifier.ascending("message"),
            time: { created: Date.now() },
          })
          const nextControl = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: worker.id,
            messageID: nextInput.id,
            type: "text",
            kind: "user_content",
            text: "Continue with the confirmed research boundary.",
          })
          if (nextControl.type !== "text") throw new Error("Expected actual continuation control TextPart")
          const nextDispatchID = Identifier.ascending("artifact")
          const nextLineage = recordTestDispatchLineage({
            origin: createDispatchLineageOrigin({
              dispatchID: nextDispatchID,
              taskID,
              orchestratorSessionID: root.id,
              orchestratorMessageID: Identifier.ascending("message"),
              toolPartID: Identifier.ascending("part"),
              toolCallID: "call_dispatch_continuation",
              targetAgentID: cap.identity.agentID,
              projectedWorkerIdentity: cap.identity,
              workScope: { kind: "task" },
              workflowBinding: workflow,
              workflowNodeID: null,
              workflowOccurrenceID: dispatchID,
              continuationOfDispatchID: dispatchID,
              coordinationActionID: response.payload.action_id,
              adapterInput: { question: nextControl.text },
            }),
            childSessionID: worker.id,
          })
          const nextDescriptor = WorkerTurnDescriptor.create({
            sessionID: worker.id,
            payload: {
              ...descriptor.payload,
              messageAuthority: {
                user_message_id: nextInput.id,
                control_text_parts: [{ part_id: nextControl.id, text_sha256: controlTextSHA256(nextControl.text) }],
              },
              dispatchTurn: {
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
                kind: "continuation",
                current_dispatch_id: nextDispatchID,
                source_dispatch_id: dispatchID,
                child_session_id: worker.id,
              },
            },
          })
          const nextBody = "Confirmed boundary: the second accepted input has its own final findings."
          const nextFinal = await Session.updateMessage({
            ...finalFields,
            id: Identifier.ascending("message"),
            parentID: nextInput.id,
            time: { created: Date.now() },
          })
          if (nextFinal.role !== "assistant") throw new Error("Expected actual continuation assistant Message")
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: worker.id,
            messageID: nextFinal.id,
            type: "text",
            text: nextBody,
          })
          await Session.updateMessage({
            ...nextFinal,
            finish: "stop",
            time: { ...nextFinal.time, completed: Date.now() },
          })
          const nextStatus = await publishSettledSessionTerminalStatus({
            session: worker,
            taskID,
            inputMessageID: nextInput.id,
            status: { type: "terminal", reason: "completed", final_message_id: nextFinal.id },
          })
          const both = JSON.parse(
            await readAgentMessages(taskID, {
              sources: [final.id, nextFinal.id].map((message_id) => ({
                kind: "dispatch_result" as const,
                message_id,
              })),
            }),
          )
          console.log(
            JSON.stringify({
              case: "same-session-continuation-116",
              response,
              nextLineage,
              nextDescriptor,
              nextStatus,
              both,
            }),
          )
          expect(both.messages).toMatchObject([
            { message_id: final.id, text: [body], tool_facts: toolFacts },
            { message_id: nextFinal.id, text: [nextBody] },
          ])
          const bothQuotes = await projectSelectedDispatchReportQuotes(
            taskID,
            [final.id, nextFinal.id].map((message_id) => ({
              source: "session_message" as const,
              session_id: worker.id,
              message_id,
            })),
          )
          expect(bothQuotes).toMatchObject({
            reports: [
              { message_id: final.id, text: { content: body } },
              { message_id: nextFinal.id, text: { content: nextBody } },
            ],
          })
          console.log(JSON.stringify({ case: "same-session-quotes-116", bothQuotes }))
          expect(nextDescriptor).toMatchObject({
            sessionID: worker.id,
            payload: {
              messageAuthority: { user_message_id: nextInput.id },
              dispatchTurn: {
                kind: "continuation",
                source_dispatch_id: dispatchID,
                current_dispatch_id: nextDispatchID,
              },
            },
          })
          if (!foreignProject) throw new Error("Expected actual independent foreign Project fixture")
          await Instance.provide({
            directory: foreignProject.path,
            fn: async () => {
              const foreignTaskID = Identifier.ascending("task")
              const foreignRoot = Session.prepareRootNext({
                kind: "root",
                directory: foreignProject.path,
                title: "Foreign reader authority",
                metadata: { taskConfigSnapshot: config },
              })
              const foreignNow = Date.now()
              const foreignTask = persistEstablishedTask({
                taskID: foreignTaskID,
                rootSession: foreignRoot,
                now: foreignNow,
                title: foreignRoot.title,
                request: "Read only this Project's accepted Task evidence.",
                productPillar: "work",
                source: "test",
                metadata: { actor: "user" },
                projectID: Instance.project.id,
                packageRevision: cap.packageRevision,
                executionCapsuleBinding: await prepareTaskProcessBinding({
                  mode: "native",
                  taskID: foreignTaskID,
                  projectID: Instance.project.id,
                  rootDirectory: foreignProject.path,
                  packageRevisionSHA256: cap.packageRevision.packageDigest,
                  timeCreated: foreignNow,
                }),
              })
              const foreignRead = await capture(() =>
                readAgentMessages(foreignTaskID, { sources: [{ kind: "dispatch_result", message_id: final.id }] }),
              )
              console.log(
                JSON.stringify({
                  case: "foreign-project-task-116",
                  foreignTask,
                  foreignProjectID: Instance.project.id,
                  sourceTaskID: taskID,
                  sourceProjectID: worker.projectID,
                  foreignRead,
                }),
              )
              expect(foreignRead).toMatchObject({
                kind: "error",
                name: "TaskEvidenceSourceError",
                typed: true,
                message: `Message ${final.id} is not a physically settled worker final for Task ${foreignTaskID}`,
              })
            },
          })
        }
      },
    })
  }, 30_000)
}
