import fs from "node:fs/promises"
import path from "node:path"
import { ChannelIngress } from "../../src/channel/ingress"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"

const [directory, root] = process.argv.slice(2)
const input = {
  platform: "slack" as const,
  channel: "stale-context",
  thread: "stale-context",
  text: "status",
  request_id: "old-context-source",
  allow_create: false,
}
await Instance.provide({
  directory: directory!,
  fn: async () => {
    const projectID = Instance.project.id,
      generation = Instance.projectGeneration
    await ChannelIngress.message(input)
    await fs.writeFile(path.join(root!, "ready.json"), JSON.stringify({ projectID, generation }))
    const deadline = Date.now() + 30_000
    while (
      !(await fs.stat(path.join(root!, "release")).then(
        () => true,
        () => false,
      ))
    ) {
      if (Date.now() > deadline) throw new Error("Actual Project recreation barrier timed out")
      await Bun.sleep(10)
    }
    async function call(requestID: string) {
      try {
        return { status: "success", result: await ChannelIngress.message({ ...input, request_id: requestID }) }
      } catch (error: any) {
        return { status: "error", error: error.toObject?.() ?? { name: error.name, message: String(error) } }
      }
    }
    console.log(
      JSON.stringify({
        projectID,
        generation,
        replay: await call("new-context-source"),
        fresh: await call("stale-context-new-source"),
        accepted: Database.allFinalized(
          "SELECT request_id,project_generation FROM channel_ingress_accepted ORDER BY request_id",
        ),
      }),
    )
  },
})
await Instance.disposeAll()
await Database.awaitEffectIdle(60_000)
Database.close()
