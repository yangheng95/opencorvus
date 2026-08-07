import { fileURLToPath } from "node:url"
import path from "node:path"
import type { ToolFiles } from "@opencorvus-ai/plugin"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"
import { activeExecutionCapsuleRuntimeFact, ExecutionCapsuleRuntimeUnavailableError } from "./runtime"
import { EXECUTION_CAPSULE_FILE_WORKER_SOURCE } from "./file-worker-source"
import { Filesystem } from "@/util/filesystem"

type Operation = keyof ToolFiles
const operationPathIndexes: Partial<Record<Operation, readonly number[]>> = {
  access: [0],
  copyFile: [0, 1],
  cp: [0, 1],
  lstat: [0],
  mkdir: [0],
  mkdtemp: [0],
  readFile: [0],
  readdir: [0],
  realpath: [0],
  rename: [0, 1],
  rm: [0],
  stat: [0],
  writeFile: [0],
}

function encode(value: unknown): unknown {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __bytes: Buffer.from(value).toString("base64") }
  }
  if (value instanceof URL) return fileURLToPath(value)
  if (Array.isArray(value)) return value.map(encode)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
  }
  return value
}

function fileType(value: Record<string, unknown>) {
  return {
    isBlockDevice: () => value.isBlockDevice === true,
    isCharacterDevice: () => value.isCharacterDevice === true,
    isDirectory: () => value.isDirectory === true,
    isFIFO: () => value.isFIFO === true,
    isFile: () => value.isFile === true,
    isSocket: () => value.isSocket === true,
    isSymbolicLink: () => value.isSymbolicLink === true,
  }
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode)
  if (!value || typeof value !== "object") return value
  const record = value as Record<string, unknown>
  if (typeof record.__bytes === "string") return Buffer.from(record.__bytes, "base64")
  if (record.__dirent === true) return Object.freeze({ name: record.name, parentPath: record.parentPath, ...fileType(record) })
  if (record.__stats === true) {
    const fields = Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => key !== "__stats" && !key.startsWith("is"))
        .map(([key, item]) => [key, item && typeof item === "object" && "__bigint" in item ? BigInt(String((item as { __bigint: unknown }).__bigint)) : item]),
    )
    return Object.freeze({ ...fields, ...fileType(record) })
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]))
}

function operationError(payload: Record<string, unknown>) {
  const error = new Error(String(payload.message ?? "Execution Capsule file operation failed")) as NodeJS.ErrnoException
  error.name = typeof payload.name === "string" ? payload.name : "Error"
  if (typeof payload.code === "string") error.code = payload.code
  if (typeof payload.path === "string") error.path = payload.path
  if (typeof payload.syscall === "string") error.syscall = payload.syscall
  return error
}

async function collect(stream: NodeJS.ReadableStream | null) {
  if (!stream) return ""
  let output = ""
  for await (const chunk of stream) output += chunk.toString()
  return output
}

export async function executeCapsuleFileOperation(input: {
  taskID: string
  cwd: string
  operation: Operation
  args: unknown[]
}): Promise<unknown> {
  const runtime = await activeExecutionCapsuleRuntimeFact()
  if (!runtime) throw new ExecutionCapsuleRuntimeUnavailableError("Capsule file broker requires an active runtime")
  const capsule = await activeTaskExecutionCapsule({ taskID: input.taskID, cwd: input.cwd })
  if (!capsule) throw new ExecutionCapsuleRuntimeUnavailableError("Capsule file broker requires a Task binding")
  const mappedArgs = [...input.args]
  for (const index of operationPathIndexes[input.operation] ?? []) {
    const value = mappedArgs[index]
    const raw = value instanceof URL ? fileURLToPath(value) : value
    if (typeof raw !== "string" || !path.isAbsolute(raw)) continue
    const absolute = Filesystem.normalizePath(path.resolve(raw))
    mappedArgs[index] = Filesystem.contains(capsule.root, absolute)
      ? path.posix.join("/workspace", path.relative(capsule.root, absolute).split(path.sep).join("/"))
      : path.posix.join("/opencorvus-outside-root", Buffer.from(absolute).toString("hex"))
  }
  const handle = await ProcessSupervisor.spawnTaskCommand({ taskID: input.taskID, cwd: input.cwd }, {
    executable: runtime.nodePath,
    args: ["-e", EXECUTION_CAPSULE_FILE_WORKER_SOURCE, "/workspace"],
    env: {},
    stdin: "pipe",
    owner: "task-file-broker",
  })
  const stdout = collect(handle.stdout)
  const stderr = collect(handle.stderr)
  handle.stdin?.end(JSON.stringify({ operation: input.operation, args: encode(mappedArgs) }))
  const exitCode = await handle.exited
  const [output, errorOutput] = await Promise.all([stdout, stderr])
  await handle.dispose()
  let response: { ok: boolean; value?: unknown; error?: Record<string, unknown> }
  try {
    response = JSON.parse(output)
  } catch (cause) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Capsule file broker returned invalid output (exit ${exitCode}): ${errorOutput || (cause instanceof Error ? cause.message : String(cause))}`,
    )
  }
  if (!response.ok) throw operationError(response.error ?? {})
  if (exitCode !== 0) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Capsule file broker exited ${exitCode} after a success response: ${errorOutput}`,
    )
  }
  return decode(response.value)
}
