import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { Database } from "@/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Hono } from "hono"
import { SessionRoutes } from "@/server/routes/session"
import { GatewayRoutes } from "@/server/routes/gateway"
import { serverErrorResponse } from "@/server/error-handler"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { PanelTool, createPanelUIRequestToolContext } from "@/tool/panel"

afterEach(resetMemoryDatabase)

// Real persisted Task/dispatch/descriptor facts; no model or Task-driver claim.
async function workerHistory() {
  const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), { prompt_profile: { active: "base" } })
  const { workerCapability: cap } = await PromptProfileResolver.resolveWorkerTurnProjection({
    projectDirectory: Instance.directory,
    config,
    agentID: "base-researcher",
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const request = "Preserve TASK-TRACE-731 evidence. Analysis is authorized; deployment is denied."
  const model = { providerID: "fixture", modelID: "metadata-only" }
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Compaction Task authority",
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
      rootDirectory: Instance.directory,
      packageRevisionSHA256: cap.packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const worker = await Session.create({
    kind: cap.identity.sessionKind,
    parentID: root.id,
    title: cap.identity.agentID,
  })
  const initial = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "user",
    author: "orchestrator",
    agent: cap.identity.agentID,
    model,
    time: { created: Date.now() },
  })
  if (initial.role !== "user") throw new Error("Expected worker input")
  const control = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: initial.id,
    type: "text",
    kind: "user_content",
    text: request,
  })
  const dispatchID = Identifier.ascending("artifact")
  const workflow = selectedWorkflowBinding({
    projection: { packageRevision: cap.packageRevision, virtualWorkflows: {} },
    workflowID: null,
  })
  recordTestDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: "call_task_compaction_dispatch",
      targetAgentID: cap.identity.agentID,
      projectedWorkerIdentity: cap.identity,
      workScope: { kind: "task" },
      workflowBinding: workflow,
      workflowNodeID: null,
      adapterInput: { question: request },
    }),
    childSessionID: worker.id,
  })
  const authority = {
    task_id: taskID,
    root_session_id: root.id,
    request_sha256: controlTextSHA256(request),
    initial_user_message_id: initial.id,
    initial_control_text_parts: [{ part_id: control.id, text_sha256: controlTextSHA256(request) }],
  }
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: worker.id,
    payload: {
      identity: cap.identity,
      expertSquadID: cap.expertSquadID,
      packageRevision: cap.packageRevision,
      model: { selection: "explicit", ...model },
      prompt: { systemMode: "complete", systemSha256: controlTextSHA256("Task compaction authority fixture") },
      tools: {
        enabled: cap.builtInToolIDs,
        stageOwned: [],
        stageMaterializers: {},
        coordinationHandoff: "request_orchestrator_decision",
      },
      output: { format: "text", resultMode: "reply" },
      lifecycle: { taskID, workScope: { kind: "task" } },
      messageAuthority: { user_message_id: initial.id, control_text_parts: authority.initial_control_text_parts },
      dispatchTurn: {
        kind: "initial",
        current_dispatch_id: dispatchID,
        workflow_binding: workflow,
        workflow_node_id: null,
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: authority,
      },
    },
  })
  const anchor = await Session.updateMessage({
    ...initial,
    extra: { workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash } },
  })
  async function assistant(text: string, summary: boolean, evidence = false) {
    const info = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: worker.id,
      parentID: anchor.id,
      role: "assistant",
      author: summary ? "compaction" : cap.identity.agentID,
      agent: summary ? "compaction" : cap.identity.agentID,
      summary,
      providerID: model.providerID,
      modelID: model.modelID,
      time: { created: Date.now() },
      path: { cwd: Instance.directory, root: Instance.worktree },
      cost: 0,
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    })
    if (info.role !== "assistant") throw new Error("Expected worker response")
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: worker.id,
      messageID: info.id,
      type: "step-start",
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: worker.id,
      messageID: info.id,
      type: "text",
      text,
    })
    let tool: Message.Part | undefined
    if (evidence)
      tool = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: info.id,
        type: "tool",
        tool: "read",
        callID: "call_task_evidence_731",
        state: {
          status: "completed",
          input: { path: "task-evidence.txt" },
          output: "Evidence TASK-TRACE-731; cursor=17031.",
          title: "Task evidence",
          metadata: { traceID: "TASK-TRACE-731" },
          time: { start: 1, end: 2 },
        },
      })
    const completed = await Session.updateMessage({
      ...info,
      finish: "stop",
      time: { ...info.time, completed: Date.now() },
    })
    if (completed.role !== "assistant") throw new Error("Expected completed worker response")
    return { info: completed, tool }
  }
  const evidence = await assistant("Original exact Task evidence", false, true)
  async function checkpoint(round: number) {
    const summary = await assistant(`Checkpoint ${round}: TASK-TRACE-731; cursor=17031; deployment denied.`, true)
    await Session.publishCompactionCheckpoint({
      info: summary.info,
      part: {
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: summary.info.id,
        type: "compaction",
        auto: true,
        anchor_id: anchor.id,
      },
    })
    return summary.info.id
  }
  return { taskID, root, worker, anchor, control, request, descriptor, evidence: evidence.tool!, checkpoint }
}

