// IMPORTANT: Set env vars BEFORE any imports from src/ directory
import path from "path"
import fs from "fs/promises"
import { afterAll } from "bun:test"
import {
  bootstrapIsolatedTestRuntime,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"

let setupPromise: Promise<void> | undefined
let testRuntimeDirectory: string | undefined
let cleanupRegistered = false
let terminalIngressRuntimeOverride: Disposable | undefined
let isolatedRuntime: Awaited<ReturnType<typeof bootstrapIsolatedTestRuntime>> | undefined

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
      const { Instance } = await import("../src/project/instance")
      const { Scheduler } = await import("../src/scheduler")
      terminalIngressRuntimeOverride?.[Symbol.dispose]()
      terminalIngressRuntimeOverride = undefined
      try {
        await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: 60_000 })
      } catch (error) {
        failures.push(error)
      }
      try {
        await Instance.disposeAll()
      } catch (error) {
        failures.push(error)
      }
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
        if (!isolatedRuntime) throw new Error("Test preload isolated runtime is missing")
        // An inherited test process cannot prove that Windows has released
        // every handle it owns until that process exits. Its outer runner is
        // the sole physical owner of ownerRoot and removes the exact subtree
        // after every child has exited; standalone test processes still own
        // and remove their root here.
        if (isolatedRuntime.ownsOwnerRoot) await removeIsolatedTestRuntime(isolatedRuntime)
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

const runtime = await bootstrapIsolatedTestRuntime("test")
isolatedRuntime = runtime
const dir = runtime.processRoot
testRuntimeDirectory = dir
const runtimeRoot = runtime.runtimeRoot
process.env["OPENCORVUS_TEST_RUNS_ROOT"] = runtime.ownerRoot

process.env["OPENCORVUS_MODELS_PATH"] = path.join(dir, "models.json")

// Set test home directory to isolate tests from user's actual home directory
// This prevents tests from picking up real user configs/skills from ~/.claude/skills
const testHome = process.env.OPENCORVUS_TEST_HOME!

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
const { TestHooks: TaskRootIngressTestHooks } = await import("../src/engine/task-root-ingress-delivery")
terminalIngressRuntimeOverride = TaskRootIngressTestHooks.replaceTerminalIngressDeliveryRuntime(`test-runtime:${process.pid}`)
  })()
  return setupPromise
}

await setupTestRuntime()
