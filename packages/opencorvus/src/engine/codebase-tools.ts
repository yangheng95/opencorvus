/**
 * Read-only codebase exploration tools for Orchestrator projections.
 *
 * These are Vercel AI SDK `tool()` definitions that allow agents to read files,
 * search code, and list directories within the project boundary.
 */
import { tool } from "ai"
import z from "zod"
import path from "path"
import { Instance } from "@/project/instance"
import { FileTime } from "@/file/time"
import { Ripgrep } from "@/file/ripgrep"
import { redactInlinePayloads } from "@/util/inline-base64"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { createPluginToolFilesHost } from "@/tool/plugin-tool-files-host"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"
import { text } from "node:stream/consumers"
import { materializeExactTool } from "@/agent/exact-tool-factory"

const READ_FILE_MAX_LINE_CHARS = 1200

function detectBinaryKind(buf: Buffer, filePath: string): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "a PNG image"
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "a JPEG image"
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "a GIF image"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "a WebP image"
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return "a PDF document"
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) return "a ZIP/Office archive"
  // NUL-heavy probe — text files should not contain NUL bytes in the first 4KB
  const sample = buf.subarray(0, Math.min(buf.length, 4096))
  let nul = 0
  for (const b of sample) if (b === 0) nul++
  if (nul > 4) return `a binary file (${nul} NUL bytes in first ${sample.length}B, path=${filePath})`
  return null
}

