import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { CapabilityRules } from "@/capability/rules"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import z from "zod"
import { Tool } from "./tool"
import {
  WORK_ARTIFACT_DELIVER_TOOL_ID,
  WORK_ARTIFACT_INSPECT_TOOL_ID,
  WORK_ARTIFACT_TOOL_IDS,
  WORK_ARTIFACT_VALIDATE_TOOL_ID,
  WORK_PARENT_ONLY_TOOL_IDS,
} from "@/work/harness"
import { createExecutionCancellationOrigin, isExecutionCancellationError } from "@/session/prompt/cancellation"
import { PANEL_LEAF_TOOL_IDS } from "@/panel/action-ids"

export const DELEGATE_AGENT_TOOL_ID = "delegate_agent" as const

const LOCAL_DELEGATE_DISABLED_TOOLS = [
  DELEGATE_AGENT_TOOL_ID,
  ...PANEL_LEAF_TOOL_IDS,
  "schedule",
  "mission_state",
  "question",
  "memory",
  ...WORK_PARENT_ONLY_TOOL_IDS,
] as const

const DelegateAgentParameters = z
  .object({
    instruction: z
      .string()
      .trim()
      .min(1)
      .describe(
        "A complete, self-contained brief with the objective, relevant context, scope, constraints, evidence requirements, and expected output.",
      ),
  })
  .strict()

const DelegateAgentOutcomeSchema = z
  .object({
    kind: z.literal("terminal_success"),
    session_id: z.string().min(1),
    final_message_id: z.string().min(1),
    handoff: z.string().min(1),
  })
  .strict()

type ParentModel = {
  providerID: string
  id: string
}

function requireParentModel(value: unknown): ParentModel {
  if (!value || typeof value !== "object") {
    throw new Error("delegate_agent requires the exact parent model in tool context")
  }
  const model = value as Record<string, unknown>
  if (typeof model.providerID !== "string" || !model.providerID.trim()) {
    throw new Error("delegate_agent parent model is missing providerID")
  }
  if (typeof model.id !== "string" || !model.id.trim()) {
    throw new Error("delegate_agent parent model is missing canonical model id")
  }
  return { providerID: model.providerID, id: model.id }
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("delegate_agent aborted", "AbortError")
}

function delegatedInstruction(input: { instruction: string; parentAgent: "coding" | "chat" | "work" }): string {
  return [
    `You are a session-local child of the ${input.parentAgent} assistant.`,
    "Complete the bounded instruction below in this independent context.",
    "",
    "This is not an engine task or expert-squad dispatch. Do not create or manage tasks, goals, Mission state, schedules, or further child agents. You share the parent's workspace, so preserve unrelated changes and modify files only when the brief clearly requires it.",
    ...(input.parentAgent === "work"
      ? [
          "",
          `You may inspect and validate Work Artifacts with ${WORK_ARTIFACT_INSPECT_TOOL_ID} and ${WORK_ARTIFACT_VALIDATE_TOOL_ID}, but ${WORK_ARTIFACT_DELIVER_TOOL_ID} is parent-owned and unavailable. Report review findings to the parent; do not claim final delivery.`,
        ]
      : []),
    "",
    "Use ordinary visible narrative while you work: report confirmed facts, the next action, changed assumptions, blockers, and verification outcomes without exposing private chain-of-thought. Finish with a concise evidence-backed handoff for the parent assistant, including files changed, validation performed, and unresolved issues.",
    "Answer and hand off in the language used by the delegated instruction's authored request. Runtime scaffolding and quoted source material do not change that language.",
    "",
    "## Delegated instruction",
    input.instruction,
  ].join("\n")
}

