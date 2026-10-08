import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
const base = path.resolve('specs/artifacts/2026-10-05-connection-workspace-authority')
const out = path.join(base, 'document-source-owned-history-query-165')
const cases = [
 [147,'subagent-markdown-live-147','subagent-markdown-live-147-01',18096,'tsk_g00VXRWOum00D5RHQb6e','prj_h53tcmn0Bc0GFgoSQjl1'],
 [150,'markdown-visible-owner-live-150','markdown-visible-owner-live-150-01',18097,'tsk_g00VXRf77v00ggeNEFiR','prj_hlba09HHCdnWjhWz5H5w'],
 [153,'store-card-accessor-after-153','store-card-accessor-after-153-01',18098,'tsk_g00VXRkMRi00ID2TqzPU','prj_honTzv1SylD1sTwgEqBC'],
 [154,'store-card-accessor-final-154','store-card-accessor-final-154-01',18099,'tsk_g00VXRpfCf00hKin7FDT','prj_hF3Muc2ULNnUntEgr5l5'],
 [159,'sources-reading-focus-after-159','sources-reading-focus-after-159-01',18100,'tsk_g00VXRud2R00OXBs7F1T','prj_hFoH6j1XjifCYeiDetbh'],
 [160,'sources-file-focus-live-160','sources-file-focus-live-160-01',18101,'tsk_g00VXRybX300WIjs1vDo','prj_h4jW34TAsAK72cmvPz10'],
 [163,'subagent-density-after-163','subagent-density-after-163-01',18102,'tsk_g00VXS5OB300myYO0mkg','prj_h13db3EFayyhYA7nR3II'],
] as const
const read = (p:string) => JSON.parse(fs.readFileSync(p,'utf8'))
const save = (p:string,v:unknown) => fs.writeFileSync(p,JSON.stringify(v,null,2),{flag:'wx'})
const tree = `WITH RECURSIVE scoped_sessions(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION SELECT s.id FROM session s JOIN scoped_sessions p ON s.parent_id=p.id)`
const results: unknown[]=[]
for(const [n,dir,prefix,port,taskID,projectID] of cases){
 const e=path.join(base,dir,'live-01'),run=path.resolve('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08',prefix)
 let db:Database|undefined
 try{
  const owner=read(path.join(e,'launch-owner.json')),selection=read(path.join(e,`actual-${n}01-task-selection.json`)),complete=read(path.join(e,'task-complete.json'))
  const physical=read(path.join(e,`${prefix}-physical-terminal-and-pair-cleanup.json`)),settled=read(path.join(e,'native-host-settled.json')),fresh=read(path.join(out,`${n}-fresh-guard.json`))
  const currentOwner=read(path.join(run,'launch-owner.json'))
  const custody={case:n,run,e,occurrence:owner.occurrence,taskID,projectID,selection,pinned:complete.pinned,lifecycle:complete.lifecycle,host:owner.host,target:owner.nativeTarget,fresh,physicalCompletion:physical.physicalCompletion,pairedCleanupComplete:physical.pairedCleanupComplete}
  save(path.join(out,`${n}-custody.json`),custody)
  assert.deepEqual(currentOwner,owner)
  assert.equal(path.resolve(owner.runRoot),run);assert.equal(owner.evidencePrefix,prefix);assert.equal(owner.port,port)
  assert.equal(path.resolve(owner.settlementEvidenceRoot),path.resolve(e))
  assert.equal(selection.taskID,taskID);assert.equal(selection.projectID,projectID);assert.equal(selection.occurrence,owner.occurrence)
  assert.equal(path.resolve(selection.directory),path.resolve(owner.project));assert.deepEqual(complete.selected,selection)
  assert.equal(complete.pid,owner.nativeTarget.pid);assert.equal(complete.occurrence,owner.occurrence)
  assert.equal(complete.pinned.taskID,taskID);assert.equal(complete.pinned.projectID,projectID);assert.equal(complete.pinned.epoch,1)
  assert.equal(complete.lifecycle.status,'completed');assert.equal(complete.lifecycle.epoch,complete.pinned.epoch)
  assert.equal(complete.lifecycle.openedEventID,complete.pinned.openedEventID);assert.equal(complete.lifecycle.openedAt,complete.pinned.openedAt)
  assert.deepEqual(complete.ownedPromptSessions,[])
  for(const x of [physical.nativeSettlement,settled]){assert.equal(x.occurrence,owner.occurrence);assert.equal(x.outcome,'settled');assert.equal(x.physicalCompletion,true);assert.equal(x.outputDrainComplete,true);assert.equal(x.requestCleanupComplete,true);assert.deepEqual(x.host,owner.host);assert.deepEqual(x.target,owner.nativeTarget)}
  assert.equal(physical.occurrence,owner.occurrence);assert.equal(physical.physicalCompletion,true);assert.equal(physical.pairedCleanupComplete,true)
  assert.equal(fresh.hostState,'dead_or_reused');assert.equal(fresh.targetState,'dead_or_reused');assert.equal(fresh.listenerCount,0);assert.equal(fresh.authPresent,false);assert.equal(fresh.modelsPresent,false);assert.equal(fresh.occurrence,owner.occurrence)
  db=new Database(path.join(run,'runtime/data/opencorvus.db'),{readonly:true});db.exec('BEGIN')
  const task=db.query('SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?').get(taskID) as Record<string,unknown>|null
  const sessions=db.query(tree+' SELECT s.id,s.parent_id,s.project_id,s.kind FROM session s JOIN scoped_sessions t ON t.id=s.id ORDER BY s.time_created,s.id').all(taskID) as Record<string,unknown>[]
  const events=db.query("SELECT id,type,seq,emitted_at,json_extract(payload,'$.execution_epoch') AS epoch FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(taskID) as Record<string,unknown>[]
  const owners=db.query(tree+' SELECT o.session_id FROM session_prompt_owner o JOIN scoped_sessions t ON t.id=o.session_id').all(taskID)
  const counts=db.query(tree+" SELECT json_extract(p.data,'$.type') AS type,COUNT(*) AS count FROM part p JOIN message m ON m.id=p.message_id JOIN scoped_sessions s ON s.id=m.session_id WHERE json_extract(p.data,'$.type') IN ('source-url','source-file','source-document') GROUP BY type ORDER BY type").all(taskID) as {type:string,count:number}[]
  const documents=db.query(tree+" SELECT p.id AS partID,m.session_id AS sessionID,p.message_id AS messageID,json_extract(p.data,'$.mediaType') AS mediaType,json_extract(p.data,'$.provider') AS provider FROM part p JOIN message m ON m.id=p.message_id JOIN scoped_sessions s ON s.id=m.session_id WHERE json_extract(p.data,'$.type')='source-document' ORDER BY p.time_created,p.id").all(taskID)
  const classCounts=Object.fromEntries(['source-url','source-file','source-document'].map(type=>[type,counts.find(x=>x.type===type)?.count??0]))
  save(path.join(out,`${n}-facts.json`),{case:n,access:'readonly BEGIN/ROLLBACK exact Task descendants',task,sessions,events,promptOwners:owners,classCounts,documents,withheld:'sourceId,title,filename,providerMetadata,fileIDs,content,URL,path'})
  assert.ok(task);assert.equal(task.project_id,projectID);assert.equal(task.request_id,selection.requestID);assert.equal(task.session_id,complete.pinned.rootSessionID);assert.equal(task.product_pillar,selection.productPillar)
  assert.ok(sessions.length>0);for(const s of sessions)assert.equal(s.project_id,projectID)
  assert.deepEqual(sessions.map(s=>s.id).sort(),[...complete.sessionIDs].sort());assert.deepEqual(owners,[])
  assert.equal(events[0]?.id,complete.pinned.openedEventID);assert.equal(events[0]?.epoch,1);assert.equal(events[0]?.emitted_at,complete.pinned.openedAt)
  assert.equal(events.at(-1)?.id,complete.lifecycle.terminalEventID);assert.equal(events.at(-1)?.type,'task.completed');assert.equal(events.at(-1)?.epoch,1);assert.equal(events.at(-1)?.emitted_at,complete.lifecycle.terminalAt)
  results.push({case:n,state:'qualified',taskID,sessionCount:sessions.length,classCounts})
 }catch(error){const blocked={case:n,state:'blocked',errorType:error instanceof Error?error.name:'UnknownError',code:'OWNED_HISTORY_CENSUS_SCOPE_BLOCKED',message:'Exact custody or persisted scope contract failed; retained scalar facts identify the boundary'};save(path.join(out,`${n}-blocked.json`),blocked);results.push(blocked)}finally{if(db){try{db.exec('ROLLBACK')}finally{db.close()}}}
}
save(path.join(out,'census-results.json'),results)
console.log(JSON.stringify(results,null,2))
