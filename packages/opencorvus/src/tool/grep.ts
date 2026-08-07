import z from "zod"
import { text } from "node:stream/consumers"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import { Ripgrep } from "../file/ripgrep"
import { ProcessSupervisor } from "@/shell/process-supervisor"

import DESCRIPTION from "./grep.txt"
import { Instance } from "../project/instance"
import path from "path"
import { assertExternalDirectory } from "./external-directory"
import { redactInlinePayloads } from "../util/inline-base64"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"

const MAX_LINE_LENGTH = 2000

export const SearchCodeTool = Tool.define("search_code", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z
      .string()
      .describe(
        'Required regex pattern to search for in file contents. This field is named "pattern"; do not use "query".',
      ),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error("pattern is required")
    }

    await ctx.ask({
      permission: "search_code",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
      },
    })

    let searchPath = params.path ?? Instance.directory
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(Instance.directory, searchPath)
    await assertExternalDirectory(ctx, searchPath, { kind: "directory" })

    const executionAuthority = Tool.requireExecutionAuthority(ctx)
    const rgPath = executionAuthority.kind === "task"
      ? (await activeExecutionCapsuleRuntimeFact())?.ripgrepPath ?? (await Ripgrep.filepath())
      : await Ripgrep.filepath()
    const args: string[] = ["-nH", "--hidden", "--no-messages", "--field-match-separator=|", "--regexp", params.pattern]
    if (params.include) {
      args.push("--glob", params.include)
    }
    args.push(searchPath)

    const processOptions = { executable: rgPath, args, owner: "search-code" }
    const proc = executionAuthority.kind === "task"
      ? await ProcessSupervisor.spawnTaskCommand(
          { taskID: executionAuthority.taskID, cwd: searchPath },
          processOptions,
        )
      : await ProcessSupervisor.spawnHostCommand({ ...processOptions, cwd: searchPath })
    const abort = () => void proc.terminate().catch(() => undefined)
    ctx.abort.addEventListener("abort", abort, { once: true })

    if (!proc.stdout || !proc.stderr) {
      throw new Error("Process output not available")
    }

    const output = await text(proc.stdout)
    const errorOutput = await text(proc.stderr)
    const exitCode = await proc.exited
    ctx.abort.removeEventListener("abort", abort)
    await proc.dispose()

    // Exit codes: 0 = matches found, 1 = no matches, 2 = errors (but may still have matches)
    // With --no-messages, we suppress error output but still get exit code 2 for broken symlinks etc.
    // Only fail if exit code is 2 AND no output was produced
    if (exitCode === 1 || (exitCode === 2 && !output.trim())) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    if (exitCode !== 0 && exitCode !== 2) {
      throw new Error(`ripgrep failed: ${errorOutput}`)
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
