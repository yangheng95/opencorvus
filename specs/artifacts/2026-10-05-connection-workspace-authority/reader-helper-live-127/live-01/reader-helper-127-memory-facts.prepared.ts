import { Database } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"

const [runInput, evidenceInput, outputName] = process.argv.slice(2)
if (!runInput || !evidenceInput || !outputName || !/^[a-z0-9-]+\.json$/.test(outputName)) throw new Error("Exact RunRoot, EvidenceRoot and safe output filename required")
const run = path.resolve(runInput)
const evidence = path.resolve(evidenceInput)
const owner = JSON.parse(fs.readFileSync(path.join(run, "launch-owner.json"), "utf8"))
const selected = JSON.parse(fs.readFileSync(path.join(run, "task-selection.json"), "utf8"))
if (path.resolve(owner.runRoot) !== run || path.resolve(owner.settlementEvidenceRoot) !== evidence || selected.occurrence !== owner.occurrence || path.resolve(selected.directory) !== path.resolve(owner.project)) throw new Error("Exact original run/selection/evidence ownership required")
const closure = JSON.parse(fs.readFileSync(path.join(evidence, `${owner.evidencePrefix}-physical-terminal-and-pair-cleanup.json`), "utf8"))
if (closure.occurrence !== owner.occurrence || closure.physicalCompletion !== true || closure.pairedCleanupComplete !== true || closure.nativeSettlement?.physicalCompletion !== true || closure.nativeSettlement?.outputDrainComplete !== true || closure.nativeSettlement?.requestCleanupComplete !== true) throw new Error("Exact whole physical/output/request/pair settlement required before readonly query")
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const task = db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get(selected.taskID) as { id: string; project_id: string; session_id: string; request_id: string; product_pillar: string } | null
  if (!task || task.project_id !== selected.projectID || task.request_id !== selected.requestID || task.product_pillar !== selected.productPillar) throw new Error("Actual persisted Task differs from selected original owner")
  const documents = db.query(`SELECT f.id AS fileID,c.id AS chunkID,f.project_id AS projectID,
    json_valid(c.content) AS validJSON,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.version') END AS version,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.revision') END AS revision,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.status') END AS status,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.timeCreated') END AS createdAt,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.timeUpdated') END AS updatedAt,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.tokenCount') END AS tokenCount,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.recentCoveredOccurrenceIDs') END AS coverage,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.organizerLease.id') END AS leaseID,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.organizerLease.revision') END AS leaseRevision,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.organizerLease.expiresAt') END AS leaseExpiresAt
    FROM memory_file f JOIN memory_chunk c ON c.file_id=f.id AND c.project_id=f.project_id
    WHERE f.project_id=? AND f.kind='project_context' AND f.key='project-memory-document'`).all(selected.projectID).map((raw) => {
      const row = raw as Record<string, unknown>
      const coverage = typeof row.coverage === "string" ? JSON.parse(row.coverage) : null
      return { ...row, coverage, selectedTaskCoveredInRecentWindow: Array.isArray(coverage) ? coverage.includes(selected.taskID) : null }
    })
  const pending = db.query(`SELECT f.id AS fileID,f.key,f.time_created AS createdAt,
    json_valid(c.content) AS validJSON,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.occurrenceKind') END AS occurrenceKind,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.occurrenceID') END AS occurrenceID,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.taskID') END AS taskID,
    CASE WHEN json_valid(c.content) THEN json_extract(c.content,'$.sessionID') END AS sessionID
    FROM memory_file f JOIN memory_chunk c ON c.file_id=f.id AND c.project_id=f.project_id
    WHERE f.project_id=? AND f.kind='user_message' AND f.key=?`).all(selected.projectID, `task_create:${selected.taskID}`)
  fs.writeFileSync(path.join(evidence, outputName), JSON.stringify({ observedAt: new Date().toISOString(), access: "one closed SQLite readonly BEGIN/ROLLBACK transaction; scalar projection only, no bootstrap", occurrence: owner.occurrence, selected: { taskID: selected.taskID, projectID: selected.projectID, requestID: selected.requestID, productPillar: selected.productPillar }, task, expectedInputOccurrence: { kind: "task_create", id: selected.taskID, key: `task_create:${selected.taskID}` }, documents, selectedPendingOccurrences: pending, interpretation: "Recent coverage is bounded; missing ID does not prove never covered. Pending row and current status are separate observations, not a fabricated commit." }, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ documentRows: documents.length, selectedPendingRows: pending.length, output: outputName }))
} finally {
  db.exec("ROLLBACK")
  db.close()
}
