import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import z from "zod"
import { ProcessRecoveryPhysicalEvidence } from "@/engine/process-recovery-fact"
import { Global } from "@/global"

const ProcessOccurrenceEnvelope = z
  .object({
    schema_version: z.literal(2),
    supervisor_observation_id: z.string().min(1),
    process_occurrence_id: z.string().min(1),
    predecessor_process_occurrence_id: z.string().min(1).nullable(),
    predecessor_envelope_path: z.string().min(1).nullable(),
    parent_pid: z.number().int().positive(),
    port: z.number().int().positive(),
    pid: z.number().int().positive().nullable(),
    started_at_ms: z.number().int().positive(),
    executable_path: z.string().min(1),
    build_identity: z.string().min(1),
    sidecar_log_path: z.string().min(1),
    state: z.enum([
      "launching",
      "running",
      "spawn_failed",
      "ownership_failed",
      "occurrence_publish_failed",
      "graceful_exit",
      "forced_exit",
      "early_exit",
    ]),
    shutdown_source: z.string().min(1).nullable(),
    shutdown_reason: z.string().min(1).nullable(),
    exit_code: z.number().int().nullable(),
    exit_signal: z.number().int().positive().nullable(),
    terminal_at_ms: z.number().int().positive().nullable(),
  })
  .strict()

type ProcessOccurrenceEnvelope = z.infer<typeof ProcessOccurrenceEnvelope>
export type ProcessRecoveryPhysicalEvidence = z.infer<typeof ProcessRecoveryPhysicalEvidence>

const UNKNOWN_REASON = "No managed sidecar supervisor occurrence evidence is available for this backend process"

export interface RuntimeProcessOccurrenceInfo {
  pid: number
  processInstanceID: string
  occurrenceID: string
}

export type RuntimeProcessOccurrenceObservation = "exact_live" | "dead_or_reused" | "unknown_live"
export type RuntimeProcessOccurrenceObserver = (
  owner: RuntimeProcessOccurrenceInfo,
) => RuntimeProcessOccurrenceObservation

let runtimeProcessOccurrence: RuntimeProcessOccurrenceInfo | undefined

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

function windowsProcessInstanceID(pid: number): string | undefined {
  const { dlopen, FFIType, ptr } = require("bun:ffi") as typeof import("bun:ffi")
  const kernel32 = dlopen("kernel32.dll", {
    OpenProcess: { args: [FFIType.u32, FFIType.u32, FFIType.u32], returns: FFIType.ptr },
    GetProcessTimes: {
      args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
      returns: FFIType.u32,
    },
    CloseHandle: { args: [FFIType.ptr], returns: FFIType.u32 },
  })
  const processHandle = kernel32.symbols.OpenProcess(0x1000, 0, pid)
  if (!processHandle) {
    kernel32.close()
    return undefined
  }
  try {
    const creationTime = Buffer.alloc(8)
    const exitTime = Buffer.alloc(8)
    const kernelTime = Buffer.alloc(8)
    const userTime = Buffer.alloc(8)
    const succeeded = kernel32.symbols.GetProcessTimes(
      processHandle,
      ptr(creationTime),
      ptr(exitTime),
      ptr(kernelTime),
      ptr(userTime),
    )
    const dotNetEpochOffset = 504_911_232_000_000_000n
    return succeeded ? `win32:${creationTime.readBigUInt64LE() + dotNetEpochOffset}` : undefined
  } finally {
    kernel32.symbols.CloseHandle(processHandle)
    kernel32.close()
  }
}

function processInstanceID(pid: number): string | undefined {
  try {
    if (process.platform === "linux") {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8")
      const fields = stat
        .slice(stat.lastIndexOf(")") + 2)
        .trim()
        .split(/\s+/)
      const startTicks = fields[19]
      return startTicks ? `linux:${startTicks}` : undefined
    }
    if (process.platform === "win32") return windowsProcessInstanceID(pid)
    const value = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return value ? `${os.platform()}:${value}` : undefined
  } catch {
    return undefined
  }
}

/** Exact process-lifetime identity used by durable execution leases and orphan
 * recovery. It is independent of every database path and listener. */
export function currentRuntimeProcessOccurrence(): RuntimeProcessOccurrenceInfo {
  if (!runtimeProcessOccurrence) {
    const instanceID = processInstanceID(process.pid)
    if (!instanceID) throw new Error(`Cannot establish runtime process-instance identity for PID ${process.pid}`)
    runtimeProcessOccurrence = {
      pid: process.pid,
      processInstanceID: instanceID,
      occurrenceID: randomUUID(),
    }
  }
  return { ...runtimeProcessOccurrence }
}

