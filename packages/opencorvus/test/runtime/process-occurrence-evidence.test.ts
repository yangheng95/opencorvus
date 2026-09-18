import { afterEach, describe, expect, test } from "bun:test"
import { dlopen, FFIType } from "bun:ffi"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import {
  ProcessOccurrenceEvidenceError,
  ProcessInstanceIDTestHooks,
  RuntimeProcessIdentityError,
  currentRuntimeProcessOccurrence,
  observeRuntimeProcessOccurrence,
  validateProcessPhysicalEvidence,
} from "@/runtime/process-occurrence"

const cleanupRoots: string[] = []

test("required process identity retains exact live identity and a failed query cause", () => {
  const own = currentRuntimeProcessOccurrence()
  expect({ identity: ProcessInstanceIDTestHooks.require(process.pid), observation: observeRuntimeProcessOccurrence(own) })
    .toEqual({ identity: own.processInstanceID, observation: "exact_live" })
  let failure: unknown
  try { ProcessInstanceIDTestHooks.require(2_147_483_647) } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(RuntimeProcessIdentityError)
  expect(failure).toMatchObject({
    pid: 2_147_483_647,
    platform: process.platform,
    name: "RuntimeProcessIdentityError",
    cause: expect.any(Error),
  })
})

test.skipIf(process.platform !== "win32")(
  "observes an exited Windows process as dead while its kernel object remains queryable",
  async () => {
    const child = Bun.spawn(
      [
        process.execPath,
        `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
        "-e",
        "await Bun.sleep(30000)",
      ],
      { stdout: "ignore", stderr: "pipe" },
    )
    const kernel32 = dlopen("kernel32.dll", {
      OpenProcess: { args: [FFIType.u32, FFIType.u32, FFIType.u32], returns: FFIType.ptr },
      CloseHandle: { args: [FFIType.ptr], returns: FFIType.u32 },
    })
    const retainedHandle = kernel32.symbols.OpenProcess(0x1000, 0, child.pid)
    if (!retainedHandle) {
      child.kill()
      await child.exited
      kernel32.close()
      throw new Error(`Could not retain a query handle for child PID ${child.pid}`)
    }
    try {
      const occurrence = {
        pid: child.pid,
        processInstanceID: ProcessInstanceIDTestHooks.require(child.pid),
        occurrenceID: "retained-terminated-process",
      }
      expect(observeRuntimeProcessOccurrence(occurrence)).toBe("exact_live")
      child.kill()
      await child.exited
      expect(observeRuntimeProcessOccurrence(occurrence)).toBe("dead_or_reused")
    } finally {
      if (child.exitCode === null) {
        child.kill()
        await child.exited
      }
      kernel32.symbols.CloseHandle(retainedHandle)
      kernel32.close()
    }
  },
  30_000,
)

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Process occurrence tests require the repository test preload")
  const root = await fs.mkdtemp(path.join(processRoot, "process-occurrence-"))
  cleanupRoots.push(root)
  const directory = path.join(root, "data", "process-occurrences")
  await fs.mkdir(directory, { recursive: true })
  const file = path.join(directory, "process-test.json")
  await fs.writeFile(
    file,
    JSON.stringify({
      schema_version: 2,
      supervisor_observation_id: "observation-test",
      process_occurrence_id: "process-test",
      predecessor_process_occurrence_id: null,
      predecessor_envelope_path: null,
      parent_pid: 10,
      port: 7878,
      pid: 11,
      started_at_ms: 1,
      executable_path: "C:/OpenCorvus/opencorvus.exe",
      build_identity: "test-build",
      sidecar_log_path: "C:/OpenCorvus/sidecar.log",
      state: "graceful_exit",
      shutdown_source: "tauri-supervisor",
      shutdown_reason: "test handoff",
      exit_code: 0,
      exit_signal: null,
      terminal_at_ms: 2,
    }),
  )
  return { root, file }
}

describe("persisted process occurrence evidence", () => {
  test("validates a historical managed envelope against the bound database runtime data root", async () => {
    const { root, file } = await fixture()
    expect(
      Global.provideRoot(root, () =>
        validateProcessPhysicalEvidence({
          kind: "managed_process_occurrence",
          process_occurrence_id: "process-test",
          supervisor_observation_id: "observation-test",
          envelope_path: file,
        }),
      ),
    ).toEqual({
      kind: "managed_process_occurrence",
      process_occurrence_id: "process-test",
      supervisor_observation_id: "observation-test",
      envelope_path: file,
    })
  })

  test("maps path escape and identity tampering to explicit evidence errors", async () => {
    const { root, file } = await fixture()
    const outsideFile = path.join(root, "outside.json")
    await fs.copyFile(file, outsideFile)

    let escaped: unknown
    try {
      Global.provideRoot(root, () =>
        validateProcessPhysicalEvidence({
          kind: "managed_process_occurrence",
          process_occurrence_id: "process-test",
          supervisor_observation_id: "observation-test",
          envelope_path: outsideFile,
        }),
      )
    } catch (error) {
      escaped = error
    }
    expect(escaped).toMatchObject({
      name: "ProcessOccurrenceEvidenceError",
      code: "PROCESS_OCCURRENCE_EVIDENCE_INVALID",
      reason: "outside_managed_occurrence_directory",
    })

    let tampered: unknown
    try {
      Global.provideRoot(root, () =>
        validateProcessPhysicalEvidence({
          kind: "managed_process_occurrence",
          process_occurrence_id: "different-process",
          supervisor_observation_id: "observation-test",
          envelope_path: file,
        }),
      )
    } catch (error) {
      tampered = error
    }
    expect(tampered).toBeInstanceOf(ProcessOccurrenceEvidenceError)
    expect(tampered).toMatchObject({
      code: "PROCESS_OCCURRENCE_EVIDENCE_INVALID",
      reason: "identity_mismatch",
    })
  })
})
