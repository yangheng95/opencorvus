import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
const before = JSON.parse(fs.readFileSync(path.join(manifest.readinessEvidence, "result-startup.json"), "utf8"))
const source = new Database(path.join(manifest.sourceRun, "runtime/data/opencorvus.db"), { readonly: true })
const clone = new Database(path.join(manifest.caseRun, "runtime/data/opencorvus.db"), { readonly: true })
const inventory = (root: string): any[] => {
  const info = fs.lstatSync(root)
  if (info.isSymbolicLink()) throw Error("Source project link requires separate review")
  if (!info.isDirectory()) return [{ path: root, type: "file", bytes: info.size, mtimeMs: info.mtimeMs }]
  return [{ path: root, type: "directory", mtimeMs: info.mtimeMs }, ...fs.readdirSync(root).sort().flatMap(name => inventory(path.join(root, name)))]
}
try {
  source.exec("BEGIN")
  clone.exec("BEGIN")
  const tables = ["session", "message", "part", "tool_part_request", "tool_part_progress", "tool_part_outcome", "provider_activity_request", "provider_activity_outcome", "provider_usage_event", "engine_task", "worker_turn_descriptor", "engine_artifact", "engine_artifact_version"]
  const completeRows = tables.map(table => {
    const left = source.query(`SELECT * FROM "${table}"`).all().map(row => JSON.stringify(row)).sort()
    const right = clone.query(`SELECT * FROM "${table}"`).all().map(row => JSON.stringify(row)).sort()
    if (left.length !== right.length || left.some((row, index) => row !== right[index])) throw Error(`Actual canonical full rows changed: ${table}`)
    return { table, rows: left.length, fullRowContent: "equal" }
  })
  const task = clone.query("SELECT id, project_id, session_id, request_id FROM engine_task WHERE id=?").get(manifest.taskID) as any
  if (task.project_id !== manifest.projectID || task.session_id !== manifest.rootSessionID || task.request_id !== manifest.requestID) throw Error("Actual selected Task identity changed")
  const session = clone.query("SELECT id, project_id, directory, kind, parent_id FROM session WHERE id=?").get(manifest.rootSessionID) as any
  if (session.project_id !== manifest.projectID || path.resolve(session.directory) !== path.resolve(manifest.sourceProject)) throw Error("Actual original Project identity changed")
  const projects = before.projects.map((project: any) => {
    const after = inventory(project.worktree)
    const prior = new Map(project.inventory.map((entry: any) => [entry.path, entry]))
    const current = new Map(after.map((entry: any) => [entry.path, entry]))
    const added = after.filter(entry => !prior.has(entry.path))
    const removed = project.inventory.filter((entry: any) => !current.has(entry.path))
    const changed = after.filter(entry => prior.has(entry.path) && JSON.stringify(prior.get(entry.path)) !== JSON.stringify(entry)).map(entry => ({ before: prior.get(entry.path) as any, after: entry }))
    const gitDirectory = path.resolve(project.worktree, ".git")
    const inspectedGitDirectoryTimeOnly = changed.every(change => path.resolve(change.after.path) === gitDirectory && change.before.type === "directory" && change.after.type === "directory" && JSON.stringify({ ...change.before, mtimeMs: 0 }) === JSON.stringify({ ...change.after, mtimeMs: 0 }))
    if (added.length || removed.length || !inspectedGitDirectoryTimeOnly) throw Error(`Unreviewed original Project properties changed: ${project.id}`)
    return { id: project.id, worktree: project.worktree, before: project.inventory, after, added, removed, changed, observedProperties: changed.length ? "Reviewed .git directory timestamp only; complete difference retained" : "equal", boundary: "Readonly filesystem attributes, not file-content identity. Current production Vcs status observes the source worktree; this qualification only admits the exact inspected .git directory timestamp difference." }
  })
  const copiedConfig = path.join(manifest.caseRun, "runtime/config/opencorvus.jsonc")
  const originalConfig = path.join(manifest.sourceRun, "runtime/config/opencorvus.jsonc")
  const originalBytes = fs.readFileSync(originalConfig)
  const copiedBytes = fs.readFileSync(copiedConfig)
  if (!originalBytes.equals(copiedBytes)) throw Error("Original and copied runtime configuration bytes differ")
  const result = { observedAtUtc: new Date().toISOString(), sourceRun: manifest.sourceRun, caseRun: manifest.caseRun, task, session, completeRows, projects, runtimeConfiguration: { originalConfig, copiedConfig, bytes: originalBytes.length, directContent: "equal", boundary: "Original and whole-history copy direct byte equality at final observation; not a historical pre-launch byte baseline" }, boundary: "Actual complete stored row equality after native closure in readonly BEGIN/ROLLBACK; Tool facts checked independently; no hashes or count-only evidence" }
  fs.writeFileSync(path.join(manifest.caseEvidence, "final-canonical-custody.json"), JSON.stringify(result, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ task, session, completeRows, projects: projects.map((p: any) => ({ id: p.id, entries: p.after.length, observedProperties: p.observedProperties })) }))
} finally {
  source.exec("ROLLBACK")
  clone.exec("ROLLBACK")
  source.close()
  clone.close()
}
