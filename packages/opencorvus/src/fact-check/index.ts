/**
 * Fact-Check Agent — verifies factual claims registered by upstream
 * worker domain artifacts and visible assistant messages.
 *
 * Per fact-check agent contract §4 / §5:
 *   - Read-only retrieval surface (web / code / memory; NO edit / bash /
 *     memory_write / git).
 *   - Domain-completion tool `record_fact_check_review`; it does not end the streamed Turn.
 *   - fact-check-core.txt does NOT receive the registration fragment
 *     (anti-recursion).
 *   - The active expert-squad scheduler may dispatch the `fact_check`
 *     adapter when its declared evidence obligations require it.
 */

import { Log } from "@/util/log"
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderPromptSections } from "@/agent/prompt-projection"
import { filterAgentTools } from "@/agent/filter-tools"
import { createAgentCoordinationRuntimeTools } from "@/agent/coordination-runtime-tools"
import { createReadonlyRetrievalTools } from "@/agent/retrieval-tools"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { createFactCheckOutputTools, type FactCheckCollector } from "./tools"
import type { FactCheckReview } from "./schema"
import { projectFactCheckFacts, type FactCheckFactProjection } from "./discovery-instruction"
import { requireTask } from "@/engine/store"
import { renderUserRequestSection } from "@/intent/request-prompt"

const log = Log.create({ service: "fact-check-agent" })

/** Maximum number of characters of target-message text injected into the
 *  fact-check user prompt.  Bounded because the message can be large
 *  (e.g. an architect goal graph dump) and an unbounded copy would blow
 *  the prompt budget. The fact-check agent has `read` etc. if it
 *  needs to inspect more.
 *
 *  Module-scope so buildFactCheckUserPrompt (also at module scope) can
 *  see it. Previously a duplicate lived inside FactCheckAgent namespace
 *  — buildFactCheckUserPrompt could not reach it from outside the
 *  namespace, producing TS2552 against the local `targetMessageText`. */
const TARGET_MESSAGE_TEXT_CAP = 8000

function buildFactCheckUserPrompt(
  input: FactCheckAgent.RunInput,
  targetMessageText: string,
  projection: FactCheckFactProjection,
): string {
  const sections: string[] = []
  sections.push("# Delegation")
  sections.push(
    `Projected agent "${input.agentID}" is asked through the fact_check adapter to verify factual claims in exact assistant ` +
      `message \`${input.targetMessageID}\` from worker session \`${input.targetSessionID}\` (agent: \`${input.targetAgent}\`).`,
  )
  const task = requireTask(input.taskID)
  sections.push(renderUserRequestSection({ heading: "# Original request", request: task.request, taskID: task.id }))
  sections.push(`# Why this was dispatched\n\n${input.reason}`)
  sections.push(
    `# Target message snapshot\n\n` +
      `- session: \`${input.targetSessionID}\`\n` +
      `- message_id: \`${input.targetMessageID}\`\n` +
      `- content_hash: \`${input.targetMessageContentHash}\`\n` +
      "\n" +
      "The target is an exact persisted assistant-message snapshot, not a claim about Session liveness. " +
      "Use the message id and content hash below to detect any reference mismatch.",
  )
  if (targetMessageText.trim().length > 0) {
    const truncated = targetMessageText.length > TARGET_MESSAGE_TEXT_CAP
    const body = truncated
      ? targetMessageText.slice(0, TARGET_MESSAGE_TEXT_CAP) +
        `\n\n…(truncated; ${targetMessageText.length - TARGET_MESSAGE_TEXT_CAP} more chars)`
      : targetMessageText
    sections.push(`# Target message content\n\n\`\`\`\n${body}\n\`\`\``)
  } else {
    sections.push(
      "# Target message content\n\n_(The target assistant message had no text parts. Inspect the exact selected domain-artifact facts below and use your retrieval tools to verify the claims directly.)_",
    )
  }
  sections.push(`# Durable Artifact discovery\n\n${projection.discoveryInstruction}`)
  const contextSection = renderPromptSections(input.contextSections)
  if (contextSection) sections.push(contextSection)
  sections.push(
    "# Output contract\n\n" +
      "Inspect the registered items using your tools. Publish the required structured review with " +
      "`record_fact_check_review`; the tool does not end the streamed session. Its `scope` must match the " +
      `snapshot above verbatim: target_session_id=\`${input.targetSessionID}\`, ` +
      `target_agent=\`${input.targetAgent}\`, target_message_id=\`${input.targetMessageID}\`, ` +
      `target_message_content_hash=\`${input.targetMessageContentHash}\`. ` +
      "Follow the verdict decision tree from fact-check-core.txt and the evidence discipline " +
      "(every verified / corrected item must cite at least one evidence pointer). Put your summary, limits, and blockers " +
      "in the final visible assistant message.",
  )
  return sections.join("\n\n")
}

/**
 * Extract the concatenated text/reasoning content of the exact target
 * assistant message so the fact-check agent can inspect the actual claims.
 *
 * @internal — exported for the direct regression test at
 * test/fact-check/load-target-message-text.test.ts (codex impl review
 * round 4). Not part of the fact-check public API; callers outside this
 * module should go through `FactCheckAgent.run` which invokes this
 * function as part of prompt construction.
 *
 * Failure semantics (codex impl review round 2 §B-2 — rule 7 no silent
 * fallback):
 *   - MessageStore.stream errors (DB error, session not found) → THROW.  The
 *     orchestrator tool's catch persists outcome=tool_error so the
 *     orchestrator LLM sees the failure rather than getting a fake
 *     "no text" report.
 *   - Message exists in stream but has no text/reasoning parts → return
 *     empty string (this IS the honest "no text" case).
 *   - Message id not in stream (worker truncated the session or a stale
 *     id was passed) → THROW with a clear error message.
 */
