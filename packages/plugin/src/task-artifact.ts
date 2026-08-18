import { z } from "zod"
import { ArtifactProducerSchema } from "./artifact-producer"
import { ProjectRelativePathSchema } from "./project-path"

// UUID means Universally Unique Identifier; SHA-256 means Secure Hash Algorithm 256-bit.
// RFC means Request for Comments; media type names use the registered restricted-name grammar from RFC 6838.
const TaskArtifactUUIDSchema = z.string().uuid()
const TaskArtifactSHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const portableSegmentPattern = /^(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9._-]{0,253}[A-Za-z0-9])$/
const windowsDeviceSegmentPattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i
const utf8Encoder = new TextEncoder()

export const TaskArtifactMediaTypeSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/,
    "must be one normalized lowercase RFC 6838 registered media type without parameters",
  )
  .refine(
    (value) => value.split("/").every((restrictedName) => restrictedName.length <= 127),
    "Internet media type and subtype names must each contain at most 127 characters",
  )

export const TaskArtifactPortableSegmentSchema = z
  .string()
  .min(1)
  .refine(
    (value) => portableSegmentPattern.test(value) && !windowsDeviceSegmentPattern.test(value),
    "must be one cross-platform portable path segment",
  )

export const TaskArtifactRecordKeySchema = TaskArtifactPortableSegmentSchema.refine(
  (value) => !isCanonicalArrayIndex(value),
  "numeric array-index names cannot preserve canonical UTF-8 object-key order",
).refine(
  (value) => !Object.prototype.hasOwnProperty.call(Object.prototype, value),
  "JavaScript object prototype names cannot be portable record keys",
)

export const TaskArtifactTreeNameSchema = TaskArtifactRecordKeySchema.refine(
  (value) => value !== "manifest.json",
  "manifest.json is reserved for the snapshot manifest",
)

/**
 * Task Artifact resources preserve the exact project-relative display path.
 * Use the same canonical cross-platform contract as project-file producers so
 * valid Unicode and spaces do not require per-Agent renaming glue.
 */
export const TaskArtifactRelativePathSchema = ProjectRelativePathSchema

export const TaskArtifactSnapshotFileSchema = z
  .object({
    path: TaskArtifactRelativePathSchema,
    media_type: TaskArtifactMediaTypeSchema,
    bytes: z.number().int().nonnegative(),
    sha256: TaskArtifactSHA256Schema,
  })
  .strict()

export const TaskArtifactPublicationFileSchema = z
  .object({
    tree: TaskArtifactTreeNameSchema,
    path: TaskArtifactRelativePathSchema,
    media_type: TaskArtifactMediaTypeSchema,
  })
  .strict()

export const TaskArtifactPublicationInventorySchema = z
  .array(TaskArtifactPublicationFileSchema)
  .min(1)
  .superRefine((files, context) => {
    const seen = new Map<string, string>()
    const seenPathPrefixes = new Map<string, { identity: string; kind: "directory" | "file" }>()
    for (const [index, file] of files.entries()) {
      if (index > 0 && compareTaskArtifactPublicationFiles(files[index - 1]!, file) >= 0) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "task artifact publication files must be strictly UTF-8 byte-sorted by tree and path",
        })
      }
      const identity = `${file.tree}/${file.path}`
      addCaseCollisionIssue({ context, path: [index], seen, identity, subject: "publication file" })
      addPathPrefixCollisionIssue({
        context,
        path: [index],
        seen: seenPathPrefixes,
        identity,
        subject: "publication path",
      })
    }
  })

export const TaskArtifactSnapshotTreeSchema = z
  .object({
    files: z.array(TaskArtifactSnapshotFileSchema).min(1, "task artifact snapshot tree requires at least one file"),
  })
  .strict()
  .superRefine((tree, context) => {
    const seen = new Map<string, string>()
    const seenPathPrefixes = new Map<string, { identity: string; kind: "directory" | "file" }>()
    for (const [index, file] of tree.files.entries()) {
      if (index > 0 && compareTaskArtifactPathsByUTF8(tree.files[index - 1]!.path, file.path) >= 0) {
        context.addIssue({
          code: "custom",
          path: ["files", index, "path"],
          message: "task artifact manifest files must be strictly UTF-8 byte-sorted by path",
        })
      }
      addCaseCollisionIssue({
        context,
        path: ["files", index, "path"],
        seen,
        identity: file.path,
        subject: "manifest file path",
      })
      addPathPrefixCollisionIssue({
        context,
        path: ["files", index, "path"],
        seen: seenPathPrefixes,
        identity: file.path,
        subject: "manifest file path",
      })
    }
  })

