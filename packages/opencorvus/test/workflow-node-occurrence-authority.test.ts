import { afterEach, describe, expect, test } from "bun:test"
import { EngineWorkflowNodeOccurrenceTable } from "@/engine/engine.sql"
import {
  createDispatchLineageOrigin,
  listDispatchLineage,
  recordDispatchLineage,
  resolveDispatchContinuationSourceID,
} from "@/engine/dispatch-lineage"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { WorkflowNodeOccurrenceConflictError } from "@/engine/workflow-node-occurrence"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database, and, eq } from "@/storage/db"
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
  const root = await Session.create({
    kind: "root",
    title: "Workflow occurrence authority",
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  persistTask({
    taskID,
    sessionID: root.id,
    now,
    title: "Workflow occurrence authority",
    request: "Bind each workflow node exactly once",
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
  dispatchID: string
  nodeID: string
  workflowOccurrenceID?: string
  continuationOfDispatchID?: string
}) {
  return createDispatchLineageOrigin({
    dispatchID: input.dispatchID,
    taskID: input.taskID,
    orchestratorSessionID: "orchestrator-session",
    orchestratorMessageID: `orchestrator-message-${input.dispatchID}`,
    toolPartID: `tool-part-${input.dispatchID}`,
    toolCallID: `tool-call-${input.dispatchID}`,
    targetAgentID: projectedWorkerIdentity.agentID,
    projectedWorkerIdentity,
    workScope: { kind: "task" },
    workflowBinding,
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
  nodeID: string
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
    return recordDispatchLineage({
      origin: origin({ taskID: input.taskID, dispatchID: input.dispatchID, nodeID: input.nodeID }),
      childSessionID: session.id,
    })
  })
  return { session, lineage }
}

describe("workflow node occurrence authority", () => {
  test("projects the coordination redispatch source as the continuation source", () => {
    const sourceDispatchID = Identifier.ascending("artifact")
    expect(
      resolveDispatchContinuationSourceID({ coordinationSourceDispatchID: sourceDispatchID }),
    ).toBe(sourceDispatchID)
  })

  test("binds one initial node and reuses its exact occurrence and Session for continuation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, root } = await createBoundTask()
        const initialDispatchID = Identifier.ascending("artifact")
        const { session: child, lineage: initial } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: initialDispatchID,
          nodeID: "fundamentals",
          title: "Fundamentals worker",
        })

        const continuationDispatchID = Identifier.ascending("artifact")
        const continuation = recordDispatchLineage({
          origin: origin({
            taskID,
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
        expect(
          Database.use((db) =>
            db
              .select()
              .from(EngineWorkflowNodeOccurrenceTable)
              .where(
                and(
                  eq(EngineWorkflowNodeOccurrenceTable.task_id, taskID),
                  eq(EngineWorkflowNodeOccurrenceTable.workflow_node_id, "fundamentals"),
                ),
              )
              .get(),
          ),
        ).toMatchObject({
          state: "bound",
          workflow_occurrence_id: initialDispatchID,
          initial_dispatch_id: initialDispatchID,
          child_session_id: child.id,
          dispatch_lineage_artifact_id: initial.artifactID,
          conflict_lineage_ids: [],
        })
        expect(continuation.payload.continuation_of_dispatch_id).toBe(initialDispatchID)
      },
    })
  }, 30_000)

  test("returns one typed existing authority for a second initial while a sibling node binds independently", async () => {
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
        let conflict: WorkflowNodeOccurrenceConflictError | undefined
        try {
          Database.transaction(() => {
            Session.persistPreparedNext(secondChild)
            recordDispatchLineage({
              origin: origin({ taskID, dispatchID: secondDispatchID, nodeID: "fundamentals" }),
              childSessionID: secondChild.id,
            })
          })
        } catch (error) {
          if (error instanceof WorkflowNodeOccurrenceConflictError) conflict = error
          else throw error
        }
        expect(conflict).toMatchObject({
          name: "WorkflowNodeOccurrenceConflictError",
          code: "workflow_node_occurrence_conflict",
          taskID,
          workflowID: "occurrence-workflow",
          workflowNodeID: "fundamentals",
          existing: [
            {
              artifactID: first.artifactID,
              dispatchID: firstDispatchID,
              childSessionID: child.id,
              workflowOccurrenceID: firstDispatchID,
            },
          ],
        })

        const siblingDispatchID = Identifier.ascending("artifact")
        const { session: sibling, lineage: siblingLineage } = await commitInitialSession({
          taskID,
          rootSessionID: root.id,
          dispatchID: siblingDispatchID,
          nodeID: "valuation",
          title: "Valuation worker",
        })
        expect({
          lineage: siblingLineage,
          sessions: (await Session.children(root.id)).map((session) => ({ id: session.id, title: session.title })),
        }).toMatchObject({
          lineage: { dispatchID: siblingDispatchID, payload: { child_session_id: sibling.id } },
          sessions: [
            { id: child.id, title: "Fundamentals worker" },
            { id: sibling.id, title: "Valuation worker" },
          ],
        })
      },
    })
  }, 30_000)
})
