import { Identifier } from "@/id/id"
import { NamedError } from "@opencorvus-ai/util/error"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { isCanonicalProjectRelativePath } from "@opencorvus-ai/plugin/project-path"
import {
  canonicalEvolutionJSON,
  compareCandidateIntegrity,
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  ArtifactReadReferenceSchema,
  artifactReadLocatorKey,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import {
  ArtifactReferenceResolutionError,
  completeArtifactReadsBeforePublication,
  resolveArtifactReadReferenceBeforeSelection,
} from "@/agent/artifact-read-facts"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { insertEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Database, eq } from "@/storage/db"
import { inspectExpertSquadPackage, readExpertSquadPackageFiles } from "./package-inspection"
import { ExpertSquadRegistry } from "./registry"
import { ExpertSquadVersionSchema } from "./version"

/**
 * The Core component that authors a feedback-driven candidate.
 *
 * The Host owns validation, immutable package identity and persisted source
 * attribution. A projected squad cannot issue this Core receipt for itself.
 * The author still owns the feedback quotation and causal hypothesis; source
 * read receipts establish delivered bytes, not semantic understanding.
 */
export const FEEDBACK_REVISION_COMPONENT_ID = "expert-squad-feedback-revision"

export const FeedbackRevisionIdentityConflictError = NamedError.create(
  "FeedbackRevisionIdentityConflictError",
  z.object({ artifactID: z.string() }),
)

export const FeedbackRevisionEditError = NamedError.create(
  "FeedbackRevisionEditError",
  z.object({
    editIndex: z.number().int().nonnegative(),
    path: z.string(),
    code: z.enum(["invalid_path", "target_exists", "target_missing", "source_text_missing", "source_text_ambiguous", "no_change"]),
  }),
)

const MANIFEST = "expert-squad.jsonc"
const VERSION_FIELD = /("version"\s*:\s*)"(\d{4}\.\d{2}\.\d{2}\.[1-9]\d*)"/

export const ExpertSquadFeedbackRevisionEditSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .describe("Package-relative POSIX path of the owning instruction, for example agents/<agent-id>/system.md."),
    old_text: z.string().describe("Exact existing UTF-8 text to replace, including whitespace; it must match once. Empty only to create a new file."),
    new_text: z.string().describe("Replacement text for that exact span, or the complete content of a new file. Empty deletes the matched text."),
    reason: z.string().min(1).describe("Why this owning instruction must change: observed decision, predicted Tool arguments, and working behavior preserved."),
  })
  .strict()

export const ExpertSquadFeedbackRevisionInputSchema = z
  .object({
    target_squad_id: z
      .string()
      .min(1)
      .describe(
        'The installed Expert Squad to revise, as "<id>" or the namespace-qualified "<namespace>/<id>" used everywhere else in this system, for example "deep-research" or "builtin/deep-research".',
      ),
    feedback: z.string().min(1).describe("The operator's exact words, verbatim. Do not paraphrase or translate them."),
    hypothesis: z
      .string()
      .min(1)
      .describe(
        "By what mechanism these edits make the squad satisfy that preference: which agent's behavior changes, and " +
          "through what it produces. For measured improvement, identify the observed failure, the instruction or " +
          "decision responsible, the predicted change on a fresh run, and the successful behavior to preserve. " +
          "Distinguish untested predictions from actual checker evidence. Name the Tool when the preference asks for an output the squad renders rather " +
          "than describes — `publish_interactive_artifact` carries `table@1` and `chart@1`, and every projected " +
          "worker already holds it; scheduler availability follows its exact inherited and explicit Tool surface. " +
          "An answer that only restates the preference is the shape that has repeatedly shipped " +
          "revisions changing wording and nothing else.",
      ),
    edits: z.array(ExpertSquadFeedbackRevisionEditSchema).min(1),
    source_read_refs: z.array(ArtifactReadReferenceSchema).describe(
      "Exact artifact_read_ref values from complete same-Turn Artifact reads supporting this revision. " +
      "Use artifact_snapshot and bounded artifact_read byte chunks for long evidence; follow next_reads. " +
      "An empty array is valid when this preference revision relies on no Artifact evidence.",
    ),
  })
  .strict()