export async function loadTargetMessageText(
  sessionID: string,
  messageID: string,
  expectedContentHash: string,
): Promise<string> {
  const { MessageStore } = await import("@/session/message-store")
  const { canonicalAssistantMessageContent } = await import("@/session/assistant-message-content")
  for await (const msg of MessageStore.stream(sessionID)) {
    if (msg.info.id !== messageID) continue
    const content = canonicalAssistantMessageContent(msg.parts)
    if (content.hash !== expectedContentHash) {
      throw new Error(
        `fact-check: target message ${messageID} content hash changed: expected ${expectedContentHash}, found ${content.hash}`,
      )
    }
    return content.text
  }
  // The stream completed without seeing the requested message id.
  // Throw — orchestrator catch persists tool_error so the caller knows
  // the snapshot the host took has gone stale (rule 7).
  throw new Error(
    `fact-check: target message ${messageID} not found in session ${sessionID} (snapshot stale or wrong target id)`,
  )
}

export namespace FactCheckAgent {
  export function sessionCreatedObserver(
    callback: RunInput["onSessionCreated"],
  ): ((session: { id: string }) => void | Promise<void>) | undefined {
    return callback ? (session) => callback(session.id) : undefined
  }

  export interface RunInput {
    /** Target worker session owning the exact assistant message being verified. */
    targetSessionID: string
    /** Target worker's agent name ("build" / "architect" / ...) — used in
     *  the prompt for the LLM to know which kind of content it is verifying. */
    targetAgent: string
    /** Exact message observation from Session.snapshotAssistantMessage(). */
    targetMessageID: string
    targetMessageContentHash: string
    contextSections?: string[]
    /** Free-text reason the orchestrator wrote when invoking the tool. */
    reason: string
    /** Orchestrator session id (used as the persistence idempotency key and
     *  as the parent for the child fact-check session). */
    orchestratorSessionID: string
    /** Optional explicit task id; otherwise inherits from the orchestrator
     *  session via runAgentSession internals. */
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    signal?: AbortSignal
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }

  export interface RunOutput {
    sessionID: string
    finalMessageID: string
    /** Required for Fact Check domain success; absence remains a physical Turn with incomplete domain delivery. */
    review?: FactCheckReview
  }

  export async function run(input: RunInput): Promise<RunOutput | AgentCoordinationHandoffResult> {
    log.info("fact-check starting", {
      targetSessionID: input.targetSessionID,
      targetAgent: input.targetAgent,
    })

    const retrievalTools = await filterAgentTools(createReadonlyRetrievalTools(), "fact-check", {
      taskID: input.taskID,
      sessionID: input.orchestratorSessionID,
    })
    const coordinationTools = await filterAgentTools(
      await createAgentCoordinationRuntimeTools({
        agentID: input.agentID,
        taskID: input.taskID,
        signal: input.signal,
      }),
      "fact-check",
      {
        taskID: input.taskID,
        sessionID: input.orchestratorSessionID,
      },
    )
    const outputToolKit = createFactCheckOutputTools()
    const factProjection = projectFactCheckFacts({ taskID: input.taskID })
    const targetMessageText = await loadTargetMessageText(
      input.targetSessionID,
      input.targetMessageID,
      input.targetMessageContentHash,
    )

    let runErrored = false
    try {
      const out = await runAgentSession<FactCheckCollector>({
        agentID: input.agentID,
        packageRevision: input.packageRevision,
        sessionTitle:
          `${input.agentID} (fact-check): ${input.targetAgent} ` + `(${input.targetSessionID.slice(0, 12)})`,
        newSessionID: input.newSessionID,
        existingSessionID: input.existingSessionID,
        continuationPrompt: input.continuationPrompt,
        dispatchTurn: input.dispatchTurn,
        parentSessionID: input.orchestratorSessionID,
        taskID: input.taskID,
        workScope: input.workScope,
        signal: input.signal,
        onSessionCreated: sessionCreatedObserver(input.onSessionCreated),
        onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
          ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
          : undefined,
        onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
        toolKit: {
          tools: { ...retrievalTools, ...coordinationTools, ...outputToolKit.tools },
          stageOwnedToolIDs: Object.keys(outputToolKit.tools),
          getCollector: outputToolKit.getCollector,
        },
        buildUserPrompt: () => buildFactCheckUserPrompt(input, targetMessageText, factProjection),
      })

      const coordinationHandoff = agentCoordinationHandoffResult(out)
      if (coordinationHandoff) return coordinationHandoff

      const review = out.collector.review
      log.info("fact-check finished", {
        sessionID: out.session.id,
        reviewRecorded: Boolean(review),
        verdict: review?.overall_verdict,
        verified: review?.verified.length,
        corrected: review?.corrected.length,
        unresolved: review?.unresolved.length,
      })
      return {
        sessionID: out.session.id,
        finalMessageID: out.finalMessage.info.id,
        ...(review ? { review } : {}),
      }
    } catch (err) {
      runErrored = true
      if (input.signal?.aborted) {
        log.info("fact-check aborted", {
          targetSessionID: input.targetSessionID,
          error: err instanceof Error ? err.message : String(err),
        })
      } else {
        log.error("fact-check tool error", {
          targetSessionID: input.targetSessionID,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      throw err
    } finally {
      if (runErrored) {
        // Reset the collector so a retry from the orchestrator side
        // doesn't accidentally see stale state. (The runtime is one-shot
        // per call; collector is local to this invocation.)
        outputToolKit.reset()
      }
    }
  }
}
