import z from "zod"
import { braceExpand, Minimatch } from "minimatch"
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
const MAX_BATCH_ARGUMENT_CHARACTERS = 12_000
const MAX_INCLUDE_PATTERN_LENGTH = 4096
const MAX_INCLUDE_EXPANSIONS = 256
const MAX_INCLUDE_GLOBSTARS = 32
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

function createIncludeMatcher(searchPath: string, searchIsFile: boolean, include: string | undefined) {
  if (!include) return (_filePath: string) => true
  const pattern = include.replaceAll("\\", "/")
  let matcher: Minimatch
  try {
    if (pattern.length > MAX_INCLUDE_PATTERN_LENGTH) {
      throw new Error(`include exceeds ${MAX_INCLUDE_PATTERN_LENGTH} characters`)
    }
    const expanded = braceExpand(pattern, { braceExpandMax: MAX_INCLUDE_EXPANSIONS + 1 })
    if (expanded.length > MAX_INCLUDE_EXPANSIONS) {
      throw new Error(`include expands to more than ${MAX_INCLUDE_EXPANSIONS} patterns`)
    }
    if (
      expanded.some(
        (expandedPattern) =>
          expandedPattern.split("/").filter((segment) => segment === "**").length > MAX_INCLUDE_GLOBSTARS,
      )
    ) {
      throw new Error(`include contains more than ${MAX_INCLUDE_GLOBSTARS} globstar path segments`)
    }
    matcher = new Minimatch(pattern, {
      dot: true,
      matchBase: !pattern.includes("/"),
      braceExpandMax: MAX_INCLUDE_EXPANSIONS,
      noext: true,
    })
  } catch (cause) {
    throw executionError(cause)
  }
  return (filePath: string) => {
    const candidate = (searchIsFile ? path.basename(filePath) : path.relative(searchPath, filePath)).replaceAll(
      "\\",
      "/",
    )
    return matcher.match(candidate)
  }
}

function batches(paths: string[], baseArgumentCharacters: number) {
  const result: string[][] = []
  let current: string[] = []
  let characters = baseArgumentCharacters
  for (const filePath of paths) {
    const nextCharacters = filePath.length + 3
    if (current.length > 0 && characters + nextCharacters > MAX_BATCH_ARGUMENT_CHARACTERS) {
      result.push(current)
      current = []
      characters = baseArgumentCharacters
    }
    current.push(filePath)
    characters += nextCharacters
  }
  if (current.length > 0) result.push(current)
  return result
}

function noFiles(pattern: string) {
  return {
    title: pattern,
    metadata: { matches: 0, truncated: false },
    output: "No files found",
  }
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
    const deadlineAt = Date.now() + SEARCH_CODE_TIMEOUT_MS
    const matchesInclude = createIncludeMatcher(searchPath, searchStat.isFile(), params.include)
    let remainingOutputBytes = SEARCH_CODE_MAX_OUTPUT_BYTES
    const run = async (args: string[], input?: AsyncIterable<Uint8Array>) => {
      const timeoutMs = deadlineAt - Date.now()
      if (timeoutMs <= 0) {
        throw executionError(new Error(`search_code exceeded its ${SEARCH_CODE_TIMEOUT_MS}ms deadline`))
      }
      if (remainingOutputBytes <= 0) {
        throw executionError(new Error(`search_code output exceeded ${SEARCH_CODE_MAX_OUTPUT_BYTES} bytes`))
      }
      const command = [rgPath, ...args]
      const options = {
        abort: ctx.abort,
        timeoutMs,
        maxOutputBytes: remainingOutputBytes,
        nothrow: true,
        owner: "search-code",
        input,
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
      remainingOutputBytes -= result.stdout.byteLength + result.stderr.byteLength
      return result
    }
    const validatePattern = async () => {
      const result = await run(
        ["--regexp", params.pattern, "-"],
        (async function* () {
          return
        })(),
      )
      if (result.code === 0 || result.code === 1) return
      const detail = result.stderr.toString().trim()
      throw executionError(new Error(detail || `ripgrep pattern validation exited with code ${result.code}`))
    }

    let searchTargets: string[][]
    let hasErrors = false
    let partialErrorDetail = ""
    if (searchStat.isFile()) {
      if (!matchesInclude(searchPath)) {
        await validatePattern()
        return noFiles(params.pattern)
      }
      searchTargets = [[searchPath]]
    } else if (params.include) {
      const files = await run(["--files", "--hidden", "--glob", "!**/.git/**", searchPath])
      const fileOutput = files.stdout.toString()
      if (files.code === 2 && fileOutput.trim()) {
        hasErrors = true
        partialErrorDetail = files.stderr.toString().trim()
      } else if (files.code !== 0 && files.code !== 1) {
        const detail = files.stderr.toString().trim()
        throw executionError(new Error(detail || `ripgrep file enumeration exited with code ${files.code}`))
      }
      const candidates: string[] = []
      for (const filePath of fileOutput.split(/\r?\n/)) {
        if (!filePath) continue
        ctx.abort.throwIfAborted()
        if (Date.now() >= deadlineAt) {
          throw executionError(new Error(`search_code exceeded its ${SEARCH_CODE_TIMEOUT_MS}ms deadline`))
        }
        if (matchesInclude(filePath)) candidates.push(filePath)
      }
      if (candidates.length === 0) {
        await validatePattern()
        if (hasErrors) {
          throw executionError(
            new Error(
              partialErrorDetail || "ripgrep file enumeration was incomplete and produced no included candidates",
            ),
          )
        }
        return noFiles(params.pattern)
      }
      searchTargets = batches(candidates, rgPath.length + params.pattern.length + 128)
    } else {
      searchTargets = [[searchPath]]
    }

    const searchArgs = [
      "-nH",
      "--hidden",
      "--field-match-separator=|",
      "--regexp",
      params.pattern,
      "--glob",
      "!**/.git/**",
    ]
    const matches: Array<{ path: string; modTime: number; lineNum: number; lineText: string }> = []

    for (const targets of searchTargets) {
      const result = await run([...searchArgs, ...targets])
      const output = result.stdout.toString()
      const errorOutput = result.stderr.toString().trim()
      const exitCode = result.code

      // Exit codes: 0 = matches found, 1 = no matches, 2 = errors (but may still have matches)
      if (exitCode === 1) continue
      if (exitCode === 2 && !output.trim()) {
        throw executionError(new Error(errorOutput || "ripgrep exited with code 2"))
      }
      if (exitCode !== 0 && exitCode !== 2) {
        throw executionError(new Error(errorOutput || `ripgrep exited with code ${exitCode}`))
      }
      if (exitCode === 2) {
        hasErrors = true
        partialErrorDetail ||= errorOutput
      }

      // Handle both Unix (\n) and Windows (\r\n) line endings
      const lines = output.trim().split(/\r?\n/)

      for (const line of lines) {
        if (!line) continue

        const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
        if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

        const lineNum = parseInt(lineNumStr, 10)
        const lineText = lineTextParts.join("|")

        const stats = Filesystem.stat(filePath)
        if (!stats) continue

        matches.push({
          path: filePath,
          modTime: stats.mtime.getTime(),
          lineNum,
          lineText,
        })
      }
    }

    matches.sort((a, b) => b.modTime - a.modTime)

    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    if (finalMatches.length === 0) {
      if (hasErrors) {
        throw executionError(new Error(partialErrorDetail || "ripgrep search was incomplete and produced no matches"))
      }
      return noFiles(params.pattern)
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
