import { createHash } from "node:crypto"
import z from "zod"
import { TaskArtifactRelativePathSchema } from "./task-artifact"

const WorkspaceTreeFileSchema = z.object({
  path: TaskArtifactRelativePathSchema,
  bytes_base64: z.string(),
}).strict()

export const WorkspaceTreeSnapshotSchema = z.object({
  protocol: z.literal("opencorvus/workspace-tree@1"),
  files: z.array(WorkspaceTreeFileSchema),
}).strict().superRefine((value, context) => {
  const paths = value.files.map((file) => file.path)
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort()) || new Set(paths).size !== paths.length) {
    context.addIssue({ code: "custom", path: ["files"], message: "workspace files must be sorted and unique" })
  }
  value.files.forEach((file, index) => {
    if (Buffer.from(file.bytes_base64, "base64").toString("base64") !== file.bytes_base64) {
      context.addIssue({ code: "custom", path: ["files", index, "bytes_base64"], message: "workspace bytes must use canonical base64" })
    }
  })
})

export type WorkspaceTreeSnapshot = z.infer<typeof WorkspaceTreeSnapshotSchema>

export function canonicalWorkspaceTreeJSON(input: WorkspaceTreeSnapshot): string {
  return JSON.stringify(WorkspaceTreeSnapshotSchema.parse(input))
}

export function workspaceTreeDigest(input: WorkspaceTreeSnapshot): string {
  const snapshot = WorkspaceTreeSnapshotSchema.parse(input)
  const digest = createHash("sha256")
  digest.update("opencorvus/execution-capsule-tree@1\0", "utf8")
  for (const file of snapshot.files) {
    const bytes = Buffer.from(file.bytes_base64, "base64")
    digest.update(`${Buffer.byteLength(file.path)}:${file.path}:${bytes.byteLength}:`, "utf8")
    digest.update(bytes)
  }
  return digest.digest("hex")
}
