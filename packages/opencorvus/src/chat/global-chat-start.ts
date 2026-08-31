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
import { Database, NotFoundError, and, eq, isSqliteIdentityConstraintError } from "@/storage/db"
import { GlobalConversationService } from "@/chat/global-chat-service"
import { rightSidebarConversationExperience } from "@/chat/session"
import {
  GlobalCreationAllocation,
  GlobalCreationAcceptedTargetUnavailableError,
  GlobalCreationAllocationConflictError,
} from "@/project/global-creation-allocation"
import {
  globalChatStartRequestContract,
  taskCreationContractFingerprint,
} from "@/engine/task-creation-request"
import { assertGlobalChatAcceptedInputFacts } from "@/engine/global-creation-target"
import { SessionControlEventTable, SessionControlRecordTable } from "@/session/session.sql"

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
    version: z.literal(2),
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

let afterAllocationForTest: ((allocationID: string) => void | Promise<void>) | undefined

export const GlobalChatStartTestHooks = {
  installAfterAllocation(hook: (allocationID: string) => void | Promise<void>): Disposable {
    if (afterAllocationForTest) throw new Error("Global Chat allocation hook is already installed")
    afterAllocationForTest = hook
    return {
      [Symbol.dispose]() {
        if (afterAllocationForTest === hook) afterAllocationForTest = undefined
      },
    }
  },
}

function identities(input: GlobalChatStart): {
  sessionID: string
  textPartID: string
  controlID: string
  identity: StartIdentity
  requestContract: ReturnType<typeof globalChatStartRequestContract>
} {
  const material = `global.chat.start.v1\0${input.requestID}`
  const messageID = Identifier.deterministic("message", `${material}\0message`)
  const requestContract = globalChatStartRequestContract(input)
  return {
    sessionID: Identifier.deterministic("session", material),
    textPartID: Identifier.deterministic("part", `${material}\0text`),
    controlID: Identifier.deterministic("session_control", `${material}\0control`),
    identity: GlobalChatStartIdentity.parse({
      version: 2,
      requestID: input.requestID,
      requestFingerprint: taskCreationContractFingerprint(requestContract),
      messageID,
    }),
    requestContract,
  }
}

async function getSession(sessionID: string): Promise<Session.Info | undefined> {
  return Session.get(sessionID).catch((error) => {
    if (NotFoundError.isInstance(error as Error)) return undefined
    throw error
  })
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
  requestContract: ReturnType<typeof globalChatStartRequestContract>,
): Promise<Session.Info> {
  const readAllocation = () => {
    try {
      return GlobalCreationAllocation.find({
        kind: "global_chat_start",
        requestID: identity.requestID,
        requestContract,
      })
    } catch (error) {
      if (!GlobalCreationAllocationConflictError.isInstance(error as Error)) throw error
      throw new GlobalChatStartIdentityConflictError({
        requestID: identity.requestID,
        sessionID,
        message: `Global Chat start request ${identity.requestID} is already bound to another immutable request contract`,
      })
    }
  }
  let allocation: ReturnType<typeof GlobalCreationAllocation.reserve> | undefined
  allocation = readAllocation()
  if (!allocation) {
    const configSnapshot = await Config.getGlobal()
    try {
      await GlobalConversationService.preflight({ model: input.model, configSnapshot })
    } catch (error) {
      allocation = readAllocation()
      if (!allocation) throw error
    }
    if (!allocation) {
      try {
        allocation = GlobalCreationAllocation.reserve({
          kind: "global_chat_start",
          requestID: identity.requestID,
          requestContract,
          resolutionSeed: configSnapshot,
        })
      } catch (error) {
        if (!GlobalCreationAllocationConflictError.isInstance(error as Error)) throw error
        readAllocation()
        throw error
      }
    }
  }
  await afterAllocationForTest?.(allocation.id)
  const accepted = GlobalCreationAllocation.acceptedTarget(allocation)
  if (accepted) {
    if (accepted.targetID !== sessionID) {
      throw new GlobalChatStartIdentityConflictError({
        requestID: identity.requestID,
        sessionID,
        message: `Global Chat start request ${identity.requestID} is accepted by another Session`,
      })
    }
    const retained = await getSession(sessionID)
    if (!retained) {
      throw new GlobalCreationAcceptedTargetUnavailableError({
        message: `Global Chat start request ${identity.requestID} was accepted as ${sessionID}, but that Session is no longer retained`,
        kind: "global_chat_start",
        requestID: identity.requestID,
        projectID: accepted.projectID,
        targetID: sessionID,
        directory: allocation.directory,
      })
    }
    if (retained.projectID !== accepted.projectID) {
      throw new GlobalCreationAcceptedTargetUnavailableError({
        message:
          `Global Chat start request ${identity.requestID} was accepted in Project ${accepted.projectID}, ` +
          `but Session ${sessionID} is now owned by Project ${retained.projectID}`,
        kind: "global_chat_start",
        requestID: identity.requestID,
        projectID: accepted.projectID,
        targetID: sessionID,
        directory: allocation.directory,
      })
    }
    return assertMatchingSession(retained, identity)
  }
  const existing = await getSession(sessionID)
  if (existing) {
    const currentAccepted = GlobalCreationAllocation.acceptedTarget(GlobalCreationAllocation.read(allocation.id))
    if (currentAccepted?.projectID === existing.projectID && currentAccepted.targetID === existing.id) {
      return assertMatchingSession(existing, identity)
    }
    throw new GlobalChatStartIdentityConflictError({
      requestID: identity.requestID,
      sessionID,
      message: `Global Chat start Session ${sessionID} has no atomic allocation acceptance`,
    })
  }
  try {
    const created = await GlobalConversationService.create({
      experience: "chat",
      model: input.model,
      sessionID,
      creationMetadata: { globalChatStart: identity },
      creationAllocation: allocation,
      configSnapshot: allocation.resolution_seed as Config.Info,
      commitInTransaction: (db, session) =>
        GlobalCreationAllocation.acceptInTransaction(db, {
          allocationID: allocation.id,
          kind: "global_chat_start",
          projectID: session.projectID,
          targetID: session.id,
          acceptedAt: session.time.created,
        }),
    })
    return assertMatchingSession(created.session, identity)
  } catch (error) {
    if (!isSqliteIdentityConstraintError(error)) throw error
    // A SQLite identity constraint is observable only after the conflicting
    // writer transaction has settled. Join the durable allocation once; wall
    // clock polling would be a second coordination protocol.
    const winnerAccepted = GlobalCreationAllocation.acceptedTarget(GlobalCreationAllocation.read(allocation.id))
    if (winnerAccepted?.targetID === sessionID) {
      const winner = await getSession(winnerAccepted.targetID)
      if (winner && winnerAccepted.projectID === winner.projectID) return assertMatchingSession(winner, identity)
    }
    throw error
  }
}

