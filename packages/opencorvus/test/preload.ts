// IMPORTANT: Set env vars BEFORE any imports from src/ directory
import path from "path"
import fs from "fs/promises"
import { afterAll } from "bun:test"
import {
  createManagedTemporaryDirectory,
  currentOpenCorvusRuntimePaths,
  removeManagedDirectoryTree,
  removeManagedDirectoryTreeSync,
} from "@opencorvus-ai/util/runtime-directories"

let setupPromise: Promise<void> | undefined
let testRuntimeDirectory: string | undefined
let cleanupRegistered = false
let terminalIngressRuntimeOverride: Disposable | undefined

export function registerTestRuntimeCleanup(): void {
  if (cleanupRegistered) return
  const dir = testRuntimeDirectory
  if (!dir) throw new Error("OpenCorvus test runtime cleanup requires completed setup")
  cleanupRegistered = true
  afterAll(
    async () => {
      const failures: unknown[] = []
      const { Database } = await import("../src/storage/db")
      const { Log } = await import("../src/util/log")
      terminalIngressRuntimeOverride?.[Symbol.dispose]()
      terminalIngressRuntimeOverride = undefined
      try {
        await Database.awaitEffectIdle(60_000)
      } catch (error) {
        failures.push(error)
      }
      try {
        Database.close()
      } catch (error) {
        failures.push(error)
      }
      try {
        await Log.close()
      } catch (error) {
        failures.push(error)
      }
      try {
        await removeManagedDirectoryTree(dir)
      } catch (error) {
        failures.push(error)
      }
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, "Test preload database and directory cleanup failed")
    },
    120_000,
  )
}

export function setupTestRuntime(): Promise<void> {
  setupPromise ??= (async () => {
    ;(globalThis as typeof globalThis & { __OPENCORVUS_OVERLAY_VERSION__?: string }).__OPENCORVUS_OVERLAY_VERSION__ =
      "test"

const testRunsRoot = path.join(currentOpenCorvusRuntimePaths().temporary, "tests")
const dir = await createManagedTemporaryDirectory(testRunsRoot, `${process.pid}-`)
testRuntimeDirectory = dir
const runtimeRoot = path.join(dir, "runtime-root")
const temporaryDirectory = path.join(runtimeRoot, "tmp")
await fs.mkdir(temporaryDirectory, { recursive: true })
process.env["OPENCORVUS_TEST_PROCESS_ROOT"] = dir
process.env["OPENCORVUS_TEST_RUNS_ROOT"] = testRunsRoot
process.env["TEMP"] = temporaryDirectory
process.env["TMP"] = temporaryDirectory
process.env["TMPDIR"] = temporaryDirectory

process.once("exit", () => {
  removeManagedDirectoryTreeSync(dir)
})

process.env["XDG_DATA_HOME"] = path.join(dir, "cross-desktop-group-data")
process.env["XDG_CACHE_HOME"] = path.join(dir, "cross-desktop-group-cache")
process.env["XDG_CONFIG_HOME"] = path.join(dir, "cross-desktop-group-config")
process.env["XDG_STATE_HOME"] = path.join(dir, "cross-desktop-group-state")
process.env["OPENCORVUS_HOME"] = runtimeRoot
process.env["OPENCORVUS_MODELS_PATH"] = path.join(dir, "models.json")

// Set test home directory to isolate tests from user's actual home directory
// This prevents tests from picking up real user configs/skills from ~/.claude/skills
const testHome = path.join(dir, "home")
await fs.mkdir(testHome, { recursive: true })
process.env["OPENCORVUS_TEST_HOME"] = testHome

// Set test managed config directory to isolate tests from system managed settings
const testManagedConfigDir = path.join(dir, "managed")
process.env["OPENCORVUS_TEST_MANAGED_CONFIG_DIR"] = testManagedConfigDir

// Write the cache version file to prevent global/index.ts from clearing the cache
const cacheDir = path.join(runtimeRoot, "cache")
await fs.mkdir(cacheDir, { recursive: true })
await fs.writeFile(path.join(cacheDir, "version"), "21")

// Clear provider env vars to ensure clean test state
delete process.env["ANTHROPIC_API_KEY"]
delete process.env["OPENAI_API_KEY"]
delete process.env["GOOGLE_API_KEY"]
delete process.env["GOOGLE_GENERATIVE_AI_API_KEY"]
delete process.env["AZURE_OPENAI_API_KEY"]
delete process.env["AWS_ACCESS_KEY_ID"]
delete process.env["AWS_PROFILE"]
delete process.env["AWS_REGION"]
delete process.env["AWS_BEARER_TOKEN_BEDROCK"]
delete process.env["OPENROUTER_API_KEY"]
delete process.env["GROQ_API_KEY"]
delete process.env["MISTRAL_API_KEY"]
delete process.env["PERPLEXITY_API_KEY"]
delete process.env["TOGETHER_API_KEY"]
delete process.env["XAI_API_KEY"]
delete process.env["DEEPSEEK_API_KEY"]
delete process.env["FIREWORKS_API_KEY"]
delete process.env["CEREBRAS_API_KEY"]
delete process.env["SAMBANOVA_API_KEY"]

// Now safe to import from src/
const { Log } = await import("../src/util/log")
const { ModelsDev } = await import("../src/provider/models")
const modelFixture = JSON.parse(
  await fs.readFile(path.join(import.meta.dir, "..", "src", "provider", "models-bootstrap.json"), "utf8"),
)
await fs.writeFile(process.env["OPENCORVUS_MODELS_PATH"], JSON.stringify(ModelsDev.withLocalProviders(modelFixture)))

await Log.init({
  print: false,
  dev: true,
  level: "DEBUG",
})

const { installDefaultControlPlaneToolLoaders } = await import("../src/tool/control-plane-tool-composition")
installDefaultControlPlaneToolLoaders()
const { installDefaultTaskWakeRuntime } = await import("../src/scheduler/task-wake-composition")
installDefaultTaskWakeRuntime()
const { TestHooks: QueueTestHooks } = await import("../src/engine/queue")
terminalIngressRuntimeOverride = QueueTestHooks.replaceTerminalIngressDeliveryRuntime(`test-runtime:${process.pid}`)
  })()
  return setupPromise
}
