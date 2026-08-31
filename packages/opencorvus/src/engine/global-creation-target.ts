import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { canonicalJSONValue } from "@/util/canonical-digest"
import { TaskCreationResolutionSeedSchema } from "./task-creation-facts"
import {
  assertCurrentGlobalChatStartRequest,
  assertCurrentGlobalTaskAllocationRequest,
  assertCurrentTaskCreationContract,
  globalTaskAllocationTaskRequest,
} from "./task-creation-request"

type RecordValue = Record<string, unknown>

function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as RecordValue
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJSONValue(actual, label) !== canonicalJSONValue(expected, `${label} expected`)) {
    throw new Error(`${label} diverges from its frozen Global creation occurrence`)
  }
}

export function expectedTaskRootOverlay(request: RecordValue, seed: ReturnType<typeof Config.Info.parse>) {
  return Config.Overlay.parse({
    ...(typeof request.model === "string" ? { model: request.model } : {}),
    prompt_profile: {
      active: typeof request.prompt_profile === "string"
        ? request.prompt_profile
        : seed.prompt_profile.active,
    },
  })
}

export function assertGlobalTaskAcceptedResolution(input: {
  requestContract: unknown
  resolutionSeed: unknown
  taskResolution: unknown
  taskContract: unknown
  taskMetadata: unknown
  rootSessionMetadata: unknown
  initialConfigOverlay: unknown
}): void {
  const request = assertCurrentGlobalTaskAllocationRequest(input.requestContract) as RecordValue
  const seed = Config.Info.parse(input.resolutionSeed)
  const resolution = TaskCreationResolutionSeedSchema.parse(input.taskResolution)
  const contract = assertCurrentTaskCreationContract(input.taskContract)
  const resolved = record(contract.resolved, "Global Task resolved snapshot")
  const taskMetadata = record(input.taskMetadata ?? {}, "Global Task metadata")
  const sessionMetadata = record(input.rootSessionMetadata ?? {}, "Global Task root Session metadata")
  const rootSnapshot = Config.Info.parse(sessionMetadata.taskConfigSnapshot)
  const expectedOverlay = expectedTaskRootOverlay(request, seed)
  const initialOverlay = Config.Overlay.parse(input.initialConfigOverlay)

  equal(contract.request, globalTaskAllocationTaskRequest(request), "Global Task caller request")
  equal(rootSnapshot, seed, "Global Task immutable root configuration snapshot")
  equal(initialOverlay, expectedOverlay, "Global Task initial root Session overlay")
  equal(taskMetadata.checks ?? {}, resolution.resolved_checks, "Global Task resolved checks")
  equal(
    resolved.package_revision,
    {
      scope: resolution.package_revision.scope,
      project_id: resolution.package_revision.projectID,
      namespace: resolution.package_revision.namespace,
      id: resolution.package_revision.id,
      version: resolution.package_revision.version,
      package_digest: resolution.package_revision.packageDigest,
    },
    "Global Task package revision",
  )
  if (resolved.prompt_profile_id !== resolution.selected_profile_id) {
    throw new Error("Global Task prompt profile diverges from its frozen allocation resolution")
  }
  const process = record(resolved.process, "Global Task process binding")
  const expectedNative = resolution.process_mode === "native"
  if ((process.protocol === "task-native-process-binding-v1") !== expectedNative) {
    throw new Error("Global Task process mode diverges from its frozen allocation resolution")
  }
  const effective = Config.mergeOverlay(seed, {
    ...(typeof request.model === "string" ? { model: request.model } : {}),
    prompt_profile: { active: resolution.selected_profile_id },
  })
  if ((resolved.effective_model ?? null) !== (effective.model ?? null)) {
    throw new Error("Global Task effective model diverges from its frozen allocation resolution")
  }
}

export function expectedGlobalChatInitialOverlay(input: {
  requestContract: unknown
  resolutionSeed: unknown
}) {
  const request = assertCurrentGlobalChatStartRequest(input.requestContract) as RecordValue
  const seed = Config.Info.parse(input.resolutionSeed)
  const overlay = Config.Overlay.parse({
    ...(typeof request.model === "string" ? { model: request.model } : seed.model ? { model: seed.model } : {}),
    prompt_profile: { active: seed.prompt_profile.active },
  })
  return Config.previewOverlayUpdate(seed, {}, overlay).nextOverlay
}

