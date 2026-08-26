import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Session } from "@/session"
import { Database } from "@/storage/db"

const [mode, projectDirectory, barrierDirectory, sessionID, requestedCreated] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) {
  throw new Error("Message frontier worker requires mode, project, and barrier")
}

declareNativeTaskProcessDeployment()

async function result() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      using _publicationCut = Bus.TestHooks.suppressAutomaticDurableDrain()
      if (mode === "init") {
        const session = await Session.create({ kind: "root", title: "Cross-process Message frontier" })
        return { sessionID: session.id }
      }
      if (mode === "race") {
        if (!sessionID || !requestedCreated) throw new Error("Message frontier race requires Session and time")
        await fs.writeFile(path.join(barrierDirectory, `${process.pid}.ready`), "ready")
        while (!(await fs.stat(path.join(barrierDirectory, "go")).catch(() => undefined))) {
          await Bun.sleep(5)
        }
        const messageID = Identifier.ascending("message")
        const partID = Identifier.ascending("part")
        const completion = Session.persistMessageWithCommitInTransaction(
          {
            info: {
              id: messageID,
              sessionID,
              role: "user",
              author: "user",
              agent: "chat",
              model: { providerID: "test", modelID: "cross-process-frontier" },
              time: { created: Number(requestedCreated) },
            },
            parts: [
              {
                id: partID,
                messageID,
                sessionID,
                type: "text",
                text: "Composite owner Message",
              },
            ],
          },
          () => undefined,
        )
        const message = await completion.complete()
        return { id: message.info.id, created: message.info.time.created }
      }
      throw new Error(`Unknown Message frontier worker mode: ${mode}`)
    },
  })
}

try {
  const output = await result()
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState()
  console.log(JSON.stringify(output))
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
