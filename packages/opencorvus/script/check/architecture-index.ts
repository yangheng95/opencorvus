#!/usr/bin/env bun
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

/**
 * The current-architecture authority graph must be reachable and live.
 *
 * `docs:check` validates the GENERATED API markdown; nothing validated the
 * hand-written architecture authority, so the index silently omitted current
 * fact sources and documents kept links to files that had been deleted. Both
 * make an authority unreachable, which is the same defect from either side.
 */
const architectureRoot = path.resolve(import.meta.dir, "..", "..", "..", "..", "specs", "current", "architecture")
const indexFile = path.join(architectureRoot, "README.md")

const LINK = /\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g

async function main() {
  const entries = await readdir(architectureRoot)
  const documents = entries.filter((entry) => entry.endsWith(".md") && entry !== "README.md").sort()
  const index = await readFile(indexFile, "utf8")

  const failures: string[] = []

  const unlisted = documents.filter((document) => !index.includes(`(${document})`))
  for (const document of unlisted) {
    failures.push(`current architecture document is not reachable from the index: ${document}`)
  }

  for (const document of ["README.md", ...documents]) {
    const body = await readFile(path.join(architectureRoot, document), "utf8")
    for (const match of body.matchAll(LINK)) {
      const target = match[1]!
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      const resolved = path.resolve(architectureRoot, target)
      const live = await stat(resolved).then(
        (value) => value.isFile(),
        () => false,
      )
      if (!live) failures.push(`${document} links a document that is not live: ${target}`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`architecture-index: ${failure}`)
    console.error(`architecture-index FAILED (${failures.length} problem${failures.length === 1 ? "" : "s"})`)
    process.exit(1)
  }
  console.log(`architecture-index ok — ${documents.length} current documents indexed, every link live`)
}

await main()