export const DelegateAgentTool = Tool.define(DELEGATE_AGENT_TOOL_ID, {
  description:
    "Delegate one bounded, self-contained piece of the current Coding, Chat, or Work request to a real session-local child agent. Use it for context isolation, independent investigation or review, and non-overlapping work. It is not Task Orchestrator dispatch: it creates no task, goal, expert-squad projection, worktree, or scheduler lifecycle. The parent remains responsible for synthesis, verification, and final Work deliverable publication.",
  parameters: DelegateAgentParameters,
  async execute(input, ctx) {
    const executionAuthority = Tool.requireExecutionAuthority(ctx)
    if (executionAuthority.kind !== "conversation") {
      throw new Error("delegate_agent is only available to standalone conversation execution.")
    }
    if (
      !PrimaryAssistantRegistry.isID(ctx.agent) ||
      (ctx.agent !== "coding" && ctx.agent !== "chat" && ctx.agent !== "work")
    ) {
      throw new Error(`delegate_agent is available only to coding, chat, or work, found ${JSON.stringify(ctx.agent)}`)
    }
    if (ctx.abort.aborted) {
      throw abortError(ctx.abort)
    }
    const parent = await Session.get(ctx.sessionID)
    const model = requireParentModel(ctx.extra?.model)
    const deniedPermissions: CapabilityRules.Ruleset = LOCAL_DELEGATE_DISABLED_TOOLS.map((permission) => ({
      permission,
      pattern: "*",
      action: "deny" as const,
    }))
    const childPermission = CapabilityRules.merge(parent.permission ?? [], deniedPermissions)
    const { SessionPrompt } = await import("@/session/prompt")
    const child = await Session.createNext({
      kind: "assistant",
      parentID: parent.id,
      directory: parent.directory,
      title: `Delegated: ${input.instruction.slice(0, 80)}`,
      permission: childPermission,
      metadata: {
        delegation: {
          kind: "session-local",
          parentAgent: ctx.agent,
          parentMessageID: ctx.messageID,
          parentToolCallID: ctx.callID,
        },
      },
    })
    let rawParentOrigin: ReturnType<typeof createExecutionCancellationOrigin> | undefined
    const childCancellationOrigin = () => {
      if (isExecutionCancellationError(ctx.abort.reason)) {
        return { ...ctx.abort.reason.origin, targetSessionID: child.id }
      }
      rawParentOrigin ??= createExecutionCancellationOrigin({
        actor: "runtime",
        source: "delegate_agent.parent_signal",
        surface: "agent",
        requestID: ctx.callID,
        reason: "delegate_agent parent signal aborted",
        targetSessionID: child.id,
        messageID: ctx.messageID,
        toolCallID: ctx.callID,
      })
      return rawParentOrigin
    }
    const abortChild = () => SessionPrompt.cancel(child.id, child.directory, childCancellationOrigin())
    let promptGenerationOwner: AbortSignal | undefined
    let abortListenerInstalled = false
    try {
      ctx.metadata({
        title: child.title,
        metadata: { childSessionID: child.id, parentSessionID: parent.id, agent: ctx.agent },
      })
      ctx.abort.addEventListener("abort", abortChild, { once: true })
      abortListenerInstalled = true
      if (ctx.abort.aborted) {
        abortChild()
        throw abortError(ctx.abort)
      }
      const result = await SessionPrompt.prompt(
        {
          sessionID: child.id,
          model: { providerID: model.providerID, modelID: model.id },
          agent: ctx.agent,
          author: ctx.agent,
          tools: Object.fromEntries(LOCAL_DELEGATE_DISABLED_TOOLS.map((toolID) => [toolID, false])),
          parts: [
            { type: "text", text: delegatedInstruction({ instruction: input.instruction, parentAgent: ctx.agent }) },
          ],
        },
        {
          beforeLoop: async () => {
            await Session.setPermission({ sessionID: child.id, permission: childPermission })
          },
        },
      )
      promptGenerationOwner = SessionPrompt.messageOwner(child.id, result.info.id)
      if (!promptGenerationOwner && SessionPrompt.hasGeneration(child.id)) {
        throw new Error(
          `delegate_agent child ${child.id} final message ${result.info.id} has no prompt generation receipt`,
        )
      }
      await SessionStatus.set(child.id, { type: "terminal", reason: "completed" }, { promptGenerationOwner })
      const handoff = result.parts
        .filter((part): part is Extract<(typeof result.parts)[number], { type: "text" }> => part.type === "text")
        .map((part) => part.text.trim())
        .filter(Boolean)
        .join("\n\n")
      return {
        title: child.title,
        metadata: { childSessionID: child.id, parentSessionID: parent.id, agent: ctx.agent },
        output: JSON.stringify(
          DelegateAgentOutcomeSchema.parse({
            kind: "terminal_success",
            session_id: child.id,
            final_message_id: result.info.id,
            handoff,
          }),
        ),
      }
    } catch (error) {
      if (ctx.abort.aborted) {
        SessionPrompt.cancel(child.id, child.directory, childCancellationOrigin())
        await SessionStatus.set(
          child.id,
          {
            type: "terminal",
            reason: "aborted",
            error: abortError(ctx.abort).message,
          },
          { promptGenerationOwner },
        )
      } else {
        await SessionStatus.set(
          child.id,
          {
            type: "terminal",
            reason: "error",
            error: error instanceof Error ? error.message : String(error),
          },
          { promptGenerationOwner },
        )
      }
      throw error
    } finally {
      if (abortListenerInstalled) ctx.abort.removeEventListener("abort", abortChild)
    }
  },
})
