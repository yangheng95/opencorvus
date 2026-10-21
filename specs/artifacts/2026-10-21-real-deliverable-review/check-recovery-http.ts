import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-recovery-data'
const owner=JSON.parse(fs.readFileSync(root+'/task-create-corrected-response.json','utf8')).result
const origin='http://127.0.0.1:18893',receipts=[]
async function api(route:string,body?:unknown){
 const response=await fetch(origin+route+'?directory='+encodeURIComponent(owner.directory),{method:body===undefined?'GET':'POST',
  headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(90000)})
 const result={route,at:new Date().toISOString(),status:response.status,requestID:response.headers.get('x-opencorvus-request-id'),body:await response.json()}
 receipts.push(result);fs.writeFileSync(root+'/recovery-http-receipts.json',JSON.stringify(receipts,null,2)+'\n');return result
}
const board=await api('/task/'+owner.task_id+'/board');assert.equal(board.status,200)
const terminal=(board.body as any).task;assert.equal(terminal.lifecycleStatus,'cancelled')
const interaction=(board.body as any).interactions.find((i:any)=>i.id==='int_g0VYeNJZT003I5AZCoPJ')
assert.equal(interaction.status,'rejected');assert.equal(interaction.response.decision,'deny')
const late=await api('/interaction/'+interaction.id+'/reply',{decision:'allow_once'})
assert.equal(late.status,200);assert.equal((late.body as any).status,'rejected');assert.equal((late.body as any).response.decision,'deny')
const replay=await api('/task/'+owner.task_id+'/cancel',{surface:'api',reason:'Replay original private QA cancellation'})
assert.equal(replay.status,202);assert.equal((replay.body as any).status,'cancelled')
const db=new Database(base+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const ledger=db.query('SELECT id,event_type,decision_slot,actor_id,reason FROM permission_ledger WHERE request_id=? ORDER BY rowid').all('per_h9Tts9cnzyWtqrAjnwjN') as any[]
 assert.deepEqual(ledger.map(r=>r.event_type),['requested','cancelled'])
 const providerActivity=(db.query('SELECT count(*) count FROM provider_activity').get() as any).count
 fs.writeFileSync(root+'/recovery-http-summary.json',JSON.stringify({at:new Date().toISOString(),owner,task:terminal,interaction,ledger,providerActivity,http:receipts.map(r=>({route:r.route,status:r.status})),modelInputs:0},null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({task:terminal.lifecycleStatus,interaction:interaction.status,actualDecision:interaction.response.decision,ledger:ledger.map(r=>r.event_type),http:receipts.map(r=>r.status),providerActivity,modelInputs:0}))
}finally{db.close(true)}