export function createCodebaseToolFactory(projectDir?: string, onMaterialize?: (toolID: string) => void) {
  const dir = projectDir ?? Instance.directory

  function sessionIDFromOptions(options: unknown): string | undefined {
    if (!options || typeof options !== "object") return undefined
    const opencorvus = (options as { opencorvus?: unknown }).opencorvus
    if (!opencorvus || typeof opencorvus !== "object") return undefined
    const sessionID = (opencorvus as { sessionID?: unknown }).sessionID
    return typeof sessionID === "string" && sessionID.length > 0 ? sessionID : undefined
  }

  function safePath(relPath: string): string | null {
    const root = path.resolve(dir)
    const normalized = path.resolve(root, relPath)
    const relative = path.relative(root, normalized)
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return normalized
    return null
  }

  function execution(options: unknown) {
    const sessionID = sessionIDFromOptions(options)
    const taskID = sessionID ? taskIDForSession(sessionID) : undefined
    if (!sessionID || !taskID) throw new Error("Codebase tool execution requires a Task Session identity")
    return {
      sessionID,
      taskID,
      files: createPluginToolFilesHost((operation) => operation(), { taskID }),
    }
  }

  const toolFactories = {
    read: () => tool({
      description:
        "Read the contents of a file. Returns the file contents with line numbers. " +
        "Use this to understand code structure, conventions, and existing patterns. " +
        "For large files, set offset to continue from the next unread line instead of re-reading from line 1.",
      inputSchema: z.object({
        filePath: z.string().describe("File path relative to the scoped project root"),
        offset: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("1-based line number to start reading from (default 1). Use to page through large files."),
        limit: z.number().int().positive().optional().describe("Maximum lines to read (default 300)."),
      }),
      execute: async ({ filePath, offset, limit }, options) => {
        const abs = safePath(filePath)
        if (!abs) return "Error: path is outside the project boundary."
        try {
          const scope = execution(options)
          const buf = await scope.files.readFile(abs)
          // Refuse known binary signatures and NUL-heavy content — decoding
          // a PNG/JPG/zip as UTF-8 produces garbage that wastes LLM context
          // and sends agents chasing nonsense. Image-like inputs must flow
          // via a vision channel, not read.
          const kind = detectBinaryKind(buf, filePath)
          if (kind) {
            return `Error: ${filePath} is ${kind}. read returns text only; use a vision/multimodal channel or a dedicated binary tool.`
          }
          const content = buf.toString("utf-8")
          FileTime.read(scope.sessionID, abs)
          const lines = content.split("\n")
          const lineLimit = limit ?? 300
          const startIndex = Math.max(0, (offset ?? 1) - 1)
          if (startIndex >= lines.length) {
            return `Error: offset ${offset ?? 1} is past end of file (${lines.length} lines).`
          }
          const slice = lines.slice(startIndex, startIndex + lineLimit)
          const numbered = slice
            .map((line, i) => {
              const safeLine = redactInlinePayloads(line)
              const displayLine =
                safeLine.length > READ_FILE_MAX_LINE_CHARS
                  ? `${safeLine.slice(0, READ_FILE_MAX_LINE_CHARS)}... (line truncated, ${safeLine.length - READ_FILE_MAX_LINE_CHARS} more chars)`
                  : safeLine
              return `${String(startIndex + i + 1).padStart(5)} | ${displayLine}`
            })
            .join("\n")
          const remaining = lines.length - (startIndex + slice.length)
          if (remaining > 0) {
            return (
              numbered +
              `\n... (${remaining} more lines, total ${lines.length}; ` +
              `next chunk: read filePath="${filePath}" offset=${startIndex + slice.length + 1} limit=${lineLimit})`
            )
          }
          return numbered
        } catch (e) {
          return `Error reading file: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    }),

    glob: () => tool({
      description:
        "Find files matching a glob pattern. Returns file paths relative to project root. " +
        "Use this to discover project structure and find relevant source files.",
      inputSchema: z.object({
        pattern: z.string().describe("Glob pattern (e.g., 'src/**/*.ts', '*.json', 'test/**/*.test.ts')"),
        path: z.string().optional().describe("Directory path relative to the scoped project root"),
      }),
      execute: async ({ pattern, path: searchPath }, options) => {
        const limit = 80
        const root = path.resolve(dir)
        const cwd = searchPath ? safePath(searchPath) : root
        if (!cwd) return "Error: path is outside the project boundary."
        try {
          const scope = execution(options)
          const files: string[] = []
          for await (const file of Ripgrep.filesForTask({ cwd, glob: [pattern], taskID: scope.taskID })) {
            if (file.includes("node_modules/") || file.includes(".git/")) continue
            files.push(path.relative(root, path.resolve(cwd, file)).replace(/\\/g, "/"))
            if (files.length >= limit) break
          }
          if (files.length === 0) return "No files found matching the pattern."
          const result = files.join("\n")
          return files.length >= limit ? result + `\n(limited to ${limit} results)` : result
        } catch (e) {
          return `Error finding files: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    }),

    search_code: () => tool({
      description:
        "Search file contents using a regex pattern (powered by ripgrep). " +
        'Required input shape: {"pattern":"<regex>"}. The search string field is named "pattern"; do not use "query". ' +
        "Returns matching lines with file paths and line numbers. " +
        "Use this to find specific code patterns, function definitions, imports, etc.",
      inputSchema: z.object({
        pattern: z.string().describe('Required regex pattern to search for. Field name is "pattern", not "query".'),
        path: z.string().optional().describe("Subdirectory or file to search in (default: project root)"),
        max_results: z.number().optional().describe("Maximum matching lines (default 30)"),
      }),
      execute: async ({ pattern, path: searchPath, max_results }, options) => {
        const limit = Math.max(1, Math.floor(max_results ?? 30))
        const target = searchPath ? safePath(searchPath) : dir
        if (!target) return "Error: search path is outside the project boundary."
        try {
          const scope = execution(options)
          const capsuleRuntime = await activeExecutionCapsuleRuntimeFact()
          const rgPath = capsuleRuntime?.ripgrepPath ?? (await Ripgrep.filepath())
          const proc = await ProcessSupervisor.spawnTaskCommand({ taskID: scope.taskID, cwd: dir }, {
            executable: rgPath,
            args: [
              "--no-heading",
              "--line-number",
              "--max-columns",
              "200",
              "--glob",
              "!node_modules",
              "--glob",
              "!.git",
              "--",
              pattern,
              target,
            ],
            owner: "codebase-search",
          })
          const output = proc.stdout ? await text(proc.stdout) : ""
          await proc.exited
          await proc.dispose()
          const lines = output.split(/\r?\n/).filter(Boolean)
          const limited = lines.length > limit
          const trimmed = redactInlinePayloads(lines.slice(0, limit).join("\n").trim())
          if (!trimmed) return "No matches found."
          return limited ? `${trimmed}\n(limited to ${limit} results)` : trimmed
        } catch (e) {
          return `Error searching code: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    }),

    list: () => tool({
      description:
        "List files and directories at a given path. " +
        "Use this to understand project layout and find relevant directories.",
      inputSchema: z.object({
        path: z.string().optional().describe("Directory path relative to project root (default: project root)"),
        ignore: z.array(z.string()).optional().describe("Directory entry names to omit from the listing"),
      }),
      execute: async ({ path: dirPath, ignore }, options) => {
        const abs = dirPath ? safePath(dirPath) : dir
        if (!abs) return "Error: path is outside the project boundary."
        try {
          const ignored = new Set(ignore ?? [])
          const entries = await execution(options).files.readdir(abs, { withFileTypes: true })
          const sorted = entries
            .filter((e) => e.name !== "node_modules" && e.name !== ".git" && !ignored.has(e.name))
            .sort((a, b) => {
              if (a.isDirectory() && !b.isDirectory()) return -1
              if (!a.isDirectory() && b.isDirectory()) return 1
              return a.name.localeCompare(b.name)
            })
          return sorted.map((e) => `${e.isDirectory() ? "[dir] " : "      "}${e.name}`).join("\n")
        } catch (e) {
          return `Error listing directory: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    }),
  }
  return {
    materializeExact: (toolID: string) => materializeExactTool(toolFactories, toolID, onMaterialize),
  }
}
