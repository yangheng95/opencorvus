import path from "node:path"
import { fileURLToPath } from "node:url"
import { rm } from "node:fs/promises"
import { WebsiteRegistry, readWebsiteRegistrySeed } from "../src/lib/website-registry"
import { importWebsiteRegistryPublication } from "../src/lib/website-registry-import"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const generatedRoot = path.join(webRoot, ".generated")
const seedFile = path.join(generatedRoot, "website-registry-seed.json")
const databasePath = path.join(generatedRoot, "website-registry-publication.sqlite3")
const dataRoot = path.join(generatedRoot, "website-registry-data")

await Promise.all([databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map((file) => rm(file, { force: true })))

const registry = await WebsiteRegistry.open(databasePath, dataRoot)
try {
  const seed = await readWebsiteRegistrySeed(seedFile)
  const publicationID = await importWebsiteRegistryPublication(registry, seed, generatedRoot)
  const ready = await registry.readiness()
  console.log(JSON.stringify({ publicationID, databasePath, dataRoot, ready }))
} finally {
  registry.close()
}
