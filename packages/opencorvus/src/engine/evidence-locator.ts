import {
  EvidenceLocatorListSchema,
  type EvidenceLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import { MessageTable } from "@/session/session.sql"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Database, and, eq, sql } from "@/storage/db"
import {
  readTaskArtifactRef,
  readTaskArtifactSnapshotManifest,
} from "@/task-artifact/store"
import { EngineArtifactTable, EngineGoalTable, EngineTaskTable } from "./engine.sql"
import { taskIDForSession } from "./task-session-lineage"

function locatorIdentity(locator: EvidenceLocator): string {
  return JSON.stringify(locator)
}

function requireTaskArtifactAuthority(taskID: string, locatorTaskID: string, locatorProjectID: string) {
  if (locatorTaskID !== taskID) {
    throw new Error(`Evidence locator belongs to Task ${locatorTaskID}, not ${taskID}`)
  }
  const task = Database.use((db) =>
    db.select({ projectID: EngineTaskTable.project_id }).from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
  )
  if (!task) throw new Error(`Evidence locator Task not found: ${taskID}`)
  if (task.projectID !== locatorProjectID) {
    throw new Error(`Evidence locator belongs to project ${locatorProjectID}, not ${task.projectID}`)
  }
  return {
    projectID: task.projectID,
    projectDirectory: taskPrimaryProjectRoot(taskID, { activeProjectID: task.projectID }),
    taskID,
  }
}

async function assertTaskEvidenceLocator(input: {
  taskID: string
  locator: EvidenceLocator
}): Promise<void> {
  const { taskID, locator } = input
  switch (locator.source) {
    case "engine_artifact": {
      requireEngineArtifactByLocator({ taskID, locator })
      return
    }
    case "task_artifact_snapshot": {
      const authority = requireTaskArtifactAuthority(
        taskID,
        locator.snapshot.task_id,
        locator.snapshot.project_id,
      )
      await readTaskArtifactSnapshotManifest({ ...authority, snapshot: locator.snapshot })
      return
    }
    case "task_artifact_resource": {
      const authority = requireTaskArtifactAuthority(
        taskID,
        locator.ref.snapshot.task_id,
        locator.ref.snapshot.project_id,
      )
      await readTaskArtifactRef({ ...authority, ref: locator.ref })
      return
    }
    case "session": {
      if (taskIDForSession(locator.session_id) !== taskID) {
        throw new Error(`Session evidence is missing or belongs to another Task: ${locator.session_id}`)
      }
      return
    }
    case "session_message": {
      const message = Database.use((db) =>
        db
          .select({ sessionID: MessageTable.session_id })
          .from(MessageTable)
          .where(eq(MessageTable.id, locator.message_id))
          .get(),
      )
      if (
        !message ||
        message.sessionID !== locator.session_id ||
        taskIDForSession(locator.session_id) !== taskID
      ) {
        throw new Error(
          `Session message evidence is missing or belongs to another Task: ${locator.session_id}/${locator.message_id}`,
        )
      }
      return
    }
    case "goal_revision": {
      const goal = Database.use((db) =>
        db
          .select({ id: EngineGoalTable.id })
          .from(EngineGoalTable)
          .where(and(eq(EngineGoalTable.id, locator.goal_id), eq(EngineGoalTable.task_id, taskID)))
          .get(),
      )
      if (!goal) throw new Error(`Goal revision evidence is missing or belongs to another Task: ${locator.goal_id}`)
      return
    }
    case "coordination_request": {
      const request = Database.use((db) =>
        db
          .select({ id: EngineArtifactTable.id })
          .from(EngineArtifactTable)
          .where(
            and(
              eq(EngineArtifactTable.task_id, taskID),
              eq(EngineArtifactTable.kind, "agent_coordination_request"),
              sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${locator.request_id}`,
            ),
          )
          .get(),
      )
      if (!request) {
        throw new Error(
          `Coordination request evidence is missing or belongs to another Task: ${locator.request_id}`,
        )
      }
    }
  }
}

/**
 * Parse the sole evidence-locator union and prove every non-empty locator is
 * exact, readable, and owned by the receiving Task.
 */
export async function assertTaskEvidenceLocators(input: {
  taskID: string
  evidenceLocators: readonly EvidenceLocator[]
}): Promise<EvidenceLocator[]> {
  const parsed = EvidenceLocatorListSchema.parse(input.evidenceLocators)
  for (const locator of parsed) {
    try {
      await assertTaskEvidenceLocator({ taskID: input.taskID, locator })
    } catch (cause) {
      throw new Error(`Invalid evidence locator ${locatorIdentity(locator)} for Task ${input.taskID}`, { cause })
    }
  }
  return parsed
}
