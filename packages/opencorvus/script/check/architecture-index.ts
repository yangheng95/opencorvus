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
const specsRoot = path.resolve(import.meta.dir, "..", "..", "..", "..", "specs")
const architectureRoot = path.join(specsRoot, "current", "architecture")
const indexFile = path.join(architectureRoot, "README.md")

const LINK = /\[[^\]]*\]\(([^)\s]+?)(?:#[^)]*)?\)/g

/** Markdown outside fenced code blocks: a link in an example is not a link. */
function withoutFences(body: string): string {
  const lines = body.split("\n")
  const kept: string[] = []
  let fenced = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    kept.push(fenced ? "" : line)
  }
  return kept.join("\n")
}

function linkTargets(body: string): string[] {
  return [...withoutFences(body).matchAll(LINK)].map((match) => match[1]!)
}

async function markdownFilesUnder(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await markdownFilesUnder(root, child)))
      continue
    }
    if (entry.name.endsWith(".md")) files.push(child)
  }
  return files.sort()
}

async function isLiveFile(target: string): Promise<boolean> {
  return stat(target).then(
    (value) => value.isFile(),
    () => false,
  )
}

async function main() {
  const documents = (await markdownFilesUnder(architectureRoot)).filter((entry) => entry !== "README.md")
  const index = await readFile(indexFile, "utf8")
  // Reachability is a real markdown link whose target is the document, not the
  // document's name appearing somewhere in the file.
  const indexed = new Set(
    linkTargets(index).map((target) => path.posix.normalize(target.replace(/^\.\//, ""))),
  )

  const failures: string[] = []
  for (const document of documents) {
    if (!indexed.has(document)) {
      failures.push(`current architecture document is not reachable from the index: ${document}`)
    }
  }

  // Links out of the index, out of every current document, and out of the
  // specs index that points into this directory, must all resolve to a live file.
  const sources: Array<{ label: string; file: string; root: string }> = [
    { label: "README.md", file: indexFile, root: architectureRoot },
    ...documents.map((document) => ({
      label: document,
      file: path.join(architectureRoot, document),
      root: path.dirname(path.join(architectureRoot, document)),
    })),
    { label: "specs/README.md", file: path.join(specsRoot, "README.md"), root: specsRoot },
  ]
  for (const source of sources) {
    const body = await readFile(source.file, "utf8").catch(() => undefined)
    if (body === undefined) continue
    for (const target of linkTargets(body)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      if (!target.endsWith(".md")) continue
      if (!(await isLiveFile(path.resolve(source.root, target)))) {
        failures.push(`${source.label} links a document that is not live: ${target}`)
      }
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
