import { afterEach, describe, expect, test } from "bun:test"
import {
  createDispatchLineageOrigin,
  listDispatchLineage,
  resolveDispatchContinuationSourceID,
} from "@/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "occurrence-test",
  version: "2026.08.09.1",
  packageDigest: "d".repeat(64),
}

const workflowBinding: SelectedWorkflowBinding = {
  kind: "virtual_workflow",
  workflow_id: "occurrence-workflow",
  package_revision: {
    scope: "built_in",
    project_id: null,
    namespace: packageRevision.namespace,
    id: packageRevision.id,
    version: packageRevision.version,
    package_digest: packageRevision.packageDigest,
  },
  nodes: [
    { node_id: "fundamentals", agent_id: "occurrence-worker", depends_on: [] },
    { node_id: "valuation", agent_id: "occurrence-worker", depends_on: [] },
  ],
}

const projectedWorkerIdentity = {
  agentID: "occurrence-worker",
  baseRole: "delegated-worker" as const,
  sessionKind: "delegated-worker" as const,
  dispatchAdapterID: "delegated_worker" as const,
  runtimeTemplateABIVersion: 1 as const,
  dispatchAdapterABIVersion: 1 as const,
  projectionHash: "e".repeat(64),
}

afterEach(async () => {
  await resetMemoryDatabase()
})

