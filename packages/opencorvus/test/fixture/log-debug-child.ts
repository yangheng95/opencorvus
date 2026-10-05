import { bootstrapIsolatedTestRuntime, removeIsolatedTestRuntime } from "@opencorvus-ai/util/test-runtime-environment"

const runtime = await bootstrapIsolatedTestRuntime("test")
const { Log } = await import("../../src/util/log")
try {
  await Log.init({ print: true, dev: true, level: "DEBUG" })
  const logger = Log.create({ service: "log-debug-real-child" })
  logger.debug("actual debug payload", { count: 7 })
  const timer = logger.timeDebug("actual debug timer")
  timer.stop()
  await Log.flush()
  const records = (await Log.read({ lines: 20 })).lines
    .map((line) => JSON.parse(line))
    .filter((row) => row.service === "log-debug-real-child")
  await Log.close()
  console.log(JSON.stringify({ fileRecords: records }))
} finally {
  await Log.close()
  await removeIsolatedTestRuntime(runtime)
}