/**
 * The identity of the Squad to revise.
 *
 * Every other model-facing surface names a Squad as `<namespace>/<id>`, so the
 * qualified form is the one an author reaches for first; refusing it taught
 * nothing and cost a whole turn. Both forms are accepted, and a namespace,
 * when given, narrows the match instead of widening it.
 */
export function parseFeedbackRevisionTarget(value: string): { namespace?: string; id: string } {
  const segments = value.trim().split("/")
  if (segments.length > 2)
    throw new Error(
      `Expert Squad feedback revision target must be "<id>" or "<namespace>/<id>"; received ${JSON.stringify(value)}`,
    )
  const [first, second] = segments
  if (second === undefined) return { id: ExpertSquadRegistry.parseID(first!, "expert squad feedback revision id") }
  return {
    namespace: second === "" ? undefined : first,
    id: ExpertSquadRegistry.parseID(second, "expert squad feedback revision id"),
  }
}

export type ExpertSquadFeedbackRevisionInput = z.infer<typeof ExpertSquadFeedbackRevisionInputSchema>

/**
 * The next version for a revision published now.
 *
 * The Host derives the version from the later of today's UTC date and the
 * parent's date. A parent authored in a later local calendar day must not
 * regress merely because UTC has not crossed midnight.
 */
export function nextExpertSquadVersion(input: { current: string; now: number }): string {
  const date = new Date(input.now)
  const today = `${date.getUTCFullYear().toString().padStart(4, "0")}.${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getUTCDate().toString().padStart(2, "0")}`
  const currentMatch = /^(\d{4}\.\d{2}\.\d{2})\.([1-9]\d*)$/.exec(input.current)
  const publicationDay = currentMatch && currentMatch[1]! > today ? currentMatch[1]! : today
  const revision = currentMatch && currentMatch[1] === publicationDay ? Number(currentMatch[2]) + 1 : 1
  return ExpertSquadVersionSchema.parse(`${publicationDay}.${revision}`)
}

function manifestTextWithVersion(input: { text: string; version: string }): string {
  const matches = input.text.match(new RegExp(VERSION_FIELD, "g"))
  if (matches?.length !== 1)
    throw new Error(`Expert Squad manifest must declare exactly one version field, found ${matches?.length ?? 0}`)
  return input.text.replace(VERSION_FIELD, (_match, prefix: string) => `${prefix}"${input.version}"`)
}

/** Apply only the author's exact spans. This proves byte application, not
 * semantic conflict resolution or behavioral improvement. */
function applyRevisionEdits(parentBytes: ReadonlyMap<string, Buffer>, edits: ExpertSquadFeedbackRevisionInput["edits"]) {
  const candidate = new Map(parentBytes)
  for (const [editIndex, edit] of edits.entries()) {
    const fail = (code: InstanceType<typeof FeedbackRevisionEditError>["data"]["code"]): never => {
      throw new FeedbackRevisionEditError({ editIndex, path: edit.path, code })
    }
    if (!isCanonicalProjectRelativePath(edit.path)) fail("invalid_path")
    if (edit.old_text === edit.new_text) fail("no_change")
    const prior = candidate.get(edit.path)
    if (edit.old_text === "") {
      if (prior !== undefined) fail("target_exists")
      candidate.set(edit.path, Buffer.from(edit.new_text, "utf8"))
      continue
    }
    const text = prior?.toString("utf8") ?? fail("target_missing")
    const start = text.indexOf(edit.old_text)
    if (start < 0) fail("source_text_missing")
    if (text.indexOf(edit.old_text, start + 1) >= 0) fail("source_text_ambiguous")
    candidate.set(edit.path, Buffer.from(text.slice(0, start) + edit.new_text + text.slice(start + edit.old_text.length), "utf8"))
  }
  return candidate
}

