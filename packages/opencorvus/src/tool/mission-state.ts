import z from "zod"
import path from "node:path"
import { readFile, rm } from "node:fs/promises"
import { NamedError } from "@opencorvus-ai/util/error"
import { Tool } from "./tool"
import { Truncate } from "./truncation"
import { MissionID } from "@/mission/schema"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { Filesystem } from "@/util/filesystem"
import { canonicalDigestSource, canonicalJSONValue } from "@/util/canonical-digest"
import { withSharedJsonFactLock } from "@/util/process-lock"

/**
 * Mission state tool — the Mission agent's durable, write-confined memory.
 *
 * The public vocabulary remains four logical markdown files, but their only
 * current physical authority is one canonical JSON document. Replacing that
 * document through `writeDurableAtomic` gives a multi-file logical commit one
 * filesystem publication point; a reader can observe either the complete old
 * revision or the complete new revision, never a mixed generation.
 */

const MISSION_FILES = ["frontier.md", "tasks.md", "handoff.md", "notes.md"] as const
type MissionFile = (typeof MISSION_FILES)[number]
const SHA256 = /^[a-f0-9]{64}$/
const MISSION_STATE_DOCUMENT = "state.json"
const MISSION_STATE_LOCK = ".state.lock"

const MissionStateUpdate = z
  .object({
    file: z.enum(MISSION_FILES).describe("Mission state file to replace."),
    content: z.string().describe("Complete markdown content to write into the mission state file."),
  })
  .strict()

function uniqueCanonicalEntries<T extends { file: MissionFile }>(entries: readonly T[], ctx: z.RefinementCtx) {
  const seen = new Set<MissionFile>()
  let previous = -1
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.file)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "file"],
        message: `Mission state file ${entry.file} appears more than once.`,
      })
    }
    seen.add(entry.file)
    const position = MISSION_FILES.indexOf(entry.file)
    if (position <= previous) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "file"],
        message: "Mission state document files must use canonical order.",
      })
    }
    previous = position
  }
}

const MissionStateDocument = z
  .object({
    schema_version: z.literal(1),
    legacy_retired: z.boolean(),
    files: z.array(MissionStateUpdate).max(MISSION_FILES.length),
  })
  .strict()
  .superRefine((document, ctx) => {
    uniqueCanonicalEntries(document.files, ctx)
  })
type MissionStateDocument = z.infer<typeof MissionStateDocument>

const missionStateLocks = new Map<string, Promise<unknown>>()
let afterLegacyDocumentPublicationForTest:
  | ((input: { missionID: string; filepath: string }) => void | Promise<void>)
  | undefined

export const MissionStateRevisionConflictError = NamedError.create(
  "MissionStateRevisionConflictError",
  z.object({
    expected_revision: z.string().regex(SHA256),
    current_revision: z.string().regex(SHA256),
    message: z.string(),
  }),
)

export const MissionStateSnapshotLimitError = NamedError.create(
  "MissionStateSnapshotLimitError",
  z.object({
    output_bytes: z.number().int().nonnegative(),
    output_limit_bytes: z.number().int().positive(),
    message: z.string(),
  }),
)

export const MissionStateLegacyMigrationRequiredError = NamedError.create(
  "MissionStateLegacyMigrationRequiredError",
  z.object({
    mission_id: MissionID,
    recovery_directory: z.string().min(1),
    files: z.array(
      z.object({
        file: z.enum(MISSION_FILES),
        bytes: z.number().int().nonnegative(),
      }),
    ),
    output_bytes: z.number().int().nonnegative(),
    output_limit_bytes: z.number().int().positive(),
    message: z.string(),
  }),
)

function runtimeBase() {
  return path.resolve(ProjectRuntimePaths.projectRuntimeRoot(Instance.directory), "missions")
}

function missionDir(missionID: string) {
  const parsedMissionID = MissionID.parse(missionID)
  const base = runtimeBase()
  const resolved = path.resolve(ProjectRuntimePaths.missionRoot(Instance.directory, parsedMissionID))
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`missionID path traversal blocked: ${parsedMissionID}`)
  }
  return resolved
}

function missionFilePath(missionID: string, file: MissionFile) {
  return path.join(missionDir(missionID), file)
}

function missionStatePath(missionID: string) {
  return path.join(missionDir(missionID), MISSION_STATE_DOCUMENT)
}

function missionStateLockPath(missionID: string) {
  return path.join(missionDir(missionID), MISSION_STATE_LOCK)
}

async function resolveMissionID(sessionID: string): Promise<string> {
  const session = await Session.get(sessionID)
  const missionMeta = (session.metadata as Record<string, unknown> | undefined)?.mission as { id?: unknown } | undefined
  const missionID = typeof missionMeta?.id === "string" ? missionMeta.id : undefined
  if (!missionID) {
    throw new Error(
      `mission_state requires a mission session (metadata.mission.id). ` +
        `Session ${sessionID} is not a mission session.`,
    )
  }
  return missionID
}