export function observeRuntimeProcessOccurrence(
  owner: RuntimeProcessOccurrenceInfo,
): RuntimeProcessOccurrenceObservation {
  const observedInstanceID = processInstanceID(owner.pid)
  if (observedInstanceID === owner.processInstanceID) return "exact_live"
  if (observedInstanceID !== undefined) return "dead_or_reused"
  return isProcessAlive(owner.pid) ? "unknown_live" : "dead_or_reused"
}

export function cachedRuntimeProcessOccurrenceObserver(
  observe: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
): RuntimeProcessOccurrenceObserver {
  const observations = new Map<string, RuntimeProcessOccurrenceObservation>()
  return (owner) => {
    const key = `${owner.pid}\0${owner.processInstanceID}`
    const cached = observations.get(key)
    if (cached) return cached
    const observation = observe(owner)
    observations.set(key, observation)
    return observation
  }
}

export type ProcessOccurrenceEvidenceErrorReason =
  | "path_not_absolute"
  | "outside_managed_occurrence_directory"
  | "physical_path_escape"
  | "not_regular_file"
  | "unreadable_or_invalid_envelope"
  | "identity_mismatch"

export class ProcessOccurrenceEvidenceError extends Error {
  override readonly name = "ProcessOccurrenceEvidenceError"
  readonly code = "PROCESS_OCCURRENCE_EVIDENCE_INVALID"

