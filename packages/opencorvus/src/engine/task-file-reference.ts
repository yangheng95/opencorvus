import { AttachmentStore } from "@/storage/attachment-store"
import { Database, NotFoundError, eq } from "@/storage/db"
import { EngineTaskTable } from "./engine.sql"
import { requireTaskInCurrentProject } from "./task-project-read"
import { updateTask, writeTaskUpdateInTransaction } from "./state"

export type TaskFileRef = {
  sha: string
  url: string
  mime: string
  size: number
  filename?: string
  intent?: string
  source?: string
}

export type TaskInputFileRef = TaskFileRef & { intent: "task_input"; source: "user-upload" }
type TaskFileRefColumn = "attachments" | "system_artifacts"

async function canonicalTaskFileRef(
  task: ReturnType<typeof requireTaskInCurrentProject>,
  column: TaskFileRefColumn,
  file: TaskFileRef,
): Promise<TaskFileRef> {
  const located = AttachmentStore.nameFromUrl(file.url)
  if (!located) {
    throw new Error(`${column}: file.url is not a valid /attachment/<projectID>/<name> reference: ${file.url}`)
  }
  if (located.projectID !== task.project_id) {
    throw new Error(
      `${column}: file.url belongs to project ${located.projectID}, expected task project ${task.project_id}: ${file.url}`,
    )
  }
  let reference: AttachmentStore.Reference
  try {
    reference = await AttachmentStore.readReference(located.projectID, located.name)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${column}: cannot read canonical attachment metadata for project ${located.projectID}/${located.name}: ${message}`,
    )
  }
  const metadataMismatches = [
    file.sha !== reference.sha ? "sha" : "",
    file.mime !== reference.mime ? "mime" : "",
    file.size !== reference.size ? "size" : "",
  ].filter(Boolean)
  if (metadataMismatches.length > 0) {
    throw new Error(
      `${column}: file metadata does not match canonical AttachmentStore metadata (${metadataMismatches.join(", ")}): ${file.url}`,
    )
  }
  return {
    sha: reference.sha,
    url: reference.url,
    mime: reference.mime,
    size: reference.size,
    ...(reference.filename ? { filename: reference.filename } : {}),
    ...(file.intent ? { intent: file.intent } : {}),
    ...(file.source ? { source: file.source } : {}),
  }
}

async function mergeTaskFileRef(
  taskID: string,
  column: TaskFileRefColumn,
  file: TaskFileRef,
  merge: (prev: TaskFileRef[], canonical: TaskFileRef) => { next: TaskFileRef[]; reason: string } | null,
): Promise<TaskFileRef[]> {
  const task = requireTaskInCurrentProject(taskID)
  const canonical = await canonicalTaskFileRef(task, column, file)
  const prev = Array.isArray(task[column]) ? (task[column] as TaskFileRef[]) : []
  const result = merge(prev, canonical)
  if (!result) return prev
  await updateTask(task, { [column]: result.next } as any, result.reason)
  return result.next
}

export async function prepareTaskAttachmentAppends(taskID: string, attachments: readonly TaskInputFileRef[]) {
  const task = requireTaskInCurrentProject(taskID)
  const canonicals: TaskFileRef[] = []
  for (const attachment of attachments) {
    if (attachment.intent !== "task_input" || attachment.source !== "user-upload") {
      throw new Error("appendTaskAttachment accepts only neutral task_input/user-upload references")
    }
    canonicals.push(await canonicalTaskFileRef(task, "attachments", attachment))
  }
  return {
    commitInTransaction(db: Database.TxOrDb): void {
      for (const canonical of canonicals) {
        const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
        if (!row) throw new NotFoundError({ message: `Task not found: ${taskID}` })
        const prev = Array.isArray(row.attachments) ? (row.attachments as TaskFileRef[]) : []
        if (prev.some((item) => item?.sha === canonical.sha)) continue
        writeTaskUpdateInTransaction({
          db,
          taskID,
          values: { attachments: [...prev, canonical] } as any,
          summary: `attachments appended: ${canonical.filename ?? canonical.sha}`,
          now: Date.now(),
        })
      }
    },
  }
}

export async function appendTaskAttachment(taskID: string, attachment: TaskInputFileRef) {
  if (attachment.intent !== "task_input" || attachment.source !== "user-upload") {
    throw new Error("appendTaskAttachment accepts only neutral task_input/user-upload references")
  }
  return mergeTaskFileRef(taskID, "attachments", attachment, (prev, canonical) => {
    if (prev.some((item) => item?.sha === canonical.sha)) return null
    return {
      next: [...prev, canonical],
      reason: `attachments appended: ${canonical.filename ?? canonical.sha}`,
    }
  })
}

export async function appendTaskSystemArtifact(taskID: string, artifact: TaskFileRef) {
  return mergeTaskFileRef(taskID, "system_artifacts", artifact, (prev, canonical) => {
    if (prev.some((item) => item?.sha === canonical.sha)) return null
    return {
      next: [...prev, canonical],
      reason: `system_artifacts appended: ${canonical.filename ?? canonical.sha}`,
    }
  })
}

export async function replaceTaskSystemArtifactByIntent(
  taskID: string,
  intent: string,
  artifact: TaskFileRef,
): Promise<TaskFileRef[]> {
  if (artifact.intent !== intent) {
    throw new Error(
      `replaceTaskSystemArtifactByIntent: intent mismatch — slot=${intent} artifact.intent=${artifact.intent}`,
    )
  }
  return mergeTaskFileRef(taskID, "system_artifacts", artifact, (prev, canonical) => ({
    next: [...prev.filter((item) => item?.intent !== intent), canonical],
    reason: `system_artifacts replaced [intent=${intent}]: ${canonical.filename ?? canonical.sha}`,
  }))
}
