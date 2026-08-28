import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Session } from "../../session"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { Locale } from "../../util/locale"
import { Flag } from "../../flag/flag"
import { Filesystem } from "../../util/filesystem"
import { Process } from "../../util/process"
import { EOL } from "os"
import path from "path"
import * as prompts from "@clack/prompts"
import { which } from "@/util/which"
import { EngineService } from "@/task-api"
import { randomUUID } from "node:crypto"
import { assertPublicSessionOperationAuthority } from "@/mission/public-session-authority"

function pagerCmd(): string[] {
  const lessOptions = ["-R", "-S"]
  if (process.platform !== "win32") {
    return ["less", ...lessOptions]
  }

  // user could have less installed via other options
  const lessOnPath = which("less")
  if (lessOnPath) {
    if (Filesystem.stat(lessOnPath)?.size) return [lessOnPath, ...lessOptions]
  }

  if (Flag.OPENCORVUS_GIT_BASH_PATH) {
    const less = path.join(Flag.OPENCORVUS_GIT_BASH_PATH, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  const git = which("git")
  if (git) {
    const less = path.join(git, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  // Fall back to Windows built-in more (via cmd.exe)
  return ["cmd", "/c", "more"]
}

export const SessionCommand = cmd({
  command: "session",
  describe: "manage sessions",
  builder: (yargs: Argv) => yargs.command(SessionListCommand).command(SessionDeleteCommand).demandCommand(),
  async handler() {},
})

export function assertSessionDeleteTargets(targets: Session.Info[]): void {
  for (const target of targets) {
    assertPublicSessionOperationAuthority(target, "session.delete")
  }
}

export const SessionDeleteCommand = cmd({
  command: "delete [sessionID]",
  aliases: ["rm", "remove"],
  describe: "delete sessions",
  builder: (yargs: Argv) =>
    yargs
      .positional("sessionID", {
        describe: "session ID to delete",
        type: "string",
      })
      .option("all", {
        type: "boolean",
        describe: "delete all filtered root sessions",
        default: false,
      })
      .option("search", {
        type: "string",
        describe: "filter root sessions by title or id",
      })
      .option("yes", {
        alias: "y",
        type: "boolean",
        describe: "skip confirmation prompt",
        default: false,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const all = args.sessionID ? [] : [...Session.list({ limit: 10_000 })]
      const roots = all.filter((x) => !x.parentID)
      const term = args.search?.toLowerCase()
      const filtered =
        term === undefined
          ? roots
          : roots.filter((x) => x.title.toLowerCase().includes(term) || x.id.toLowerCase().includes(term))

      if (!args.sessionID && filtered.length === 0) {
        UI.println("No sessions found")
        return
      }

      let targets: Session.Info[] = []

      if (args.sessionID) {
        const session = await Session.get(args.sessionID).catch(() => null)
        if (!session) {
          UI.error(`Session not found: ${args.sessionID}`)
          process.exitCode = 1
          return
        }
        targets = [session]
      }

      if (!args.sessionID && args.all) {
        targets = filtered
      }

      if (!args.sessionID && !args.all) {
        const selected = await prompts.multiselect({
          message: "Select sessions to delete",
          options: filtered.map((session) => ({
            label: session.title,
            value: session.id,
            hint: `${session.id} | ${Locale.todayTimeOrDateTime(session.time.updated)}`,
          })),
        })
        if (prompts.isCancel(selected)) throw new UI.CancelledError()
        const ids = new Set(selected)
        targets = filtered.filter((x) => ids.has(x.id))
      }

      if (targets.length === 0) {
        UI.println("No sessions selected")
        return
      }

      assertSessionDeleteTargets(targets)

      if (!args.yes) {
        const message =
          targets.length === 1 ? `Delete session "${targets[0]!.title}"?` : `Delete ${targets.length} sessions?`
        const confirm = await prompts.confirm({
          message,
          initialValue: false,
        })
        if (prompts.isCancel(confirm) || !confirm) throw new UI.CancelledError()
      }

      const suffix = targets.length === 1 ? "" : "s"
      const spinner = prompts.spinner()
      spinner.start(`Deleting ${targets.length} session${suffix}...`)
      for (const target of targets) {
        await EngineService.deleteSession(target.id, {
          cancellationOrigin: {
            actor: "user",
            source: "session.delete",
            surface: "api",
            requestID: randomUUID(),
            reason: "session deleted from the command-line interface",
          },
        })
      }
      spinner.stop(`Deleted ${targets.length} session${suffix}`)
    })
  },
})

export const SessionListCommand = cmd({
  command: "list",
  describe: "list sessions",
  builder: (yargs: Argv) => {
    return yargs
      .option("max-count", {
        alias: "n",
        describe: "limit to N most recent sessions",
        type: "number",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessions = [...Session.list({ roots: true, limit: args.maxCount })]

      if (sessions.length === 0) {
        return
      }

      let output: string
      if (args.format === "json") {
        output = formatSessionJSON(sessions)
      } else {
        output = formatSessionTable(sessions)
      }

      const shouldPaginate = process.stdout.isTTY && !args.maxCount && args.format === "table"

      if (shouldPaginate) {
        const proc = await Process.spawnHost(pagerCmd(), {
          stdin: "pipe",
          stdout: "inherit",
          stderr: "inherit",
        })

        if (!proc.stdin) {
          console.log(output)
          return
        }

        await proc.stdin.write(new TextEncoder().encode(output))
        await proc.stdin.close()
        await proc.exited
      } else {
        console.log(output)
      }
    })
  },
})

function formatSessionTable(sessions: Session.Info[]): string {
  const lines: string[] = []

  const maxIdWidth = Math.max(20, ...sessions.map((s) => s.id.length))
  const maxTitleWidth = Math.max(25, ...sessions.map((s) => s.title.length))

  const header = `Session ID${" ".repeat(maxIdWidth - 10)}  Title${" ".repeat(maxTitleWidth - 5)}  Updated`
  lines.push(header)
  lines.push("─".repeat(header.length))
  for (const session of sessions) {
    const truncatedTitle = Locale.truncate(session.title, maxTitleWidth)
    const timeStr = Locale.todayTimeOrDateTime(session.time.updated)
    const line = `${session.id.padEnd(maxIdWidth)}  ${truncatedTitle.padEnd(maxTitleWidth)}  ${timeStr}`
    lines.push(line)
  }

  return lines.join(EOL)
}

function formatSessionJSON(sessions: Session.Info[]): string {
  const jsonData = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updated: session.time.updated,
    created: session.time.created,
    projectId: session.projectID,
    directory: session.directory,
  }))
  return JSON.stringify(jsonData, null, 2)
}
