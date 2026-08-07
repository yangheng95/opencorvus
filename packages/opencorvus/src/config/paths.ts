import path from "path"
import os from "os"
import z from "zod"
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser"
import { NamedError } from "@opencorvus-ai/util/error"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { Global } from "@/global"

export namespace ConfigPaths {
  export const CANONICAL_FILE_NAME = "opencorvus.jsonc"

  export const NonCanonicalConfigFileError = NamedError.create(
    "NonCanonicalConfigFileError",
    z.object({
      canonical: z.string(),
      conflicts: z.array(z.string()).min(1),
      message: z.string(),
    }),
  )

  function rejectNonCanonical(canonical: string, conflicts: string[]): never {
    throw new NonCanonicalConfigFileError({
      canonical,
      conflicts,
      message:
        `OpenCorvus configuration has one canonical file: ${canonical}. ` +
        `Remove the non-canonical configuration source${conflicts.length === 1 ? "" : "s"}: ${conflicts.join(", ")}`,
    })
  }

  export async function assertCanonicalDirectory(dir: string, additionalNonCanonicalNames: string[] = []) {
    const canonical = path.join(dir, CANONICAL_FILE_NAME)
    const conflicts: string[] = []
    for (const name of ["opencorvus.json", ...additionalNonCanonicalNames]) {
      const candidate = path.join(dir, name)
      if (await Filesystem.exists(candidate)) conflicts.push(candidate)
    }
    if (conflicts.length > 0) rejectNonCanonical(canonical, conflicts)
    return canonical
  }

  function boundary(directory: string, worktree: string) {
    return worktree
  }

  export function projectFile(directory: string) {
    return path.join(directory, ".opencorvus", CANONICAL_FILE_NAME)
  }

  export async function assertCanonicalProject(directory: string, worktree: string) {
    const canonical = projectFile(directory)
    const [rootJson, rootJsonc, directoryJson, directoryJsonc] = await Promise.all([
      Filesystem.findUp("opencorvus.json", directory, worktree),
      Filesystem.findUp(CANONICAL_FILE_NAME, directory, worktree),
      Filesystem.findUp(path.join(".opencorvus", "opencorvus.json"), directory, worktree),
      Filesystem.findUp(path.join(".opencorvus", CANONICAL_FILE_NAME), directory, worktree),
    ])
    const resolvedCanonical = Filesystem.resolve(canonical)
    const conflicts = [...rootJson, ...rootJsonc, ...directoryJson, ...directoryJsonc].filter(
      (candidate) => Filesystem.resolve(candidate) !== resolvedCanonical,
    )
    if (conflicts.length > 0) rejectNonCanonical(canonical, conflicts)
    await assertCanonicalDirectory(path.dirname(canonical))
    return canonical
  }

  export async function directories(directory: string, worktree: string) {
    const projectDirectories = !Flag.OPENCORVUS_DISABLE_PROJECT_CONFIG
      ? await Array.fromAsync(
          Filesystem.up({
            targets: [".opencorvus"],
            start: directory,
            stop: boundary(directory, worktree),
          }),
        )
      : []

    return [
      Global.Path.config,
      ...projectDirectories.toReversed(),
      ...(Flag.OPENCORVUS_CONFIG_DIR ? [Flag.OPENCORVUS_CONFIG_DIR] : []),
    ]
  }

  export function fileInDirectory(dir: string, name: string) {
    return [path.join(dir, `${name}.jsonc`)]
  }

  export const JsonError = NamedError.create(
    "ConfigJsonError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
    }),
  )

  export const InvalidError = NamedError.create(
    "ConfigInvalidError",
    z.object({
      path: z.string(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
      message: z.string().optional(),
    }),
  )

  /** Read a config file, returning undefined for missing files and throwing JsonError for other failures. */
  export async function readFile(filepath: string) {
    return Filesystem.readText(filepath).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return
      throw new JsonError({ path: filepath }, { cause: err })
    })
  }

  type ParseSource = string | { source: string; dir: string }

  function source(input: ParseSource) {
    return typeof input === "string" ? input : input.source
  }

  function dir(input: ParseSource) {
    return typeof input === "string" ? path.dirname(input) : input.dir
  }

  /** Apply {env:VAR} and {file:path} substitutions to config text. */
  async function substitute(text: string, input: ParseSource, missing: "error" | "empty" = "error") {
    // audit-2026-04-29 W2-V23 — pre-fix the `{env:VAR}` branch
    // ignored the `missing` parameter completely: an UNSET env var
    // ALWAYS substituted to "" regardless of whether the caller
    // asked for "error" mode. A config that referenced
    // `{env:DATABASE_URL}` for a required field silently bound to
    // empty string, slipped past zod's `.url()` validator (zod
    // sees ""), and the sidecar tried to connect to a blank DSN.
    //
    // Distinguish UNSET from EXPLICITLY-EMPTY: setting an env var
    // to "" is the operator saying "deliberately empty", which
    // we honour. UNSET in "error" mode throws naming the variable.
    const sourceLabel = source(input)
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName: string) => {
      const value = process.env[varName]
      if (value !== undefined) return value
      if (missing === "error") {
        throw new Error(`Config substitution failed: env var ${varName} is unset (referenced from ${sourceLabel})`)
      }
      return ""
    })

    const fileMatches = Array.from(text.matchAll(/\{file:[^}]+\}/g))
    if (!fileMatches.length) return text

    const configDir = dir(input)
    const configSource = source(input)
    let out = ""
    let cursor = 0

    for (const match of fileMatches) {
      const token = match[0]
      const index = match.index!
      out += text.slice(cursor, index)

      const lineStart = text.lastIndexOf("\n", index - 1) + 1
      const prefix = text.slice(lineStart, index).trimStart()
      if (prefix.startsWith("//")) {
        out += token
        cursor = index + token.length
        continue
      }

      let filePath = token.replace(/^\{file:/, "").replace(/\}$/, "")
      if (filePath.startsWith("~/")) {
        filePath = path.join(os.homedir(), filePath.slice(2))
      }

      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath)
      const fileContent = (
        await Filesystem.readText(resolvedPath).catch((error: NodeJS.ErrnoException) => {
          if (missing === "empty") return ""

          const errMsg = `bad file reference: "${token}"`
          if (error.code === "ENOENT") {
            throw new InvalidError(
              {
                path: configSource,
                message: errMsg + ` ${resolvedPath} does not exist`,
              },
              { cause: error },
            )
          }
          throw new InvalidError({ path: configSource, message: errMsg }, { cause: error })
        })
      ).trim()

      out += JSON.stringify(fileContent).slice(1, -1)
      cursor = index + token.length
    }

    out += text.slice(cursor)
    return out
  }

  /** Substitute and parse JSONC text, throwing JsonError on syntax errors. */
  export async function parseText(text: string, input: ParseSource, missing: "error" | "empty" = "error") {
    const configSource = source(input)
    text = await substitute(text, input, missing)

    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const lines = text.split("\n")
      const errorDetails = errors
        .map((e) => {
          const beforeOffset = text.substring(0, e.offset).split("\n")
          const line = beforeOffset.length
          const column = beforeOffset[beforeOffset.length - 1].length + 1
          const problemLine = lines[line - 1]

          const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
          if (!problemLine) return error

          return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
        })
        .join("\n")

      throw new JsonError({
        path: configSource,
        message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${errorDetails}\n--- End ---`,
      })
    }

    return data
  }
}
