import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, printAttachedResult, withAttachOptions } from "./attach"
import { Answer } from "../../question/types"

/**
 * Operator-facing question interactions for hosts that drive a running server
 * over HTTP (Hermes Agent, OpenClaw, or any Agent Skills host).
 *
 * Without these, an unattended host cannot answer a clarifying question: the
 * request sits pending until the automatic deadline expires it, and the agent
 * continues on its own assumption instead of the operator's answer.
 */
export const QuestionCommand = cmd({
  command: "question",
  describe: "list and answer pending assistant questions on a running server",
  builder: (yargs: Argv) =>
    yargs.command(QuestionListCommand).command(QuestionReplyCommand).command(QuestionRejectCommand).demandCommand(),
  async handler() {},
})

export const QuestionListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list pending question requests",
  builder: (yargs: Argv) => withAttachOptions(yargs),
  handler: async (args) => {
    const server = attach(args)
    const questions = await server.result("question list", server.client.question.list({}))

    if (args.format === "json") {
      console.log(JSON.stringify(questions, null, 2))
      return
    }

    if (questions.length === 0) {
      UI.println("No pending questions")
      return
    }

    const lines: string[] = []
    for (const request of questions) {
      lines.push(`${request.id}  session=${request.sessionID}`)
      request.questions.forEach((info, index) => {
        const selection = info.multiple ? "multiple" : "single"
        const custom = info.custom ? ", custom answers allowed" : ""
        lines.push(`  [${index}] ${info.header}: ${info.question}  (${selection}${custom})`)
        for (const option of info.options) {
          const disabled = option.disabled ? " (disabled)" : ""
          lines.push(`        ${option.value}${disabled} — ${option.label}: ${option.description}`)
        }
      })
      // Both deadlines are surfaced because they mean different things: an
      // automatic contract answers on the operator's behalf, while an expiry
      // abandons the question with no decision attributed.
      if (request.automatic) {
        lines.push(`  automatic answer at ${new Date(request.automatic.timeExpires).toISOString()}`)
      }
      if (request.expiry) {
        lines.push(`  expires unanswered at ${new Date(request.expiry.timeExpires).toISOString()}`)
      }
    }
    console.log(lines.join(EOL))
  },
})

export const QuestionReplyCommand = cmd({
  command: "reply <requestID>",
  describe: "answer a pending question request",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("requestID", {
        describe: "question request ID from `question list`",
        type: "string",
        demandOption: true,
      })
      .option("answers", {
        type: "string",
        describe: 'JSON array of answer arrays in question order, for example [["yes"],["postgres","redis"]]',
        demandOption: true,
      }),
  handler: async (args) => {
    const answers = parseQuestionAnswers(args.answers)
    const server = attach(args)
    const result = await server.result(
      "question reply",
      server.client.question.reply({ requestID: args.requestID, answers }),
    )
    printAttachedResult(args.format, result, `Answered question ${args.requestID} with ${answers.length} answer(s)`)
  },
})

export const QuestionRejectCommand = cmd({
  command: "reject <requestID>",
  describe: "reject a pending question request without answering it",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("requestID", {
      describe: "question request ID from `question list`",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const server = attach(args)
    const result = await server.result("question reject", server.client.question.reject({ requestID: args.requestID }))
    printAttachedResult(args.format, result, `Rejected question ${args.requestID}`)
  },
})

/** Preserve exact option values and custom text through the server's answer schema. */
export function parseQuestionAnswers(raw: string): string[][] {
  return Answer.array().parse(JSON.parse(raw))
}
