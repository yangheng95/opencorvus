import { createHash } from "node:crypto"
import { canonicalDigestSource, canonicalJSONValue } from "@/util/canonical-digest"
import { decodeRawBase64Payload } from "@/util/base64"
import { PersistedTaskCreationCreator } from "./task-creation-creator"

type JSONPrimitive = string | number | boolean | null
export type CanonicalJSON = JSONPrimitive | CanonicalJSON[] | { [key: string]: CanonicalJSON }

/** Parse one value through the repository canonical JSON authority and return
 * the immutable object shape stored by creation identity facts. */
export function canonicalTaskCreationContract(value: unknown): Record<string, CanonicalJSON> {
  const canonical = JSON.parse(canonicalJSONValue(value, "task-creation-contract")) as CanonicalJSON
  if (!canonical || Array.isArray(canonical) || typeof canonical !== "object") {
    throw new Error("Task creation contract root must be an object")
  }
  return canonical
}

export function taskCreationContractFingerprint(contract: Record<string, CanonicalJSON>): string {
  return canonicalDigestSource("task-creation-request-fingerprint-v1", contract).sha256
}

const TASK_CALLER_KEYS = [
  "requested_project", "requested_directory", "explicit_source", "explicit_product_pillar", "explicit_title",
  "request", "attachments", "explicit_priority", "budget", "checks", "metadata", "explicit_model",
  "explicit_prompt_profile", "expected_package_digest", "artifact_sources", "creator",
] as const
const TASK_RESOLVED_KEYS = [
  "project_id", "directory", "source", "product_pillar", "title", "request", "attachments", "priority",
  "budget", "metadata", "effective_model", "prompt_profile_id", "package_revision",
  "creation_expected_package_digest", "artifact_imports", "process", "creator",
] as const

function assertExactKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  const record = value as Record<string, unknown>
  const actual = Object.keys(record).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} does not contain the exact current field set`)
  }
  return record
}

export function assertCurrentTaskCreationRequest(value: unknown): Record<string, CanonicalJSON> {
  const request = canonicalTaskCreationContract(value)
  if (request.protocol !== "task-create-request-v1") throw new Error("Task creation request protocol is not current")
  const input = assertExactKeys(request.input, TASK_CALLER_KEYS, "Task creation caller input")
  if (typeof input.request !== "string" || !Array.isArray(input.attachments) || !Array.isArray(input.artifact_sources)) {
    throw new Error("Task creation caller input has invalid request or attachment fields")
  }
  PersistedTaskCreationCreator.parse(input.creator)
  return request
}

export function assertCurrentTaskCreationContract(value: unknown): Record<string, CanonicalJSON> {
  const contract = canonicalTaskCreationContract(value)
  if (contract.protocol !== "task-creation-contract-v2") throw new Error("Task creation contract protocol is not current")
  const request = assertCurrentTaskCreationRequest(contract.request)
  const resolved = assertExactKeys(contract.resolved, TASK_RESOLVED_KEYS, "Task creation resolved snapshot")
  if (
    canonicalJSONValue((request.input as Record<string, unknown>).creator) !==
    canonicalJSONValue(resolved.creator)
  ) {
    throw new Error("Task creation request and resolved creator authority diverge")
  }
  return contract
}

export type InlineUploadBytes = Readonly<{ data: string; mime: string; filename?: string }>

/** One byte-level caller attachment identity. Legal padded and unpadded
 * base64 encodings of the same bytes intentionally produce the same fact. */
export function canonicalInlineUploadAttachment(attachment: InlineUploadBytes, label: string) {
  const bytes = decodeRawBase64Payload(attachment.data, label)
  return canonicalTaskCreationContract({
    sha: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.byteLength,
    mime: attachment.mime,
    filename: attachment.filename ?? null,
  })
}

export type TaskCreationCallerInput = Readonly<{
  project?: unknown
  directory?: unknown
  source?: unknown
  productPillar?: unknown
  title?: unknown
  request: unknown
  attachments?: unknown
  priority?: unknown
  budget?: unknown
  checks?: unknown
  metadata?: unknown
  model?: unknown
  promptProfile?: unknown
  expectedPackageDigest?: unknown
  artifactSources?: unknown
}>

/** The sole durable caller-semantics builder for Task creation. Values that
 * the Host derives from Session/config state never enter this object; they
 * belong to the accepted contract's resolved snapshot. */
export function taskCreationCallerRequest(input: {
  caller: TaskCreationCallerInput
  creator: unknown
}) {
  return canonicalTaskCreationContract({
    requested_project: input.caller.project ?? null,
    requested_directory: input.caller.directory ?? null,
    explicit_source: input.caller.source ?? null,
    explicit_product_pillar: input.caller.productPillar ?? null,
    explicit_title:
      typeof input.caller.title === "string" && input.caller.title.trim()
        ? input.caller.title.trim()
        : null,
    request: input.caller.request,
    attachments: input.caller.attachments ?? [],
    explicit_priority: input.caller.priority ?? null,
    budget: input.caller.budget ?? null,
    checks: input.caller.checks ?? null,
    metadata: input.caller.metadata ?? null,
    explicit_model: input.caller.model ?? null,
    explicit_prompt_profile: input.caller.promptProfile ?? null,
    expected_package_digest: input.caller.expectedPackageDigest ?? null,
    artifact_sources: input.caller.artifactSources ?? [],
    creator: input.creator,
  })
}

/** A persisted Panel Tool request freezes the caller-controlled fields. The
 * effective model/profile/source/pillar passed to Engine execution may be
 * inherited by the Host, so this adapter intentionally reads only the Tool
 * input plus the exact caller Message attachments. */
export function panelTaskCreationCallerInput(
  toolInput: Record<string, unknown>,
  attachments: unknown,
): TaskCreationCallerInput {
  if (typeof toolInput.request !== "string") {
    throw new Error("Persisted panel.create_task input requires a string request")
  }
  return {
    directory: toolInput.directory,
    source: toolInput.source,
    productPillar: toolInput.productPillar,
    title: toolInput.title,
    request: toolInput.request,
    attachments,
    priority: toolInput.priority,
    budget: toolInput.budget,
    checks: toolInput.checks,
    metadata: toolInput.metadata,
    model: toolInput.model,
    promptProfile: toolInput.promptProfile,
    expectedPackageDigest: toolInput.expectedPackageDigest,
    artifactSources: toolInput.artifact_sources,
  }
}

export function globalTaskRequestContract(input: {
  request: string
  title: string | null
  source: string | null
  productPillar: string
  attachments: unknown[]
  model?: string | null
  priority?: string | null
  promptProfile?: string | null
  expectedPackageDigest?: string | null
  budget?: unknown
  checks?: unknown
  channelBinding?: unknown
}) {
  return canonicalTaskCreationContract({
    protocol: "global-task-project-allocation-v2",
    request: input.request,
    title: input.title,
    source: input.source,
    product_pillar: input.productPillar,
    attachments: input.attachments,
    model: input.model ?? null,
    priority: input.priority ?? null,
    prompt_profile: input.promptProfile ?? null,
    expected_package_digest: input.expectedPackageDigest ?? null,
    budget: input.budget ?? null,
    checks: input.checks ?? null,
    channel_binding: input.channelBinding ?? null,
  })
}

/** Deterministic proof that a Global allocation request and its accepted Task
 * caller request describe the same external semantics. */
export function globalTaskAllocationTaskRequest(allocationContract: unknown) {
  const allocation = canonicalTaskCreationContract(allocationContract) as Record<string, unknown>
  if (allocation.protocol !== "global-task-project-allocation-v2") {
    throw new Error("Global Task allocation does not contain the current request protocol")
  }
  return canonicalTaskCreationContract({
    protocol: "task-create-request-v1",
    input: taskCreationCallerRequest({
      caller: {
        request: allocation.request,
        title: allocation.title,
        source: allocation.source,
        productPillar: allocation.product_pillar,
        attachments: allocation.attachments,
        priority: allocation.priority,
        budget: allocation.budget,
        checks: allocation.checks,
        model: allocation.model,
        promptProfile: allocation.prompt_profile,
        expectedPackageDigest: allocation.expected_package_digest,
        metadata: null,
        artifactSources: [],
      },
      creator: { actor: "user" },
    }),
  })
}

export function assertCurrentGlobalTaskAllocationRequest(value: unknown): Record<string, CanonicalJSON> {
  const contract = canonicalTaskCreationContract(value)
  assertExactKeys(
    contract,
    [
      "protocol", "request", "title", "source", "product_pillar", "attachments", "model", "priority",
      "prompt_profile", "expected_package_digest", "budget", "checks", "channel_binding",
    ],
    "Global Task allocation request",
  )
  if (contract.protocol !== "global-task-project-allocation-v2" || typeof contract.request !== "string" || !Array.isArray(contract.attachments)) {
    throw new Error("Global Task allocation request is not current")
  }
  return contract
}

export function assertCurrentGlobalChatStartRequest(value: unknown): Record<string, CanonicalJSON> {
  const contract = canonicalTaskCreationContract(value)
  assertExactKeys(contract, ["protocol", "text", "attachments", "model"], "Global Chat start request")
  if (contract.protocol !== "global-chat-start-request-v2" || typeof contract.text !== "string" || !Array.isArray(contract.attachments)) {
    throw new Error("Global Chat start request is not current")
  }
  return contract
}

export function globalChatStartRequestContract(input: {
  text: string
  attachments?: readonly InlineUploadBytes[]
  model?: string
}) {
  return canonicalTaskCreationContract({
    protocol: "global-chat-start-request-v2",
    text: input.text,
    attachments: (input.attachments ?? []).map((attachment, index) =>
      canonicalInlineUploadAttachment(attachment, `Global Chat attachment ${index + 1}`),
    ),
    model: input.model ?? null,
  })
}
