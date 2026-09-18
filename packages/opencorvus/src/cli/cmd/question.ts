import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, withAttachOptions } from "./attach"

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
      .option("answer", {
        alias: ["a"],
        type: "string",
        array: true,
        describe:
          "one answer per question, in order; repeat the flag for multiple questions and " +
          "comma-separate the values selected for a multiple-choice question",
        demandOption: true,
      }),
  handler: async (args) => {
    const answers = parseQuestionAnswers(args.answer)
    const server = attach(args)
    await server.result("question reply", server.client.question.reply({ requestID: args.requestID, answers }))
    UI.println(`Answered question ${args.requestID} with ${answers.length} answer(s)`)
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
    await server.result("question reject", server.client.question.reject({ requestID: args.requestID }))
    UI.println(`Rejected question ${args.requestID}`)
  },
})

/**
 * `--answer a --answer b,c` answers question 0 with ["a"] and question 1 with
 * ["b", "c"]. The route validates arity and option membership against the
 * stored request, so this only has to produce the exact operator selection.
 */
export function parseQuestionAnswers(raw: readonly string[] | undefined): string[][] {
  const values = raw ?? []
  if (values.length === 0) throw new Error("question reply requires at least one --answer")
  return values.map((value, index) => {
    const selected = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
    if (selected.length === 0) {
      throw new Error(`--answer #${index + 1} is empty; expected one or more comma-separated option values`)
    }
    return selected
  })
}
