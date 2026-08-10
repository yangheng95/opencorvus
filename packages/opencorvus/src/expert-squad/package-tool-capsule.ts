import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ToolContext, ToolHost } from "@opencorvus-ai/plugin"
import { resolveBrowserNodeSidecarRuntime } from "@/browser/runtime/node-sidecar"
import { resolveTaskProcessExecution } from "@/engine/task-execution-capsule-binding"
import { ExecutionCapsuleRuntimeUnavailableError, activeExecutionCapsuleRuntimeFact } from "@/execution-capsule/runtime"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { which } from "@/util/which"
import type { PackageToolBundle } from "./package-tool-bundle"

// RPC means Remote Procedure Call. JSON means JavaScript Object Notation.
const RPC_PREFIX = "\u001eopencorvus-package-tool-rpc-v1:"
const NATIVE_PACKAGE_TOOL_INACTIVITY_MS = 300_000

type CapsuleContext = Pick<
  ToolContext,
  "sessionID" | "messageID" | "agent" | "directory" | "worktree" | "configuration"
>

type Introspection = Readonly<{
  description: string
  inputSchema: Record<string, unknown>
}>

type Execution = Readonly<{
  output: string
  title: string
  metadata: Record<string, unknown>
}>

type RpcMessage =
  | { kind: "host_call"; id: string; path: string[]; args: unknown[] }
  | { kind: "result"; value: unknown }
  | { kind: "failure"; error: Record<string, unknown> }

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isFileMetadata(value: object): value is {
  isBlockDevice(): boolean
  isCharacterDevice(): boolean
  isDirectory(): boolean
  isFIFO(): boolean
  isFile(): boolean
  isSocket(): boolean
  isSymbolicLink(): boolean
} {
  return "isFile" in value && typeof value.isFile === "function"
}

async function encode(value: unknown): Promise<unknown> {
  if (value === undefined) return { __rpc_type: "undefined" }
  if (typeof value === "bigint") return { __rpc_type: "bigint", value: String(value) }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __rpc_type: "bytes", value: Buffer.from(value).toString("base64") }
  }
  if (value instanceof URL) return { __rpc_type: "url", value: value.href }
  if (value instanceof Date) return { __rpc_type: "date", value: value.toISOString() }
  if (value instanceof Response) {
    return {
      __rpc_type: "response",
      status: value.status,
      statusText: value.statusText,
      headers: [...value.headers.entries()],
      body: value.body === null ? null : Buffer.from(await value.arrayBuffer()).toString("base64"),
      url: value.url,
      redirected: value.redirected,
      responseType: value.type,
    }
  }
  if (value instanceof Request) {
    return {
      __rpc_type: "request",
      url: value.url,
      method: value.method,
      headers: [...value.headers.entries()],
      body: value.body ? Buffer.from(await value.arrayBuffer()).toString("base64") : null,
      redirect: value.redirect,
    }
  }
  if (value instanceof AbortSignal) return { __rpc_type: "abort_signal" }
  if (Array.isArray(value)) return Promise.all(value.map(encode))
  if (value && typeof value === "object") {
    if (isFileMetadata(value)) {
      const record = value as unknown as Record<string, unknown>
      const fields: Record<string, unknown> = {}
      for (const key of [
        "name",
        "parentPath",
        "dev",
        "ino",
        "mode",
        "nlink",
        "uid",
        "gid",
        "rdev",
        "size",
        "blksize",
        "blocks",
        "atimeMs",
        "mtimeMs",
        "ctimeMs",
        "birthtimeMs",
        "atimeNs",
        "mtimeNs",
        "ctimeNs",
        "birthtimeNs",
        "atime",
        "mtime",
        "ctime",
        "birthtime",
      ]) {
        if (record[key] !== undefined) fields[key] = await encode(record[key])
      }
      return {
        __rpc_type: typeof record.name === "string" ? "dirent" : "stats",
        fields,
        fileTypes: {
          isBlockDevice: value.isBlockDevice(),
          isCharacterDevice: value.isCharacterDevice(),
          isDirectory: value.isDirectory(),
          isFIFO: value.isFIFO(),
          isFile: value.isFile(),
          isSocket: value.isSocket(),
          isSymbolicLink: value.isSymbolicLink(),
        },
      }
    }
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encode(item)] as const))
    return Object.fromEntries(entries)
  }
  return value
}

