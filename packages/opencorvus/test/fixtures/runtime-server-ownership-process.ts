import { RuntimeServerOwnership, RuntimeServerOwnershipConflictError } from "../../src/server/runtime-server-ownership"
import fs from "node:fs"
import path from "node:path"

const database = process.argv[2]
const mode = process.argv[3]
if (!database || (mode !== "hold" && mode !== "stale-hold" && mode !== "once")) {
  throw new Error("Usage: runtime-server-ownership-process.ts <database> <hold|stale-hold|once>")
}

try {
  const ownership = RuntimeServerOwnership.acquire({ database })
  if (mode === "stale-hold") {
    const lockDirectory = fs
      .readdirSync(path.dirname(database), { withFileTypes: true })
      .find(
        (entry) =>
          entry.isDirectory() && entry.name.startsWith(".opencorvus-runtime-") && entry.name.endsWith(".owner.lock"),
      )
    if (!lockDirectory) throw new Error("Runtime ownership fixture did not find the proper-lockfile directory")
    const stale = new Date(Date.now() - 20_000)
    fs.utimesSync(path.join(path.dirname(database), lockDirectory.name), stale, stale)
  }
  process.stdout.write(`${JSON.stringify({ status: "acquired", owner: ownership.owner })}\n`)
  if (mode === "hold" || mode === "stale-hold") {
    process.stdin.resume()
    await new Promise<void>((resolve) => process.stdin.once("end", resolve))
  }
  ownership.release()
} catch (error) {
  if (!(error instanceof RuntimeServerOwnershipConflictError)) throw error
  process.stdout.write(`${JSON.stringify({ status: "conflict", existing: error.existing })}\n`)
}
