import { tool } from "ai"
import z from "zod"
import { Log } from "@/util/log"
import { Question } from "@/question"
import { requireTask } from "@/engine/store"
import { MessageStore } from "@/session/message-store"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"

const log = Log.create({ service: "task-tools" })

export const ORCHESTRATOR_QUESTION_DESCRIPTION =
  "Ask the user for the one pre-dispatch verification-budget preference defined by the scheduler instructions, or for authority or facts that exclusively belong to the operator and block the accepted Task contract. " +
  "The verification-budget interaction asks one concise question, recommends skip_optional_testing, and offers run_optional_testing only when the active package can execute a concrete additional confidence increment with an exact test scope and stated relative time/token cost. Rejection or automatic deadline expiry has exactly the skip_optional_testing meaning: do not dispatch or execute any testing or assurance work named by the question; continue only requirements that were already mandatory outside the optional question. Never repeat an answered preference or ask after domain dispatch exists. " +
  "Other valid triggers are credentials or inaccessible external facts only the operator can provide, explicit approval for an irreversible or destructive operation, or an irreducible externally meaningful product choice that current Task evidence cannot decide. " +
  "A local runtime, process, provider, projected-worker, repository, or Tool failure is recovery evidence, never a user decision and never authority to ask whether work should continue or stop; use the exact dispatch, named wait, recovery, or lifecycle action instead. " +
  "The questions appear in the Task Interaction panel. Each question may provide options for click-selection; omit options for free text. Set multiple=true to allow multi-select. Returns a model-visible answered, operator-rejected, or automatic-deadline-expired outcome."

export function createOrchestratorInteractionTools(input: {
  taskID: string
  agentSessionID: string
  allowedRootMessages: readonly {
    messageID: string
    kind: "operator" | "orchestrator"
  }[]
}) {
  return {
    read_task_message: tool({
      description:
        "Read one exact already-recorded task-root message ID authorized by this wake's Wake Provenance. The initial Task creator request is already the normal User Request and is not eligible for this tool. Retry/Replan may authorize ordered superseded operator messages by ID; this tool never grants broad root-Session history access.",
      inputSchema: z
        .object({
          message_id: z.string().min(1).describe("Exact authorized task-root message ID."),
          reason: z.string().describe("Why this exact task-root message is needed for the scheduler decision"),
        })
        .strict(),
      execute: async ({ message_id, reason }) => {
        const wake = input.allowedRootMessages.find((candidate) => candidate.messageID === message_id)
        if (!wake) throw new Error(`Task ${input.taskID} wake does not authorize task-root message ${message_id}`)
        const task = requireTask(input.taskID)
        if (!task.session_id) throw new Error(`Task ${input.taskID} has no root session`)
        if (task.project_id !== Instance.project.id) {
          throw new Error(`Task-root message ${wake.messageID} does not belong to the active project`)
        }
        await Session.assertLineageInProject({ sessionID: task.session_id, projectID: task.project_id })
        const message = await MessageStore.get({ sessionID: task.session_id, messageID: message_id })
        if (message.info.role !== "user") {
          throw new Error(`Task-root message ${message_id} must have role=user, received ${message.info.role}`)
        }
        const expectedAuthor = wake.kind === "operator" ? "user" : "orchestrator"
        if (message.info.author !== expectedAuthor) {
          throw new Error(
            `Task-root message ${message_id} kind=${wake.kind} requires author=${expectedAuthor}, received ${message.info.author}`,
          )
        }
        const provenance = TaskRootMessageProvenance.parse(message.info.extra?.task_root_message)
        if (provenance.taskID !== input.taskID) {
          throw new Error(
            `Task-root message ${message_id} provenance belongs to task ${provenance.taskID}, expected ${input.taskID}`,
          )
        }
        if (provenance.kind !== wake.kind) {
          throw new Error(`Task-root message ${message_id} provenance kind=${provenance.kind}, expected ${wake.kind}`)
        }
        const textParts = message.parts.filter((part) => part.type === "text").map((part) => part.text)
        const fileParts = message.parts
          .filter((part) => part.type === "file")
          .map((part) => JSON.stringify({ type: "file", url: part.url, mime: part.mime, filename: part.filename }))
        return [
          `Task-root message ${message_id} (${wake.kind}) is already recorded. Reason: ${reason}.`,
          `source=${provenance.source}`,
          "",
          ...textParts,
          ...fileParts,
        ].join("\n")
      },
    }),

    question: tool({
      description: ORCHESTRATOR_QUESTION_DESCRIPTION,
      inputSchema: z.object({
        questions: z
          .array(
            z.object({
              question: z.string().describe("The complete question text to show the user."),
              header: z.string().describe("Short label (≤30 chars) used as a chip/title."),
              options: z
                .array(
                  z.object({
                    value: z.string().describe("Stable machine-facing value returned when selected."),
                    label: z.string().describe("Display text (1-5 words)."),
                    description: z.string().describe("Explanation of this choice."),
                  }),
                )
                .default([])
                .describe("Click-selectable options. Leave empty for free-text-only answers."),
              multiple: z.boolean().optional().describe("Allow multi-select (default false)."),
              custom: z.boolean().optional().describe("Allow a custom typed answer (default true)."),
            }),
          )
          .min(1)
          .max(4)
          .describe("1-4 questions to ask in a single turn."),
        reason: z.string().optional().describe("Why you're asking (short, shown in logs — not to the user)."),
      }),
      execute: async ({ questions, reason }) => {
        log.info("question", { taskID: input.taskID, count: questions.length, reason })
        const { output } = await Question.askAndFormat({
          sessionID: input.agentSessionID,
          questions: questions.map((question) => ({
            question: question.question,
            header: question.header,
            options: question.options,
            multiple: question.multiple,
            custom: question.custom,
          })),
        })
        return output
      },
    }),
  }
}
