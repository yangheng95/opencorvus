import { bootstrap } from "../../src/cli/bootstrap"
import { Database } from "../../src/storage/db"
import { RuntimeServerOwnershipConflictError } from "../../src/server/runtime-server-ownership"
import { Server } from "../../src/server/server"

const mode = process.argv[2]
const project = process.argv[3]
if (!project || (mode !== "server-hold" && mode !== "bootstrap-once")) {
  throw new Error("Usage: runtime-entry-ownership-process.ts <server-hold|bootstrap-once> <project>")
}

try {
  if (mode === "server-hold") {
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    process.stdout.write(`${JSON.stringify({ status: "server-owned", database: Database.Path() })}\n`)
    process.stdin.resume()
    await new Promise<void>((resolve) => process.stdin.once("end", resolve))
    await server.stop(true)
  } else {
    await bootstrap(project, async () => {
      process.stdout.write(`${JSON.stringify({ status: "bootstrap-owned", database: Database.Path() })}\n`)
    })
  }
} catch (error) {
  if (!(error instanceof RuntimeServerOwnershipConflictError)) throw error
  process.stdout.write(
    `${JSON.stringify({ status: "conflict", database: error.database, existing: error.existing })}\n`,
  )
}
