import path from "node:path"
import { WebsiteRegistry, readWebsiteRegistrySeed } from "../src/lib/website-registry"
import { importWebsiteRegistryPublication } from "../src/lib/website-registry-import"

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const command = process.argv[2]
const databasePath = option("--database")
const dataRoot = option("--data")
if (!command || !databasePath || !dataRoot) {
  throw new Error("Usage: website-registry-control.ts <import|health|backup> --database <file> --data <directory> [--seed <file> --source <directory> | --target <file>]")
}

const registry = await WebsiteRegistry.open(path.resolve(databasePath), path.resolve(dataRoot))
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
