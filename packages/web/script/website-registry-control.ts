import path from "node:path"
import { rm, stat } from "node:fs/promises"
import { WebsiteRegistry, inspectWebsiteRegistrySchema, readWebsiteRegistrySeed } from "../src/lib/website-registry"
import { importWebsiteRegistryPublication } from "../src/lib/website-registry-import"

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const command = process.argv[2]
const databasePath = option("--database")
const dataRoot = option("--data")
if (!command || !databasePath || !dataRoot) {
  throw new Error("Usage: website-registry-control.ts <import|reset-v1|health|backup|schema-state> --database <file> --data <directory> [--seed <file> --source <directory> | --target <file>]")
}

const resolvedDatabase = path.resolve(databasePath)
const resolvedData = path.resolve(dataRoot)
if (command === "schema-state") {
  console.log(JSON.stringify({ schemaVersion: 1, state: inspectWebsiteRegistrySchema(resolvedDatabase) }))
  process.exit(0)
}
if (command === "reset-v1") {
  const target = option("--target")
  const seedFile = option("--seed")
  const sourceRoot = option("--source")
  if (!target || !seedFile || !sourceRoot) throw new Error("reset-v1 requires --target, --seed, and --source")
  if (inspectWebsiteRegistrySchema(resolvedDatabase) !== "legacy") throw new Error("reset-v1 requires the exact legacy v1 fingerprint")
  const resolvedTarget = path.resolve(target)
  await stat(resolvedTarget).then(() => { throw new Error("reset-v1 target already exists") }).catch((error) => {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error
  })
  const resetRegistry = await WebsiteRegistry.open(resolvedTarget, resolvedData)
  try {
    const seed = await readWebsiteRegistrySeed(path.resolve(seedFile))
    await importWebsiteRegistryPublication(resetRegistry, seed, path.resolve(sourceRoot))
    const counters = resetRegistry.sqlite.query<{ total: number }, []>("SELECT COALESCE(SUM(response_count), 0) AS total FROM revision_download_counter").get()?.total
    const views = resetRegistry.sqlite.query<{ total: number }, []>("SELECT total_views AS total FROM site_view_summary WHERE singleton = 1").get()?.total
    if (counters !== 0 || views !== 0) throw new Error("reset-v1 did not initialize download and view counters at zero")
    await resetRegistry.readiness()
    await resetRegistry.prepareForAtomicSwap()
  } catch (error) {
    try { resetRegistry.close() } catch {}
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(resolvedTarget, { force: true })
    await rm(`${resolvedTarget}-wal`, { force: true })
    await rm(`${resolvedTarget}-shm`, { force: true })
    throw error
  }
  console.log(JSON.stringify({ schemaVersion: 1, reset: resolvedTarget }))
  process.exit(0)
}

const registry = await WebsiteRegistry.open(resolvedDatabase, resolvedData)
try {
  if (command === "import") {
    const seedFile = option("--seed")
    const sourceRoot = option("--source")
    if (!seedFile || !sourceRoot) throw new Error("import requires --seed and --source")
    const seed = await readWebsiteRegistrySeed(path.resolve(seedFile))
    const publicationID = await importWebsiteRegistryPublication(registry, seed, path.resolve(sourceRoot))
    console.log(JSON.stringify({ publicationID, publication: registry.publication() }))
  } else if (command === "health") {
    console.log(JSON.stringify(await registry.readiness()))
  } else if (command === "backup") {
    const target = option("--target")
    if (!target) throw new Error("backup requires --target")
    console.log(JSON.stringify({ backup: await registry.backup(path.resolve(target)) }))
  } else {
    throw new Error(`Unknown Website Registry command: ${command}`)
  }
} finally {
  registry.close()
}