/** Stage an unmeasured candidate; supplied evidence is attributed through the
 * existing complete-read facts, while installation still needs acceptance. */
export async function reviseInstalledExpertSquadFromFeedback(input: {
  taskID: string
  sessionID: string
  request: ExpertSquadFeedbackRevisionInput
  evidenceScope?: { assistantMessageID: string; toolPartID: string }
  now?: number
}) {
  const request = ExpertSquadFeedbackRevisionInputSchema.parse(input.request)
  const target = parseFeedbackRevisionTarget(request.target_squad_id)
  const id = target.id
  const evidenceScope = input.evidenceScope && { sessionID: input.sessionID, ...input.evidenceScope }
  const sourceByLocator = new Map<string, ArtifactReadLocator>()
  for (const reference of request.source_read_refs) {
    if (!evidenceScope)
      throw new ArtifactReferenceResolutionError(reference, "Feedback revision requires persisted invocation identity for evidence reads")
    const locator = resolveArtifactReadReferenceBeforeSelection({ ...evidenceScope, reference })
    sourceByLocator.set(artifactReadLocatorKey(locator), locator)
  }
  const sourceArtifactLocators = [...sourceByLocator.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
  const observedArtifactLocators = evidenceScope ? completeArtifactReadsBeforePublication(evidenceScope) : []

  const installed = await installedProjectPackage(target)
  const parentSnapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(installed.packageDigest)
  const parentFiles = await readExpertSquadPackageFiles(parentSnapshot.root)
  const parent = inspectExpertSquadPackage({ loaded: parentSnapshot, files: parentFiles })

  const manifestFile = parentFiles.find((file) => file.path === MANIFEST)
  if (!manifestFile) throw new Error(`Installed Expert Squad ${id} has no ${MANIFEST}`)
  const version = nextExpertSquadVersion({ current: parent.version, now: input.now ?? Date.now() })

  const parentBytesByPath = new Map(parentFiles.map((file) => [file.path, Buffer.from(file.bytes)]))
  const candidateBytes = applyRevisionEdits(parentBytesByPath, request.edits)
  // The author may rewrite the manifest — an agent's grants, the workflow
  // topology and the agent set all live there, and refusing the file left this
  // path able to change only prose while the Campaign path could change all of
  // it. What stays the Host's is the version alone, because it is derivable
  // from today and the parent; restating it would be a second source for one
  // fact. Candidate integrity still refuses any capability the parent never
  // declared, so a revision cannot widen its own reach here.
  const authoredManifest = candidateBytes.get(MANIFEST) ?? Buffer.from(manifestFile.bytes)
  candidateBytes.set(
    MANIFEST,
    Buffer.from(manifestTextWithVersion({ text: authoredManifest.toString("utf8"), version }), "utf8"),
  )

  const temporaryRoot = await Global.createTemporaryDirectory("expert-squad-feedback-revision-")
  const sourceDirectory = path.join(temporaryRoot, "candidate")
  let candidate
  let candidateSnapshotDigest: string
  try {
    for (const [relative, bytes] of candidateBytes) {
      const destination = path.join(sourceDirectory, ...relative.split("/"))
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, bytes, { flag: "wx" })
    }
    // Loading the source package is what validates it and what materializes it
    // into the content-addressed revision store; the promotion below installs
    // from that store, so this call is the publication.
    const loaded = await ExpertSquadRegistry.loadSourcePackage(sourceDirectory)
    if (loaded.manifest.version !== version)
      throw new Error(`Expert Squad candidate manifest version is ${loaded.manifest.version}, expected ${version}`)
    candidateSnapshotDigest = loaded.packageDigest
    const candidateSnapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(loaded.packageDigest)
    candidate = inspectExpertSquadPackage({
      loaded: candidateSnapshot,
      files: await readExpertSquadPackageFiles(candidateSnapshot.root),
    })
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }

  const comparison = compareCandidateIntegrity(parent, candidate)
  const payload = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
    development_campaign_locator: null,
    feedback: request.feedback,
    parent_revision: exactRevision(parent),
    candidate_revision: exactRevision(candidate),
    parent_resources: [],
    candidate_resources: [],
    hypothesis: request.hypothesis,
    changed_paths: comparison.changed_paths,
    diff_sha256: comparison.diff_sha256,
    frozen_files: comparison.frozen_files,
    manager_receipt: {
      operation: "validated",
      namespace: candidate.namespace,
      id: candidate.id,
      version: candidate.version,
      package_digest: candidate.package_digest,
    },
    provenance: sourceArtifactLocators,
  })

  const locator = persistCandidate({
    taskID: input.taskID,
    sessionID: input.sessionID,
    payload,
    observedArtifactLocators,
    sourceArtifactLocators,
  })
  return {
    locator,
    expectedCurrentPackageDigest: installed.packageDigest,
    candidatePackageDigest: candidateSnapshotDigest,
    namespace: candidate.namespace,
    id: candidate.id,
    version,
    changedPaths: comparison.changed_paths,
  }
}

