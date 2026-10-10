import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { Database as Sqlite } from "bun:sqlite"

const repo = "D:/myhexin-local/opencorvus"
const evidence = path.join(repo, "specs/artifacts/2026-10-05-connection-workspace-authority/research-source-277")
const scratch = path.join(repo, ".tmp-product-iteration/research-source-277/readonly")
fs.mkdirSync(scratch, { recursive: true })
process.env.OPENCORVUS_HOME = path.join(scratch, "runtime")
process.env.OPENCORVUS_TEST_HOME = path.join(scratch, "home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT = scratch
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = "1"
for (const key of ["OPENCORVUS_CONFIG", "OPENCORVUS_CONFIG_DIR", "OPENCORVUS_CONFIG_CONTENT"]) delete process.env[key]
const require = createRequire(path.join(repo, "packages/opencorvus/package.json"))
const { drizzle } = await import(require.resolve("drizzle-orm/bun-sqlite"))
const { installProcessShims } = await import(`${repo}/packages/opencorvus/src/runtime/shims.ts`)
installProcessShims()
const { findSchemaDrift } = await import(`${repo}/packages/opencorvus/src/storage/schema-contract.ts`)
const { currentControlLeasesInTransaction } = await import(`${repo}/packages/opencorvus/src/engine/control-lease.ts`)
const { taskLifecycleProjectionInTransaction } = await import(`${repo}/packages/opencorvus/src/engine/task-lifecycle.ts`)
const { taskRootIngressDispositionInTransaction } = await import(`${repo}/packages/opencorvus/src/engine/task-root-ingress-disposition.ts`)
const { dispatchRecoveryCandidatesInTransaction } = await import(`${repo}/packages/opencorvus/src/engine/dispatch-delivery-disposition.ts`)
const { Message } = await import(`${repo}/packages/opencorvus/src/session/message.ts`)
const { canonicalSourceUrl } = await import(`${repo}/packages/opencorvus/src/tool/source.ts`)

const sourceFile = "C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db"
if (fs.lstatSync(sourceFile).isSymbolicLink()) throw new Error("Exact original production database must be a physical file")
const sqlite = new Sqlite(sourceFile, { readonly: true })
try {
  sqlite.exec("BEGIN")
  const db = drizzle({ client: sqlite })
  if (db.$client !== sqlite) throw new Error("Explicit readonly canonical client required")
  const now = Date.now()
  const taskID = "tsk_g00VXMejke00KwIb9xRv"
  const task = sqlite.query("SELECT id,project_id,session_id,request_id,time_created FROM engine_task WHERE id=?").get(taskID) as any
  if (!task || task.project_id !== "prj_h5qbWiFVHxI6qXpzkg8E" || task.session_id !== "ses_-zUSdLG7mzz2z8XPgyML") throw new Error("Exact original screenshot Task identity differs")
  const sessions = sqlite.query("WITH RECURSIVE f AS (SELECT id FROM session WHERE id=? UNION ALL SELECT s.id FROM session s JOIN f ON s.parent_id=f.id) SELECT id,kind,parent_id,directory FROM session WHERE id IN (SELECT id FROM f) ORDER BY time_created,id").all(task.session_id) as any[]
  const sessionFacts = sessions.map((session) => {
    const messages = sqlite.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(session.id) as any[]
    const parts = messages.flatMap((message) => sqlite.query("SELECT id,data FROM part WHERE message_id=? ORDER BY time_created,id").all(message.id) as any[]).map((row) => JSON.parse(row.data))
    const sources = parts.filter((part) => ["source-url", "source-file", "source-document"].includes(part.type))
    const sourceValidation = sources.map((source) => Message.SourcePayload.safeParse(source))
    const tools = messages.flatMap((message) => sqlite.query("SELECT id,data FROM tool_part_request WHERE message_id=? ORDER BY time_created,id").all(message.id) as any[])
    const outcomes = tools.flatMap((tool) => sqlite.query("SELECT data FROM tool_part_outcome WHERE request_part_id=?").all(tool.id) as any[]).map((row) => JSON.parse(row.data))
    const urls = sources.filter((source) => source.type === "source-url")
    return {
      id: session.id, kind: session.kind, parentID: session.parent_id,
      agents: [...new Set(messages.map((row) => JSON.parse(row.data).agent).filter(Boolean))],
      messages: messages.length,
      sources: Object.fromEntries(["source-file", "source-url", "source-document"].map((kind) => [kind, sources.filter((source) => source.type === kind).length])),
      validSourcePayloads: sourceValidation.filter((result) => result.success).length,
      sourceValidationIssues: sourceValidation.flatMap((result, index) => result.success ? [] : [{ index, issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }]),
      sourceExcerpts: sources.filter((source) => source.snippet).length,
      urlTitles: urls.filter((source) => source.title?.trim()).length,
      distinctSourceIDs: new Set(sources.map((source) => `${source.type}\0${source.sourceId}`)).size,
      distinctCanonicalURLs: new Set(urls.map((source) => canonicalSourceUrl(source.url))).size,
      longestExcerptChars: Math.max(0, ...sources.map((source) => source.snippet?.length ?? 0)),
      tools: tools.reduce((counts, row) => { const tool = JSON.parse(row.data).tool; counts[tool] = (counts[tool] ?? 0) + 1; return counts }, {} as Record<string, number>),
      outcomes: outcomes.reduce((counts, row) => { counts[row.outcome] = (counts[row.outcome] ?? 0) + 1; return counts }, {} as Record<string, number>),
      requestRows: tools.length, outcomeRows: outcomes.length,
    }
  })
  const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
  const targets = sqlite.query("SELECT DISTINCT target,target_id FROM engine_control_activation_lease ORDER BY target,target_id").all() as any[]
  const leases = [...new Set(targets.map((row) => row.target))].flatMap((target) => [...currentControlLeasesInTransaction(db, target, targets.filter((row) => row.target === target).map((row) => row.target_id)).values()])
  const descriptors = (sqlite.query("SELECT task_id,session_id,json_extract(payload,'$.dispatchTurn.current_dispatch_id') AS dispatch_id FROM worker_turn_descriptor ORDER BY id").all() as any[]).map((row) => ({ taskID: row.task_id, sessionID: row.session_id, dispatchID: row.dispatch_id }))
  const recoveries = dispatchRecoveryCandidatesInTransaction(db, { descriptors })
  const ingresses = (sqlite.query("SELECT id,task_id,project_id,execution_epoch,sequence FROM engine_task_root_ingress ORDER BY task_id,sequence,id").all() as any[]).map((row) => ({ ...row, disposition: taskRootIngressDispositionInTransaction(db, { taskID: row.task_id, ingressID: row.id }) ?? null }))
  const tables = (sqlite.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]).map((row) => ({ name: row.name, rows: (sqlite.query(`SELECT COUNT(*) AS n FROM "${row.name.replaceAll('"', '""')}"`).get() as any).n }))
  const count = (sql: string) => (sqlite.query(sql).get() as any).n
  const result = {
    observedAtUtc: new Date(now).toISOString(), sourceFile,
    access: "Original production readonly BEGIN/ROLLBACK; every semantic owner uses the exact readonly client; no model, migration, UI, source mutation or Task/member creation",
    task, sessionFacts,
    lifecycle: { status: lifecycle.status, epoch: lifecycle.epoch, openedEventID: lifecycle.openedEventID, terminalEventID: lifecycle.terminalEventID },
    schemaDrift: findSchemaDrift(sqlite) ?? null,
    tableCounts: tables,
    leaseFacts: { currentWinners: leases.length, unexpiredTargets: [...new Set(leases.filter((lease: any) => lease.expires_at > now).map((lease: any) => lease.target))] },
    runtimeIdentities: sqlite.query("SELECT target_id,owner_occurrence_id,time_activated,expires_at FROM engine_control_activation_lease WHERE target='runtime_process' ORDER BY time_activated").all(),
    capacity: sqlite.query("SELECT resource_key,lease_id,owner_id,expires_at FROM runtime_execution_capacity_lease ORDER BY resource_key,slot").all(),
    dispatchRecoveryCandidates: recoveries.map((row: any) => ({ taskID: row.taskID, sessionID: row.sessionID, dispatchID: row.dispatchID })),
    ingresses,
    pendingProvider: count("SELECT COUNT(*) AS n FROM provider_activity_request r LEFT JOIN provider_activity_outcome o ON o.request_id=r.id WHERE o.id IS NULL"),
    pendingTools: count("SELECT COUNT(*) AS n FROM tool_part_request r LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE o.id IS NULL"),
    unsettledPublications: count("SELECT COUNT(*) AS n FROM bus_publication_outbox o WHERE (SELECT COUNT(DISTINCT phase) FROM bus_publication_phase_receipt p WHERE p.occurrence_id=o.occurrence_id AND p.phase IN ('exact','wildcard','global'))<>3"),
    unsettledDeliveries: count("SELECT COUNT(*) AS n FROM bus_publication_delivery d LEFT JOIN bus_publication_delivery_receipt r ON r.occurrence_id=d.occurrence_id AND r.phase=d.phase AND r.subscriber_id=d.subscriber_id AND r.outcome IN ('succeeded','ignored') WHERE r.id IS NULL"),
    assistants: count("SELECT COUNT(*) AS n FROM message WHERE json_extract(data,'$.role')='assistant'"),
    completedAssistants: count("SELECT COUNT(*) AS n FROM message WHERE json_extract(data,'$.role')='assistant' AND json_extract(data,'$.time.completed') IS NOT NULL"),
    permissionStarts: count("SELECT COUNT(*) AS n FROM permission_ledger WHERE event_type='execution_started'"),
    permissionOutcomes: count("SELECT COUNT(*) AS n FROM permission_ledger s JOIN permission_ledger o ON o.outcome_slot=s.attempt_id WHERE s.event_type='execution_started'"),
    boundary: "Exact original screenshot Task/source census and current semantic frontiers only; full runtime/config/project custody and actual original child UI remain unqualified",
  }
  fs.writeFileSync(path.join(evidence, "census.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ taskID, schemaDrift: result.schemaDrift, lifecycle: result.lifecycle, sessions: sessionFacts.map((session) => ({ id: session.id, agents: session.agents, sources: session.sources, distinctCanonicalURLs: session.distinctCanonicalURLs, validSourcePayloads: session.validSourcePayloads, longestExcerptChars: session.longestExcerptChars })), pendingProvider: result.pendingProvider, pendingTools: result.pendingTools, recoveryCandidates: result.dispatchRecoveryCandidates.length }))
} finally {
  sqlite.exec("ROLLBACK")
  sqlite.close()
}
