import path from "path"
import fs from "fs/promises"
import z from "zod"
import { buffer as readStreamBuffer } from "node:stream/consumers"
import { lazy } from "../util/lazy"
import { Process } from "../util/process"
import { Log } from "@/util/log"
import { resolveRipgrepRuntime } from "@/runtime/ripgrep"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"
import { activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"

export namespace Ripgrep {
  const log = Log.create({ service: "ripgrep" })
  const Stats = z.object({
    elapsed: z.object({
      secs: z.number(),
      nanos: z.number(),
      human: z.string(),
    }),
    searches: z.number(),
    searches_with_match: z.number(),
    bytes_searched: z.number(),
    bytes_printed: z.number(),
    matched_lines: z.number(),
    matches: z.number(),
  })

  const Begin = z.object({
    type: z.literal("begin"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
    }),
  })

  export const Match = z.object({
    type: z.literal("match"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      lines: z.object({
        text: z.string(),
      }),
      line_number: z.number(),
      absolute_offset: z.number(),
      submatches: z.array(
        z.object({
          match: z.object({
            text: z.string(),
          }),
          start: z.number(),
          end: z.number(),
        }),
      ),
    }),
  })

  const End = z.object({
    type: z.literal("end"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      binary_offset: z.number().nullable(),
      stats: Stats,
    }),
  })

  const Summary = z.object({
    type: z.literal("summary"),
    data: z.object({
      elapsed_total: z.object({
        human: z.string(),
        nanos: z.number(),
        secs: z.number(),
      }),
      stats: Stats,
    }),
  })

  export type Result = Begin | Match | End | Summary
  export type Match = z.infer<typeof Match>
  export type Begin = z.infer<typeof Begin>
  export type End = z.infer<typeof End>
  export type Summary = z.infer<typeof Summary>
  const EncodedText = z.union([z.object({ text: z.string() }), z.object({ bytes: z.base64() })])
  const WireMatch = Match.extend({
    data: Match.shape.data.extend({
      path: EncodedText,
      lines: EncodedText,
      submatches: z.array(Match.shape.data.shape.submatches.element.extend({ match: EncodedText })),
    }),
  })
  const WireResult = z.union([
    Begin.extend({ data: Begin.shape.data.extend({ path: EncodedText.nullable() }) }),
    WireMatch,
    WireMatch.extend({ type: z.literal("context") }),
    End.extend({ data: End.shape.data.extend({ path: EncodedText.nullable() }) }),
    Summary,
  ])
  const pathDecoder = () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  function decodedText(value: z.infer<typeof EncodedText>, filePath = false): { text: string } {
    if ("text" in value) return value
    const bytes = Buffer.from(value.bytes, "base64")
    // Application file identities are Unicode strings. A lossy path decode
    // could address another file; content keeps the existing UTF-8 display.
    return { text: filePath ? pathDecoder().decode(bytes) : bytes.toString("utf8") }
  }

  export function parseSearchOutput(output: string): Match["data"][] {
    return output.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      const result = WireResult.parse(JSON.parse(line))
      if (result.type !== "match") return []
      return [{
        ...result.data,
        path: decodedText(result.data.path, true),
        lines: decodedText(result.data.lines),
        submatches: result.data.submatches.map((match) => ({ ...match, match: decodedText(match.match) })),
      }]
    })
  }

  export function parseFileList(output: Uint8Array): string[] {
    const text = pathDecoder().decode(output)
    if (text && !text.endsWith("\0")) throw new Error("ripgrep file list ended without a NUL terminator")
    return text.split("\0").filter(Boolean)
  }
  const state = lazy(async () => {
    const runtime = await resolveRipgrepRuntime()
    return { filepath: runtime.filepath }
  })

  function outputText(input: Buffer | Uint8Array | undefined) {
    return input ? new TextDecoder().decode(input).trim() : ""
  }

  function ripgrepFailure(action: string, code: number, stderr?: Buffer | Uint8Array, stdout?: Buffer | Uint8Array) {
    const detail = [outputText(stderr), outputText(stdout)].filter(Boolean).join("\n")
    return detail ? `ripgrep ${action} failed with code ${code}: ${detail}` : `ripgrep ${action} failed with code ${code}`
  }

  export async function filepath() {
    const { filepath } = await state()
    return filepath
  }

  type FilesInput = {
    cwd: string
    glob?: string[]
    hidden?: boolean
    follow?: boolean
    maxDepth?: number
    signal?: AbortSignal
  }

  type FilesRequest = FilesInput & ({ owner: "host" } | { owner: "task"; taskID: string })

  export function filesForHost(input: FilesInput) {
    return files({ ...input, owner: "host" })
  }

  export function filesForTask(input: FilesInput & { taskID: string }) {
    return files({ ...input, owner: "task" })
  }

  async function* files(input: FilesRequest) {
    input.signal?.throwIfAborted()

    const executable = input.owner === "task"
      ? (await activeExecutionCapsuleRuntimeFact())?.ripgrepPath ?? (await filepath())
      : await filepath()
    const args = ["--files", "--null", "--glob=!.git/*"]
    if (input.follow) args.push("--follow")
    if (input.hidden !== false) args.push("--hidden")
    if (input.maxDepth !== undefined) args.push(`--max-depth=${input.maxDepth}`)
    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    // Guard against invalid cwd to provide a consistent ENOENT error.
    if (!(await fs.stat(input.cwd).catch(() => undefined))?.isDirectory()) {
      throw Object.assign(new Error(`No such file or directory: '${input.cwd}'`), {
        code: "ENOENT",
        errno: -2,
        path: input.cwd,
      })
    }

    const options = {
      executable,
      args,
      owner: "ripgrep-files",
    }
    const proc = input.owner === "task"
      ? await ProcessSupervisor.spawnTaskCommand({ taskID: input.taskID, cwd: input.cwd }, options)
      : await ProcessSupervisor.spawnHostCommand({ ...options, cwd: input.cwd })
    const abort = () => void proc.terminate().catch(() => undefined)
    input.signal?.addEventListener("abort", abort, { once: true })

    if (!proc.stdout || !proc.stderr) {
      throw new Error("Process output not available")
    }

    const stderr = readStreamBuffer(proc.stderr)
    void stderr.catch(() => undefined)
    let buffer = ""
    const decoder = pathDecoder()
    let sawFile = false
    let completed = false
    try {
      const stream = proc.stdout as AsyncIterable<Buffer | string>
      for await (const chunk of stream) {
        input.signal?.throwIfAborted()

        buffer += decoder.decode(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk, { stream: true })
        const lines = buffer.split("\0")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line) {
            sawFile = true
            yield line
          }
        }
      }

      buffer += decoder.decode()
      if (buffer) throw new Error("ripgrep file list ended without a NUL terminator")
      const [code, stderrBuffer] = await Promise.all([proc.exited, stderr, proc.outputSettled ?? Promise.resolve()])
      if (code === 1 && !sawFile && !stderrBuffer.toString().trim()) {
        completed = true
        return
      }
      if (code !== 0) {
        throw new Error(ripgrepFailure("files", code, stderrBuffer))
      }

      input.signal?.throwIfAborted()
      completed = true
    } finally {
      input.signal?.removeEventListener("abort", abort)
      if (!completed) {
        await ProcessSupervisor.terminateAndWaitForExit(proc, "ripgrep files")
        await Promise.all([
          stderr.catch(() => undefined),
          proc.outputSettled?.catch(() => undefined) ?? Promise.resolve(),
        ])
      } else {
        await proc.dispose()
      }
    }
  }

  export async function treeHost(input: { cwd: string; limit?: number; signal?: AbortSignal }) {
    log.info("tree", input)
    const files = await Array.fromAsync(Ripgrep.filesForHost({ cwd: input.cwd, signal: input.signal }))
    interface Node {
      name: string
      children: Map<string, Node>
    }

    function dir(node: Node, name: string) {
      const existing = node.children.get(name)
      if (existing) return existing
      const next = { name, children: new Map() }
      node.children.set(name, next)
      return next
    }

    const root: Node = { name: "", children: new Map() }
    for (const file of files) {
      if (file.includes(".opencorvus")) continue
      const parts = file.split(/[\\/]/).filter(Boolean)
      if (parts.length < 2) continue
      let node = root
      for (const part of parts.slice(0, -1)) {
        node = dir(node, part)
      }
    }

    function count(node: Node): number {
      let total = 0
      for (const child of node.children.values()) {
        total += 1 + count(child)
      }
      return total
    }

    const total = count(root)
    const limit = input.limit ?? total
    const lines: string[] = []
    const queue: { node: Node; path: string }[] = []
    for (const child of Array.from(root.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
      queue.push({ node: child, path: child.name })
    }

    let used = 0
    for (let i = 0; i < queue.length && used < limit; i++) {
      const { node, path } = queue[i]
      lines.push(path)
      used++
      for (const child of Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name))) {
        queue.push({ node: child, path: `${path}/${child.name}` })
      }
    }

    if (total > used) lines.push(`[${total - used} truncated]`)

    return lines.join("\n")
  }

  export async function searchHost(input: {
    cwd: string
    pattern: string
    glob?: string[]
    limit?: number
    follow?: boolean
  }) {
    const args = [`${await filepath()}`, "--json", "--line-number", "--hidden", "--glob=!.git/*"]
    if (input.follow) args.push("--follow")

    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    if (input.limit) {
      args.push(`--max-count=${input.limit}`)
    }

    args.push("--")
    args.push(input.pattern)

    const result = await Process.runHost(args, { cwd: input.cwd, nothrow: true })
    if (result.code === 1) {
      return []
    }
    if (result.code !== 0) {
      throw new Error(ripgrepFailure("search", result.code, result.stderr, result.stdout))
    }

    return parseSearchOutput(result.stdout.toString())
  }
}