export const TaskArtifactSnapshotManifestSchema = z
  .object({
    schema_version: z.literal(2),
    snapshot_kind: z.enum(["catalog", "engine_resource"]),
    project_id: z.string().min(1),
    task_id: z.string().min(1),
    snapshot_id: TaskArtifactUUIDSchema,
    publication_sequence: z.number().int().positive(),
    created_at_ms: z.number().int().nonnegative(),
    producer: ArtifactProducerSchema,
    trees: z
      .record(TaskArtifactTreeNameSchema, TaskArtifactSnapshotTreeSchema)
      .refine((trees) => Object.keys(trees).length > 0, "task artifact snapshot requires at least one tree"),
  })
  .strict()
  .superRefine((manifest, context) => {
    const names = Object.keys(manifest.trees)
    const seen = new Map<string, string>()
    for (const [index, name] of names.entries()) {
      if (index > 0 && compareTaskArtifactPathsByUTF8(names[index - 1]!, name) >= 0) {
        context.addIssue({
          code: "custom",
          path: ["trees", name],
          message: "task artifact tree names must be strictly UTF-8 byte-sorted",
        })
      }
      addCaseCollisionIssue({
        context,
        path: ["trees", name],
        seen,
        identity: name,
        subject: "tree name",
      })
    }
  })

export const TaskArtifactSnapshotIdentitySchema = z
  .object({
    schema_version: z.literal(2),
    project_id: z.string().min(1),
    task_id: z.string().min(1),
    snapshot_id: TaskArtifactUUIDSchema,
    manifest_sha256: TaskArtifactSHA256Schema,
  })
  .strict()

export const TaskArtifactRefSchema = z
  .object({
    snapshot: TaskArtifactSnapshotIdentitySchema,
    tree: TaskArtifactTreeNameSchema,
    path: TaskArtifactRelativePathSchema,
    media_type: TaskArtifactMediaTypeSchema,
    bytes: z.number().int().nonnegative(),
    sha256: TaskArtifactSHA256Schema,
  })
  .strict()

export const TaskArtifactResourceSetLocatorSchema = z
  .object({
    snapshot: TaskArtifactSnapshotIdentitySchema,
    tree: TaskArtifactTreeNameSchema,
  })
  .strict()

export const TaskArtifactSetSchema = z
  .object({
    manifest: TaskArtifactRefSchema,
    artifacts: z.array(TaskArtifactRefSchema).min(1),
  })
  .strict()
  .superRefine((artifactSet, context) => {
    const seen = new Map<string, string>()
    const seenPathPrefixes = new Map<string, { identity: string; kind: "directory" | "file" }>()
    for (const [index, artifact] of artifactSet.artifacts.entries()) {
      if (index > 0 && compareTaskArtifactPathsByUTF8(artifactSet.artifacts[index - 1]!.path, artifact.path) >= 0) {
        context.addIssue({
          code: "custom",
          path: ["artifacts", index, "path"],
          message: "task artifact set entries must be strictly UTF-8 byte-sorted by path",
        })
      }
      if (!sameTaskArtifactSnapshotIdentity(artifact.snapshot, artifactSet.manifest.snapshot)) {
        context.addIssue({
          code: "custom",
          path: ["artifacts", index, "snapshot"],
          message: "task artifact set entries must bind one exact snapshot identity",
        })
      }
      if (artifact.tree !== artifactSet.manifest.tree) {
        context.addIssue({
          code: "custom",
          path: ["artifacts", index, "tree"],
          message: "task artifact set entries must bind one exact snapshot tree",
        })
      }
      addCaseCollisionIssue({
        context,
        path: ["artifacts", index, "path"],
        seen,
        identity: artifact.path,
        subject: "artifact-set path",
      })
      addPathPrefixCollisionIssue({
        context,
        path: ["artifacts", index, "path"],
        seen: seenPathPrefixes,
        identity: artifact.path,
        subject: "artifact-set path",
      })
    }
    if (!artifactSet.artifacts.some((artifact) => sameTaskArtifactRef(artifact, artifactSet.manifest))) {
      context.addIssue({
        code: "custom",
        path: ["manifest"],
        message: "task artifact set manifest must be included in its artifact inventory",
      })
    }
  })

export type TaskArtifactSnapshotFile = z.infer<typeof TaskArtifactSnapshotFileSchema>
export type TaskArtifactPublicationFile = z.infer<typeof TaskArtifactPublicationFileSchema>
export type TaskArtifactSnapshotManifest = z.infer<typeof TaskArtifactSnapshotManifestSchema>
export type TaskArtifactSnapshotIdentity = z.infer<typeof TaskArtifactSnapshotIdentitySchema>
export type TaskArtifactRef = z.infer<typeof TaskArtifactRefSchema>
export type TaskArtifactResourceSetLocator = z.infer<typeof TaskArtifactResourceSetLocatorSchema>
export type TaskArtifactSet = z.infer<typeof TaskArtifactSetSchema>

