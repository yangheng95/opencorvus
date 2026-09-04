import { Session } from "./index"
import { Instance } from "@/project/instance"
import {
  provideInitializedProjectExecution,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { Log } from "@/util/log"
import { SessionPrompt } from "./prompt"
import { SessionContext } from "./context"
import { EffectiveConfig } from "@/config/effective"
import { resolveNativeSessionMessageIdentity, resolveSessionMessageIdentity } from "./message-identity"
import type { PreparedUserMessage, UserMessagePersistenceHooks } from "./prompt/parts"
import { preflightUserMessageModel, preparedUserMessageFromPreflight } from "./prompt/parts"
import { Identifier } from "@/id/id"
import { PanelSurface } from "@/panel/capability"
import {
  applyRightSidebarConversationPromptOverlay,
  rightSidebarConversationExperience,
  rightSidebarConversationMetadata,
  type ConversationExperience,
} from "@/chat/session"
import z from "zod"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { createExecutionCancellationOrigin, isExecutionCancellationError } from "./prompt/cancellation"
import { ProjectMemory } from "@/memory/project-memory"
import type { Database } from "@/storage/db"
import { MessageStore } from "./message-store"
import { missionProcessRecoveryFrontierDigest } from "./mission-process-recovery-schema"
import { PersistedWakeReplay as PersistedWakeReplayError } from "./persisted-wake-replay"
import { SessionWakeReason } from "./wake-reason"

/**
 * Session wake mechanism.
 *
 * Appends a scheduled prompt as a normal session message to trigger the
 * `waitForUserMessage()` listener.
 *
 * If the session's loop is in standby (waiting for user message),
 * the injected message will wake it. If the loop is not running,
 * we start it.
 */
export namespace SessionWake {
  const log = Log.create({ service: "session.wake" })
  type WakeLoopExecutor = (input: {
    sessionID: string
    messageID: string
    directory: string
    signal: AbortSignal
    retryFailedReply?: boolean
  }) => Promise<void>
  let wakeLoopExecutorForTest: WakeLoopExecutor | undefined
  let beforeWakeLoopActivationForTest: (() => void | Promise<void>) | undefined

  export const PersistedWakeReplay = PersistedWakeReplayError

  export const recoveryFrontierDigest = missionProcessRecoveryFrontierDigest

  export const WakeReason = SessionWakeReason
  export type WakeReason = z.infer<typeof WakeReason>

  export function loopFailureDisposition(error: unknown, cancellationReason: unknown): "cancelled" | "failed" {
    return isExecutionCancellationError(error) || isExecutionCancellationError(cancellationReason)
      ? "cancelled"
      : "failed"
  }

  export interface WakeInput {
    /** Existing session ID to wake. If omitted, creates a new session. */
    sessionID?: string
    /** Exact durable message identity owned by a scheduler fire. */
    messageID?: string
    /** Exact durable primary text-part identity owned by a scheduler fire. */
    textPartID?: string
    /** Physical fire ownership signal; durable effects remain reconcilable after abort. */
    signal?: AbortSignal
    /** Durable owner fence committed atomically with the exact Message/Part bundle. */
    commitBundle?: UserMessagePersistenceHooks["commitBundle"]
    /** Scheduler-owned compact occurrence check performed before bundle rows. */
    preflightBundle?: UserMessagePersistenceHooks["preflightBundle"]
    /** Exact business-occurrence check performed in the durable Prompt-owner
     * acquisition transaction before a physical loop may start. */
    ownerPreflight?: (db: Database.TxOrDb) => void
    /** Observe the admitted physical Prompt owner until it settles. */
    ownerLifecycle?: (owner: AbortSignal) => Disposable
    /** The prompt to append as the next session message. */
    prompt: string
    /** Real participant that authored this wake payload. */
    author: string
    /** Structured reason used to audit why this session was woken. */
    reason: WakeReason
    /** Primary assistant ID. If omitted, uses PrimaryAssistantRegistry.defaultID(). */
    agent?: string
    /** Model override. If omitted, uses the configured default model. */
    model?: { providerID: string; modelID: string }
    /** Provider-defined reasoning variant or effort. */
    variant?: string
    /** Additional user-authored prompt parts carried with the wake message. */
    parts?: SessionPrompt.PromptInput["parts"]
    /** Explicit control-plane surface propagated to surface-authorized tools. */
    surface?: z.infer<typeof PanelSurface>
    /** Canonical right-sidebar conversation identity used only when this wake creates a session. */
    newConversationExperience?: ConversationExperience
    /** Stable control ID reserved by a durable ingress owner before wake persistence. */
    controlID?: string
    /** Trusted external operator ingress; runtime and scheduler wakes leave this unset. */
    userAuthored?: boolean
  }

  export type WakeCompletion = { ok: true } | { ok: false; error: string }
  export type WakeActivation = { owner: AbortSignal }
  export type WakeReceipt = {
    sessionID: string
    messageID: string
    /** Exact physical prompt owner admitted for this wake attempt. */
    activation: Promise<WakeActivation>
    /** Outcome of the exact assistant reply to this durable wake Message. */
    completion: Promise<WakeCompletion>
  }

  export function reasonExtra(reason: WakeReason): { wake_reason: WakeReason } {
    return { wake_reason: WakeReason.parse(reason) }
  }

  /**
   * JSON path to one wake-reason field inside a persisted Message row.
   *
   * `reasonExtra` is the only encoder, so the shape it produces is stated here
   * too rather than copied into SQL string literals in other modules. Callers
   * bind the returned path as a `json_extract` argument; the field name is
   * checked against the union so a renamed discriminant fails to compile
   * instead of silently matching nothing.
   */
  export function reasonJSONPath(field: WakeReason extends infer R ? (R extends object ? keyof R : never) : never) {
    return `$.extra.wake_reason.${String(field)}`
  }

  /**
   * Wake a session by appending the scheduled prompt.
   * Returns the session ID (existing or newly created).
   */
  export async function wake(input: WakeInput): Promise<string> {
    return (await wakeWithReceipt(input)).sessionID
  }

  /** Persist one wake and expose the exact assistant reply's truthful completion. */
  export async function wakeWithReceipt(input: WakeInput): Promise<WakeReceipt> {
    if (input.signal?.aborted) throw input.signal.reason
    if (input.sessionID && input.newConversationExperience) {
      throw new Error("Session wake cannot apply a new conversation identity to an existing session")
    }
    const reason = WakeReason.parse(input.reason)
    const sessionID = input.sessionID ?? Identifier.ascending("session")
    const authoredPrompt: SessionPrompt.PromptInput = {
      sessionID,
      messageID: input.messageID,
      author: input.author,
      agent: input.newConversationExperience && !input.agent ? input.newConversationExperience : input.agent,
      model: input.model,
      variant: input.variant,
      noReply: true,
      extra: {
        ...reasonExtra(reason),
        ...(input.surface ? { surface: PanelSurface.parse(input.surface) } : {}),
        ...(input.userAuthored
          ? ProjectMemory.userInputExtra({ surface: reason.source, literalText: input.prompt })
          : {}),
      },
      byteMaterializationProjectID: Instance.project.id,
      parts: [
        {
          id: input.textPartID,
          type: "text",
          text: input.prompt,
        },
        ...(input.parts ?? []),
      ],
    }
    const promptInput = SessionPrompt.PromptInput.parse(
      input.newConversationExperience
        ? applyRightSidebarConversationPromptOverlay(authoredPrompt, { experience: input.newConversationExperience })
        : authoredPrompt,
    )
    let session: Session.Info
    let config
    let identity
    let modelPreflight
    let resolvedPromptInput: SessionPrompt.PromptInput
    let prepared: PreparedUserMessage
    if (!input.sessionID) {
      config = await EffectiveConfig.effective()
      identity = await resolveNativeSessionMessageIdentity({
        sessionID,
        sessionKind: "assistant",
        requestedAgentID: promptInput.agent,
        config,
      })
      resolvedPromptInput = { ...promptInput, agent: identity.agentID }
      modelPreflight = await preflightUserMessageModel({ prompt: resolvedPromptInput, config, identity })
      session = await Session.createNext({
        id: sessionID,
        kind: "assistant",
        directory: Instance.directory,
        title: `Scheduled: ${input.prompt.slice(0, 60)}`,
        metadata: input.newConversationExperience
          ? rightSidebarConversationMetadata(input.newConversationExperience)
          : undefined,
      })
      prepared = preparedUserMessageFromPreflight({
        prompt: resolvedPromptInput,
        config,
        session,
        identity,
        modelPreflight,
      })
      log.info("created new session for wake", { sessionID })
    } else {
      session = await Session.assertLineageInProject({ sessionID, projectID: Instance.project.id })
      config = await EffectiveConfig.effective({ sessionID })
      const runtimeContract = SessionPrompt.getSessionRuntimeContract(sessionID)
      const conversationExperience = rightSidebarConversationExperience(session)
      const sessionPromptInput = conversationExperience
        ? SessionPrompt.PromptInput.parse(
            applyRightSidebarConversationPromptOverlay(promptInput, { experience: conversationExperience }),
          )
        : promptInput
      identity = await resolveSessionMessageIdentity({
        session,
        requestedAgentID: runtimeContract?.identity.agentID ?? sessionPromptInput.agent,
        config,
      })
      resolvedPromptInput = { ...sessionPromptInput, agent: identity.agentID }
      modelPreflight = await preflightUserMessageModel({
        prompt: resolvedPromptInput,
        config,
        identity,
        modelScope: { sessionID },
      })
      prepared = preparedUserMessageFromPreflight({
        prompt: resolvedPromptInput,
        config,
        session,
        identity,
        modelPreflight,
      })
    }

    return SessionContext.provide(session, async () => {
      if (input.signal?.aborted) throw input.signal.reason
      const message = await SessionPrompt.prompt
        .force(resolvedPromptInput, {
          prepared,
          signal: input.signal,
          commitBundle: input.commitBundle,
          preflightBundle: input.preflightBundle,
          controls: (info) => [
            {
              id: input.controlID,
              sessionID,
              kind: "wake_reason",
              status: "consumed",
              owner: reason.source,
              payload: {
                messageID: info.id,
                wake_reason: reason,
              },
            },
          ],
        })
        .catch(async (error) => {
          if (!(error instanceof PersistedWakeReplay)) throw error
          if (error.sessionID !== sessionID || error.messageID !== input.messageID) throw error
          return MessageStore.get({ sessionID, messageID: error.messageID })
        })

      log.info("injected wake message", { sessionID, messageID: message.info.id, wakeReason: reason.source })

      // Start the session loop.
      //
      // For existing sessions with an active loop in standby (waitForUserMessage),
      // the Bus event from the user message above will wake it automatically.
      //
      // For new sessions or sessions whose loop has ended, we need to start
      // a fresh loop. Using resume_existing=false ensures a new loop starts.
      // If a loop is already running, start() returns undefined and the
      // function enters the callback path (which resolves when the loop
      // processes our message).
      const directory = session.directory
      await provideInitializedProjectExecution({
        directory,
        signal: input.signal,
        fn: () => undefined,
      })
      const started = startPersistedWakeLoop({
        sessionID,
        messageID: message.info.id,
        directory,
        ownerPreflight: input.ownerPreflight,
        ownerLifecycle: input.ownerLifecycle,
      })

      return { sessionID, messageID: message.info.id, ...started }
    })
  }

  export function resumePersistedWake(input: {
    sessionID: string
    messageID: string
    directory: string
    signal?: AbortSignal
    retryFailedReply?: boolean
    ownerPreflight?: (db: Database.TxOrDb) => void
    ownerLifecycle?: (owner: AbortSignal) => Disposable
  }): Promise<WakeCompletion> {
    return startPersistedWakeLoop(input).completion
  }

  export function resumePersistedWakeWithReceipt(input: {
    sessionID: string
    messageID: string
    directory: string
    signal?: AbortSignal
    retryFailedReply?: boolean
    ownerPreflight?: (db: Database.TxOrDb) => void
    ownerLifecycle?: (owner: AbortSignal) => Disposable
  }): Pick<WakeReceipt, "activation" | "completion"> {
    return startPersistedWakeLoop(input)
  }

  function startPersistedWakeLoop(input: {
    sessionID: string
    messageID: string
    directory: string
    signal?: AbortSignal
    retryFailedReply?: boolean
    ownerPreflight?: (db: Database.TxOrDb) => void
    ownerLifecycle?: (owner: AbortSignal) => Disposable
  }): Pick<WakeReceipt, "activation" | "completion"> {
    input.signal?.throwIfAborted()
    let settleReply!: (completion: WakeCompletion) => void
    const reply = new Promise<WakeCompletion>((resolve) => {
      settleReply = resolve
    })
    const reservation = RuntimeExecutionSettlement.reserve(
      "session_wake_loop",
      `session-wake-loop:${input.sessionID}:${input.messageID}`,
    )
    let promptOwner: AbortSignal | undefined
    reservation.onCancel((reason) => {
      if (!promptOwner) return
      try {
        SessionPrompt.cancelOwned(
          input.sessionID,
          input.directory,
          promptOwner,
          {
            origin: createExecutionCancellationOrigin({
              actor: "runtime",
              source: "process.shutdown",
              surface: "session-wake-loop",
              reason: reason instanceof Error ? reason.message : String(reason),
              targetSessionID: input.sessionID,
              messageID: input.messageID,
            }),
          },
        )
      } catch (error) {
        log.warn("wake loop cancellation callback failed", {
          sessionID: input.sessionID,
          messageID: input.messageID,
          error,
        })
      }
    })
    const cancelFromCaller = () => reservation.cancel(input.signal?.reason)
    if (input.signal?.aborted) cancelFromCaller()
    else input.signal?.addEventListener("abort", cancelFromCaller, { once: true })
    let resolveActivation!: (activation: WakeActivation) => void
    let rejectActivation!: (error: unknown) => void
    let activationSettled = false
    const activation = new Promise<WakeActivation>((resolve, reject) => {
      resolveActivation = resolve
      rejectActivation = reject
    })
    void activation.catch(() => undefined)
    const activated = (owner: AbortSignal) => {
      if (activationSettled) return
      promptOwner = owner
      activationSettled = true
      resolveActivation({ owner })
    }
    const operation = Promise.resolve().then(async () => {
      await beforeWakeLoopActivationForTest?.()
      if (wakeLoopExecutorForTest) {
        activated(reservation.signal)
        return wakeLoopExecutorForTest({
          ...input,
          signal: reservation.signal,
        })
      }
      return executeWakeLoop({
        ...input,
        signal: reservation.signal,
        activated,
        replySettled: () => settleReply({ ok: true }),
      })
    })
    reservation.settleWith(operation)
    void operation.finally(() => input.signal?.removeEventListener("abort", cancelFromCaller)).catch(() => undefined)
    void operation.then(
      () => settleReply({ ok: true }),
      (err) => {
        if (!activationSettled) {
          activationSettled = true
          rejectActivation(err)
        }
        if (loopFailureDisposition(err, reservation.signal.reason) === "cancelled") {
          log.info("wake loop cancelled", { sessionID: input.sessionID, messageID: input.messageID })
        } else {
          log.error("wake loop failed", { sessionID: input.sessionID, messageID: input.messageID, err })
        }
        settleReply({ ok: false, error: err instanceof Error ? err.message : String(err) })
      },
    )
    return { activation, completion: reply }
  }

  async function executeWakeLoop(input: {
    sessionID: string
    messageID: string
    directory: string
    signal: AbortSignal
    retryFailedReply?: boolean
    ownerPreflight?: (db: Database.TxOrDb) => void
    ownerLifecycle?: (owner: AbortSignal) => Disposable
    activated: (owner: AbortSignal) => void
    replySettled?: () => void
  }): Promise<void> {
    await runWithInitializedIndependentProject({
      directory: input.directory,
      signal: input.signal,
      fn: async () => {
        input.signal.throwIfAborted()
        await SessionPrompt.withPromptOwnerCapture(
          input.sessionID,
          input.activated,
          () =>
            SessionPrompt.loop({
              sessionID: input.sessionID,
              resume_existing: false,
              reply_to_message_id: input.messageID,
              retry_failed_reply: input.retryFailedReply,
            }),
          input.ownerPreflight,
          input.ownerLifecycle,
        )
        input.replySettled?.()
        await SessionPrompt.waitForFinish(input.sessionID, input.directory)
      },
    })
  }

  export const TestHooks = {
    installWakeLoopExecutor(executor: WakeLoopExecutor): Disposable {
      if (wakeLoopExecutorForTest) throw new Error("SessionWake loop executor is already installed")
      wakeLoopExecutorForTest = executor
      return {
        [Symbol.dispose]() {
          if (wakeLoopExecutorForTest === executor) wakeLoopExecutorForTest = undefined
        },
      }
    },
    installBeforeWakeLoopActivation(hook: () => void | Promise<void>): Disposable {
      if (beforeWakeLoopActivationForTest) throw new Error("SessionWake activation test hook is already installed")
      beforeWakeLoopActivationForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeWakeLoopActivationForTest === hook) beforeWakeLoopActivationForTest = undefined
        },
      }
    },
  }
}
