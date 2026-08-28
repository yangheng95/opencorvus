import { createHash } from "node:crypto"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Config } from "@/config/config"
import { UserUploadBytesList } from "@/engine/model"
import { materializeUserUploadParts } from "@/engine/user-upload-parts"
import { Identifier } from "@/id/id"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { SessionWake } from "@/session/wake"
import { NotFoundError } from "@/storage/db"
import { withKeyedLock } from "@/util/lock"
import { GlobalConversationService } from "@/chat/global-chat-service"
import { rightSidebarConversationExperience } from "@/chat/session"

export const GlobalChatStartInput = z
  .object({
    requestID: z.string().trim().min(1).max(200),
    text: z.string().min(1).max(32_000),
    attachments: UserUploadBytesList.optional(),
    model: Config.ModelId.optional(),
  })
  .strict()

const GlobalChatStartIdentity = z
  .object({
    version: z.literal(1),
    requestID: z.string().trim().min(1).max(200),
    requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    messageID: Identifier.schema("message"),
  })
  .strict()

export const GlobalChatStartResponse = z
  .object({
    requestID: z.string(),
    session: Session.Info,
    messageID: Identifier.schema("message"),
  })
  .strict()

export const GlobalChatStartIdentityConflictError = NamedError.create(
  "GlobalChatStartIdentityConflictError",
  z
    .object({
      requestID: z.string(),
      sessionID: Identifier.schema("session"),
      message: z.string(),
    })
    .strict(),
)

type GlobalChatStart = z.infer<typeof GlobalChatStartInput>
type StartIdentity = z.infer<typeof GlobalChatStartIdentity>

const startLocks = new Map<string, Promise<unknown>>()

function requestFingerprint(input: GlobalChatStart): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        text: input.text,
        attachments: input.attachments ?? [],
        model: input.model ?? null,
      }),
    )
    .digest("hex")
}

function identities(input: GlobalChatStart): {
  sessionID: string
  textPartID: string
  controlID: string
  identity: StartIdentity
} {
  const material = `global.chat.start.v1\0${input.requestID}`
  return {
    sessionID: Identifier.deterministic("session", material),
    textPartID: Identifier.deterministic("part", `${material}\0text`),
    controlID: Identifier.deterministic("session_control", `${material}\0control`),
    identity: GlobalChatStartIdentity.parse({
      version: 1,
      requestID: input.requestID,
      requestFingerprint: requestFingerprint(input),
      messageID: Identifier.deterministic("message", `${material}\0message`),
    }),
  }
}

async function getSession(sessionID: string): Promise<Session.Info | undefined> {
  return Session.get(sessionID).catch((error) => {
    if (NotFoundError.isInstance(error as Error)) return undefined
    throw error
  })
}

async function waitForConcurrentSession(sessionID: string, timeoutMs = 5_000): Promise<Session.Info | undefined> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const session = await getSession(sessionID)
    if (session) return session
    if (Date.now() >= deadline) return undefined
    await Bun.sleep(25)
  }
}

function sessionStartIdentity(session: Session.Info): StartIdentity | undefined {
  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : undefined
  const parsed = GlobalChatStartIdentity.safeParse((metadata as Record<string, unknown> | undefined)?.globalChatStart)
  return parsed.success ? parsed.data : undefined
}

function assertMatchingSession(session: Session.Info, expected: StartIdentity): Session.Info {
  const actual = sessionStartIdentity(session)
  if (
    session.id !== Identifier.deterministic("session", `global.chat.start.v1\0${expected.requestID}`) ||
    rightSidebarConversationExperience(session) !== "chat" ||
    !actual ||
    actual.requestID !== expected.requestID ||
    actual.requestFingerprint !== expected.requestFingerprint ||
    actual.messageID !== expected.messageID
  ) {
    throw new GlobalChatStartIdentityConflictError({
      requestID: expected.requestID,
      sessionID: session.id,
      message: `Global Chat start request ${expected.requestID} is already bound to a different durable Session contract`,
    })
  }
  return session
}

function assertMessageOccurrenceOwner(identity: StartIdentity, sessionID: string): void {
  const owner = Session.messageOccurrenceSessionID(identity.messageID)
  if (!owner || owner === sessionID) return
  throw new GlobalChatStartIdentityConflictError({
    requestID: identity.requestID,
    sessionID: owner,
    message: `Global Chat start Message ${identity.messageID} is already claimed by Session ${owner}`,
  })
}

