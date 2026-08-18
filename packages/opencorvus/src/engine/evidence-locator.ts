import {
  ArtifactReadLocatorInputListSchema,
  ArtifactReadLocatorListSchema,
  EvidenceLocatorInputListSchema,
  EvidenceLocatorListSchema,
  type ArtifactReadLocator,
  type EvidenceLocator,
  type EvidenceLocatorInput,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { engineArtifactRevisionDigest, requireEngineArtifactByLocator } from "@/artifact-catalog"
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
 * Complete one model-supplied evidence pointer with the Host-owned content
 * facts of the exact revision or snapshot entry it names.
 *
 * The model states which Artifact it means; digests, byte counts, and media
 * types are read from the Host. They are never transcribed, because a
 * 64-character hexadecimal digest copied by hand truncates instead of
 * verifying, and the copy proves nothing the exact revision does not already
 * prove.
 */
async function completeTaskEvidenceLocator(input: {
  taskID: string
  locator: EvidenceLocatorInput
}): Promise<EvidenceLocator> {
  const { taskID, locator } = input
  if (locator.source === "engine_artifact") {
    return {
      ...locator,
      expected_sha256: engineArtifactRevisionDigest({
        taskID,
        artifactID: locator.artifact_id,
        catalogRevision: locator.catalog_revision,
      }),
    }
  }
  if (locator.source === "task_artifact_resource") {
    const authority = requireTaskArtifactAuthority(
      taskID,
      locator.ref.snapshot.task_id,
      locator.ref.snapshot.project_id,
    )
    const record = await readTaskArtifactSnapshotManifest({ ...authority, snapshot: locator.ref.snapshot })
    const inventory = record.manifest.trees[locator.ref.tree]
    if (!inventory) {
      throw new Error(`Evidence snapshot has no tree ${locator.ref.tree}`)
    }
    const file = inventory.files.find((entry) => entry.path === locator.ref.path)
    if (!file) {
      throw new Error(
        `Evidence snapshot tree ${locator.ref.tree} has no resource ${locator.ref.path}`,
      )
    }
    return {
      source: "task_artifact_resource",
      ref: {
        snapshot: locator.ref.snapshot,
        tree: locator.ref.tree,
        path: locator.ref.path,
        media_type: file.media_type,
        bytes: file.bytes,
        sha256: file.sha256,
      },
    }
  }
  return locator
}

/**
 * Complete every model-supplied evidence pointer with Host-owned content facts,
 * then prove the resulting exact locators are readable and owned by the
 * receiving Task.
 */
export async function resolveTaskEvidenceLocators(input: {
  taskID: string
  evidenceLocators: unknown
}): Promise<EvidenceLocator[]> {
  const parsed = EvidenceLocatorInputListSchema.parse(input.evidenceLocators)
  const completed: EvidenceLocator[] = []
  for (const locator of parsed) {
    try {
      completed.push(await completeTaskEvidenceLocator({ taskID: input.taskID, locator }))
    } catch (cause) {
      throw new Error(
        `Invalid evidence locator ${locatorIdentity(locator as EvidenceLocator)} for Task ${input.taskID}`,
        { cause },
      )
    }
  }
  return assertTaskEvidenceLocators({ taskID: input.taskID, evidenceLocators: completed })
}

/**
 * The Artifact-only projection of {@link resolveTaskEvidenceLocators}, for
 * surfaces whose locators are already narrowed to readable Artifacts.
 */
export async function resolveTaskArtifactReadLocators(input: {
  taskID: string
  locators: unknown
}): Promise<ArtifactReadLocator[]> {
  const parsed = ArtifactReadLocatorInputListSchema.parse(input.locators)
  const resolved = await resolveTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: parsed,
  })
  return ArtifactReadLocatorListSchema.parse(resolved)
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
