import { cp, copyFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { discoverLandingBinaryDownloads } from "../src/lib/landing-download"
import { distributionOutputRoot } from "./generate-expert-squad-distribution"

const repoRoot = path.resolve(process.cwd(), "../..")
const downloads = discoverLandingBinaryDownloads(repoRoot)

for (const download of downloads) {
  await mkdir(download.destinationDirectory, { recursive: true })
  await copyFile(
    path.join(download.sourceDirectory, download.sourceFileName),
    path.join(download.destinationDirectory, download.downloadFileName),
  )
}

console.log(`Copied ${downloads.length} canonical landing installer${downloads.length === 1 ? "" : "s"}`)

const distributionDestination = path.resolve(import.meta.dir, "../dist/client/expert-squads")
await mkdir(path.dirname(distributionDestination), { recursive: true })
await cp(distributionOutputRoot, distributionDestination, { recursive: true, force: true })
console.log("Copied the canonical Expert Squad static distribution")