function fileTypeMethods(types: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(types).map(([name, value]) => [name, () => value === true]))
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode)
  if (!value || typeof value !== "object") return value
  const record = value as Record<string, unknown>
  if (record.__rpc_type === "undefined") return undefined
  if (record.__rpc_type === "bigint") return BigInt(String(record.value))
  if (record.__rpc_type === "bytes") return Buffer.from(String(record.value), "base64")
  if (record.__rpc_type === "url") return new URL(String(record.value))
  if (record.__rpc_type === "date") return new Date(String(record.value))
  if (record.__rpc_type === "abort_signal") return undefined
  if (record.__rpc_type === "request") {
    const body = record.body === null ? undefined : Buffer.from(String(record.body), "base64")
    return new Request(String(record.url), {
      method: String(record.method),
      headers: record.headers as [string, string][],
      body,
      redirect: record.redirect as RequestRedirect,
      ...(body ? ({ duplex: "half" } as Record<string, unknown>) : {}),
    } as RequestInit)
  }
  if (record.__rpc_type === "response") {
    const response = new Response(
      record.body === null ? undefined : Buffer.from(String(record.body), "base64"),
      {
        status: Number(record.status),
        statusText: String(record.statusText),
        headers: record.headers as [string, string][],
      },
    )
    Object.defineProperties(response, {
      url: { value: String(record.url), enumerable: true },
      redirected: { value: record.redirected === true, enumerable: true },
      type: { value: String(record.responseType), enumerable: true },
    })
    return response
  }
  if (record.__rpc_type === "stats" || record.__rpc_type === "dirent") {
    const fields = Object.fromEntries(
      Object.entries((record.fields ?? {}) as Record<string, unknown>).map(([key, item]) => [key, decode(item)]),
    )
    return Object.freeze({ ...fields, ...fileTypeMethods((record.fileTypes ?? {}) as Record<string, unknown>) })
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]))
}

export const PackageToolCapsuleRpc = Object.freeze({ encode, decode })

function serializedError(error: unknown) {
  const source = error && typeof error === "object" ? (error as Record<string, unknown>) : {}
  return {
    name: typeof source.name === "string" ? source.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    code: source.code,
    path: source.path,
    syscall: source.syscall,
  }
}

function callableCapability(host: ToolHost, path: readonly string[]) {
  let owner: unknown = host
  for (const segment of path.slice(0, -1)) {
    if (!owner || typeof owner !== "object" || !Object.hasOwn(owner, segment)) {
      throw new Error(`Package ToolHost RPC capability ${path.join(".")} is unavailable`)
    }
    owner = (owner as Record<string, unknown>)[segment]
  }
  const method = path.at(-1)
  if (!method || !owner || typeof owner !== "object" || !Object.hasOwn(owner, method)) {
    throw new Error(`Package ToolHost RPC capability ${path.join(".")} is unavailable`)
  }
  const operation = (owner as Record<string, unknown>)[method]
  if (typeof operation !== "function") {
    throw new Error(`Package ToolHost RPC capability ${path.join(".")} is not callable`)
  }
  return { owner, operation }
}