async function installedProjectPackage(target: { namespace?: string; id: string }) {
  const found = await ExpertSquadRegistry.findInstalledPackageIdentitiesForProjects(
    [Instance.project.worktree],
    target.id,
  )
  const matches = target.namespace ? found.filter((identity) => identity.namespace === target.namespace) : found
  const named = target.namespace ? `${target.namespace}/${target.id}` : target.id
  if (matches.length === 0) {
    const available = found.map((identity) => `${identity.namespace}/${identity.id}`).join(", ")
    throw new Error(
      `Expert Squad ${named} is not installed in this Project, so it has no revision to revise` +
        (available ? `; this Project installs ${available}` : ""),
    )
  }
  if (matches.length > 1) {
    const namespaces = matches.map((identity) => identity.namespace).join(", ")
    throw new Error(
      `Expert Squad ${named} is installed under more than one namespace in this Project (${namespaces}); name it as "<namespace>/<id>"`,
    )
  }
  const loaded = await ExpertSquadRegistry.loadPackage(matches[0]!.root)
  return { namespace: loaded.namespace, id: loaded.id, packageDigest: loaded.packageDigest }
}

function exactRevision(inspected: { namespace: string; id: string; version: string; package_digest: string }) {
  return {
    namespace: inspected.namespace,
    id: inspected.id,
    version: inspected.version,
    package_digest: inspected.package_digest,
  }
}

function persistCandidate(input: {
  taskID: string
  sessionID: string
  payload: unknown
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
}): EngineArtifactLocator {
  const envelope = EngineArtifactEnvelopeSchema.parse({
    artifact_type: "evolution-lab/candidate-revision",
    schema_version: 1,
    producer: {
      owner_kind: "core",
      component_id: FEEDBACK_REVISION_COMPONENT_ID,
      operation_id: input.sessionID,
    },
    payload: input.payload,
    resources: [],
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
  })
  const artifactID = Identifier.deterministic("artifact", `feedback-revision\0${input.taskID}\0${canonicalEvolutionJSON(envelope)}`)
  Database.transaction((db) => {
    const current = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get()
    if (current) {
      if (
        current.task_id !== input.taskID ||
        current.kind !== "expert_output" ||
        canonicalEvolutionJSON(EngineArtifactEnvelopeSchema.parse(current.payload)) !== canonicalEvolutionJSON(envelope)
      ) throw new FeedbackRevisionIdentityConflictError({ artifactID })
      return
    }
    insertEngineArtifact(db, {
      id: artifactID,
      taskID: input.taskID,
      kind: "expert_output",
      label: "evolution-lab/candidate-revision",
      payload: envelope,
    })
  })
  return exactEngineArtifactLocator({ taskID: input.taskID, artifactID })
}