async function readIfExists(target: string): Promise<string | undefined> {
  try {
    return await readFile(target, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

function orderedFiles(files: ReadonlyMap<MissionFile, string>) {
  return MISSION_FILES.flatMap((file) => {
    const content = files.get(file)
    return content === undefined ? [] : [{ file, content }]
  })
}

function snapshotFiles(document: MissionStateDocument) {
  const stored = new Map(document.files.map((entry) => [entry.file, entry.content]))
  return MISSION_FILES.map((file) => {
    const content = stored.get(file)
    return {
      file,
      exists: content !== undefined,
      bytes: Buffer.byteLength(content ?? "", "utf8"),
      content: content ?? "",
    }
  })
}

function revisionFor(files: ReturnType<typeof snapshotFiles>) {
  return canonicalDigestSource("mission-state-revision-v1", { files }).sha256
}

function snapshotOutput(document: MissionStateDocument) {
  const files = snapshotFiles(document)
  const revision = revisionFor(files)
  const output = JSON.stringify({ revision, files })
  const outputBytes = Buffer.byteLength(output, "utf8")
  if (outputBytes > Truncate.MAX_BYTES) {
    throw new MissionStateSnapshotLimitError({
      output_bytes: outputBytes,
      output_limit_bytes: Truncate.MAX_BYTES,
      message:
        `Mission state snapshot is ${outputBytes} bytes, above the ${Truncate.MAX_BYTES}-byte Tool output boundary. ` +
        "Trim authored state or move bulk evidence to an engine artifact.",
    })
  }
  return { files, revision, output }
}

async function readDocumentIfExists(filepath: string): Promise<MissionStateDocument | undefined> {
  const bytes = await readIfExists(filepath)
  if (bytes === undefined) return undefined
  const document = MissionStateDocument.parse(JSON.parse(bytes))
  if (bytes !== canonicalJSONValue(document)) {
    throw new Error(`Mission state document is not canonical JSON: ${filepath}`)
  }
  return document
}

async function retireLegacyFiles(missionID: string): Promise<void> {
  const directory = missionDir(missionID)
  for (const file of MISSION_FILES) await rm(missionFilePath(missionID, file), { force: true })
  await Filesystem.syncDirectoryMetadata(directory)
}

async function initializeDocument(missionID: string, filepath: string): Promise<MissionStateDocument> {
  const files = new Map<MissionFile, string>()
  for (const file of MISSION_FILES) {
    const content = await readIfExists(missionFilePath(missionID, file))
    if (content !== undefined) files.set(file, content)
  }
  const document = MissionStateDocument.parse({
    schema_version: 1,
    legacy_retired: files.size === 0,
    files: orderedFiles(files),
  })
  try {
    snapshotOutput(document)
  } catch (error) {
    if (!(error instanceof MissionStateSnapshotLimitError)) throw error
    throw new MissionStateLegacyMigrationRequiredError({
      mission_id: missionID,
      recovery_directory: missionDir(missionID),
      files: document.files.map((entry) => ({
        file: entry.file,
        bytes: Buffer.byteLength(entry.content, "utf8"),
      })),
      output_bytes: error.data.output_bytes,
      output_limit_bytes: error.data.output_limit_bytes,
      message:
        `Mission ${missionID} has a valid legacy four-file state whose complete snapshot is ${error.data.output_bytes} bytes, ` +
        `above the ${error.data.output_limit_bytes}-byte current Tool boundary. The legacy files remain authoritative and unchanged at ` +
        `${missionDir(missionID)}. An operator must archive or trim them below the boundary, then retry snapshot to complete the one-time migration.`,
    })
  }
  await Filesystem.writeDurableAtomic(filepath, canonicalJSONValue(document))
  if (document.legacy_retired) return document
  await afterLegacyDocumentPublicationForTest?.({ missionID, filepath })
  return completeLegacyRetirement(missionID, filepath, document)
}

async function completeLegacyRetirement(
  missionID: string,
  filepath: string,
  document: MissionStateDocument,
): Promise<MissionStateDocument> {
  await retireLegacyFiles(missionID)
  const retired = MissionStateDocument.parse({ ...document, legacy_retired: true })
  await Filesystem.writeDurableAtomic(filepath, canonicalJSONValue(retired))
  return retired
}

async function withMissionState<T>(
  missionID: string,
  abort: AbortSignal,
  operation: (input: { filepath: string; document: MissionStateDocument }) => Promise<T>,
): Promise<T> {
  abort.throwIfAborted()
  const filepath = missionStatePath(missionID)
  return withSharedJsonFactLock({
    locks: missionStateLocks,
    filepath: missionStateLockPath(missionID),
    empty: "{}",
    run: async () => {
      abort.throwIfAborted()
      let document = await readDocumentIfExists(filepath)
      if (!document) document = await initializeDocument(missionID, filepath)
      else if (!document.legacy_retired) document = await completeLegacyRetirement(missionID, filepath, document)
      abort.throwIfAborted()
      return operation({ filepath, document })
    },
  })
}

const SnapshotAction = z.object({ action: z.literal("snapshot") }).strict()

const CommitAction = z
  .object({
    action: z.literal("commit"),
    base_revision: z
      .string()
      .regex(SHA256)
      .describe("Exact revision returned by the snapshot on which these complete replacements are based."),
    updates: z
      .array(MissionStateUpdate)
      .min(1)
      .max(MISSION_FILES.length)
      .superRefine((updates, ctx) => {
        const seen = new Set<MissionFile>()
        for (const [index, update] of updates.entries()) {
          if (seen.has(update.file)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "file"],
              message: `Mission state file ${update.file} appears more than once in one commit.`,
            })
          }
          seen.add(update.file)
        }
      })
      .describe("One to four unique complete-file replacements published as one revision."),
  })
  .strict()

