import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { Database as Sqlite } from "bun:sqlite"
const repo = "D:/myhexin-local/opencorvus"
const sourceRun = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/store-card-accessor-after-153-01"
const out = path.join(repo, "specs/artifacts/2026-10-05-connection-workspace-authority/tool-identity-273/history-readiness-02")
const scratch = path.join(repo, ".tmp-product-iteration/tool-identity-273/history-readiness-02")
process.env.OPENCORVUS_HOME = path.join(scratch, "runtime")
process.env.OPENCORVUS_TEST_HOME = path.join(scratch, "home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT = scratch
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = "1"
for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_CONFIG_CONTENT", "OPENCORVUS_DISABLE_PROJECT_CONFIG"]) delete process.env[key]
const require = createRequire(path.join(repo, "packages/opencorvus/package.json"))
const { parse } = require("jsonc-parser")
const { drizzle } = await import(pathToFileURL(require.resolve("drizzle-orm/bun-sqlite")).href)
const { installProcessShims } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/runtime/shims.ts")).href)
installProcessShims()
const { Config } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/config/config.ts")).href)
const { findSchemaDrift } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/storage/schema-contract.ts")).href)
const { currentControlLeasesInTransaction } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/engine/control-lease.ts")).href)
const { ProjectMemory } = await import(pathToFileURL(path.join(repo, "packages/opencorvus/src/memory/project-memory.ts")).href)
const inventory = (root: string): any[] => {
  const info = fs.lstatSync(root)
  if (info.isSymbolicLink()) throw Error("Source filesystem link refused")
  if (!info.isDirectory()) return [{ path: root, type: "file", bytes: info.size, mtimeMs: info.mtimeMs }]
  return [{ path: root, type: "directory", mtimeMs: info.mtimeMs }, ...fs.readdirSync(root).sort().flatMap(name => inventory(path.join(root, name)))]
}
const errors: any[] = []
const globalConfig = Config.Info.parse(parse(fs.readFileSync(path.join(sourceRun, "runtime/config/opencorvus.jsonc"), "utf8"), errors, { allowTrailingComma: true }))
if (errors.length) throw Error("Actual source global JSONC is invalid")
const sqlite = new Sqlite(path.join(sourceRun, "runtime/data/opencorvus.db"), { readonly: true })
sqlite.exec("BEGIN")
try {
  const db = drizzle({ client: sqlite })
  const projects = sqlite.query("SELECT id,worktree,sandboxes FROM project ORDER BY id").all() as any[]
  const tasks = sqlite.query("SELECT id,project_id,session_id,request_id FROM engine_task ORDER BY id").all()
  const targets = sqlite.query("SELECT DISTINCT target,target_id FROM engine_control_activation_lease ORDER BY target,target_id").all() as any[]
  const leases = [...new Set(targets.map(row => row.target))].flatMap(target => [...currentControlLeasesInTransaction(db, target, targets.filter(row => row.target === target).map(row => row.target_id)).values()])
  const capacity = sqlite.query("SELECT * FROM runtime_execution_capacity_lease ORDER BY lease_id").all()
  const controls = sqlite.query("SELECT r.id,r.session_id,r.kind,e.id AS event_id,e.kind AS event_kind FROM session_control_record r LEFT JOIN session_control_event e ON e.control_id=r.id ORDER BY r.id,e.time_created,e.id").all()
  const permissions = sqlite.query("SELECT s.id,s.attempt_id,s.project_id,s.session_id,o.id AS outcome_id,o.event_type AS outcome,r.time_created AS result_at FROM permission_ledger s LEFT JOIN permission_ledger o ON o.outcome_slot=s.attempt_id LEFT JOIN permission_execution_result r ON r.attempt_id=s.attempt_id WHERE s.event_type='execution_started' ORDER BY s.id").all()
  const permissionRequests = sqlite.query("SELECT id,request_id,event_type,attempt_id,outcome_slot FROM permission_ledger ORDER BY time_created,id").all()
  const checkpoints = sqlite.query("SELECT r.id,r.task_id,r.stage,o.request_id AS outcome_request_id FROM engine_git_checkpoint_request r LEFT JOIN engine_git_checkpoint_outcome o ON o.request_id=r.id ORDER BY r.id").all()
  const messages = sqlite.query("SELECT id,session_id,json_extract(data,'$.role') AS role,json_extract(data,'$.time.completed') AS completed_at,json_extract(data,'$.pendingDelivery') AS pending_delivery FROM message ORDER BY session_id,time_created,id").all() as any[]
  const memory = sqlite.query("SELECT f.id,f.project_id,f.kind,f.source,f.key,c.id AS chunk_id,length(c.content) AS content_chars FROM memory_file f LEFT JOIN memory_chunk c ON c.file_id=f.id ORDER BY f.project_id,f.id").all()
  const memoryDocuments = projects.map(project => {
    const fileID = ProjectMemory.TestHooks.documentFile(project.id)
    const chunkID = ProjectMemory.TestHooks.documentChunk(project.id)
    const chunk = sqlite.query("SELECT content FROM memory_chunk WHERE id=? AND file_id=?").get(chunkID, fileID) as {content:string}|null
    if (!chunk) throw Error(`Project ${project.id} document must be qualified before any bootstrap initialization`)
    const snapshot = ProjectMemory.readInTransaction(db, project.id)
    const envelope = JSON.parse(chunk.content)
    return {projectID:project.id,fileID,chunkID,snapshot,organizerLease:envelope.organizerLease}
  })
  const recoveryTables = ["automation", "automation_fire", "automation_fire_frontier", "event_job", "event_job_fire", "protocol_inbox", "session_prompt_owner", "engine_task_wait_registration", "engine_interaction_request", "engine_build_observation_cleanup", "project_directory_admission", "project_maintenance_fence", "channel_ingress_accepted", "workspace_lifecycle_admission"]
  const recoveryTableCounts = recoveryTables.map(name => ({ name, ...(sqlite.query(`SELECT COUNT(*) AS rows FROM "${name}"`).get() as any) }))
  const providerPending = sqlite.query("SELECT r.id FROM provider_activity_request r LEFT JOIN provider_activity_outcome o ON o.request_id=r.id WHERE o.id IS NULL ORDER BY r.id").all()
  const toolPending = sqlite.query("SELECT r.id FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE o.id IS NULL ORDER BY r.id").all()
  const unsettledPublications = sqlite.query("SELECT o.occurrence_id FROM bus_publication_outbox o WHERE (SELECT COUNT(DISTINCT phase) FROM bus_publication_phase_receipt p WHERE p.occurrence_id=o.occurrence_id AND p.phase IN ('exact','wildcard','global'))<>3 ORDER BY o.occurrence_id").all()
  const unsettledDeliveries = sqlite.query("SELECT d.occurrence_id,d.phase,d.subscriber_id FROM bus_publication_delivery d LEFT JOIN bus_publication_delivery_receipt r ON r.occurrence_id=d.occurrence_id AND r.phase=d.phase AND r.subscriber_id=d.subscriber_id AND r.outcome IN ('succeeded','ignored') WHERE r.id IS NULL ORDER BY d.occurrence_id,d.phase,d.subscriber_id").all()
  const projectObservations = []
  for (const project of projects) {
    const effective = await Config.snapshotForProject(project.worktree, globalConfig)
    projectObservations.push({ ...project, config: effective, inventory: inventory(project.worktree) })
  }
  const tableCounts = (sqlite.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]).map(row => ({ name: row.name, ...(sqlite.query(`SELECT COUNT(*) AS rows FROM "${row.name.replaceAll('"', '""')}"`).get() as any) }))
  const result = { observedAtUtc: new Date().toISOString(), sourceRun, access: "Original full canonical readonly BEGIN/ROLLBACK and explicit drizzle client; current schema/lease/config and recovery frontiers; lstat inventory only", schemaDrift: findSchemaDrift(sqlite) ?? null, projects: projectObservations, tasks, leases, capacity, controls, permissions, permissionRequests, checkpoints, messages, memory, memoryDocuments, recoveryTableCounts, providerPending, toolPending, unsettledPublications, unsettledDeliveries, tableCounts, runtimeInventory: inventory(path.join(sourceRun, "runtime")), boundary: "Fresh original pre-start observations; exact closure/ports/pair and complete copied row custody remain required before history start" }
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, "result-startup.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ schemaDrift: result.schemaDrift, projects: projectObservations.map(p => ({ id: p.id, config: p.config, files: p.inventory.length })), tasks, leases, capacity, controls, permissions, permissionRequests, checkpoints, messages, memory, memoryDocuments, recoveryTableCounts, providerPending, toolPending, unsettledPublications, unsettledDeliveries }, null, 2))
} finally { sqlite.exec("ROLLBACK"); sqlite.close() }