  constructor(
    readonly reason: ProcessOccurrenceEvidenceErrorReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

function unknownPhysicalEvidence(): ProcessRecoveryPhysicalEvidence {
  return {
    kind: "unmanaged_process_cause_unknown",
    reason: UNKNOWN_REASON,
  }
}

function occurrenceDirectory(): string {
  return path.resolve(Global.Path.data, "process-occurrences")
}

function samePhysicalPath(left: string, right: string): boolean {
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase()
  return left === right
}

function readExactEnvelope(file: string): ProcessOccurrenceEnvelope {
  if (!path.isAbsolute(file)) {
    throw new ProcessOccurrenceEvidenceError(
      "path_not_absolute",
      `Supervisor process occurrence path is not absolute: ${file}`,
    )
  }
  const directory = occurrenceDirectory()
  const resolvedFile = path.resolve(file)
  if (!samePhysicalPath(path.dirname(resolvedFile), directory)) {
    throw new ProcessOccurrenceEvidenceError(
      "outside_managed_occurrence_directory",
      `Supervisor process occurrence path is outside the managed occurrence directory: ${file}`,
    )
  }
  try {
    const physicalDirectory = fs.realpathSync.native(directory)
    const physicalFile = fs.realpathSync.native(resolvedFile)
    if (!samePhysicalPath(path.dirname(physicalFile), physicalDirectory)) {
      throw new ProcessOccurrenceEvidenceError(
        "physical_path_escape",
        `Supervisor process occurrence path resolves outside the managed occurrence directory: ${file}`,
      )
    }
    if (!fs.statSync(physicalFile).isFile()) {
      throw new ProcessOccurrenceEvidenceError(
        "not_regular_file",
        `Supervisor process occurrence path is not a regular file: ${file}`,
      )
    }
    return ProcessOccurrenceEnvelope.parse(JSON.parse(fs.readFileSync(physicalFile, "utf8")))
  } catch (error) {
    if (error instanceof ProcessOccurrenceEvidenceError) throw error
    throw new ProcessOccurrenceEvidenceError(
      "unreadable_or_invalid_envelope",
      `Supervisor process occurrence envelope is unreadable or invalid: ${file}`,
      { cause: error },
    )
  }
}

function managedEvidence(file: string, envelope: ProcessOccurrenceEnvelope): ProcessRecoveryPhysicalEvidence {
  return {
    kind: "managed_process_occurrence",
    process_occurrence_id: envelope.process_occurrence_id,
    supervisor_observation_id: envelope.supervisor_observation_id,
    envelope_path: path.resolve(file),
  }
}

export function validateProcessPhysicalEvidence(
  evidence: ProcessRecoveryPhysicalEvidence,
): ProcessRecoveryPhysicalEvidence {
  const parsed = ProcessRecoveryPhysicalEvidence.parse(evidence)
  if (parsed.kind === "unmanaged_process_cause_unknown") return parsed
  const envelope = readExactEnvelope(parsed.envelope_path)
  if (
    envelope.process_occurrence_id !== parsed.process_occurrence_id ||
    envelope.supervisor_observation_id !== parsed.supervisor_observation_id
  ) {
    throw new ProcessOccurrenceEvidenceError(
      "identity_mismatch",
      `Managed process occurrence evidence ${parsed.process_occurrence_id} no longer matches its envelope`,
    )
  }
  return parsed
}

export function currentProcessPhysicalEvidence(): ProcessRecoveryPhysicalEvidence {
  const id = process.env.OPENCORVUS_PROCESS_OCCURRENCE_ID?.trim()
  const file = process.env.OPENCORVUS_PROCESS_OCCURRENCE_PATH?.trim()
  if (!id && !file) return unknownPhysicalEvidence()
  if (!id || !file) throw new Error("Managed backend current process occurrence identity is incomplete")
  const envelope = readExactEnvelope(file)
  if (envelope.process_occurrence_id !== id) {
    throw new Error(
      `Managed backend occurrence ${id} does not match supervisor envelope ${envelope.process_occurrence_id}`,
    )
  }
  if (envelope.pid !== process.pid) {
    throw new Error(`Managed backend occurrence ${id} belongs to process ${envelope.pid ?? "null"}, not ${process.pid}`)
  }
  if (envelope.state !== "running") {
    throw new Error(`Managed backend occurrence ${id} is not running: ${envelope.state}`)
  }
  return managedEvidence(file, envelope)
}

export function interruptedProcessPhysicalEvidence(): ProcessRecoveryPhysicalEvidence {
  const predecessorFile = process.env.OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH?.trim()
  if (!predecessorFile) return unknownPhysicalEvidence()
  const predecessor = readExactEnvelope(predecessorFile)
  const currentID = process.env.OPENCORVUS_PROCESS_OCCURRENCE_ID?.trim()
  const currentFile = process.env.OPENCORVUS_PROCESS_OCCURRENCE_PATH?.trim()
  if (!currentID || !currentFile) {
    throw new Error("Managed predecessor occurrence requires the replacement process occurrence identity")
  }
  const current = readExactEnvelope(currentFile)
  if (current.process_occurrence_id !== currentID) {
    throw new Error(
      `Replacement occurrence ${currentID} does not match supervisor envelope ${current.process_occurrence_id}`,
    )
  }
  if (current.pid !== process.pid || current.state !== "running") {
    throw new Error(`Replacement occurrence ${currentID} is not the running backend process ${process.pid}`)
  }
  if (
    current.predecessor_process_occurrence_id !== predecessor.process_occurrence_id ||
    path.resolve(current.predecessor_envelope_path ?? "") !== path.resolve(predecessorFile)
  ) {
    throw new Error(
      `Replacement occurrence ${currentID} does not name exact predecessor ${predecessor.process_occurrence_id}`,
    )
  }
  if (!["running", "graceful_exit", "forced_exit", "early_exit"].includes(predecessor.state)) {
    throw new Error(
      `Supervisor predecessor ${predecessor.process_occurrence_id} is not interruption evidence: ${predecessor.state}`,
    )
  }
  return managedEvidence(predecessorFile, predecessor)
}

const ProcessShutdownRequest = z
  .object({
    schema_version: z.literal(1),
    process_occurrence_id: z.string().min(1),
    source: z.enum([
      "tauri-supervisor",
      "managed-parent-watchdog",
      "http-client",
      "internal-restart",
      "process-signal",
    ]),
    reason: z.string().min(1),
    requested_at_ms: z.number().int().positive(),
  })
  .strict()

export function recordCurrentProcessShutdownRequest(input: {
  source: z.infer<typeof ProcessShutdownRequest>["source"]
  reason: string
  processOccurrenceID?: string
}): void {
  const evidence = currentProcessPhysicalEvidence()
  if (evidence.kind !== "managed_process_occurrence") return
  if (input.processOccurrenceID && input.processOccurrenceID !== evidence.process_occurrence_id) {
    throw new Error(
      `Shutdown request occurrence ${input.processOccurrenceID} does not match ${evidence.process_occurrence_id}`,
    )
  }
  const target = process.env.OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH?.trim()
  if (!target || !path.isAbsolute(target) || path.dirname(path.resolve(target)) !== occurrenceDirectory()) {
    throw new Error("Managed backend shutdown request path is missing or outside the occurrence directory")
  }
  const request = ProcessShutdownRequest.parse({
    schema_version: 1,
    process_occurrence_id: evidence.process_occurrence_id,
    source: input.source,
    reason: input.reason,
    requested_at_ms: Date.now(),
  })
  const temporary = `${target}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(request, null, 2))
  fs.renameSync(temporary, target)
}