export function assertGlobalChatAcceptedSession(input: {
  requestID: string
  requestFingerprint: string
  requestContract: unknown
  resolutionSeed: unknown
  initialConfigOverlay: unknown
  session: {
    id: unknown
    kind: unknown
    metadata: unknown
  }
}): void {
  const material = `global.chat.start.v1\0${input.requestID}`
  const expectedSessionID = Identifier.deterministic("session", material)
  const expectedMessageID = Identifier.deterministic("message", `${material}\0message`)
  const metadata = record(input.session.metadata ?? {}, "Global Chat Session metadata")
  const identity = record(metadata.globalChatStart, "Global Chat identity")
  const conversation = record(metadata.conversation, "Global Chat conversation identity")
  const identityKeys = Object.keys(identity).sort().join(",")
  if (
    input.session.id !== expectedSessionID ||
    input.session.kind !== "assistant" ||
    conversation.surface !== "right-sidebar" ||
    conversation.experience !== "chat" ||
    identityKeys !== "messageID,requestFingerprint,requestID,version" ||
    identity.version !== 2 ||
    identity.requestID !== input.requestID ||
    identity.requestFingerprint !== input.requestFingerprint ||
    identity.messageID !== expectedMessageID
  ) {
    throw new Error("Global Chat accepted Session diverges from its deterministic request identity")
  }
  equal(
    input.initialConfigOverlay,
    expectedGlobalChatInitialOverlay({
      requestContract: input.requestContract,
      resolutionSeed: input.resolutionSeed,
    }),
    "Global Chat initial overlay",
  )
}

type DurableGlobalChatPart = { id: unknown; data: unknown }

/** Validate the optional post-Session input bundle. Absence is the legal
 * owner-death cut between Session acceptance and Message admission; once the
 * Message exists, every deterministic child fact must describe the frozen
 * allocation request exactly. */
export function assertGlobalChatAcceptedInputFacts(input: {
  requestID: string
  requestFingerprint: string
  requestContract: unknown
  projectID: string
  sessionID: string
  message?: { id: unknown; sessionID: unknown; data: unknown }
  parts: DurableGlobalChatPart[]
  control?: { id: unknown; sessionID: unknown; kind: unknown; source: unknown; payload: unknown }
  controlTerminal?: { kind: unknown; payload: unknown }
}): void {
  const request = assertCurrentGlobalChatStartRequest(input.requestContract) as RecordValue
  const material = `global.chat.start.v1\0${input.requestID}`
  const messageID = Identifier.deterministic("message", `${material}\0message`)
  const textPartID = Identifier.deterministic("part", `${material}\0text`)
  const controlID = Identifier.deterministic("session_control", `${material}\0control`)
  if (!input.message) {
    if (input.parts.length > 0 || input.control || input.controlTerminal) {
      throw new Error("Global Chat input child facts exist without their deterministic Message")
    }
    return
  }
  const message = record(input.message.data, "Global Chat input Message")
  const extra = record(message.extra, "Global Chat input Message extra")
  const reason = record(extra.wake_reason, "Global Chat wake reason")
  if (
    input.message.id !== messageID ||
    input.message.sessionID !== input.sessionID ||
    message.role !== "user" ||
    reason.source !== "api.chat" ||
    reason.requestID !== input.requestID ||
    reason.requestFingerprint !== input.requestFingerprint
  ) {
    throw new Error("Global Chat input Message diverges from its deterministic request occurrence")
  }

  const attachments = request.attachments as unknown[]
  if (input.parts.length !== attachments.length + 1) {
    throw new Error("Global Chat input Part set diverges from its frozen request")
  }
  const byID = new Map(input.parts.map((part) => [String(part.id), record(part.data, `Global Chat Part ${String(part.id)}`)]))
  const text = byID.get(textPartID)
  if (!text || text.type !== "text" || text.text !== request.text) {
    throw new Error("Global Chat input text Part diverges from its frozen request")
  }
  for (let index = 0; index < attachments.length; index += 1) {
    const expected = record(attachments[index], `Global Chat attachment ${index + 1}`)
    const partID = Identifier.deterministic("part", `${material}\0attachment\0${index}`)
    const part = byID.get(partID)
    const expectedURLPrefix = `/attachment/${input.projectID}/`
    const url = typeof part?.url === "string" ? part.url : ""
    if (
      !part ||
      part.type !== "file" ||
      part.presentation !== "attachment-index" ||
      part.mime !== expected.mime ||
      (part.filename ?? null) !== (expected.filename ?? null) ||
      typeof expected.sha !== "string" ||
      !url.startsWith(expectedURLPrefix) ||
      !url.slice(expectedURLPrefix.length).startsWith(`${expected.sha}.`)
    ) {
      throw new Error(`Global Chat attachment Part ${index + 1} diverges from its frozen request`)
    }
  }

  const control = input.control
  const payload = control ? record(control.payload, "Global Chat wake control") : undefined
  if (
    !control ||
    control.id !== controlID ||
    control.sessionID !== input.sessionID ||
    control.kind !== "wake_reason" ||
    control.source !== "api.chat" ||
    payload?.messageID !== messageID ||
    canonicalJSONValue(payload?.wake_reason) !== canonicalJSONValue(reason) ||
    input.controlTerminal?.kind !== "consumed" ||
    input.controlTerminal.payload !== null
  ) {
    throw new Error("Global Chat wake control diverges from its deterministic request occurrence")
  }
}
