import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Global } from "@/global"

const CleanupAdmissionFact = z.object({
  format: z.literal("opencorvus.project-deletion-cleanup.v5"),
  projectID: z.string().min(1),
})
let beforeManifestReadForTest: ((manifestPath: string) => void | Promise<void>) | undefined

export function projectDeletionCleanupRoot(): string {
  return path.join(Global.Path.data, "maintenance", "project-deletion-cleanup", "active")
}

export const ProjectDeletionCleanupAdmissionClosedError = NamedError.create(
  "ProjectDeletionCleanupAdmissionClosedError",
  z.object({
    projectID: z.string(),
    operation: z.string(),
    message: z.string(),
  }),
)

/** A failed committed deletion must settle before its deterministic Project ID
 * can be recreated, otherwise old and new generation credentials share one
 * auth key and cannot be retired independently. */
export async function assertProjectDeletionCleanupAdmissionOpen(projectID: string): Promise<void> {
  let names: string[]
  try {
    names = await fs.readdir(projectDeletionCleanupRoot())
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return
    throw error
  }
  for (const name of names.filter((candidate) => candidate.endsWith(".json")).sort()) {
    const manifestPath = path.join(projectDeletionCleanupRoot(), name)
    await beforeManifestReadForTest?.(manifestPath)
    let serialized: string
    try {
      serialized = await fs.readFile(manifestPath, "utf8")
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
      // Recovery can durably move the exact manifest to completed after this
      // scan enumerates it. That retired owner no longer closes admission.
      if (code === "ENOENT" || code === "ENOTDIR") continue
      throw error
    }
    const fact = CleanupAdmissionFact.parse(JSON.parse(serialized))
    if (fact.projectID !== projectID) continue
    throw new ProjectDeletionCleanupAdmissionClosedError({
      projectID,
      operation: path.basename(name, ".json"),
      message: `Project ${projectID} admission is blocked by active deletion cleanup ${name}`,
    })
  }
}

export namespace ProjectDeletionCleanupAdmissionTestHooks {
  export function setBeforeManifestRead(hook: ((manifestPath: string) => void | Promise<void>) | undefined): void {
    beforeManifestReadForTest = hook
  }
}
