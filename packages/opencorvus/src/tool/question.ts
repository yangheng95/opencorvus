import z from "zod"
import { Tool } from "./tool"
import { Question } from "../question"
import DESCRIPTION from "./question.txt"

export const QuestionTool = Tool.define("question", {
  description: DESCRIPTION,
  parameters: z.object({
    questions: z.array(Question.Info).min(1).max(4).describe("1-4 questions to ask in a single turn."),
  }),
  async execute(params, ctx) {
    const result = await Question.askAndFormat({
      sessionID: ctx.sessionID,
      questions: params.questions,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
    })
    return {
      title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
      output: result.output,
      metadata: {
        status: result.status,
        answers: result.answers,
        ...(result.status === "expired"
          ? {
              requestID: result.requestID,
              timeExpires: result.timeExpires,
              timeResolved: result.timeResolved,
            }
          : {}),
      },
    }
  },
})
