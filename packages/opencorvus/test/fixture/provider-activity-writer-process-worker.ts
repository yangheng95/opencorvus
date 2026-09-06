import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { Database } from "@/storage/db"

const [projectDirectory, barrierDirectory, sessionID, assistantMessageID, activityID] = process.argv.slice(2)
if (!projectDirectory || !barrierDirectory || !sessionID || !assistantMessageID || !activityID) {
  throw new Error("Provider activity writer worker requires project, barrier, Session, Message and activity IDs")
}

async function run() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      await Session.get(sessionID)
      await fs.writeFile(path.join(barrierDirectory, "ready"), "ready")
      while (!(await fs.stat(path.join(barrierDirectory, "start")).catch(() => undefined))) {
        await Bun.sleep(10)
      }
      await fs.writeFile(path.join(barrierDirectory, "attempting"), "attempting")
      const now = Date.now()
      recordProviderActivityEvent(assistantMessageID, {
        type: "started",
        id: activityID,
        ts: now,
        sessionID,
        provider: "provider-activity-cross-process",
        model: "writer-reservation",
      })
      recordProviderActivityEvent(assistantMessageID, {
        type: "terminal",
        id: activityID,
        ts: now + 1,
        outcome: "done",
      })
      return { activityID }
    },
  })
}

try {
  const result = await run()
  await Instance.disposeAll()
  Database.close()
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exit(1)
}
