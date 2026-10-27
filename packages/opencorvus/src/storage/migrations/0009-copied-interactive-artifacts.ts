import type { Database as SQLite } from "bun:sqlite"
import { prepareInteractiveArtifactCopies } from "@/interactive-artifact/copy"
import { CompactionCoverage } from "@/session/compaction-coverage"
import type { Message } from "@/session/message"
import { SchemaMigrationError } from "../schema-migration"

type Reference = {
  part_id: string; message_id: string; artifact_id: string
  payload: string; time_created: number; time_updated: number
}
type Snapshot = {
  part: Message.Part
  owner: Pick<Message.Info, "role" | "author">
}

/** Preserve existing fork history by giving each copied display its own payload. */
export function preserveCopiedInteractiveArtifacts(sqlite: SQLite): void {
  const references = sqlite.query<Reference, []>(`
    SELECT p.id part_id,p.message_id,a.id artifact_id,a.payload,a.time_created,a.time_updated
    FROM part p JOIN message target ON target.id=p.message_id
    JOIN session target_session ON target_session.id=target.session_id
    JOIN interactive_artifact a ON a.id=json_extract(p.data,'$.artifactID')
    JOIN message original ON original.id=a.message_id
    JOIN session original_session ON original_session.id=original.session_id
    WHERE json_extract(p.data,'$.type')='interactive-artifact'
      AND original.session_id<>target.session_id
      AND original_session.project_id=target_session.project_id
    ORDER BY p.message_id,p.id
  `)
  let rows: Reference[]
  try { rows = references.all() } finally { references.finalize() }
  if (!rows.length) return

  const select = sqlite.query<{
    id: string; message_id: string; session_id: string; data: string; owner: string
  }, []>(`
    SELECT p.id,p.message_id,m.session_id,p.data,m.data owner FROM part p
    JOIN message m ON m.id=p.message_id
    WHERE json_extract(p.data,'$.type') IN ('interactive-artifact','compaction')
  `)
  const snapshots = new Map<string, Snapshot>()
  try {
    for (const row of select.all()) snapshots.set(row.id, {
      part: { ...JSON.parse(row.data), id: row.id, messageID: row.message_id, sessionID: row.session_id },
      owner: JSON.parse(row.owner),
    })
  } finally { select.finalize() }
  const repaired = new Map<string, Message.Part>()
  const insert = sqlite.query(`INSERT INTO interactive_artifact
    (id,message_id,payload,time_created,time_updated) VALUES(?,?,?,?,?)`)
  try {
    const groups = Map.groupBy(rows, row => row.message_id)
    for (const [messageID, references] of groups) {
      const copies = prepareInteractiveArtifactCopies(references.map(row => row.artifact_id))
      for (const [originalID, id] of copies) {
        const source = references.find(row => row.artifact_id === originalID)!
        insert.run(id, messageID, source.payload, source.time_created, source.time_updated)
      }
      for (const reference of references) repaired.set(reference.part_id, {
        ...snapshots.get(reference.part_id)!.part, artifactID: copies.get(reference.artifact_id)!,
      } as Message.InteractiveArtifactPart)
    }
  } finally { insert.finalize() }

  // Coverage binds real immutable Part contents. Rebind only exact old snapshots,
  // then process dependent checkpoints after their covered Parts have settled.
  const dependents = new Map<string, Set<string>>()
  const dependencies = new Map<string, Set<string>>()
  for (const [id, snapshot] of snapshots) {
    if (snapshot.part.type !== "compaction") continue
    const inputs = new Set<string>()
    for (const entry of snapshot.part.covered_parts ?? []) for (const bound of entry.parts) {
      const target = snapshots.get(bound.partID)
      if (!target || target.part.messageID !== entry.messageID ||
        target.part.sessionID !== snapshot.part.sessionID ||
        CompactionCoverage.digest(target.owner, target.part) !== bound.sha256) continue
      inputs.add(bound.partID)
      const owners = dependents.get(bound.partID) ?? new Set<string>()
      owners.add(id)
      dependents.set(bound.partID, owners)
    }
    dependencies.set(id, inputs)
  }
  const affected = new Set<string>()
  const discover = [...repaired.keys()]
  for (let index = 0; index < discover.length; index++) for (const id of dependents.get(discover[index]!) ?? []) {
    if (affected.has(id)) continue
    affected.add(id)
    discover.push(id)
  }
  const pending = new Map([...affected].map(id =>
    [id, new Set([...dependencies.get(id)!].filter(input => affected.has(input)))] as const))
  const ready = [...pending].filter(([, inputs]) => inputs.size === 0).map(([id]) => id)
  for (let index = 0; index < ready.length; index++) {
    const id = ready[index]!, snapshot = snapshots.get(id)!
    const part = snapshot.part as Message.CompactionPart
    const covered_parts = part.covered_parts!.map(entry => ({ ...entry, parts: entry.parts.map(bound => {
      const original = snapshots.get(bound.partID), current = repaired.get(bound.partID)
      return original && current && original.part.messageID === entry.messageID &&
        original.part.sessionID === part.sessionID &&
        CompactionCoverage.digest(original.owner, original.part) === bound.sha256
        ? { ...bound, sha256: CompactionCoverage.digest(original.owner, current) } : bound
    }) }))
    repaired.set(id, { ...part, covered_parts })
    pending.delete(id)
    for (const dependent of dependents.get(id) ?? []) {
      const inputs = pending.get(dependent)
      if (inputs?.delete(id) && inputs.size === 0) ready.push(dependent)
    }
  }
  if (pending.size) throw new SchemaMigrationError("SCHEMA_MIGRATION_REQUIRED",
    "Copied artifact coverage has cyclic exact Part dependencies; retain the original database and backup for repair.")

  const update = sqlite.query("UPDATE part SET data=? WHERE id=?")
  try {
    for (const [id, part] of repaired) {
      const { id: _id, messageID: _messageID, sessionID: _sessionID, orderKey: _orderKey, ...data } = part
      update.run(JSON.stringify(data), id)
    }
  } finally { update.finalize() }
}
