import { createHash } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import z from "zod"
import {
  canonicalEvolutionJSON,
  compareCandidateIntegrity,
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
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
 * Only the Host can attest that a revision came from what the operator said:
 * it is the one participant that saw the Message. A projected squad claiming
 * the same provenance would be claiming to have witnessed something outside
 * its own evidence, so the mutation path accepts this component and no other.
 */
export const FEEDBACK_REVISION_COMPONENT_ID = "expert-squad-feedback-revision"

const MANIFEST = "expert-squad.jsonc"
const VERSION_FIELD = /("version"\s*:\s*)"(\d{4}\.\d{2}\.\d{2}\.[1-9]\d*)"/

export const ExpertSquadFeedbackRevisionFileSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .describe("Package-relative POSIX path to overwrite or add, for example agents/<agent-id>/system.md."),
    content: z.string().describe("Complete new UTF-8 content for that path."),
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
          "through what it produces. Name the Tool when the preference asks for an output the squad renders rather " +
          "than describes — `publish_interactive_artifact` carries `table@1` and `chart@1`, and every projected " +
          "worker already holds it; scheduler availability follows its exact inherited and explicit Tool surface. " +
          "An answer that only restates the preference is the shape that has repeatedly shipped " +
          "revisions changing wording and nothing else.",
      ),
    conflicting_instruction: z
      .enum(["rewritten", "none"])
      .describe(
        'Whether an instruction already in this Squad conflicts with the preference. "rewritten" means you edited ' +
          'that instruction where it stands; "none" means nothing in the Squad said otherwise and your edit only ' +
          "adds. Answer from the text you read, not from what you wrote: appending beside a conflicting instruction " +
          "leaves the older, more specific one in force, which is how a revision changes wording and nothing else.",
      ),
    files: z.array(ExpertSquadFeedbackRevisionFileSchema).min(1),
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

function assertPackageRelativePath(value: string) {
  if (value !== value.trim()) throw new Error(`Expert Squad revision path must not be padded: ${JSON.stringify(value)}`)
  if (value.includes("\\")) throw new Error(`Expert Squad revision path must use POSIX separators: ${value}`)
  if (path.posix.isAbsolute(value)) throw new Error(`Expert Squad revision path must be package-relative: ${value}`)
  const normalized = path.posix.normalize(value)
  if (normalized !== value || normalized.startsWith("../") || normalized === "..")
    throw new Error(`Expert Squad revision path must be canonical and inside the package: ${value}`)
}

/**
 * The next version for a revision published today.
 *
 * The version is a derivable fact — today's UTC date and the next daily
 * revision — so the Host computes it rather than asking the author to restate
 * a field the candidate integrity check will reject if it is wrong.
 */
export function nextExpertSquadVersion(input: { current: string; now: number }): string {
  const date = new Date(input.now)
  const today = `${date.getUTCFullYear().toString().padStart(4, "0")}.${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getUTCDate().toString().padStart(2, "0")}`
  const currentMatch = /^(\d{4}\.\d{2}\.\d{2})\.([1-9]\d*)$/.exec(input.current)
  const revision = currentMatch && currentMatch[1] === today ? Number(currentMatch[2]) + 1 : 1
  return ExpertSquadVersionSchema.parse(`${today}.${revision}`)
}

function manifestTextWithVersion(input: { text: string; version: string }): string {
  const matches = input.text.match(new RegExp(VERSION_FIELD, "g"))
  if (matches?.length !== 1)
    throw new Error(`Expert Squad manifest must declare exactly one version field, found ${matches?.length ?? 0}`)
  return input.text.replace(VERSION_FIELD, (_match, prefix: string) => `${prefix}"${input.version}"`)
}

/**
 * Author one candidate revision of an installed Expert Squad from verbatim
 * operator feedback, and stage the mutation the operator can then accept.
 *
 * There is no Campaign, no trial and no comparison: one piece of feedback has
 * nothing to measure against, so the operator's own acceptance is the verdict
 * and the published receipt is the way back.
 */
/**
 * Hold the author to what they said they did.
 *
 * The Host cannot judge whether new wording is strong enough — that is a
 * reading, and a gate built on one refuses honest revisions and teaches
 * nothing. What it can do is check a claim against the bytes. An author who
 * says an existing instruction was rewritten has made a statement this file can
 * verify: some changed text file must differ from its parent somewhere other
 * than the end. Three live revisions in a row appended a hedged sentence to a
 * prompt that already prescribed the opposite shape and changed nothing else,
 * and each one shipped as a version that behaved exactly like its parent.
 *
 * Claiming "none" stays available and is not second-guessed. It is not an
 * escape so much as the decision itself, made on purpose and on the record:
 * the author has to look at what the Squad already says before answering.
 */