const WORKER_SOURCE = String.raw`
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const readline = require("node:readline");
const prefix = ${JSON.stringify(RPC_PREFIX)};
const rpcWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);
const send = (message) => rpcWrite(prefix + JSON.stringify(message) + "\n");
const pending = new Map();
let callSequence = 0;

function fileTypes(types) {
  return Object.fromEntries(Object.entries(types).map(([name, value]) => [name, () => value === true]));
}
async function encode(value) {
  if (value === undefined) return { __rpc_type: "undefined" };
  if (typeof value === "bigint") return { __rpc_type: "bigint", value: String(value) };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __rpc_type: "bytes", value: Buffer.from(value).toString("base64") };
  if (value instanceof URL) return { __rpc_type: "url", value: value.href };
  if (value instanceof Date) return { __rpc_type: "date", value: value.toISOString() };
  if (value instanceof Request) return {
    __rpc_type: "request", url: value.url, method: value.method, headers: [...value.headers.entries()],
    body: value.body ? Buffer.from(await value.arrayBuffer()).toString("base64") : null, redirect: value.redirect,
  };
  if (value instanceof AbortSignal) return { __rpc_type: "abort_signal" };
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encode(item)])));
  return value;
}
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (!value || typeof value !== "object") return value;
  if (value.__rpc_type === "undefined") return undefined;
  if (value.__rpc_type === "bigint") return BigInt(value.value);
  if (value.__rpc_type === "bytes") return Buffer.from(value.value, "base64");
  if (value.__rpc_type === "url") return new URL(value.value);
  if (value.__rpc_type === "date") return new Date(value.value);
  if (value.__rpc_type === "abort_signal") return undefined;
  if (value.__rpc_type === "response") {
    const response = new Response(value.body === null ? undefined : Buffer.from(value.body, "base64"), { status: value.status, statusText: value.statusText, headers: value.headers });
    Object.defineProperties(response, {
      url: { value: value.url, enumerable: true }, redirected: { value: value.redirected, enumerable: true },
      type: { value: value.responseType, enumerable: true },
    });
    return response;
  }
  if (value.__rpc_type === "stats" || value.__rpc_type === "dirent") {
    return Object.freeze({ ...Object.fromEntries(Object.entries(value.fields || {}).map(([key, item]) => [key, decode(item)])), ...fileTypes(value.fileTypes || {}) });
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}
function remoteError(payload) {
  return Object.assign(new Error(payload && payload.message || "Package ToolHost RPC failed"), payload || {});
}
async function hostCall(path, args) {
  const id = String(++callSequence);
  send({ kind: "host_call", id, path, args: await encode(args) });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function hostProxy(start) {
  const branch = (segments) => new Proxy(() => undefined, {
    get(_target, property) { return branch([...segments, String(property)]); },
    apply(_target, _receiver, args) { return hostCall(segments, args); },
  });
  return Object.freeze({
    kind: "task",
    managedRuntimeDirectory: start.managedRuntimeDirectory,
    files: branch(["files"]), fetch: (...args) => hostCall(["fetch"], args),
    runCommand: (...args) => hostCall(["runCommand"], args),
    engineArtifacts: branch(["engineArtifacts"]), taskArtifacts: branch(["taskArtifacts"]),
    taskRuns: branch(["taskRuns"]), expertSquadPackages: branch(["expertSquadPackages"]), metrics: branch(["metrics"]),
  });
}
async function loadDefinition(start) {
  const bytes = Buffer.from(start.bundle, "base64");
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== start.bundleSHA256) throw new Error("Package tool compiled bundle digest mismatch inside Task Capsule");
  const location = path.join(start.workerRuntimeDirectory, "opencorvus-package-tool-" + start.bundleSHA256 + ".mjs");
  const existing = await fs.readFile(location).catch((error) => {
    if (error && error.code === "ENOENT") return undefined;
    throw error;
  });
  if (existing) {
    if (crypto.createHash("sha256").update(existing).digest("hex") !== start.bundleSHA256) {
      throw new Error("Package tool materialized bundle cache digest mismatch");
    }
  } else {
    const temporary = location + "." + process.pid + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temporary, bytes, { flag: "wx" });
      try {
        await fs.rename(temporary, location);
      } catch (error) {
        const target = await fs.readFile(location).catch((readError) => {
          if (readError && readError.code === "ENOENT") return undefined;
          throw readError;
        });
        if (!target || crypto.createHash("sha256").update(target).digest("hex") !== start.bundleSHA256) throw error;
      }
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  const materialized = await fs.readFile(location);
  if (crypto.createHash("sha256").update(materialized).digest("hex") !== start.bundleSHA256) {
    throw new Error("Package tool materialized bundle cache digest mismatch");
  }
  const imported = await import(pathToFileURL(location).href);
  const definition = imported.default;
  if (!definition || typeof definition !== "object" || typeof definition.introspect !== "function" || typeof definition.execute !== "function") {
    throw new Error("Package tool must export the current ToolDefinition ABI");
  }
  return definition;
}
async function main(start) {
  if (!start || start.protocol !== "opencorvus.package-tool-capsule-rpc.v1") throw new Error("Package tool Capsule RPC protocol is invalid");
  if (start.operation !== "introspect" && start.operation !== "execute") throw new Error("Package tool Capsule RPC operation is invalid");
  const definition = await loadDefinition(start);
  if (start.operation === "introspect") {
    const result = definition.introspect();
    if (!result || typeof result.description !== "string" || !result.inputSchema || typeof result.inputSchema !== "object") {
      throw new Error("Package tool introspection returned an invalid description or JSON Schema");
    }
    send({ kind: "result", value: await encode(result) });
    return;
  }
  let title = "";
  let metadata = {};
  const abortController = new AbortController();
  const context = {
    ...decode(start.context), abort: abortController.signal, host: hostProxy(start),
    metadata(update) {
      if (update && update.title !== undefined) title = update.title;
      if (update && update.metadata !== undefined) metadata = { ...metadata, ...update.metadata };
    },
  };
  const output = await definition.execute(decode(start.args), context);
  if (typeof output !== "string") throw new Error("Package tool returned non-string output");
  send({ kind: "result", value: await encode({ output, title, metadata }) });
}
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let started = false;
lines.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch (error) { send({ kind: "failure", error: { name: error.name, message: error.message } }); return; }
  if (!started) {
    started = true;
    void main(message).catch((error) => send({ kind: "failure", error: { name: error && error.name, message: error && error.message || String(error), code: error && error.code, path: error && error.path, syscall: error && error.syscall } }));
    return;
  }
  if (message.kind === "host_result" || message.kind === "host_failure") {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.kind === "host_result") waiter.resolve(decode(message.value));
    else waiter.reject(remoteError(message.error));
  }
});
`

