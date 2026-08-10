import path from "node:path"
import { pathToFileURL } from "node:url"

const { registerTestRuntimeCleanup, setupTestRuntime } = await import("./preload")
await setupTestRuntime()
if (!process.env.OPENCORVUS_TEST_PROCESS_ROOT) throw new Error("OpenCorvus isolated test preload did not initialize")

const encoded = process.env.OPENCORVUS_TEST_FILES
if (!encoded) throw new Error("OPENCORVUS_TEST_FILES is required")

const files = JSON.parse(encoded) as unknown
if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string")) {
  throw new Error("OPENCORVUS_TEST_FILES must contain one or more test paths")
}

for (const file of files) {
  await import(pathToFileURL(path.resolve(file)).href)
}

registerTestRuntimeCleanup()
