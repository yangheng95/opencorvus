import { Session } from "./index"
import { Instance } from "@/project/instance"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
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
import { createExecutionCancellationOrigin } from "./prompt/cancellation"

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
  }) => Promise<void>
  let wakeLoopExecutorForTest: WakeLoopExecutor | undefined

  export const MissionChildTaskResultWakeReason = z
    .object({
      source: z.literal("mission.child_task_result"),
      missionID: z.string().optional(),
      taskID: z.string().min(1),
      taskTitle: z.string().min(1),
      taskStatus: z.enum(["completed", "failed", "cancelled"]),
      terminalLifecycleReference: TerminalLifecycleReferenceSchema,
      completionDecisionArtifactID: z.string().min(1).optional(),
    })
    .strict()

  export const WakeReason = z.discriminatedUnion("source", [
    z.object({
      source: z.literal("mission.operator"),
      missionID: z.string().optional(),
    }),
    z.object({
      source: z.literal("conversation.handoff"),
      callerSessionID: Identifier.schema("session"),
      callerMessageID: Identifier.schema("message"),
      targetExperience: z.literal("work"),
    }),
    MissionChildTaskResultWakeReason,
    z.object({
      source: z.literal("scheduler.automation"),
      jobID: z.string(),
      jobName: z.string(),
      fireID: z.string(),
      scope: z.enum(["session", "project", "global"]),
      recurrence: z.string().nullable(),
    }),
    z.object({
      source: z.literal("scheduler.event"),
      jobID: z.string(),
      jobName: z.string(),
      fireID: z.string(),
      eventType: z.string(),
      oneShot: z.boolean(),
    }),
    z.object({
      source: z.literal("scheduler.task_queue"),
      queueTaskID: z.string().optional(),
      queueSource: z.string().optional(),
    }),
  ])
  export type WakeReason = z.infer<typeof WakeReason>

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
  }

  export function reasonExtra(reason: WakeReason): { wake_reason: WakeReason } {
    return { wake_reason: WakeReason.parse(reason) }
  }

  /**
   * Wake a session by appending the scheduled prompt.
   * Returns the session ID (existing or newly created).
   */
  export async function wake(input: WakeInput): Promise<string> {
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
      const message = await SessionPrompt.prompt.force(resolvedPromptInput, {
        prepared,
        signal: input.signal,
        commitBundle: input.commitBundle,
        controls: (info) => [
          {
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
      startPersistedWakeLoop({ sessionID, messageID: message.info.id, directory })

      return sessionID
    })
  }

  export function resumePersistedWake(input: { sessionID: string; messageID: string; directory: string }): void {
    startPersistedWakeLoop(input)
  }

  function startPersistedWakeLoop(input: { sessionID: string; messageID: string; directory: string }): void {
    const reservation = RuntimeExecutionSettlement.reserve(
      "session_wake_loop",
      `session-wake-loop:${input.sessionID}:${input.messageID}`,
    )
    reservation.onCancel((reason) => {
      try {
        SessionPrompt.cancel(
          input.sessionID,
          input.directory,
          createExecutionCancellationOrigin({
            actor: "runtime",
            source: "process.shutdown",
            surface: "session-wake-loop",
            reason: reason instanceof Error ? reason.message : String(reason),
            targetSessionID: input.sessionID,
            messageID: input.messageID,
          }),
        )
      } catch (error) {
        log.warn("wake loop cancellation callback failed", {
          sessionID: input.sessionID,
          messageID: input.messageID,
          error,
        })
      }
    })
    const operation = Promise.resolve().then(() =>
      (wakeLoopExecutorForTest ?? executeWakeLoop)({
        ...input,
        signal: reservation.signal,
      }),
    )
    reservation.settleWith(operation)
    void operation.catch((err) => {
      log.error("wake loop failed", { sessionID: input.sessionID, messageID: input.messageID, err })
    })
  }

  async function executeWakeLoop(input: {
    sessionID: string
    messageID: string
    directory: string
    signal: AbortSignal
  }): Promise<void> {
    await runWithInitializedIndependentProject({
      directory: input.directory,
      signal: input.signal,
      fn: async () => {
        input.signal.throwIfAborted()
        await SessionPrompt.loop({
          sessionID: input.sessionID,
          resume_existing: false,
          reply_to_message_id: input.messageID,
        })
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
  }
}