async function ensureSession(
  input: GlobalChatStart,
  sessionID: string,
  identity: StartIdentity,
): Promise<Session.Info> {
  const existing = await getSession(sessionID)
  if (existing) return assertMatchingSession(existing, identity)
  try {
    const created = await GlobalConversationService.create({
      experience: "chat",
      model: input.model,
      sessionID,
      creationMetadata: { globalChatStart: identity },
    })
    return assertMatchingSession(created.session, identity)
  } catch (error) {
    const winner = await waitForConcurrentSession(sessionID)
    if (winner) return assertMatchingSession(winner, identity)
    throw error
  }
}

async function existingInputMessage(session: Session.Info, identity: StartIdentity) {
  const existing = await MessageStore.get({ sessionID: session.id, messageID: identity.messageID }).catch((error) => {
    if (NotFoundError.isInstance(error as Error)) return undefined
    throw error
  })
  if (!existing) return undefined
  if (existing.info.role !== "user") {
    throw new GlobalChatStartIdentityConflictError({
      requestID: identity.requestID,
      sessionID: session.id,
      message: `Global Chat start Message ${identity.messageID} is already bound to a non-user participant`,
    })
  }
  const reason = SessionWake.WakeReason.safeParse(existing.info.extra?.wake_reason)
  if (
    !reason.success ||
    reason.data.source !== "api.chat" ||
    reason.data.requestID !== identity.requestID ||
    reason.data.requestFingerprint !== identity.requestFingerprint
  ) {
    throw new GlobalChatStartIdentityConflictError({
      requestID: identity.requestID,
      sessionID: session.id,
      message: `Global Chat start Message ${identity.messageID} is already bound to a different durable request`,
    })
  }
  return existing
}

async function admitStart(
  input: GlobalChatStart,
  session: Session.Info,
  identity: StartIdentity,
  textPartID: string,
  controlID: string,
) {
  const persisted = await existingInputMessage(session, identity)
  if (persisted) {
    SessionWake.resumePersistedWakeWithReceipt({
      sessionID: session.id,
      messageID: identity.messageID,
      directory: session.directory,
      retryFailedReply: true,
    })
    return
  }

  const attachmentParts = await materializeUserUploadParts(input.attachments, "global Chat start attachment")
  try {
    await SessionWake.wakeWithReceipt({
      sessionID: session.id,
      messageID: identity.messageID,
      textPartID,
      controlID,
      prompt: input.text,
      author: "user",
      agent: "chat",
      surface: "right-sidebar",
      userAuthored: true,
      parts: attachmentParts,
      reason: {
        source: "api.chat",
        requestID: identity.requestID,
        requestFingerprint: identity.requestFingerprint,
      },
    })
  } catch (error) {
    if (error instanceof Session.MessageOccurrenceClaimConflictError) {
      assertMessageOccurrenceOwner(identity, session.id)
    } else if (NotFoundError.isInstance(error as Error)) {
      assertMessageOccurrenceOwner(identity, session.id)
    } else {
      throw error
    }
    if (!(await existingInputMessage(session, identity))) {
      throw new GlobalChatStartIdentityConflictError({
        requestID: identity.requestID,
        sessionID: session.id,
        message: `Global Chat start Message ${identity.messageID} was not durably accepted by its bound Session`,
      })
    }
    SessionWake.resumePersistedWakeWithReceipt({
      sessionID: session.id,
      messageID: identity.messageID,
      directory: session.directory,
      retryFailedReply: true,
    })
  }
}

async function startOwned(input: GlobalChatStart): Promise<z.infer<typeof GlobalChatStartResponse>> {
  const { sessionID, textPartID, controlID, identity } = identities(input)
  assertMessageOccurrenceOwner(identity, sessionID)
  const session = await ensureSession(input, sessionID, identity)
  await Instance.provide({
    directory: session.directory,
    init: InstanceBootstrap,
    fn: () => admitStart(input, session, identity, textPartID, controlID),
  })
  return GlobalChatStartResponse.parse({
    requestID: input.requestID,
    session: await Session.get(session.id),
    messageID: identity.messageID,
  })
}

export function startGlobalChat(input: z.input<typeof GlobalChatStartInput>) {
  const parsed = GlobalChatStartInput.parse(input)
  return withKeyedLock(startLocks, parsed.requestID, () => startOwned(parsed))
}
