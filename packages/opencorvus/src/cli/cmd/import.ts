import type { Argv } from "yargs"
import type { Part, VisibleMessage } from "@opencorvus-ai/sdk"
import { Session } from "../../session"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { EOL } from "os"
import { Filesystem } from "../../util/filesystem"

export class ImportFileMissingError extends Error {
  constructor(file: string) {
    super(`Import file not found: ${file}`)
    this.name = "ImportFileMissingError"
  }
}

export class ImportFileInvalidJsonError extends Error {
  constructor(file: string, options?: ErrorOptions) {
    super(`Import file is not valid JSON: ${file}`, options)
    this.name = "ImportFileInvalidJsonError"
  }
}

type SessionImportData = {
  info: Session.Info
  messages: Array<{
    info: VisibleMessage
    parts: Part[]
  }>
}

function isEnoent(error: unknown): error is { code: "ENOENT" } {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ENOENT"
  )
}

export async function readSessionImportFile(file: string): Promise<SessionImportData> {
  let text: string
  try {
    text = await Filesystem.readText(file)
  } catch (error) {
    if (isEnoent(error)) throw new ImportFileMissingError(file)
    throw error
  }
  try {
    return JSON.parse(text) as SessionImportData
  } catch (error) {
    throw new ImportFileInvalidJsonError(file, { cause: error })
  }
}

export async function importSessionData(exportData: SessionImportData) {
  const snapshot = Session.importSnapshot.schema.parse(exportData)
  await Session.importSnapshot(snapshot)
}

export const ImportCommand = cmd({
  command: "import <file>",
  describe: "import session data from JSON file",
  builder: (yargs: Argv) => {
    return yargs.positional("file", {
      describe: "path to JSON file",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const exportData = await readSessionImportFile(args.file)
      await importSessionData(exportData)

      process.stdout.write(`Imported session: ${exportData.info.id}`)
      process.stdout.write(EOL)
    })
  },
})
