import z from "zod"
import { EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { assertTaskEvidenceLocators } from "@/engine/evidence-locator"
import { recordMailboxMessage } from "@/engine/mailbox"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { Session } from "@/session"
import { validateSessionRuntimeContractForContinuation } from "@/session/runtime-contract-validation"
import { Tool } from "./tool"

const SendMailboxMessageInput = z
  .object({
  category: z
    .enum(["progress", "status", "notification"])
    .describe("Message kind: progress update, execution status, or operator-facing notification."),
  subject: z.string().min(1).describe("Short mailbox list title."),
  body: z.string().min(1).describe("Concrete update with enough context to understand it without hidden messages."),
  attention: z
    .boolean()
    .optional()
    .default(false)
    .describe("True only when the update deserves operator attention; this does not block scheduling."),
  progress: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Optional completion ratio from 0 to 1 for a progress update."),
  evidence_locators: EvidenceLocatorListSchema
    .optional()
    .describe(
      "Exact typed evidence locators supporting the update. Raw IDs, file paths, log labels, and artifact:<id> display strings are invalid.",
    ),
  })
  .strict()

type SendMailboxMessageParams = z.infer<typeof SendMailboxMessageInput>

export async function executeSendMailboxMessage(params: SendMailboxMessageParams, ctx: Tool.Context) {
  const input = SendMailboxMessageInput.parse(params)
  const executionAuthority = Tool.requireExecutionAuthority(ctx)
  if (executionAuthority.kind !== "task") {
    throw new Error("send_mailbox_message requires explicit Task execution authority")
  }
  const taskID = executionAuthority.taskID
  if (!ctx.callID) throw new Error("send_mailbox_message requires the current tool call id")

  const session = await Session.get(ctx.sessionID)
  const runtimeContract = validateSessionRuntimeContractForContinuation({
    sessionID: ctx.sessionID,
    expectedSessionKind: session.kind,
    expectedAgentID: ctx.agent,
    requireRuntimeContract: true,
    requireWorkerTurnDescriptor: true,
  })
  if (!runtimeContract || runtimeContract.identity.identityKind !== "projected-worker") {
    throw new Error(`send_mailbox_message requires a projected worker runtime for ${ctx.sessionID}`)
  }

  const owningTask = taskIDForSession(ctx.sessionID)
  if (owningTask && owningTask !== taskID) {
    throw new Error(`send_mailbox_message session ${ctx.sessionID} belongs to task ${owningTask}, not ${taskID}`)
  }

  const evidenceLocators = await assertTaskEvidenceLocators({
    taskID,
    evidenceLocators: input.evidence_locators ?? [],
  })
  const row = recordMailboxMessage({
    taskID,
    sessionID: ctx.sessionID,
    agentID: ctx.agent,
    expertSquadID: runtimeContract.identity.expertSquadID,
    category: input.category,
    subject: input.subject,
    body: input.body,
    attention: input.attention,
    progress: input.progress,
    evidenceLocators,
    summary: `${input.subject}: ${input.body}`,
    correlationID: `mailbox:${ctx.sessionID}:${ctx.messageID}:${ctx.callID}`,
  })

  return {
    title: "mailbox message",
    output: JSON.stringify({
      message_id: row.id,
      task_id: taskID,
      session_id: ctx.sessionID,
      category: row.payload.category,
      replayed: !row.createdNow,
      orchestrator_wake: "not_dispatched",
      message:
        "Mailbox message recorded. It is visible to the operator and to the orchestrator on its next natural wake.",
    }),
    metadata: {
      messageID: row.id,
      taskID,
      sessionID: ctx.sessionID,
      category: row.payload.category,
    },
  }
}

export const SendMailboxMessageTool = Tool.define("send_mailbox_message", {
  description: `Send a visible, durable task update to the global Mailbox under this Task's owning project directory.

Use this for execution progress, non-terminal status, and notifications that the operator and scheduler should see. The message is appended to Task protocol history and appears in the left-sidebar mailbox. It does not wake the scheduler or change Task lifecycle.

Use request_orchestrator_decision instead when you need an explicit scheduling, scope, retry, cancellation, or user-question decision. Do not claim canonical Task completion through this tool.`,
  parameters: SendMailboxMessageInput,
  async execute(params, ctx) {
    return executeSendMailboxMessage(params, ctx)
  },
})
