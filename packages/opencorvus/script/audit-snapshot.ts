import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

type AuditKind = "provider" | "streams"

/** Test evidence publication. Readers never hold a file that the writer replaces. */
export function createAuditSnapshotPublisher(root: string, kind: AuditKind) {
  fs.mkdirSync(root, { recursive: true })
  const publisher = `${process.pid}-${randomUUID()}`
  let revision = 0
  return (value: unknown): string => {
    const file = path.join(root, `${kind}-${publisher}-${++revision}.json`)
    const temporary = `${file}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(value), { flag: "wx" })
    fs.renameSync(temporary, file)
    return file
  }
}

export async function latestAuditSnapshotFiles(root: string, kind: AuditKind): Promise<string[]> {
  const names = await fs.promises.readdir(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return []
    throw error
  })
  const pattern = new RegExp(`^${kind}-(\\d+-[a-f0-9-]{36})-(\\d+)\\.json$`)
  const latest = new Map<string, { revision: number; name: string }>()
  for (const name of names) {
    const match = pattern.exec(name)
    if (!match) continue
    const publisher = match[1]!
    const revision = Number(match[2])
    if (!Number.isSafeInteger(revision) || revision <= 0) throw new Error(`Invalid audit revision: ${name}`)
    if (revision > (latest.get(publisher)?.revision ?? 0)) latest.set(publisher, { revision, name })
  }
  return [...latest.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([, snapshot]) => path.join(root, snapshot.name))
}