async function createBoundTask() {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Workflow occurrence authority",
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistTask({
    taskID,
    rootSession: root,
    now,
    title: "Workflow occurrence authority",
    request: "Execute independent responsibilities and preserve exact continuations",
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
  return { taskID, root }
}

function origin(input: {
  taskID: string
  rootSessionID: string
  dispatchID: string
  nodeID: string | null
  binding?: SelectedWorkflowBinding
  workflowOccurrenceID?: string
  continuationOfDispatchID?: string
}) {
  return createDispatchLineageOrigin({
    dispatchID: input.dispatchID,
    taskID: input.taskID,
    orchestratorSessionID: input.rootSessionID,
    orchestratorMessageID: `orchestrator-message-${input.dispatchID}`,
    toolPartID: `tool-part-${input.dispatchID}`,
    toolCallID: `tool-call-${input.dispatchID}`,
    targetAgentID: projectedWorkerIdentity.agentID,
    projectedWorkerIdentity,
    workScope: { kind: "task" },
    workflowBinding: input.binding ?? workflowBinding,
    workflowNodeID: input.nodeID,
    ...(input.workflowOccurrenceID ? { workflowOccurrenceID: input.workflowOccurrenceID } : {}),
    ...(input.continuationOfDispatchID ? { continuationOfDispatchID: input.continuationOfDispatchID } : {}),
    adapterInput: { reason: `Execute ${input.nodeID}` },
  })
}

async function commitInitialSession(input: {
  taskID: string
  rootSessionID: string
  dispatchID: string
  nodeID: string | null
  binding?: SelectedWorkflowBinding
  title: string
}) {
  const session = await Session.prepareNext({
    kind: "delegated-worker",
    parentID: input.rootSessionID,
    title: input.title,
    directory: Instance.directory,
  })
  const lineage = Database.transaction(() => {
    Session.persistPreparedNext(session)
    return recordTestDispatchLineage({
      origin: origin({
        taskID: input.taskID,
        rootSessionID: input.rootSessionID,
        dispatchID: input.dispatchID,
        nodeID: input.nodeID,
        binding: input.binding,
      }),
      childSessionID: session.id,
    })
  })
  return { session, lineage }
}

describe("workflow node occurrence authority", () => {
  test("projects the coordination redispatch source as the continuation source", () => {
    const sourceDispatchID = Identifier.ascending("artifact")
    expect(resolveDispatchContinuationSourceID({ coordinationSourceDispatchID: sourceDispatchID })).toBe(
      sourceDispatchID,
    )
  })

  test("binds one initial node and reuses its exact occurrence and Session for continuation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, root } = await createBoundTask()
        const initialDispatchID = Identifier.ascending("artifact")
        const { session: child } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: initialDispatchID,
          nodeID: "fundamentals",
          title: "Fundamentals worker",
        })

        const continuationDispatchID = Identifier.ascending("artifact")
        const continuation = recordTestDispatchLineage({
          origin: origin({
            taskID,
            rootSessionID: root.id,
            dispatchID: continuationDispatchID,
            nodeID: "fundamentals",
            workflowOccurrenceID: initialDispatchID,
            continuationOfDispatchID: initialDispatchID,
          }),
          childSessionID: child.id,
        })

        expect(
          listDispatchLineage(taskID).map((lineage) => ({
            dispatchID: lineage.dispatchID,
            occurrenceID: lineage.payload.workflow_occurrence_id,
            childSessionID: lineage.payload.child_session_id,
          })),
        ).toEqual([
          { dispatchID: initialDispatchID, occurrenceID: initialDispatchID, childSessionID: child.id },
          { dispatchID: continuationDispatchID, occurrenceID: initialDispatchID, childSessionID: child.id },
        ])
        expect(continuation.payload.continuation_of_dispatch_id).toBe(initialDispatchID)
      },
    })
  }, 30_000)

  test("records independent occurrences for repeated capabilities and optional reference nodes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, root } = await createBoundTask()
        const firstDispatchID = Identifier.ascending("artifact")
        const { session: child, lineage: first } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: firstDispatchID,
          nodeID: "fundamentals",
          title: "Fundamentals worker",
        })

        const secondDispatchID = Identifier.ascending("artifact")
        const secondChild = await Session.prepareNext({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Duplicate fundamentals worker",
          directory: Instance.directory,
        })
        const second = Database.transaction(() => {
          Session.persistPreparedNext(secondChild)
          return recordTestDispatchLineage({
            origin: origin({ taskID, rootSessionID: root.id, dispatchID: secondDispatchID, nodeID: "fundamentals" }),
            childSessionID: secondChild.id,
          })
        })
        expect(second.payload).toMatchObject({
          child_session_id: secondChild.id,
          workflow_occurrence_id: secondDispatchID,
          workflow_node_id: "fundamentals",
        })

        const siblingDispatchID = Identifier.ascending("artifact")
        const { session: sibling, lineage: siblingLineage } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: siblingDispatchID,
          nodeID: "valuation",
          title: "Valuation worker",
        })
        const directDispatchID = Identifier.ascending("artifact")
        const { lineage: direct } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: directDispatchID,
          nodeID: null,
          binding: { kind: "direct", package_revision: workflowBinding.package_revision },
          title: "Independent direct expert",
        })
        expect(direct.payload).toMatchObject({
          workflow_binding: { kind: "direct" },
          workflow_occurrence_id: directDispatchID,
        })
        const alternateDispatchID = Identifier.ascending("artifact")
        const { lineage: alternate } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: alternateDispatchID,
          nodeID: "fundamentals",
          binding: { ...workflowBinding, workflow_id: "alternate-investigation" },
          title: "Alternative investigation reference",
        })
        expect(alternate.payload).toMatchObject({
          workflow_binding: { kind: "virtual_workflow", workflow_id: "alternate-investigation" },
          workflow_occurrence_id: alternateDispatchID,
        })
        expect(listDispatchLineage(taskID).map((entry) => entry.dispatchID)).toEqual([
          firstDispatchID,
          secondDispatchID,
          siblingDispatchID,
          directDispatchID,
          alternateDispatchID,
        ])
        expect({
          lineage: siblingLineage,
          sessions: (await Session.children(root.id))
            .filter((session) => [child.id, secondChild.id, sibling.id].includes(session.id))
            .map((session) => ({ id: session.id, title: session.title })),
        }).toMatchObject({
          lineage: { dispatchID: siblingDispatchID, payload: { child_session_id: sibling.id } },
          sessions: [
            { id: child.id, title: "Fundamentals worker" },
            { id: secondChild.id, title: "Duplicate fundamentals worker" },
            { id: sibling.id, title: "Valuation worker" },
          ],
        })
      },
    })
  }, 30_000)
})
