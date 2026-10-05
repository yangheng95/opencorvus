import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { Bus } from "@/bus"
import { File } from "@/file"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { FileRoutes } from "@/server/routes/file"
import { serverErrorResponse } from "@/server/error-handler"
import { Database } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"

const [directory, readyPath, rewritePath] = process.argv.slice(2)
if (!directory || !readyPath) throw new Error("File save peer requires project directory and readiness path")
declareNativeTaskProcessDeployment()
let unsubscribe: (() => void) | undefined
await Instance.provide({
  directory,
  fn: async () => {
    if (rewritePath)
      unsubscribe = Bus.subscribe(File.Event.Edited, async (event) => {
        if (event.properties.file !== rewritePath) return
        await fs.writeFile(path.join(directory, rewritePath), "external-after-save\n")
      })
  },
})
const app = new Hono().onError(serverErrorResponse).route("/", FileRoutes())
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => Instance.provide({ directory, fn: async () => app.fetch(request) }),
})
try {
  await Filesystem.writeAtomic(
    readyPath,
    JSON.stringify({
      url: server.url.toString(),
      pid: process.pid,
      stdinState: process.stdin.readableEnded ? "ended" : "open",
    }),
  )
  await new Promise<void>((resolve) => {
    process.stdin.once("end", resolve)
    process.stdin.resume()
  })
} finally {
  unsubscribe?.()
  await server.stop(true)
  await Instance.disposeAll()
  Database.close()
}
