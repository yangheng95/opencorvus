import type { Argv } from "yargs"
import { EOL } from "os"
import type { WorkLedgerRow } from "@opencorvus-ai/transport-protocol"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, withAttachOptions } from "./attach"

/**
 * The Work Ledger is the single unified projection of Missions, Tasks, and
 * Chat/Work sessions. One call answers "what is running, and is anything
 * waiting on me" — including `pendingInteractions`, which is the cheapest
 * signal that work is blocked on an operator decision rather than progressing.
 */
export const LedgerCommand = cmd({
  command: "ledger",
  describe: "read the unified Mission, Task, and Chat Work Ledger on a running server",
  builder: (yargs: Argv) => yargs.command(LedgerListCommand).command(LedgerArchiveCommand).demandCommand(),
  async handler() {},
})

const listOptions = <T>(yargs: Argv<T>) =>
  withAttachOptions(yargs)
    .option("search", { type: "string", describe: "filter rows by title" })
    .option("limit", { type: "number", describe: "maximum rows to return (1-200)" })
    .option("cursor-updated", { type: "number", describe: "nextCursor.updated from the preceding page" })
    .option("cursor-pinned", { type: "boolean", describe: "nextCursor.pinned from the preceding page" })
    .option("cursor-row-key", { type: "string", describe: "nextCursor.rowKey from the preceding page" })

export const LedgerListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list active Work Ledger rows",
  builder: (yargs: Argv) => listOptions(yargs),
  handler: async (args) => {
    const server = attach(args)
    const ledger = await server.result(
      "work ledger list",
      server.client.workLedger.list({
        search: args.search,
        limit: args.limit,
        cursorUpdated: args.cursorUpdated,
        cursorPinned: args.cursorPinned === undefined ? undefined : args.cursorPinned ? "true" : "false",
        cursorRowKey: args.cursorRowKey,
      }),
    )

    if (args.format === "json") {
      console.log(JSON.stringify(ledger, null, 2))
      return
    }

    if (ledger.rows.length === 0) {
      UI.println("Work Ledger is empty")
      return
    }

    const lines = ledger.rows.flatMap((row) => renderLedgerRow(row))
    if (ledger.nextCursor) {
      // The projection is cursor-paged; a truncated page must not be reported
      // as the whole ledger.
      lines.push(
        `${EOL}nextCursor: ${JSON.stringify(ledger.nextCursor)} — continue with --cursor-updated, --cursor-pinned and --cursor-row-key`,
      )
    }
    console.log(lines.join(EOL))
  },
})

export const LedgerArchiveCommand = cmd({
  command: "archive",
  describe: "list archived Work Ledger rows",
  builder: (yargs: Argv) => listOptions(yargs),
  handler: async (args) => {
    const server = attach(args)
    const ledger = await server.result(
      "work ledger archive",
      server.client.workLedger.listArchived({
        search: args.search,
        limit: args.limit,
        cursorUpdated: args.cursorUpdated,
        cursorPinned: args.cursorPinned === undefined ? undefined : args.cursorPinned ? "true" : "false",
        cursorRowKey: args.cursorRowKey,
      }),
    )

    if (args.format === "json") {
      console.log(JSON.stringify(ledger, null, 2))
      return
    }

    if (ledger.rows.length === 0) {
      UI.println("No archived Work Ledger rows")
      return
    }

    console.log(ledger.rows.flatMap((row) => renderLedgerRow(row)).join(EOL))
    if (ledger.nextCursor)
      console.log(
        `nextCursor: ${JSON.stringify(ledger.nextCursor)} — continue with --cursor-updated, --cursor-pinned and --cursor-row-key`,
      )
  },
})

function pendingSuffix(pending: number): string {
  return pending > 0 ? `  ⚠ ${pending} pending interaction(s)` : ""
}

export function renderLedgerRow(row: WorkLedgerRow, indent = ""): string[] {
  const pin = row.pinned ? "📌 " : ""
  switch (row.kind) {
    case "project":
      return [`${indent}${pin}project  ${row.id}  ${row.title}`]
    case "mission": {
      const stats = `${row.taskStats.running} running / ${row.taskStats.total} tasks`
      const lines = [
        `${indent}${pin}mission  ${row.missionID}  ${row.productPillar}  ${stats}${pendingSuffix(
          row.pendingInteractions,
        )}  ${row.title}`,
      ]
      // Tasks nest under their Mission root in this projection; flattening them
      // would lose which Mission owns the work.
      for (const task of row.tasks) lines.push(...renderLedgerRow(task, `${indent}  `))
      return lines
    }
    case "task": {
      const cancelling = row.cancellationStatus === "none" ? "" : `  (${row.cancellationStatus})`
      return [
        `${indent}${pin}task     ${row.id}  ${row.lifecycleStatus}/${row.activityStatus}${cancelling}${pendingSuffix(
          row.pendingInteractions,
        )}  ${row.title}`,
      ]
    }
    case "chat":
      return [`${indent}${pin}${row.experience.padEnd(8)} ${row.id}  ${row.status}  ${row.title}`]
  }
}