const MissionStateAction = z.discriminatedUnion("action", [SnapshotAction, CommitAction])

export const MissionStateTool = Tool.define("mission_state", {
  description: [
    "Snapshot or atomically commit the state files for the CURRENT mission.",
    "The mission is resolved automatically from your session — you do NOT pass a missionID.",
    "The fixed logical file vocabulary is frontier.md, tasks.md, handoff.md, notes.md.",
    "Use this for authored Mission contracts, stage bindings, decisions, and next-wake notes — do NOT copy live Task status into it.",
    "Read current Mission-owned Task identity and status through the search-revealed panel leaves.",
    "Use this to carry mission reasoning across wake cycles — do NOT use read/write/glob.",
    "",
    "Actions:",
    "  snapshot {} → returns one revision and all four complete logical files.",
    "  commit { base_revision, updates:[{file,content}, ...] } → compares the snapshot revision and atomically publishes one to four complete replacements.",
    `The complete encoded snapshot must remain within the ${Truncate.MAX_BYTES}-byte Tool output boundary; bulk evidence belongs in an engine artifact.`,
  ].join("\n"),
  parameters: MissionStateAction,
  async execute(params, ctx) {
    const missionID = await resolveMissionID(ctx.sessionID)
    return withMissionState(missionID, ctx.abort, async ({ filepath, document }) => {
      switch (params.action) {
        case "snapshot": {
          const snapshot = snapshotOutput(document)
          return {
            title: `mission_state snapshot ${missionID}`,
            output: snapshot.output,
            metadata: {
              missionID,
              revision: snapshot.revision,
              count: snapshot.files.filter((file) => file.exists).length,
              bytes: snapshot.files.reduce((total, file) => total + file.bytes, 0),
            } as Record<string, unknown>,
          }
        }
        case "commit": {
          const current = snapshotOutput(document)
          if (params.base_revision !== current.revision) {
            throw new MissionStateRevisionConflictError({
              expected_revision: params.base_revision,
              current_revision: current.revision,
              message:
                `Mission state changed after snapshot ${params.base_revision}; ` +
                `take one current snapshot and recompute the complete replacements from ${current.revision}.`,
            })
          }
          const files = new Map(document.files.map((entry) => [entry.file, entry.content]))
          for (const update of params.updates) files.set(update.file, update.content)
          const next = MissionStateDocument.parse({
            schema_version: 1,
            legacy_retired: true,
            files: orderedFiles(files),
          })
          const committed = snapshotOutput(next)
          ctx.abort.throwIfAborted()
          await Filesystem.writeDurableAtomic(filepath, canonicalJSONValue(next))
          return {
            title: `mission_state commit ${missionID}`,
            output: JSON.stringify({
              revision: committed.revision,
              files: params.updates
                .map((update) => ({
                  file: update.file,
                  bytes: Buffer.byteLength(update.content, "utf8"),
                }))
                .sort((left, right) => MISSION_FILES.indexOf(left.file) - MISSION_FILES.indexOf(right.file)),
            }),
            metadata: {
              missionID,
              revision: committed.revision,
              count: params.updates.length,
              bytes: params.updates.reduce((total, update) => total + Buffer.byteLength(update.content, "utf8"), 0),
            } as Record<string, unknown>,
          }
        }
      }
    })
  },
})

export const MISSION_STATE_FILES = MISSION_FILES
export const MISSION_STATE_DOCUMENT_FILENAME = MISSION_STATE_DOCUMENT
export type MissionStateFile = MissionFile

export const MissionStateTestHooks = {
  installAfterLegacyDocumentPublication(
    hook: (input: { missionID: string; filepath: string }) => void | Promise<void>,
  ): Disposable {
    if (afterLegacyDocumentPublicationForTest) {
      throw new Error("Mission state legacy-publication test hook is already installed")
    }
    afterLegacyDocumentPublicationForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterLegacyDocumentPublicationForTest === hook) afterLegacyDocumentPublicationForTest = undefined
      },
    }
  },
}