export type TaskArtifactStage = Readonly<{
  id: string
  treeDirectories: Readonly<Record<string, string>>
}>

export type TaskArtifactMaterialization = Readonly<{
  id: string
  directory: string
}>

export type TaskArtifactPublication = Readonly<{
  snapshot: TaskArtifactSnapshotIdentity
  manifest: TaskArtifactSnapshotManifest
  artifacts: readonly TaskArtifactRef[]
}>

export type TaskArtifactHost = Readonly<{
  stage(input: { trees: readonly string[] }): Promise<TaskArtifactStage>
  publish(
    stage: TaskArtifactStage,
    input: {
      /**
       * Mirrors the manifest enum the Host actually stores. `engine_resource`
       * snapshots are the ones reachability collection may reclaim once no
       * Engine Artifact references them.
       */
      snapshot_kind: "catalog" | "engine_resource"
      files: readonly TaskArtifactPublicationFile[]
    },
  ): Promise<TaskArtifactPublication>
  resources(locator: TaskArtifactResourceSetLocator): Promise<readonly TaskArtifactRef[]>
  materialize(input: { snapshot: TaskArtifactSnapshotIdentity; tree: string }): Promise<TaskArtifactMaterialization>
  verify(artifactSet: TaskArtifactSet): Promise<void>
  read(ref: TaskArtifactRef): Promise<Uint8Array>
}>

export function sameTaskArtifactSnapshotIdentity(
  left: TaskArtifactSnapshotIdentity,
  right: TaskArtifactSnapshotIdentity,
): boolean {
  return (
    left.schema_version === right.schema_version &&
    left.project_id === right.project_id &&
    left.task_id === right.task_id &&
    left.snapshot_id === right.snapshot_id &&
    left.manifest_sha256 === right.manifest_sha256
  )
}

export function sameTaskArtifactRef(left: TaskArtifactRef, right: TaskArtifactRef): boolean {
  return (
    sameTaskArtifactSnapshotIdentity(left.snapshot, right.snapshot) &&
    left.tree === right.tree &&
    left.path === right.path &&
    left.media_type === right.media_type &&
    left.bytes === right.bytes &&
    left.sha256 === right.sha256
  )
}

export function compareTaskArtifactPathsByUTF8(left: string, right: string): number {
  const leftBytes = utf8Encoder.encode(left)
  const rightBytes = utf8Encoder.encode(right)
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < sharedLength; index++) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

function isCanonicalArrayIndex(value: string): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) return false
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 && numeric < 4_294_967_295 && String(numeric) === value
}

function compareTaskArtifactPublicationFiles(
  left: z.infer<typeof TaskArtifactPublicationFileSchema>,
  right: z.infer<typeof TaskArtifactPublicationFileSchema>,
): number {
  const treeOrder = compareTaskArtifactPathsByUTF8(left.tree, right.tree)
  return treeOrder === 0 ? compareTaskArtifactPathsByUTF8(left.path, right.path) : treeOrder
}

function addCaseCollisionIssue(input: {
  context: z.RefinementCtx
  path: PropertyKey[]
  seen: Map<string, string>
  identity: string
  subject: string
}): void {
  const folded = input.identity.toLowerCase()
  const prior = input.seen.get(folded)
  if (prior) {
    input.context.addIssue({
      code: "custom",
      path: input.path,
      message:
        prior === input.identity ? `${input.subject} must be unique` : `${input.subject} case-collides with ${prior}`,
    })
  }
  input.seen.set(folded, input.identity)
}

function addPathPrefixCollisionIssue(input: {
  context: z.RefinementCtx
  path: PropertyKey[]
  seen: Map<string, { identity: string; kind: "directory" | "file" }>
  identity: string
  subject: string
}): void {
  const segments = input.identity.split("/")
  for (let index = 0; index < segments.length; index++) {
    const prefix = segments.slice(0, index + 1).join("/")
    const kind = index === segments.length - 1 ? "file" : "directory"
    const folded = prefix.toLowerCase()
    const prior = input.seen.get(folded)
    if (prior && (prior.identity !== prefix || prior.kind !== kind)) {
      input.context.addIssue({
        code: "custom",
        path: input.path,
        message:
          prior.identity !== prefix
            ? `${input.subject} prefix ${prefix} case-collides with ${prior.identity}`
            : `${input.subject} prefix ${prefix} cannot be both a file and a directory`,
      })
      return
    }
    input.seen.set(folded, { identity: prefix, kind })
  }
}
