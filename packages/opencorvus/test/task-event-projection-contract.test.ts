import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { requireTask } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { taskExecutionProjectionForTask } from "@/orchestrator/task-event"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { protocolTaskEvent } from "@/server/routes/orchestrator"
import { protocolSessionEvent } from "@/server/routes/session"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Database, eq } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { controlTextSHA256, taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("projects normalized Part ownership and Protocol envelope identity into conversation transport", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const now = Date.now()
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Envelope projection root" })
      const child = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Envelope projection child",
      })
      Database.transaction((db) => db.insert(EngineTaskTable).values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: "Envelope projection",
        request: "Project one normalized conversation",
        metadata: { actor: "user" },
        time_created: now,
      }).run())
      const message = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: child.id,
        role: "user",
        author: "orchestrator",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "projection" },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: child.id,
        messageID: message.id,
        type: "text",
        text: "Normalized Part is reached through its Message owner.",
      })
      const persistedMessage = await MessageStore.get({ sessionID: child.id, messageID: message.id })

      const event = Database.transaction((db) => ProtocolStore.appendEventInTransaction({
        kind: "event",
        type: "agent.execution.lifecycle",
        aggregate: "task",
        aggregate_id: taskID,
        task_id: null,
        session_id: child.id,
        source: "test.envelope-projection",
        emitted_at: now + 10,
        order_key: timelineOrderKey({ domain: "session", time: message.time.created, id: message.id }),
        payload: {
          inputMessageID: message.id,
          status: { type: "terminal", reason: "completed" },
        },
      }))
      const durable = ProtocolStore.listTaskEvents(taskID).find((candidate) => candidate.id === event.id)!
      const persistedPayload = Database.use((db) => db
        .select({ payload: ProtocolEventTable.payload })
        .from(ProtocolEventTable)
        .where(eq(ProtocolEventTable.id, event.id))
        .get()?.payload)
      const execution = taskExecutionProjectionForTask(taskID).occurrences.find(
        (candidate) => candidate.inputMessageID === message.id,
      )

      expect({
        persistedPart: persistedMessage.parts.find((candidate) => candidate.id === part.id),
        taskEvent: protocolTaskEvent(durable),
        sessionEvent: protocolSessionEvent(durable),
        execution,
        persistedPayload,
      }).toMatchObject({
        persistedPart: {
          id: part.id,
          sessionID: child.id,
          messageID: message.id,
          text: "Normalized Part is reached through its Message owner.",
        },
        taskEvent: {
          event_id: event.id,
          task_id: taskID,
          session_id: child.id,
          payload: {
            sessionID: child.id,
            agentID: "orchestrator",
            channel: "orchestrator",
            resolvedRole: "orchestrator",
            parentSessionID: root.id,
            inputMessageID: message.id,
            status: { type: "terminal", reason: "completed" },
          },
        },
        sessionEvent: {
          event_id: event.id,
          session_id: child.id,
          payload: {
            sessionID: child.id,
            agentID: "orchestrator",
            channel: "orchestrator",
            resolvedRole: "orchestrator",
            parentSessionID: root.id,
            inputMessageID: message.id,
            status: { type: "terminal", reason: "completed" },
          },
        },
        execution: {
          sessionID: child.id,
          inputMessageID: message.id,
          agent: "orchestrator",
          kind: "orchestrator",
          latest: {
            eventID: event.id,
            status: { type: "terminal", reason: "completed" },
          },
        },
        persistedPayload: {
          inputMessageID: message.id,
          status: { type: "terminal", reason: "completed" },
        },
      })
    },
  })
})