async function existingInputMessage(
  session: Session.Info,
  identity: StartIdentity,
  requestContract: ReturnType<typeof globalChatStartRequestContract>,
) {
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
  // The current request authority is the canonical allocation plus the
  // current Session identity checked by ensureSession. Wake reason is only
  // immutable provenance; historical identity shapes are not interpreted.
  if (
    !reason.success ||
    reason.data.source !== "api.chat" ||
    reason.data.requestID !== identity.requestID
  ) {
    throw new GlobalChatStartIdentityConflictError({
      requestID: identity.requestID,
      sessionID: session.id,
      message: `Global Chat start Message ${identity.messageID} is already bound to a different durable request`,
    })
  }
  const controlID = Identifier.deterministic(
    "session_control",
    `global.chat.start.v1\0${identity.requestID}\0control`,
  )
  const controlFacts = Database.use((db) => ({
    control: db.select().from(SessionControlRecordTable).where(eq(SessionControlRecordTable.id, controlID)).get(),
    terminal: db
      .select({ kind: SessionControlEventTable.kind, payload: SessionControlEventTable.payload })
      .from(SessionControlEventTable)
      .where(
        and(
          eq(SessionControlEventTable.control_id, controlID),
          eq(SessionControlEventTable.kind, "consumed"),
        ),
      )
      .get(),
  }))
  try {
    assertGlobalChatAcceptedInputFacts({
      requestID: identity.requestID,
      requestFingerprint: identity.requestFingerprint,
      requestContract,
      projectID: session.projectID,
      sessionID: session.id,
      message: { id: existing.info.id, sessionID: existing.info.sessionID, data: existing.info },
      parts: existing.parts.map((part) => ({ id: part.id, data: part })),
      control: controlFacts.control
        ? {
            id: controlFacts.control.id,
            sessionID: controlFacts.control.session_id,
            kind: controlFacts.control.kind,
            source: controlFacts.control.source,
            payload: controlFacts.control.payload,
          }
        : undefined,
      controlTerminal: controlFacts.terminal,
    })
  } catch (cause) {
    throw new GlobalChatStartIdentityConflictError(
      {
        requestID: identity.requestID,
        sessionID: session.id,
        message: `Global Chat start Message ${identity.messageID} diverges from its immutable request bundle`,
      },
      { cause },
    )
  }
  return existing
}

async function admitStart(
  input: GlobalChatStart,
  session: Session.Info,
  identity: StartIdentity,
  textPartID: string,
  controlID: string,
  requestContract: ReturnType<typeof globalChatStartRequestContract>,
) {
  const persisted = await existingInputMessage(session, identity, requestContract)
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
  const occurrenceParts = attachmentParts.map((part, index) => ({
    ...part,
    id: Identifier.deterministic("part", `global.chat.start.v1\0${identity.requestID}\0attachment\0${index}`),
  }))
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
      parts: occurrenceParts,
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
    if (!(await existingInputMessage(session, identity, requestContract))) {
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
  const { sessionID, textPartID, controlID, identity, requestContract } = identities(input)
  assertMessageOccurrenceOwner(identity, sessionID)
  const session = await ensureSession(input, sessionID, identity, requestContract)
  await Instance.provide({
    directory: session.directory,
    init: InstanceBootstrap,
    fn: () => admitStart(input, session, identity, textPartID, controlID, requestContract),
  })
  return GlobalChatStartResponse.parse({
    requestID: input.requestID,
    session: await Session.get(session.id),
    messageID: identity.messageID,
  })
}

export function startGlobalChat(input: z.input<typeof GlobalChatStartInput>) {
  const parsed = GlobalChatStartInput.parse(input)
  return startOwned(parsed)
}
