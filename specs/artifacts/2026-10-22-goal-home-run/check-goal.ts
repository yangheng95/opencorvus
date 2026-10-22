import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
import {ownedJSON} from './http-json'
const root=import.meta.dir,stage=process.argv[2],label=process.argv[3],expected=process.argv[4],expectedTurns=process.argv[5]===undefined?undefined:Number(process.argv[5]),settled=process.argv[6]==='settled',preserveLabel=process.argv[7]
assert(['before','after'].includes(stage));assert(/^[a-z0-9-]+$/.test(label));if(expected)assert(['active','paused','blocked','budget_limited','complete'].includes(expected))
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/goal-home-run-533-'+stage
const original=JSON.parse(fs.readFileSync(root+'/'+stage+'-original-private.json','utf8')),host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
let selected:any,session:any,messages:any[],events:any[]
try{
 db.exec('BEGIN')
 const known=new Set(original.original.protocol_event.filter((row:any)=>row.type==='continuous_goal.created').map((row:any)=>row.id))
 const added=(db.query("SELECT id,aggregate_id,emitted_at,payload FROM protocol_event WHERE type='continuous_goal.created' ORDER BY emitted_at,id").all() as any[]).filter(row=>!known.has(row.id))
 assert.equal(added.length,1,'One actual UI-created Goal identity')
 selected=added[0];selected.payload=JSON.parse(selected.payload)
 assert.equal(selected.payload.owner.kind,'chat');assert.equal(selected.payload.owner.id,selected.aggregate_id)
 assert.equal(selected.payload.input.objective,fs.readFileSync(root+'/objective.txt','utf8').trim())
 session=db.query('SELECT id,project_id,directory,title FROM session WHERE id=?').get(selected.aggregate_id)
 assert(session,'Goal owns a persisted Chat Session')
 messages=(db.query('SELECT id,time_created,data FROM message WHERE session_id=? ORDER BY time_created,id').all(session.id) as any[]).map(row=>{const data=JSON.parse(row.data);return{id:row.id,created:row.time_created,role:data.role,author:data.author,parentID:data.parentID,finish:data.finish,completed:data.time?.completed,errorName:data.error?.name,parts:(db.query('SELECT id,data FROM part WHERE message_id=? ORDER BY time_created,id').all(row.id) as any[]).map(part=>({id:part.id,...JSON.parse(part.data)}))}})
 events=(db.query("SELECT id,type,aggregate_type,aggregate_id,seq,emitted_at,payload FROM protocol_event WHERE (aggregate_id=? OR aggregate_id=?) AND type LIKE 'continuous_goal.%' ORDER BY emitted_at,seq").all(session.id,selected.id) as any[]).map(row=>({...row,payload:JSON.parse(row.payload)}))
}finally{db.exec('ROLLBACK');db.close(true)}
const url=new URL('http://127.0.0.1:'+(stage==='before'?19041:19043)+'/continuous-goal/chat/'+session.id);url.searchParams.set('directory',session.directory)
const {response,result:goal}=await ownedJSON(url,{method:'GET'},host.deadlineAt)
assert.equal(response.status,200);assert.equal(goal.id,selected.id);assert.equal(goal.owner.kind,'chat');assert.equal(goal.owner.id,session.id);assert.equal(goal.sessionID,session.id);assert.equal(goal.objective,selected.payload.input.objective)
if(expected)assert.equal(goal.status,expected,'Public Goal domain state')
if(expectedTurns!==undefined)assert.equal(goal.turnsAccepted,expectedTurns,'Accepted automatic continuation count')
assert(Number.isSafeInteger(goal.tokensUsed)&&goal.tokensUsed>=0)
const knownMessages=new Set(original.original.message.map((row:any)=>row.id))
const addedControllers=messages.filter(row=>row.author==='goal-controller'&&!knownMessages.has(row.id))
const controllerIDs=new Set(addedControllers.map(row=>row.id))
const goalReplies=messages.filter(row=>row.role==='assistant'&&controllerIDs.has(row.parentID))
if(settled){
 assert.equal(addedControllers.length,expectedTurns,'Current Goal real controller input count')
 assert.equal(goalReplies.length,expectedTurns,'Current Goal real assistant reply count')
 for(const reply of goalReplies){assert.equal(reply.finish,'stop');assert(Number.isFinite(reply.completed),'Persisted Goal reply completion')}
 assert(goal.tokensUsed>0,'Real Goal usage captured')
}
if(preserveLabel){assert(/^[a-z0-9-]+$/.test(preserveLabel));const prior=JSON.parse(fs.readFileSync(root+'/'+stage+'-'+preserveLabel+'-goal.json','utf8'));assert.equal(goal.id,prior.goal.id);assert.equal(goal.tokensUsed,prior.goal.tokensUsed,'Completed Goal retains its original usage');assert.equal(goal.turnsAccepted,prior.goal.turnsAccepted)}
const identityPath=root+'/'+stage+'-goal-identity.json'
if(fs.existsSync(identityPath)){const previous=JSON.parse(fs.readFileSync(identityPath,'utf8'));assert.equal(previous.goalID,goal.id);assert.equal(previous.sessionID,session.id)}else fs.writeFileSync(identityPath,JSON.stringify({goalID:goal.id,sessionID:session.id,directory:session.directory,projectID:session.project_id,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
const result={at:new Date().toISOString(),stage,label,measurement:'Readonly public HTTP and actual SQLite Goal/Session/events/messages;not UI assertions or a mutation driver',url:String(url),status:response.status,goal,session,messages,events,currentGoalMessages:{controllerIDs:[...controllerIDs],replyIDs:goalReplies.map(row=>row.id)},settledCheck:settled,usagePreservedFrom:preserveLabel}
fs.writeFileSync(root+'/'+stage+'-'+label+'-goal.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({at:result.at,label,status:response.status,goal:{id:goal.id,revision:goal.revision,state:goal.status,turns:goal.turnsAccepted,turnBudget:goal.turnBudget,tokens:goal.tokensUsed},sessionID:session.id,controllers:messages.filter(row=>row.author==='goal-controller').length,assistantReplies:messages.filter(row=>row.role==='assistant').map(row=>({id:row.id,finish:row.finish,completed:row.completed,errorName:row.errorName})),events:events.length}))