test("retains the exact Task authority and source evidence across three worker checkpoints", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await workerHistory()
      for (let round = 1; round <= 3; round++) {
        const summaryID = await source.checkpoint(round)
        Database.close()
        const projected = await Message.filterCompacted(MessageStore.stream(source.worker.id))
        expect(projected.map((m) => m.info.id)).toEqual([source.anchor.id, summaryID])
        expect(projected[0]!.parts).toMatchObject([{ id: source.control.id, text: source.request }])
        expect(taskIDForSession(source.worker.id)).toBe(source.taskID)
        expect(WorkerTurnDescriptor.latestForSession(source.worker.id)).toEqual(source.descriptor)
        const reader = CompactionEvidenceReader.create(await Session.messages({ sessionID: source.worker.id }))
        const recovered = (await reader.execute!(
          { part_id: source.evidence.id, field: "output", offset: 0, limit: 1000 },
          { toolCallId: "check_task_evidence", messages: [], abortSignal: new AbortController().signal, context: {} },
        )) as { output: string }
        expect(JSON.parse(recovered.output)).toMatchObject({
          partID: source.evidence.id,
          callID: "call_task_evidence_731",
          originalRole: "assistant",
          originalAuthor: "base-researcher",
          content: "Evidence TASK-TRACE-731; cursor=17031.",
        })
      }
    },
  })
})

test("reconstructs descriptor-backed Task evidence as independent side history", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await workerHistory()
      await source.checkpoint(1)
      const side = await Session.fork({ sessionID: source.worker.id, purpose: "side-chat" })
      Database.close()
      const projected = await Message.filterCompacted(MessageStore.stream(side.id))
      expect(
        projected.map((m) =>
          m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n"),
        ),
      ).toEqual([source.request, "Checkpoint 1: TASK-TRACE-731; cursor=17031; deployment denied."])
      expect(side).toMatchObject({ kind: "assistant", metadata: { sideChat: { sourceSessionID: source.worker.id } } })
      const reader = CompactionEvidenceReader.create(await Session.messages({ sessionID: side.id }))
      const recovered = (await reader.execute!(
        { part_id: source.evidence.id, field: "metadata", offset: 0, limit: 1000 },
        { toolCallId: "check_side_evidence", messages: [], abortSignal: new AbortController().signal, context: {} },
      )) as { output: string }
      expect(JSON.parse(recovered.output)).toMatchObject({
        requestedSource: {
          sessionID: source.worker.id,
          messageID: source.evidence.messageID,
          partID: source.evidence.id,
        },
        content: JSON.stringify({ part: {}, state: { traceID: "TASK-TRACE-731" } }),
      })
    },
  })
})

for (const kind of ["root", "worker"] as const)
  for (const compacted of [false, true]) {
    test(`returns a Task ownership conflict when copying ${kind} execution identity (checkpoint: ${compacted})`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const source = await workerHistory()
          if (compacted) await source.checkpoint(1)
          const sessionID = source[kind].id
          const before = await Session.messages({ sessionID: source.worker.id })
          expect(before.map((message) => message.info.author)).toEqual(
            compacted ? ["orchestrator", "base-researcher", "compaction"] : ["orchestrator", "base-researcher"],
          )
          const conflict = { name: "TaskBoundSessionForkError", data: { sessionID, taskID: source.taskID } }
          await expect(Session.fork({ sessionID })).rejects.toMatchObject(conflict)
          const app = new Hono().route("/session", SessionRoutes()).route("/gateway", GatewayRoutes())
          app.onError(serverErrorResponse)
          const response = await PersistedProjectContext.provide({
            directory: project.path,
            fn: () =>
              app.fetch(
                new Request(`http://opencorvus.test/session/${sessionID}/fork`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: "{}",
                }),
              ),
          })
          expect({ status: response.status, body: await response.json() }).toMatchObject({
            status: 409,
            body: conflict,
          })
          const gateway = await PersistedProjectContext.provide({
            directory: project.path,
            fn: () =>
              app.fetch(
                new Request("http://opencorvus.test/gateway/control/action", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "fork_session", sessionID }),
                }),
              ),
          })
          expect({ status: gateway.status, body: await gateway.json() }).toMatchObject({ status: 409, body: conflict })
          const panel = await PanelTool.init({ agentID: "panel_ui" })
          const context = createPanelUIRequestToolContext({ surface: "panel", requestID: crypto.randomUUID() })
          await expect(panel.execute({ action: "fork_session", sessionID }, context)).rejects.toMatchObject(conflict)
          Database.close()
          expect(await Session.messages({ sessionID: source.worker.id })).toEqual(before)
          expect(WorkerTurnDescriptor.latestForSession(source.worker.id)).toEqual(source.descriptor)
        },
      })
    })
  }
