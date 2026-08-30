import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

const [barrierRoot, workerID] = process.argv.slice(2)
if (!barrierRoot || !workerID) throw new Error("snapshot publication worker requires barrier root and worker ID")

const base = payloadPackageSources[0]!
const source = {
  ...base,
  files: {
    ...base.files,
    "README.md": `${base.files["README.md"]}\nCross-process snapshot publication contract.\n`,
  },
}

await fs.writeFile(path.join(barrierRoot, `ready-${workerID}`), workerID, { flag: "wx" })
const release = path.join(barrierRoot, "release")
while (true) {
  try {
    await fs.access(release)
    break
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    await Bun.sleep(10)
  }
}

const snapshot = await ExpertSquadRegistry.materializeEmbeddedPackageSnapshot(source)
console.log(JSON.stringify(snapshot))
