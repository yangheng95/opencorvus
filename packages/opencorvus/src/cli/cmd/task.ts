import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, withAttachOptions } from "./attach"

/**
 * Task lifecycle for hosts that drive a running server over HTTP.
 *
 * A Task is the unit of delivered work. `opencorvus run` holds a single
 * assistant conversation instead, so it can neither submit durable Tasks nor
 * observe the ones a Mission dispatched.
 */
export const TaskCommand = cmd({
  command: "task",
  describe: "create, observe, and steer Tasks on a running server",
  builder: (yargs: Argv) =>
    yargs
      .command(TaskListCommand)
      .command(TaskCreateCommand)
      .command(TaskStatusCommand)
      .command(TaskBoardCommand)
      .command(TaskInteractionsCommand)
      .command(TaskArtifactsCommand)
      .command(TaskMessageCommand)
      .command(TaskCancelCommand)
      .demandCommand(),
  async handler() {},
})

export const TaskListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list Tasks in the project",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("search", { type: "string", describe: "filter Tasks by title or request" })
      .option("status", { type: "string", describe: "filter by lifecycle status" })
      .option("limit", { type: "number", describe: "maximum Tasks to return" }),
  handler: async (args) => {
    const server = attach(args)
    // The route returns a project board: the Task rows plus the project
    // identity and a lifecycle summary. Keep all of it under --format json so a
    // caller can read the counts without a second request.
    const board = await server.result(
      "task list",
      server.client.task.list({ q: args.search, status: args.status, limit: args.limit }),
    )

    if (args.format === "json") {
      console.log(JSON.stringify(board, null, 2))
      return
    }

    if (board.tasks.length === 0) {
      UI.println("No Tasks found")
      return
    }

    const lines = board.tasks.map((entry) => {
      const { task } = entry
      // pending_interactions rides along on this projection, so a caller learns
      // a Task is blocked on an operator decision without a second request.
      const pending = entry.pending_interactions > 0 ? `  ⚠ ${entry.pending_interactions} pending` : ""
      return `${task.id}  ${task.status}  ${task.productPillar}${pending}  ${task.title}`
    })
    const { summary } = board
    lines.push(
      `${EOL}${summary.total_tasks} total: ${summary.running_tasks} running, ${summary.open_tasks} open, ` +
        `${summary.completed_tasks} completed, ${summary.failed_tasks} failed, ` +
        `${summary.blocked_tasks} blocked, ${summary.cancelled_tasks} cancelled`,
    )
    console.log(lines.join(EOL))
  },
})

export const TaskCreateCommand = cmd({
  command: "create",
  describe: "submit a Task",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("pillar", {
        type: "string",
        choices: ["code", "work"] as const,
        describe: "code for repository work, work for research and knowledge artifacts",
        demandOption: true,
      })
      .option("request", { type: "string", describe: "what the Task must deliver", demandOption: true })
      .option("title", { type: "string", describe: "Task title (derived from the request when omitted)" })
      .option("model", { type: "string", describe: "model to use in the format provider/model" })
      .option("priority", {
        type: "string",
        choices: ["critical", "high", "normal", "low"] as const,
        describe: "Work Ledger presentation priority; it does not grant scheduling authority",
      })
      .option("source", { type: "string", describe: "caller label recorded on the Task" })
      .option("request-id", {
        type: "string",
        describe: "idempotency key; replaying it with changed facts is rejected as a conflict",
      }),
  handler: async (args) => {
    const server = attach(args)
    const accepted = await server.result(
      "task create",
      server.client.task.create({
        productPillar: args.pillar,
        request: args.request,
        title: args.title,
        model: args.model,
        priority: args.priority,
        source: args.source,
        requestID: args.requestId,
      }),
    )
    UI.println(`Accepted Task ${accepted.task_id} in ${accepted.directory}`)
    // HTTP 202 means the Task was admitted, not that any work happened.
    UI.println("Acceptance is not completion — poll `opencorvus task status` for lifecycle state.")
  },
})

export const TaskStatusCommand = cmd({
  command: "status <taskID>",
  describe: "read one Task's lifecycle and diagnostic status",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("taskID", { describe: "Task ID", type: "string", demandOption: true }),
  handler: async (args) => {
    const server = attach(args)
    const status = await server.result("task status", server.client.task.status({ taskID: args.taskID }))
    console.log(JSON.stringify(status, null, 2))
  },
})

export const TaskBoardCommand = cmd({
  command: "board <taskID>",
  describe: "read the Task's Goal and Slice board",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("taskID", { describe: "Task ID", type: "string", demandOption: true }),
  handler: async (args) => {
    const server = attach(args)
    const board = await server.result("task board", server.client.task.board({ taskID: args.taskID }))
    console.log(JSON.stringify(board, null, 2))
  },
})

export const TaskInteractionsCommand = cmd({
  command: "interactions <taskID>",
  describe: "list this Task's interaction history",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("taskID", { describe: "Task ID", type: "string", demandOption: true }),
  handler: async (args) => {
    const server = attach(args)
    const interactions = await server.result(
      "task interactions",
      server.client.task.interactions({ taskID: args.taskID }),
    )
    console.log(JSON.stringify(interactions, null, 2))
  },
})

export const TaskArtifactsCommand = cmd({
  command: "artifacts <taskID>",
  describe: "list the Artifacts produced across the Task's turns",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("taskID", { describe: "Task ID", type: "string", demandOption: true }),
  handler: async (args) => {
    const server = attach(args)
    const artifacts = await server.result("task artifacts", server.client.task.turnArtifacts({ taskID: args.taskID }))
    console.log(JSON.stringify(artifacts, null, 2))
  },
})

export const TaskMessageCommand = cmd({
  command: "message <taskID>",
  aliases: ["send"],
  describe: "send ordinary operator follow-up input to a Task",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("taskID", { describe: "Task ID", type: "string", demandOption: true })
      .option("text", { type: "string", describe: "message to deliver", demandOption: true })
      .option("source", {
        type: "string",
        default: "cli",
        describe: "caller label recorded with the message",
      })
      .option("model", { type: "string", describe: "model to use in the format provider/model" }),
  handler: async (args) => {
    const server = attach(args)
    const result = await server.result(
      "task message",
      server.client.task.message({
        taskID: args.taskID,
        text: args.text,
        source: args.source,
        model: args.model,
      }),
    )
    // `not_woken` is a normal outcome, not a transport failure — the Task was
    // already awake, or declined to reopen. Reporting it as success would
    // misrepresent what happened.
    UI.println(`wake_status: ${result.wake_status}`)
    if (result.message) UI.println(result.message)
  },
})

export const TaskCancelCommand = cmd({
  command: "cancel <taskID>",
  describe: "cancel a Task",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("taskID", { describe: "Task ID", type: "string", demandOption: true })
      .option("reason", {
        type: "string",
        describe: "operator-visible reason recorded with the cancellation",
        demandOption: true,
      }),
  handler: async (args) => {
    const server = attach(args)
    await server.result(
      "task cancel",
      server.client.task.cancel({ taskID: args.taskID, reason: args.reason, surface: "api" }),
    )
    UI.println(`Cancelled Task ${args.taskID}`)
  },
})
