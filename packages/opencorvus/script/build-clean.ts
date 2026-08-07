import fs from "fs"
import path from "path"

const PRESERVED_DIST_ENTRIES = new Set(["binary"])

export async function cleanBuildDist(distDir: string): Promise<void> {
  await fs.promises.mkdir(distDir, { recursive: true })
  const entries = await fs.promises.readdir(distDir, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => !PRESERVED_DIST_ENTRIES.has(entry.name))
      .map((entry) => fs.promises.rm(path.join(distDir, entry.name), { recursive: true, force: true })),
  )
}
