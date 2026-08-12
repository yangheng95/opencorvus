import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { isolatedTestChildEnvironment } from "@opencorvus-ai/util/test-runtime-environment"
import { Global } from "../src/global"
import { Database } from "../src/storage/db"
import { Log } from "../src/util/log"

function requireAbsoluteEnvironmentPath(name: string): string {
  const value = process.env[name]
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`)
  return path.resolve(value)
}

test("owns the package runner supervisor request under its isolated runtime", async () => {
  const runnerRoot = requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_RUNNER_ROOT")
  const ownerRoot = requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_OWNER_ROOT")
  const osTemporaryRoot = requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_OS_TEMP_ROOT")
  const runnerPID = Number(process.env.OPENCORVUS_TEST_RUNNER_PID)
  const runnerRuntimeRoot = path.join(runnerRoot, "runtime-root")
  const runnerTemporaryRoot = path.join(runnerRuntimeRoot, "tmp")

  expect(Number.isSafeInteger(runnerPID) && runnerPID > 0).toBe(true)
  const ownerRelative = path.relative(osTemporaryRoot, ownerRoot)
  const runnerRelative = path.relative(ownerRoot, runnerRoot)
  expect(ownerRelative.length > 0 && !ownerRelative.startsWith("..") && !path.isAbsolute(ownerRelative)).toBe(true)
  expect(runnerRelative.length > 0 && !runnerRelative.startsWith("..") && !path.isAbsolute(runnerRelative)).toBe(true)
  expect(path.relative(runnerRoot, runnerRuntimeRoot)).toBe("runtime-root")
  expect(requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT")).not.toBe(runnerRoot)
  expect(requireAbsoluteEnvironmentPath("HOME")).toBe(requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_HOME"))
  expect(requireAbsoluteEnvironmentPath("USERPROFILE")).toBe(requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_HOME"))
  for (const name of ["TEMP", "TMP", "TMPDIR", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "CARGO_HOME", "RUSTUP_HOME", "OPENCORVUS_TEST_MANAGED_CONFIG_DIR"]) {
    const relative = path.relative(requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT"), requireAbsoluteEnvironmentPath(name))
    expect(relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)).toBe(true)
  }
  if (process.platform === "win32") {
    for (const name of ["APPDATA", "LOCALAPPDATA"]) {
      const relative = path.relative(requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT"), requireAbsoluteEnvironmentPath(name))
      expect(relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)).toBe(true)
    }
  }
  for (const name of [
    "OPENCORVUS_CONFIG",
    "OPENCORVUS_CONFIG_DIR",
    "OPENCORVUS_CONFIG_CONTENT",
    "OPENCORVUS_PACKAGED_PLUGIN_DIR",
    "OPENCORVUS_AGENT_TRACE_DIR",
    "OPENCORVUS_PROCESS_OCCURRENCE_ID",
    "OPENCORVUS_PROCESS_OCCURRENCE_PATH",
    "OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH",
    "OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH",
    "OPENCORVUS_SHARED_SESSION_FILE",
    "OPENCORVUS_PROJECT_DIR",
    "OPENCORVUS_ORIGINAL_CWD",
    "OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR",
    "OPENCORVUS_TASK_PROCESS_MODE",
    "OPENCORVUS_SHARED_SESSION_MODE",
    "OPENCORVUS_RESTART_HANDOFF",
  ]) {
    expect(process.env[name]).toBeUndefined()
  }
  const modelsRelative = path.relative(
    requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT"),
    requireAbsoluteEnvironmentPath("OPENCORVUS_MODELS_PATH"),
  )
  expect(modelsRelative.length > 0 && !modelsRelative.startsWith("..") && !path.isAbsolute(modelsRelative)).toBe(true)
  const processRoot = requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT")
  for (const actualPath of [
    Global.Path.root,
    Global.Path.data,
    Global.Path.config,
    Global.Path.cache,
    Global.Path.log,
    Global.Path.temporary,
    Database.Path(),
    Log.directory(),
    Log.file(),
  ]) {
    const relative = path.relative(processRoot, path.resolve(actualPath))
    expect(relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)).toBe(true)
  }
  const sanitized = isolatedTestChildEnvironment(
    {
      ownerRoot,
      processRoot: requireAbsoluteEnvironmentPath("OPENCORVUS_TEST_PROCESS_ROOT"),
      runtimeRoot: requireAbsoluteEnvironmentPath("OPENCORVUS_HOME"),
      temporaryRoot: requireAbsoluteEnvironmentPath("TEMP"),
      ownsOwnerRoot: false,
    },
    {
      ...process.env,
      OPENCORVUS_CONFIG: path.join(ownerRoot, "host-config.json"),
      OPENCORVUS_CONFIG_DIR: path.join(ownerRoot, "host-config"),
      OPENCORVUS_CONFIG_CONTENT: '{"plugin":["host-plugin"]}',
      OPENCORVUS_MODELS_PATH: path.join(ownerRoot, "host-models.json"),
      OPENCORVUS_PACKAGED_PLUGIN_DIR: path.join(ownerRoot, "host-plugins"),
      OPENCORVUS_AGENT_TRACE_DIR: path.join(ownerRoot, "host-traces"),
      OPENCORVUS_PROCESS_OCCURRENCE_ID: "host-occurrence-id",
      OPENCORVUS_PROCESS_OCCURRENCE_PATH: path.join(ownerRoot, "host-occurrence.json"),
      OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH: path.join(ownerRoot, "host-predecessor.json"),
      OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH: path.join(ownerRoot, "host-shutdown.json"),
      OPENCORVUS_SHARED_SESSION_FILE: path.join(ownerRoot, "host-shared-session.json"),
      OPENCORVUS_PROJECT_DIR: path.join(ownerRoot, "host-project"),
      OPENCORVUS_ORIGINAL_CWD: path.join(ownerRoot, "host-cwd"),
      OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR: path.join(ownerRoot, "host-capsule.json"),
      OPENCORVUS_TASK_PROCESS_MODE: "1",
      OPENCORVUS_SHARED_SESSION_MODE: "1",
      OPENCORVUS_RESTART_HANDOFF: "1",
    },
  )
  expect(
    [
      sanitized.OPENCORVUS_CONFIG,
      sanitized.OPENCORVUS_CONFIG_DIR,
      sanitized.OPENCORVUS_CONFIG_CONTENT,
      sanitized.OPENCORVUS_MODELS_PATH,
      sanitized.OPENCORVUS_PACKAGED_PLUGIN_DIR,
      sanitized.OPENCORVUS_AGENT_TRACE_DIR,
      sanitized.OPENCORVUS_PROCESS_OCCURRENCE_ID,
      sanitized.OPENCORVUS_PROCESS_OCCURRENCE_PATH,
      sanitized.OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH,
      sanitized.OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH,
      sanitized.OPENCORVUS_SHARED_SESSION_FILE,
      sanitized.OPENCORVUS_PROJECT_DIR,
      sanitized.OPENCORVUS_ORIGINAL_CWD,
      sanitized.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR,
      sanitized.OPENCORVUS_TASK_PROCESS_MODE,
      sanitized.OPENCORVUS_SHARED_SESSION_MODE,
      sanitized.OPENCORVUS_RESTART_HANDOFF,
    ],
  ).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])

  if (process.platform !== "win32") return

  const entries = await fs.readdir(runnerTemporaryRoot, { withFileTypes: true })
  const requestDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("supervisor-"))
    .map((entry) => path.join(runnerTemporaryRoot, entry.name))
  expect(requestDirectories).toHaveLength(1)

  const requestDirectory = requestDirectories[0]!
  const request = JSON.parse(await fs.readFile(path.join(requestDirectory, "request.json"), "utf8")) as Record<
    string,
    unknown
  >
  expect(request).toMatchObject({
    kind: "command",
    owner_pid: runnerPID,
    cwd: path.resolve(import.meta.dir, ".."),
    ready_file: path.join(requestDirectory, "ready.json"),
    launch_failed_file: path.join(requestDirectory, "launch-failed.json"),
    cancel_file: path.join(requestDirectory, "cancel"),
    settled_file: path.join(requestDirectory, "settled.json"),
  })
  expect(request.args).toEqual(["test", "--timeout=0", "--parallel=1", "test/isolated-test-entry.test.ts"])
  expect(typeof request.runtime_occurrence_id).toBe("string")
  expect(typeof request.owner_process_instance_id).toBe("string")
})