const nativeWorkerPublications = new Map<string, Promise<string>>()

async function nativePackageToolWorkerPath(prepared: PackageToolBundle.Prepared): Promise<string> {
  const worker = Buffer.from(WORKER_SOURCE, "utf8")
  const digest = sha256(worker)
  const file = path.join(path.dirname(prepared.bundlePath), `package-tool-worker-${digest}.cjs`)
  const active = nativeWorkerPublications.get(digest)
  if (active) return active
  const publication = (async () => {
    const existing = await readFile(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (existing) {
      if (sha256(existing) !== digest) {
        throw new ExecutionCapsuleRuntimeUnavailableError(
          "Package tool native worker digest does not match its runtime source",
        )
      }
      return file
    }

    await mkdir(path.dirname(file), { recursive: true })
    const temporary = path.join(path.dirname(file), `.${digest}.${process.pid}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, worker, { flag: "wx" })
      await rename(temporary, file)
    } catch (error) {
      const target = await readFile(file).catch((readError: NodeJS.ErrnoException) => {
        if (readError.code === "ENOENT") return undefined
        throw readError
      })
      if (!target || sha256(target) !== digest) throw error
    } finally {
      await rm(temporary, { force: true })
    }
    if (sha256(await readFile(file)) !== digest) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        "Package tool native worker digest does not match its runtime source",
      )
    }
    return file
  })()
  nativeWorkerPublications.set(digest, publication)
  try {
    return await publication
  } finally {
    nativeWorkerPublications.delete(digest)
  }
}

export function nativePackageToolEnvironment(): NodeJS.ProcessEnv {
  if (process.platform !== "win32") return {}
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!systemRoot) {
    throw new ExecutionCapsuleRuntimeUnavailableError("Native Windows package tools require the SystemRoot runtime fact")
  }
  return { SystemRoot: systemRoot }
}

async function runCapsule(input: {
  prepared: PackageToolBundle.Prepared
  taskID: string
  cwd: string
  operation: "introspect" | "execute"
  host?: ToolHost
  context?: CapsuleContext
  args?: unknown
  abort?: AbortSignal
}): Promise<unknown> {
  if (input.abort?.aborted) throw input.abort.reason
  const execution = await resolveTaskProcessExecution({ taskID: input.taskID, cwd: input.cwd })
  const capsuleRuntime = execution.kind === "task_capsule" ? await activeExecutionCapsuleRuntimeFact() : undefined
  if (execution.kind === "task_capsule" && !capsuleRuntime) {
    throw new ExecutionCapsuleRuntimeUnavailableError("Package tool Task Capsule runtime is unavailable")
  }
  const nativeNode =
    execution.kind === "task_native" ? (await resolveBrowserNodeSidecarRuntime()).nodeExecutable : undefined
  const executable =
    capsuleRuntime?.nodePath ??
    (nativeNode && (path.isAbsolute(nativeNode) ? nativeNode : which(nativeNode))) ??
    undefined
  if (!executable) {
    throw new ExecutionCapsuleRuntimeUnavailableError("Package tool native Node runtime is unavailable")
  }
  const inactivityMs = capsuleRuntime?.packageToolInactivityMs ?? NATIVE_PACKAGE_TOOL_INACTIVITY_MS
  const nativeWorker = execution.kind === "task_native" ? await nativePackageToolWorkerPath(input.prepared) : undefined
  const args = nativeWorker ? [nativeWorker] : ["-e", WORKER_SOURCE]
  const workerRuntimeDirectory = nativeWorker ? path.dirname(nativeWorker) : "/tmp"
  const bundle = await readFile(input.prepared.bundlePath)
  if (sha256(bundle) !== input.prepared.snapshot.compiledBundleSHA256) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Package tool ${input.prepared.snapshot.ref} compiled bundle digest does not match its frozen snapshot`,
    )
  }
  const handle = await ProcessSupervisor.spawnTaskCommand({ taskID: input.taskID, cwd: input.cwd }, {
    executable,
    args,
    env: execution.kind === "task_capsule" ? {} : nativePackageToolEnvironment(),
    stdin: "pipe",
    owner: `package-tool:${input.prepared.snapshot.ref}`,
  })
  let stderr = ""
  let outputBuffer = ""
  let settled = false
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined
  let resolveResult: (value: unknown) => void = () => {}
  let rejectResult: (error: unknown) => void = () => {}
  const result = new Promise<unknown>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(() => {
      rejectResult(
        new ExecutionCapsuleRuntimeUnavailableError(
          `Package tool ${input.prepared.snapshot.ref} produced no process or RPC activity for ${inactivityMs}ms`,
        ),
      )
    }, inactivityMs)
  }
  handle.stderr?.setEncoding("utf8")
  handle.stderr?.on("data", (chunk) => {
    resetInactivity()
    stderr += String(chunk)
  })
  const write = (message: unknown) => {
    resetInactivity()
    handle.stdin?.write(`${JSON.stringify(message)}\n`)
  }
  handle.stdin?.on("error", rejectResult)
  const dispatch = async (message: RpcMessage) => {
    if (message.kind === "result") {
      settled = true
      if (inactivityTimer) clearTimeout(inactivityTimer)
      resolveResult(decode(message.value))
      return
    }
    if (message.kind === "failure") {
      settled = true
      if (inactivityTimer) clearTimeout(inactivityTimer)
      const error = Object.assign(new Error(String(message.error.message ?? "Package tool Capsule failed")), message.error)
      rejectResult(error)
      return
    }
    if (!input.host) throw new Error("Package tool introspection cannot invoke ToolHost capabilities")
    try {
      const { owner, operation } = callableCapability(input.host, message.path)
      const args = decode(message.args) as unknown[]
      if (message.path.length === 1 && message.path[0] === "fetch") {
        const init = args[1] && typeof args[1] === "object" ? (args[1] as RequestInit) : {}
        args[1] = { ...init, signal: input.abort }
      }
      const value = await Reflect.apply(operation, owner, args)
      write({ kind: "host_result", id: message.id, value: await encode(value) })
    } catch (error) {
      write({ kind: "host_failure", id: message.id, error: serializedError(error) })
    }
  }
  handle.stdout?.setEncoding("utf8")
  handle.stdout?.on("data", (chunk) => {
    resetInactivity()
    outputBuffer += String(chunk)
    for (;;) {
      const newline = outputBuffer.indexOf("\n")
      if (newline < 0) break
      const line = outputBuffer.slice(0, newline)
      outputBuffer = outputBuffer.slice(newline + 1)
      if (!line.startsWith(RPC_PREFIX)) continue
      try {
        void dispatch(JSON.parse(line.slice(RPC_PREFIX.length)) as RpcMessage).catch(rejectResult)
      } catch (error) {
        rejectResult(error)
      }
    }
  })
  const onAbort = () => {
    void ProcessSupervisor.terminateAndWaitForExit(handle, `package tool ${input.prepared.snapshot.ref}`).catch(rejectResult)
  }
  input.abort?.addEventListener("abort", onAbort, { once: true })
  resetInactivity()
  write({
    protocol: "opencorvus.package-tool-capsule-rpc.v1",
    operation: input.operation,
    invocationID: randomUUID(),
    bundle: bundle.toString("base64"),
    bundleSHA256: input.prepared.snapshot.compiledBundleSHA256,
    workerRuntimeDirectory,
    managedRuntimeDirectory: input.host?.managedRuntimeDirectory,
    context: await encode(input.context),
    args: await encode(input.args),
  })
  const exited = handle.exited.then(async (exitCode) => {
    await (handle.outputSettled ?? Promise.resolve())
    if (!settled) {
      rejectResult(
        new ExecutionCapsuleRuntimeUnavailableError(
          `Package tool ${input.prepared.snapshot.ref} Capsule exited ${exitCode} without a terminal RPC response: ${stderr}`,
        ),
      )
    }
  })
  try {
    return await result
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer)
    input.abort?.removeEventListener("abort", onAbort)
    handle.stdin?.end()
    await ProcessSupervisor.disposeAndWaitForExit(handle, `package tool ${input.prepared.snapshot.ref}`)
    await exited
  }
}

export function introspectPackageToolInCapsule(input: {
  prepared: PackageToolBundle.Prepared
  taskID: string
  cwd: string
}): Promise<Introspection> {
  return runCapsule({ ...input, operation: "introspect" }) as Promise<Introspection>
}

export function executePackageToolInCapsule(input: {
  prepared: PackageToolBundle.Prepared
  taskID: string
  cwd: string
  host: ToolHost
  context: CapsuleContext
  args: unknown
  abort: AbortSignal
}): Promise<Execution> {
  return runCapsule({ ...input, operation: "execute" }) as Promise<Execution>
}
