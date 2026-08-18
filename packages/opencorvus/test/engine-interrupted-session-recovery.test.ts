import { afterEach, describe, expect, test } from "bun:test"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
import { findTask } from "@/engine/store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import {
  acceptTaskRootIngressInTransaction,
  acquireTaskRootIngressLease,
  projectTaskRootIngress,
} from "@/engine/task-root-fact-store"
import {
  persistTaskRootMessageIngressInTransaction,
  readTaskRootIngressEvidence,
  reconcileTaskControlPlane,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Message } from "@/session/message"
import type { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { ProviderActivityOutcomeTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { publishTaskAgentCancellationStatusesAfterSettlement } from "@/engine/task-agent-lifecycle"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "recovery-test",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/**
 * A Task-root Turn killed with a Provider call in flight.
 *
 * The kill is modelled by what it actually leaves behind rather than by
 * signalling a real process: a started `provider_activity_request` with no
 * terminal receipt, an assistant Message that never completed, and an
 * activation lease whose owner is gone and whose expiry has passed.
 */
async function persistCrashedProviderActivityTask(input: { projectPath: string; label: string }) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title: `${input.label} root` })
  const orchestrator = await Session.create({
    kind: "orchestrator",
    parentID: root.id,
    title: `${input.label} scheduler`,
  })
  const startedAt = Date.now() - 10_000
  const ingress = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: input.label,
        request: "Recover a Provider call killed before its terminal receipt",
        time_created: startedAt,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: startedAt, source: `test.${input.label}` })
    return acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: `${input.label}-source`,
      inlinePayload: { note: "provider killed mid-call" },
      semanticTurnLimit: 1,
      activationLimit: 3,
      now: startedAt + 1,
    })
  })
  const lease = acquireTaskRootIngressLease({
    ingressID: ingress.id,
    ownerOccurrenceID: `${input.label}-dead-owner`,
    now: startedAt + 2,
    leaseMilliseconds: 60_000,
  })
  if (!lease.acquired) throw new Error("Expected a Task-root activation lease fixture")
  const control = currentOrchestratorControlMessage({ taskCreation: { taskID } }, taskID, ingress.id, ingress.id)
  if (!control) throw new Error("Expected an initial Task-root control occurrence")
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: orchestrator.id,
      role: "user",
      author: "orchestrator",
      time: { created: startedAt + 3 },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: orchestrator.id,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      } satisfies Message.TextPart,
    ],
  })
  const assistantID = Identifier.deterministic("message", `task-root-assistant-v1\0${control.messageID}`)
  await Session.updateMessage({
    id: assistantID,
    sessionID: orchestrator.id,
    parentID: control.messageID,
    role: "assistant",
    author: "orchestrator",
    time: { created: startedAt + 4 },
    agent: "orchestrator",
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    activationID: lease.activationID,
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: orchestrator.id,
    messageID: assistantID,
    type: "step-finish",
    reason: "stop",
    cost: 0,
    tokens: { input: 1, output: 1, reasoning: 0, total: 2, cache: { read: 0, write: 0 } },
  })
  const providerRequestID = Identifier.ascending("part")
  recordProviderActivityEvent(assistantID, {
    type: "started",
    id: providerRequestID,
    ts: startedAt + 5,
    sessionID: orchestrator.id,
    provider: "openai",
    model: "gpt-5.6-terra",
  })
  // No terminal receipt: this is the exact instant the process died.
  Database.use((db) =>
    db
      .update(EngineControlActivationLeaseTable)
      .set({ expires_at: startedAt + 1_000 })
      .where(eq(EngineControlActivationLeaseTable.id, lease.activationID))
      .run(),
  )
  return { taskID, root, orchestrator, ingress, lease, assistantID, providerRequestID }
}

