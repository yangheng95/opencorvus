import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/goal-reconciliation-admission-499-after-data'
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false}),cases:any[]=[]
const events=db.query('SELECT id,type,aggregate_type,aggregate_id,seq,payload FROM protocol_event ORDER BY emitted_at,id').all() as any[]
const deletedTasks=new Set(events.filter(e=>e.type==='task.deleted').map(e=>e.aggregate_id)),deletedSessions=new Set(events.filter(e=>e.type==='session.deleted').map(e=>e.aggregate_id))
const sessions=new Map((db.query('SELECT * FROM session').all() as any[]).map(row=>[row.id,row]))
const latest=new Map<string,any>()
for(const e of events)if(e.type==='continuous_goal.created'){const key=e.aggregate_type+'\0'+e.aggregate_id;if(!latest.has(key)||e.seq>latest.get(key).seq)latest.set(key,e)}
async function get(route:string,directory:string){
 const url='http://127.0.0.1:18883/'+route+'?directory='+encodeURIComponent(directory)
 const response=await fetch(url),body=await response.json() as any
 return {url,status:response.status,body}
}
try{
 const parent='ses_-zUS0X33CzzWEKMgCk98',parentSession=sessions.get(parent)!
 const empty=await get('continuous-goal/chat/'+parent,parentSession.directory);assert.equal(empty.status,200);assert.equal(empty.body,null)
 cases.push({case:'same original empty Chat read',status:empty.status,value:empty.body,sessionID:parent})
 let chat:any
 for(const kind of ['chat','task','mission']){
  const candidates=[...latest.values()].map(e=>({e,payload:JSON.parse(e.payload)})).filter(({payload})=>payload.owner.kind===kind)
  const viable=candidates.map(({e,payload})=>{
   const id=payload.owner.id,task=kind==='task'?db.query('SELECT * FROM engine_task WHERE id=?').get(id) as any:undefined
   const session=sessions.get(task?.session_id??id)
   return {e,id,task,session}
  }).filter(({id,task,session})=>session&&session.time_archived===null&&!deletedSessions.has(session.id)&&(kind!=='task'||(task&&task.time_archived===null&&!deletedTasks.has(id))))
  assert(viable.length>0,'Real source must contain a readable '+kind+' Goal owner')
  const owner=viable.at(-1)!,response=await get('continuous-goal/'+kind+'/'+encodeURIComponent(owner.id),owner.session.directory)
  assert.equal(response.status,200);assert.equal(response.body.id,owner.e.id);assert.equal(response.body.owner.kind,kind);assert.equal(response.body.owner.id,owner.id)
  cases.push({case:'persisted '+kind+' Goal',kind,ownerID:owner.id,status:response.status,goalID:response.body.id,goalStatus:response.body.status,tokensUsed:response.body.tokensUsed,turnsAccepted:response.body.turnsAccepted,tokenBudget:response.body.tokenBudget,turnBudget:response.body.turnBudget,directory:owner.session.directory})
  if(kind==='chat')chat=owner
 }
 const peer=[...sessions.values()].find(s=>s.project_id!==chat.session.project_id&&s.directory!==chat.session.directory&&fs.existsSync(s.directory))!
 assert(peer,'Actual registered second Project required')
 const wrong=await get('continuous-goal/chat/'+chat.id,peer.directory)
 assert.equal(wrong.status,409);assert.equal(wrong.body.name,'ContinuousGoalError');assert.equal(wrong.body.data.code,'owner_unavailable')
 cases.push({case:'same owner under actual peer Project',status:wrong.status,name:wrong.body.name,code:wrong.body.data.code,directory:peer.directory})
 const model=await get('session/'+parent+'/config',parentSession.directory)
 assert.equal(model.status,400);assert.equal(model.body.name,'ProviderModelNotFoundError');assert.equal(model.body.data.providerID,'openai');assert.equal(model.body.data.modelID,'gpt-6.1-sol')
 cases.push({case:'original runtime model resolution',status:model.status,name:model.body.name,providerID:model.body.data.providerID,modelID:model.body.data.modelID})
 fs.writeFileSync(root+'/real-read-check.json',JSON.stringify({at:new Date().toISOString(),boundary:'Real Source CLI public HTTP plus original persisted owner identities. Full canonical preserved;no Provider credential/models staging or model input.',cases},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(cases.map(({case:name,status,kind,goalStatus,name:errorName,code})=>({case:name,status,kind,goalStatus,errorName,code}))))
}finally{db.close(true)}