function assertConflictingInstructionClaim(input: {
  claim: "rewritten" | "none"
  parentBytes: ReadonlyMap<string, Buffer>
  candidateBytes: ReadonlyMap<string, Buffer>
  changedPaths: readonly string[]
}) {
  if (input.claim !== "rewritten") return
  const appendedOnly: string[] = []
  for (const changed of input.changedPaths) {
    // The Host owns the manifest's version, so the manifest always differs and
    // proves nothing about what the author did.
    if (changed === MANIFEST) continue
    const before = input.parentBytes.get(changed)
    const after = input.candidateBytes.get(changed)
    // A file this revision introduces or removes is not an append.
    if (!before || !after) return
    // Compared as text after trimming the end, because an appending author
    // routinely eats the parent's trailing newline, which no byte-level prefix
    // test would forgive and which says nothing about what changed.
    if (!after.toString("utf8").trimEnd().startsWith(before.toString("utf8").trimEnd())) return
    appendedOnly.push(changed)
  }
  if (appendedOnly.length === 0) return
  throw new Error(
    "Expert Squad revision claims conflicting_instruction=rewritten, but every changed text file still begins with " +
      `its parent unchanged and only adds at the end: ${JSON.stringify(appendedOnly.toSorted())}. ` +
      'expected: an edit to the instruction that conflicts, or conflicting_instruction="none" when nothing in the ' +
      'Squad said otherwise. received: "rewritten" with an append-only revision. ' +
      "Read the prompt you are changing, find the sentence that prescribes the shape the operator is objecting to, " +
      "and rewrite that sentence where it stands.",
  )
}

export async function reviseInstalledExpertSquadFromFeedback(input: {
  taskID: string
  sessionID: string
  request: ExpertSquadFeedbackRevisionInput
  now?: number
}) {
  const request = ExpertSquadFeedbackRevisionInputSchema.parse(input.request)
  const target = parseFeedbackRevisionTarget(request.target_squad_id)
  const id = target.id
  for (const file of request.files) assertPackageRelativePath(file.path)
  const declared = new Set(request.files.map((file) => file.path))
  if (declared.size !== request.files.length) throw new Error("Expert Squad revision declares one path twice")

  const installed = await installedProjectPackage(target)
  const parentSnapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(installed.packageDigest)
  const parentFiles = await readExpertSquadPackageFiles(parentSnapshot.root)
  const parent = inspectExpertSquadPackage({ loaded: parentSnapshot, files: parentFiles })

  const manifestFile = parentFiles.find((file) => file.path === MANIFEST)
  if (!manifestFile) throw new Error(`Installed Expert Squad ${id} has no ${MANIFEST}`)
  const version = nextExpertSquadVersion({ current: parent.version, now: input.now ?? Date.now() })

  const parentBytesByPath = new Map(parentFiles.map((file) => [file.path, Buffer.from(file.bytes)]))
  const candidateBytes = new Map(parentBytesByPath)
  for (const file of request.files) candidateBytes.set(file.path, Buffer.from(file.content, "utf8"))
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
  assertConflictingInstructionClaim({
    claim: request.conflicting_instruction,
    parentBytes: parentBytesByPath,
    candidateBytes,
    changedPaths: comparison.changed_paths,
  })
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
    // The evidence this revision was authored from is the operator's own
    // words, carried verbatim in `feedback`; there is no prior Artifact to
    // cite, and citing the Task's own Messages as Artifacts would invent one.
    provenance: [],
  })

  const locator = persistCandidate({
    taskID: input.taskID,
    sessionID: input.sessionID,
    payload,
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
    observed_artifact_locators: [],
    source_artifact_locators: [],
  })
  const artifactID = `art_feedback_revision_${createHash("sha256").update(canonicalEvolutionJSON(envelope)).digest("hex")}`
  Database.transaction((db) => {
    const current = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, artifactID)).get()
    if (current) {
      if (canonicalEvolutionJSON(EngineArtifactEnvelopeSchema.parse(current.payload)) !== canonicalEvolutionJSON(envelope))
        throw new Error("Expert Squad feedback revision identity collision")
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