describe("interrupted Provider activity recovery", () => {
  test("settles a Provider request orphaned by a killed process and keeps the Task able to receive Messages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await persistCrashedProviderActivityTask({
          projectPath: project.path,
          label: "crashed-provider-activity",
        })
        const activatedWakeIDs: string[] = []
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-crashed-provider")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            if (!wakeID) throw new Error("Missing exact activation identity")
            activatedWakeIDs.push(wakeID)
          },
        })

        // The operator retries after the restart. This is the reported failing
        // sequence in its original order: the Message and its ingress commit,
        // and the wake that follows them is what used to throw.
        const task = findTask(fixture.taskID)
        if (!task) throw new Error(`Missing recovery test Task ${fixture.taskID}`)
        const operator = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: fixture.root.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
          extra: {
            task_root_message: {
              protocol: "task-root-message",
              taskID: fixture.taskID,
              kind: "operator",
              source: "test.operator-retry",
            } satisfies TaskRootMessageProvenance,
          },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: fixture.root.id,
          messageID: operator.id,
          type: "text",
          text: "Authorize the Expert Squad evolution",
        })
        const operatorIngressID = Database.immediateTransaction((db) =>
          persistTaskRootMessageIngressInTransaction(db, {
            task,
            messageID: operator.id,
            kind: "operator",
            now: Date.now(),
          }),
        )

        // Before the fix this threw `Task-root assistant … cannot settle
        // before every accepted activity has an exact outcome`, and every
        // later scan re-entered the same refusal because the assistant never
        // reached a completed time.
        await reconcileTaskControlPlane(fixture.taskID)

        const assistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        const outcomes = Database.use((db) =>
          db
            .select()
            .from(ProviderActivityOutcomeTable)
            .where(eq(ProviderActivityOutcomeTable.request_id, fixture.providerRequestID))
            .all(),
        )
        const evidence = Database.use((db) => readTaskRootIngressEvidence(db, fixture.ingress))
        expect({
          completed: assistant?.info.time.completed,
          finish: assistant?.info.role === "assistant" ? assistant.info.finish : undefined,
          outcomes: outcomes.map((outcome) => outcome.data),
          evidenceOutcomes: evidence.activityOutcomes.map((outcome) => outcome.outcome),
          crashedIngress: projectTaskRootIngress(fixture.ingress.id, Date.now(), readTaskRootIngressEvidence),
          // Recovery settles the abandoned Turn; it never replays it. The only
          // activation belongs to the operator's own ingress, which is the
          // whole point: the Task accepts Messages again.
          activatedWakeIDs,
        }).toEqual({
          completed: expect.any(Number),
          finish: "error",
          outcomes: [
            {
              outcome: "aborted",
              error_class: "external_abort",
              error: {
                name: "ProcessExecutionInterruptedError",
                message: expect.stringContaining(fixture.assistantID),
              },
            },
          ],
          evidenceOutcomes: ["failed"],
          crashedIngress: { state: "exhausted", reason: "semantic_limit" },
          activatedWakeIDs: [operatorIngressID],
        })
      },
    })
  }, 60_000)
})

describe("interrupted prepared Worker Turn recovery", () => {
  test("classifies a first descriptor without a prior lifecycle as prepared and terminalizes its real input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Interrupted recovery root" })
        const worker = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Interrupted prepared worker",
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Interrupted prepared worker",
          request: "Recover the exact prepared Worker Turn",
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
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "recovery-worker",
          time: { created: now + 1 },
          agent: "recovery-worker",
          model: { providerID: "test", modelID: "recovery-model" },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: message.id,
          type: "text",
          text: "Execute the prepared recovery turn",
        })
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            identity: {
              agentID: "recovery-worker",
              baseRole: "delegated-worker",
              sessionKind: "delegated-worker",
              dispatchAdapterID: "delegated_worker",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "b".repeat(64),
            },
            expertSquadID: packageRevision.id,
            packageRevision,
            model: { selection: "explicit", providerID: "test", modelID: "recovery-model" },
            prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
            tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: message.id,
              control_text_parts: [{ part_id: part.id, text_sha256: controlTextSHA256(part.text) }],
            },
          },
        })

        // `listInterruptedSessionEvidence` was removed in 627146cc when execution state
        // converged on immutable facts, and its two remaining call sites were left behind —
        // a stale import here made this whole file unloadable, hiding the coverage below.
        // The projection it asserted has no successor; what the test is named for, that a
        // prepared descriptor without a prior lifecycle event gets terminalized, is asserted
        // against the surviving APIs immediately after this point.

        const task = findTask(taskID)
        if (!task) throw new Error(`Missing recovery test Task ${taskID}`)
        expect(
          await publishTaskAgentCancellationStatusesAfterSettlement({
            task,
            reason: "Previous backend process ended before the first lifecycle event",
          }),
        ).toEqual([worker.id])
        expect(
          listTaskConversationAgentSessions(taskID).find((session) => session.sessionID === worker.id),
        ).toMatchObject({
          latestStatus: {
            type: "terminal",
            reason: "aborted",
            error: "Previous backend process ended before the first lifecycle event",
          },
          latestInputMessageID: message.id,
        })

        const continuationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "recovery-worker",
          time: { created: now + 2 },
          agent: "recovery-worker",
          model: { providerID: "test", modelID: "recovery-model" },
        })
        const continuationPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: continuationMessage.id,
          type: "text",
          text: "Execute the continuation occurrence",
        })
        WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            ...descriptor.payload,
            messageAuthority: {
              user_message_id: continuationMessage.id,
              control_text_parts: [
                { part_id: continuationPart.id, text_sha256: controlTextSHA256(continuationPart.text) },
              ],
            },
          },
        })
        expect(
          await publishTaskAgentCancellationStatusesAfterSettlement({
            task,
            reason: "Cancel the exact continuation occurrence",
          }),
        ).toEqual([worker.id])
        expect(
          listTaskConversationAgentSessions(taskID).find((session) => session.sessionID === worker.id),
        ).toMatchObject({
          latestStatus: {
            type: "terminal",
            reason: "aborted",
            error: "Cancel the exact continuation occurrence",
          },
          latestInputMessageID: continuationMessage.id,
        })
      },
    })
  }, 30_000)
})