test("projects each reused Session lifecycle event from its exact occurrence descriptor", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const now = Date.now()
      const taskID = Identifier.ascending("task")
      const packageRevision = {
        scope: "built_in" as const,
        projectID: null,
        namespace: "test",
        id: "test-package",
        version: "1",
        packageDigest: "a".repeat(64),
      }
      const workflowBinding: SelectedWorkflowBinding = {
        kind: "direct",
        package_revision: {
          scope: "built_in",
          project_id: null,
          namespace: packageRevision.namespace,
          id: packageRevision.id,
          version: packageRevision.version,
          package_digest: packageRevision.packageDigest,
        },
      }
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Exact lifecycle occurrence root",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      persistTask({
        taskID,
        rootSession: root,
        now,
        title: "Exact lifecycle occurrence",
        request: "Keep occurrence routing exact",
        productPillar: "code",
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
      const worker = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Reused worker Session" })
      const descriptorPayload = (
        agentID: string,
        inputMessageID: string,
        control: { id: string; text: string },
        dispatchID: string,
      ): WorkerTurnDescriptor.Payload => ({
        identity: {
          agentID,
          baseRole: "delegated-worker",
          sessionKind: "delegated-worker",
          dispatchAdapterID: "delegated_worker",
          runtimeTemplateABIVersion: 1,
          dispatchAdapterABIVersion: 1,
          projectionHash: (agentID === "occurrence-one" ? "1" : "2").repeat(64),
        },
        expertSquadID: "test-package",
        packageRevision,
        model: { selection: "explicit", providerID: "test", modelID: "projection" },
        prompt: { systemMode: "complete", systemSha256: "b".repeat(64) },
        tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
        output: { format: "text", resultMode: "reply" },
        lifecycle: { taskID, workScope: { kind: "task" } },
        messageAuthority: {
          user_message_id: inputMessageID,
          control_text_parts: [{ part_id: control.id, text_sha256: controlTextSHA256(control.text) }],
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
      })
      const appendOccurrence = async (agentID: string, offset: number) => {
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: agentID,
          time: { created: now + offset },
          agent: agentID,
          model: { providerID: "test", modelID: "projection" },
        })
        const control = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: message.id,
          type: "text",
          text: `Execute ${agentID}`,
          kind: "control",
          source: "system",
        })
        const dispatchID = Identifier.ascending("artifact")
        const identity = descriptorPayload(agentID, message.id, control, dispatchID).identity
        recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: agentID,
            projectedWorkerIdentity: identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: null,
            adapterInput: { reason: `Execute ${agentID}` },
          }),
          childSessionID: worker.id,
        })
        WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: descriptorPayload(agentID, message.id, control, dispatchID),
        })
        return Database.transaction((db) => ProtocolStore.appendEventInTransaction({
          kind: "event",
          type: "agent.execution.lifecycle",
          aggregate: "task",
          aggregate_id: taskID,
          task_id: null,
          session_id: worker.id,
          source: "test.exact-lifecycle-occurrence",
          emitted_at: now + offset + 1,
          order_key: timelineOrderKey({ domain: "session", time: message.time.created, id: message.id }),
          payload: { inputMessageID: message.id, status: { type: "terminal", reason: "completed" } },
        }))
      }
      const first = await appendOccurrence("occurrence-one", 10)
      const second = await appendOccurrence("occurrence-two", 20)
      const events = ProtocolStore.listTaskEvents(taskID)

      expect(events.filter((event) => event.id === first.id || event.id === second.id).map((event) => ({
        eventID: event.id,
        sessionID: event.payload?.sessionID,
        agentID: event.payload?.agentID,
        resolvedRole: event.payload?.resolvedRole,
      }))).toEqual([
        { eventID: first.id, sessionID: worker.id, agentID: "occurrence-one", resolvedRole: "occurrence-one" },
        { eventID: second.id, sessionID: worker.id, agentID: "occurrence-two", resolvedRole: "occurrence-two" },
      ])

      const missingDescriptorMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: worker.id,
        role: "user",
        author: "missing-occurrence",
        time: { created: now + 30 },
        agent: "missing-occurrence",
        model: { providerID: "test", modelID: "projection" },
      })
      expect(() => Database.transaction((db) => ProtocolStore.appendEventInTransaction({
        kind: "event",
        type: "agent.execution.lifecycle",
        aggregate: "task",
        aggregate_id: taskID,
        task_id: null,
        session_id: worker.id,
        source: "test.missing-lifecycle-occurrence",
        emitted_at: now + 31,
        order_key: timelineOrderKey({
          domain: "session",
          time: missingDescriptorMessage.time.created,
          id: missingDescriptorMessage.id,
        }),
        payload: {
          inputMessageID: missingDescriptorMessage.id,
          status: { type: "terminal", reason: "completed" },
        },
      }))).toThrow(`Worker session ${worker.id} (delegated-worker) is missing projected agent evidence`)
    },
  })
})
