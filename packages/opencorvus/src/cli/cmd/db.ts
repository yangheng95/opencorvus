import type { Argv } from "yargs"
import { Database } from "../../storage/db"
import { Database as BunDatabase } from "bun:sqlite"
import { Instance } from "../../project/instance"
import { ProjectIdentityConvergence } from "../../project/identity-convergence"
import { UI } from "../ui"
import { cmd } from "./cmd"

const QueryCommand = cmd({
  command: "$0 <query>",
  describe: "run a read-only SQL query against the OpenCorvus database",
  builder: (yargs: Argv) => {
    return yargs
      .positional("query", {
        type: "string",
        describe: "SQL query to execute",
      })
      .option("format", {
        type: "string",
        choices: ["json", "tsv"],
        default: "tsv",
        describe: "Output format",
      })
  },
  handler: async (args: { query?: string; format: string }) => {
    if (!args.query) throw new Error("db query requires a nonempty SQL query")
    const db = new BunDatabase(Database.Path(), { readonly: true })
    let result: Record<string, unknown>[] = []
    let failure: unknown
    let failed = false
    let statement: ReturnType<BunDatabase["query"]> | undefined
    try {
      statement = db.query(args.query)
      result = statement.all() as Record<string, unknown>[]
    } catch (error) {
      failed = true
      failure = error
    }
    if (statement) {
      try {
        statement.finalize()
      } catch (error) {
        failure = failed
          ? new AggregateError([failure, error], "DB query and SQLite statement finalization both failed", {
              cause: failure,
            })
          : error
        failed = true
      }
    }
    try {
      db.close(true)
    } catch (error) {
      failure = failed
        ? new AggregateError([failure, error], "DB query and SQLite connection close both failed", {
            cause: failure,
          })
        : error
      failed = true
    }
    if (failed) {
      UI.error(failure instanceof Error ? failure.message : String(failure))
      process.exitCode = 1
      return
    }

    if (args.format === "json") {
      console.log(JSON.stringify(result, null, 2))
    } else if (result.length > 0) {
      const keys = Object.keys(result[0])
      console.log(keys.join("\t"))
      for (const row of result) {
        console.log(keys.map((key) => row[key]).join("\t"))
      }
    }
  },
})

const PathCommand = cmd({
  command: "path",
  describe: "print the database path",
  handler: () => {
    console.log(Database.Path())
  },
})

/** Strict DB and project scratch reset after all in-memory instances are disposed. */
export const ResetCommand = cmd({
  command: "reset",
  describe:
    "wipe the global opencorvus SQLite DB and project scratch (worktrees, ownership markers, snapshots). DESTRUCTIVE — there is no undo.",
  builder: (yargs: Argv) => {
    return yargs.option("force", {
      type: "boolean",
      default: false,
      describe: "skip the confirmation prompt (non-interactive / CI).",
    })
  },
  handler: async (args: { force: boolean }) => {
    if (!args.force) {
      UI.error("opencorvus db reset is DESTRUCTIVE — wipes DB + worktrees + ownership + snapshots.")
      UI.error("Re-run with --force to proceed.")
      process.exit(1)
    }

    // CLI is invoked from the project directory; capture cwd BEFORE disposing
    // any active Instance so reset() can locate the project's scratch dirs.
    const projectDir = process.cwd()
    try {
      await Instance.disposeAll()
      const results = await Database.reset(projectDir)
      for (const result of results) {
        console.log(`✓ ${result.label}: ${result.path}`)
      }
      console.log("")
      console.log("opencorvus db reset complete. Next process start will rebuild schema from DDL.")
    } catch (error) {
      process.exitCode = 1
      throw error
    }
  },
})

const ConvergeProjectIdentitiesCommand = cmd({
  command: "converge-project-identities <worktree> <canonical-project-id>",
  describe: "atomically converge duplicate Project rows for one physical worktree",
  builder: (yargs: Argv) => {
    return yargs
      .positional("worktree", {
        type: "string",
        demandOption: true,
        describe: "Physical worktree shared by the duplicate Project rows",
      })
      .positional("canonical-project-id", {
        type: "string",
        demandOption: true,
        describe: "Existing Project ID that will remain authoritative",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "confirm the durable identity mutation",
      })
  },
  handler: async (args: { worktree: string; canonicalProjectId: string; force: boolean }) => {
    if (!args.force) {
      UI.error("Project identity convergence is a durable repair operation.")
      UI.error("Re-run with --force after reviewing the duplicate Project identities.")
      process.exitCode = 1
      return
    }
    await Instance.disposeAll()
    const receipt = await ProjectIdentityConvergence.converge({
      worktree: args.worktree,
      canonicalProjectID: args.canonicalProjectId,
    })
    console.log(JSON.stringify(receipt, null, 2))
  },
})

export const DbCommand = cmd({
  command: "db",
  describe: "database tools",
  builder: (yargs: Argv) => {
    return yargs
      .command(QueryCommand)
      .command(PathCommand)
      .command(ResetCommand)
      .command(ConvergeProjectIdentitiesCommand)
      .demandCommand()
  },
  handler: () => {},
})
