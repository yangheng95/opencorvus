import { Database as BunDatabase } from "bun:sqlite"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime } from "../../src/cli/server-runtime"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"
import { ManagedServerLifecycle } from "../../src/server/managed-server-lifecycle"
import { observedProcessOccurrence } from "../../src/runtime/process-occurrence"
import { Project } from "../../src/project/project"
import { ProjectTable } from "../../src/project/project.sql"
import {
  closeProjectDeletionRegistryAdmission,
  type ProjectDeletionRegistryAdmission,
} from "../../src/project/deletion-registry"

const parent = observedProcessOccurrence(process.ppid)
if (!parent) throw new Error(`Cannot establish test-runner process occurrence for PID ${process.ppid}`)
const managedLifecycle = ManagedServerLifecycle.start({ parent, onParentExit: () => process.exit(1) })
const runtime = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
  options: { hostname: "127.0.0.1", port: 0, randomPort: true },
  recover: async () => {},
  disposeInstances: () => Instance.disposeAll(),
}))
const sqlite = new BunDatabase(Database.Path(), { readonly: true })
const schema = sqlite
  .query("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'")
  .get() as { count: number }
sqlite.close(true)

process.stdout.write(
  `${JSON.stringify({
    status: "ready",
    url: runtime.server.url.toString(),
    port: runtime.server.port,
    database: Database.Path(),
    schemaTables: schema.count,
    occurrenceID: runtime.occurrence.occurrenceID,
  })}\n`,
)
let deletionAdmission: ProjectDeletionRegistryAdmission | undefined
const lines = createInterface({ input: process.stdin })
for await (const line of lines) {
  const request = JSON.parse(line) as { id: string; command: string; projectID?: string; directory?: string }
  try {
    if (request.command === "exit-without-release") {
      process.exit(0)
    } else if (request.command === "seed-project") {
      Database.use((db) =>
        db.insert(ProjectTable)
          .values({
            id: request.projectID!,
            worktree: request.directory!,
            sandboxes: [],
            generation: randomUUID(),
            time_created: Date.now(),
            time_updated: Date.now(),
          })
          .run(),
      )
    } else if (request.command === "close-project-admission") {
      deletionAdmission = closeProjectDeletionRegistryAdmission(request.projectID!)
    } else if (request.command === "assert-project-admission") {
      Database.immediateTransaction((db) => Project.assertDurableAdmissionOpen(db, request.projectID!))
    } else if (request.command === "release-project-admission") {
      deletionAdmission?.[Symbol.dispose]()
      deletionAdmission = undefined
    } else {
      throw new Error(`Unknown fixture command: ${request.command}`)
    }
    process.stdout.write(`${JSON.stringify({ status: "response", id: request.id, ok: true })}\n`)
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        status: "response",
        id: request.id,
        ok: false,
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    )
  }
}
deletionAdmission?.[Symbol.dispose]()
await runtime.server.stop(true)
managedLifecycle.release()
