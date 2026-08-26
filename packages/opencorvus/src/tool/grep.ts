import z from "zod"
import { minimatch } from "minimatch"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import { Ripgrep } from "../file/ripgrep"
import { Process } from "../util/process"

import DESCRIPTION from "./grep.txt"
import { Instance } from "../project/instance"
import path from "path"
import fs from "node:fs/promises"
import { assertExternalDirectory } from "./external-directory"
import { redactInlinePayloads } from "../util/inline-base64"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"

const MAX_LINE_LENGTH = 2000
export const SEARCH_CODE_TIMEOUT_MS = 30_000
export const SEARCH_CODE_MAX_OUTPUT_BYTES = 2 * 1024 * 1024

export class SearchCodeExecutionError extends Error {
  readonly code = "SEARCH_CODE_EXECUTION_FAILED"

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "SearchCodeExecutionError"
  }
}

function executionError(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return new SearchCodeExecutionError(`search_code execution failed: ${detail}`, { cause })
}

function matchesInclude(filePath: string, searchPath: string, searchIsFile: boolean, include: string | undefined) {
  if (!include) return true
  const candidate = (searchIsFile ? path.basename(filePath) : path.relative(searchPath, filePath)).replaceAll("\\", "/")
  const pattern = include.replaceAll("\\", "/")
  return minimatch(candidate, pattern, {
    dot: true,
    matchBase: !pattern.includes("/"),
  })
}

export const SearchCodeTool = Tool.define("search_code", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z
      .string()
      .describe(
        'Required regex pattern to search for in file contents. This field is named "pattern"; do not use "query".',
      ),
    path: z.string().optional().describe("The file or directory to search. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    ctx.abort.throwIfAborted()
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    let searchPath = params.path ?? Instance.directory
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(Instance.directory, searchPath)
    await assertExternalDirectory(ctx, searchPath)
    const searchStat = await fs.stat(searchPath)
    const commandCwd = searchStat.isDirectory()
      ? searchPath
      : searchStat.isFile()
        ? path.dirname(searchPath)
        : undefined
    if (!commandCwd) throw new Error(`Search path is not a file or directory: ${searchPath}`)

    const executionAuthority = Tool.requireExecutionAuthority(ctx)
    const rgPath =
      executionAuthority.kind === "task"
        ? ((await activeExecutionCapsuleRuntimeFact())?.ripgrepPath ?? (await Ripgrep.filepath()))
        : await Ripgrep.filepath()
    const args = [
      "-nH",
      "--hidden",
      "--field-match-separator=|",
      "--regexp",
      params.pattern,
      "--glob",
      "!**/.git/**",
      searchPath,
    ]
    const command = [rgPath, ...args]
    const options = {
      abort: ctx.abort,
      timeoutMs: SEARCH_CODE_TIMEOUT_MS,
      maxOutputBytes: SEARCH_CODE_MAX_OUTPUT_BYTES,
      nothrow: true,
    }
    let result: Process.Result
    try {
      result =
        executionAuthority.kind === "task"
          ? await Process.runTask({ taskID: executionAuthority.taskID, cwd: commandCwd }, command, options)
          : await Process.runHost(command, { ...options, cwd: commandCwd })
      ctx.abort.throwIfAborted()
    } catch (cause) {
      ctx.abort.throwIfAborted()
      throw executionError(cause)
    }
    const output = result.stdout.toString()
    const errorOutput = result.stderr.toString().trim()
    const exitCode = result.code

    // Exit codes: 0 = matches found, 1 = no matches, 2 = errors (but may still have matches)
    if (exitCode === 1) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    if (exitCode === 2 && !output.trim()) {
      throw executionError(new Error(errorOutput || "ripgrep exited with code 2"))
    }

    if (exitCode !== 0 && exitCode !== 2) {
      throw executionError(new Error(errorOutput || `ripgrep exited with code ${exitCode}`))
    }

    const hasErrors = exitCode === 2

    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = output.trim().split(/\r?\n/)
    const matches: Array<{ path: string; modTime: number; lineNum: number; lineText: string }> = []

    for (const line of lines) {
      if (!line) continue

      const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

      const lineNum = parseInt(lineNumStr, 10)
      const lineText = lineTextParts.join("|")

      if (!matchesInclude(filePath, searchPath, searchStat.isFile(), params.include)) continue

      const stats = Filesystem.stat(filePath)
      if (!stats) continue

      matches.push({
        path: filePath,
        modTime: stats.mtime.getTime(),
        lineNum,
        lineText,
      })
    }

    matches.sort((a, b) => b.modTime - a.modTime)

    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    if (finalMatches.length === 0) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    const totalMatches = matches.length
    const outputLines: string[] = [`Found ${totalMatches} matches${truncated ? ` (showing first ${limit})` : ""}`]

    let currentFile = ""
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("")
        }
        currentFile = match.path
        outputLines.push(`${match.path}:`)
      }
      const truncatedLineText =
        match.lineText.length > MAX_LINE_LENGTH ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..." : match.lineText
      outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`)
    }

    if (truncated) {
      outputLines.push("")
      outputLines.push(
        `(Results truncated: showing ${limit} of ${totalMatches} matches (${totalMatches - limit} hidden). Consider using a more specific path or pattern.)`,
      )
    }

    if (hasErrors) {
      outputLines.push("")
      outputLines.push("(Some paths were inaccessible and skipped)")
    }

    return {
      title: params.pattern,
      metadata: {
        matches: totalMatches,
        truncated,
      },
      output: redactInlinePayloads(outputLines.join("\n")),
    }
  },
})
