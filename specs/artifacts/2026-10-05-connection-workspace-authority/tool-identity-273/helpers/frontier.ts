import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { Database as Sqlite } from "bun:sqlite"

const repo="D:/myhexin-local/opencorvus"
const sourceRun="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/store-card-accessor-after-153-01"
const out=path.join(repo,"specs/artifacts/2026-10-05-connection-workspace-authority/tool-identity-273/history-readiness")
const guard=JSON.parse(fs.readFileSync(path.join(out,"guard.json"),"utf8"))
const custody=JSON.parse(fs.readFileSync(path.join(repo,"specs/artifacts/2026-10-05-connection-workspace-authority/child-history-readonly-census-201/guard.json"),"utf8"))
if(!guard.readQualified || !custody.readQualified || guard.occurrence!==custody.occurrence || path.resolve(guard.sourceRun)!==path.resolve(sourceRun)) throw Error("Exact original custody and fresh273 readonly admission required")
process.env.OPENCORVUS_HOME=path.join(repo,".tmp-product-iteration/tool-identity-273/frontier/runtime")
process.env.OPENCORVUS_TEST_HOME=path.join(repo,".tmp-product-iteration/tool-identity-273/frontier/home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT=path.join(repo,".tmp-product-iteration/tool-identity-273/frontier")
const require=createRequire(path.join(repo,"packages/opencorvus/package.json"))
const {drizzle}=await import(pathToFileURL(require.resolve("drizzle-orm/bun-sqlite")).href)
const {currentControlLeasesInTransaction}=await import(pathToFileURL(path.join(repo,"packages/opencorvus/src/engine/control-lease.ts")).href)
const {taskRootIngressDispositionInTransaction}=await import(pathToFileURL(path.join(repo,"packages/opencorvus/src/engine/task-root-ingress-disposition.ts")).href)
const sourceFile=path.join(sourceRun,"runtime/data/opencorvus.db")
for(const item of [sourceRun,path.join(sourceRun,"runtime"),path.join(sourceRun,"runtime/data"),sourceFile]) if(fs.lstatSync(item).isSymbolicLink()) throw Error("Readonly source link refused")
const sqlite=new Sqlite(sourceFile,{readonly:true})
sqlite.exec("BEGIN")
try {
  const db=drizzle({client:sqlite})
  if(db.$client!==sqlite) throw Error("Explicit canonical readonly client identity required")
  const now=Date.now()
  const targets=sqlite.query("SELECT DISTINCT target,target_id FROM engine_control_activation_lease ORDER BY target,target_id").all() as {target:string,target_id:string}[]
  const leases=[...new Set(targets.map(r=>r.target))].flatMap(target=>[...currentControlLeasesInTransaction(db,target as any,targets.filter(r=>r.target===target).map(r=>r.target_id)).values()])
  const capacity=sqlite.query("SELECT slot,lease_id,owner_id,time_acquired,expires_at FROM runtime_execution_capacity_lease ORDER BY lease_id").all()
  const control=sqlite.query(`SELECT r.id,r.session_id,r.kind,e.id AS event_id,e.kind AS event_kind,e.time_created FROM session_control_record r LEFT JOIN session_control_event e ON e.control_id=r.id ORDER BY r.id,e.time_created,e.id`).all()
  const ingresses=(sqlite.query("SELECT id,task_id,project_id,execution_epoch,sequence,source,source_id,policy_id,time_accepted FROM engine_task_root_ingress ORDER BY task_id,sequence,id").all() as any[]).map(r=>({
    ...r,disposition:taskRootIngressDispositionInTransaction(db,{taskID:r.task_id,ingressID:r.id})??null,
  }))
  const permissions=sqlite.query(`SELECT s.id,s.attempt_id,s.project_id,s.session_id,s.task_id,s.time_created AS started_at,o.id AS outcome_id,o.event_type AS outcome,r.time_created AS result_at FROM permission_ledger s LEFT JOIN permission_ledger o ON o.outcome_slot=s.attempt_id LEFT JOIN permission_execution_result r ON r.attempt_id=s.attempt_id WHERE s.event_type='execution_started' ORDER BY s.id`).all()
  const checkpoints=sqlite.query("SELECT r.id,r.task_id,r.stage,o.request_id AS outcome_request_id,o.time_created AS terminal_at FROM engine_git_checkpoint_request r LEFT JOIN engine_git_checkpoint_outcome o ON o.request_id=r.id ORDER BY r.id").all()
  const messages=sqlite.query(`SELECT id,session_id,json_extract(data,'$.role') AS role,json_extract(data,'$.parentID') AS parent_id,json_extract(data,'$.time.completed') AS completed_at,json_extract(data,'$.finish') AS finish,json_extract(data,'$.error.name') AS error_name FROM message ORDER BY session_id,time_created,id`).all()
  const partKinds=sqlite.query("SELECT json_extract(data,'$.type') AS type,COUNT(*) AS count FROM part GROUP BY type ORDER BY type").all()
  const sources=sqlite.query(`SELECT p.id,p.message_id,m.session_id,s.kind AS session_kind,length(json_extract(p.data,'$.snippet')) AS snippet_chars FROM part p JOIN message m ON m.id=p.message_id JOIN session s ON s.id=m.session_id WHERE json_extract(p.data,'$.type')='source-url' ORDER BY m.session_id,p.time_created,p.id`).all()
  const memory=sqlite.query(`SELECT f.id,f.project_id,f.kind,f.source,c.id AS chunk_id,c.token_count,json_extract(c.content,'$.version') AS envelope_version,json_extract(c.content,'$.status') AS envelope_status,json_extract(c.content,'$.revision') AS envelope_revision,json_extract(c.content,'$.organizerLease.expiresAt') AS organizer_lease_expires_at,json_extract(c.content,'$.availabilityGeneration') AS availability_generation FROM memory_file f LEFT JOIN memory_chunk c ON c.file_id=f.id ORDER BY f.project_id,f.id`).all()
  const recoveryTables=["automation","automation_fire","automation_fire_frontier","event_job","event_job_fire","protocol_inbox","session_prompt_owner","engine_task_wait_registration","engine_interaction_request","engine_build_observation_cleanup","project_directory_admission","project_maintenance_fence","channel_ingress_accepted","workspace_lifecycle_admission"]
  const recoveryTableCounts=recoveryTables.map(name=>({name,...sqlite.query(`SELECT COUNT(*) AS rows FROM "${name}"`).get() as any}))
  const result={observedAtUtc:new Date(now).toISOString(),sourceRun,occurrence:guard.occurrence,access:"readonly explicit original client; BEGIN/ROLLBACK; canonical current lease winner and immutable ingress disposition reader",leases,capacity,control,ingresses,permissions,checkpoints,messages,partKinds,sources,memory,recoveryTableCounts,boundary:"Readonly startup-frontier observations only; file/config/recovery predicate/parent join/native deadline/clone identity and actual child UI remain unqualified"}
  fs.writeFileSync(path.join(out,"result-frontier.json"),JSON.stringify(result,null,2),{flag:"wx"})
  console.log(JSON.stringify({now,currentLeaseWinners:leases.length,currentLeaseTargets:[...new Set(leases.map((r:any)=>r.target))],unexpiredLeaseWinners:leases.filter((r:any)=>r.expires_at>now).length,capacitySlots:capacity.length,unexpiredCapacitySlots:capacity.filter((r:any)=>r.expires_at>now).length,control,ingresses,permissionStarts:permissions.length,permissionOutcomes:permissions.filter((r:any)=>r.outcome_id).length,checkpoints,assistantMessages:messages.filter((r:any)=>r.role==='assistant').length,completedAssistants:messages.filter((r:any)=>r.role==='assistant'&&r.completed_at!==null).length,partKinds,sources,memory,recoveryTableCounts}))
} finally {sqlite.exec("ROLLBACK");sqlite.close()}
