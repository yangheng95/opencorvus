import fs from "node:fs/promises"
import path from "node:path"

async function textFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile()) files.push(target)
    }
  }
  await visit(root)
  return files
}

export async function materializeMirrorPrismPackage(destination: string): Promise<string> {
  const source = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/deep-research")
  await fs.cp(source, destination, { recursive: true, errorOnExist: true })
  for (const file of await textFiles(destination)) {
    const original = await fs.readFile(file, "utf8")
    let updated = original
      .replaceAll("deep-research", "prism")
      .replaceAll('"base_role": "prism"', '"base_role": "deep-research"')
      .replaceAll("Deep Research", "Prism")
    if (path.basename(file) === "expert-squad.jsonc") {
      updated = updated
        .replace('"namespace": "builtin"', '"namespace": "mirror"')
        .replace('"version": "2026.08.05.1"', '"version": "2026.08.07.1"')
        .replace('"product_pillars": ["work"]', '"product_pillars": ["code"]')
    }
    if (updated !== original) await fs.writeFile(file, updated, "utf8")
  }
  const agents = path.join(destination, "agents")
  for (const entry of await fs.readdir(agents, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.includes("deep-research")) continue
    await fs.rename(path.join(agents, entry.name), path.join(agents, entry.name.replaceAll("deep-research", "prism")))
  }
  return destination
}
