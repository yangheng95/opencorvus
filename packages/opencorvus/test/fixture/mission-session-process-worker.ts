import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"

const [mode, projectDirectory, barrierDirectory] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) throw new Error("Mission process worker requires mode, project, and barrier")

declareNativeTaskProcessDeployment()
const missionID = mode === "race" ? "cross-process-race" : "cross-process-cut"
const input = {
  missionID,
  defaultCwd: projectDirectory,
  productPillar: "code" as const,
  heldExpertSquadIDs: ["base"] as [string, ...string[]],
}

async function result() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      using _publicationCut = Bus.TestHooks.suppressAutomaticDurableDrain()
      if (mode === "init") {
        Database.Client()
        return { initialized: true }
      }
      if (mode === "race") {
        const ready = path.join(barrierDirectory, `${process.pid}.ready`)
        await fs.writeFile(ready, "ready")
        while (!(await fs.stat(path.join(barrierDirectory, "go")).catch(() => undefined))) {
          await Bun.sleep(5)
        }
        const session = await ensureMissionSession(input)
        return { id: session.id }
      }
      if (mode === "cut") {
        const missionRoot = ProjectRuntimePaths.missionRoot(projectDirectory, missionID)
        await fs.mkdir(path.dirname(missionRoot), { recursive: true })
        await fs.writeFile(missionRoot, "block runtime directory")
        try {
          await ensureMissionSession(input)
          throw new Error("Expected the post-commit runtime boundary to fail")
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        }
        const row = Database.use((db) =>
          db.select().from(SessionTable).where(eq(SessionTable.kind, "mission")).get(),
        )
        const created = Database.use((db) =>
          db
            .select()
            .from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.event_type, Session.Event.Created.type))
            .get(),
        )
        if (!row || !created) throw new Error("Mission identity commit was not durable before the cut")
        await fs.writeFile(
          path.join(barrierDirectory, "cut.json"),
          JSON.stringify({ id: row.id, metadata: row.metadata, created: created.properties }),
        )
        process.exit(86)
      }
      if (mode === "recover") {
        const missionRoot = ProjectRuntimePaths.missionRoot(projectDirectory, missionID)
        await fs.rm(missionRoot)
        const session = await ensureMissionSession(input)
        const rows = Database.use((db) =>
          db.select({ id: SessionTable.id }).from(SessionTable).where(eq(SessionTable.kind, "mission")).all(),
        )
        return { id: session.id, rows, runtimeDirectory: (await fs.stat(missionRoot)).isDirectory() }
      }
      throw new Error(`Unknown Mission process worker mode: ${mode}`)
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
