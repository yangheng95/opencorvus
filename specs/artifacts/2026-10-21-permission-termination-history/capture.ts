import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,stage=process.argv[2];assert(stage==='before'||stage==='after')
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/permission-termination-history-505-'+stage,port=stage==='before'?18913:18915,taskID='tsk_g00VYeMccK0078SroWDw'
const response=await fetch('http://127.0.0.1:'+port+'/task/'+taskID+'/board'),board=await response.json() as any
assert.equal(response.status,200);assert.equal(board.task.status,'cancelled')
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 const requestID='per_h9Tts9cnzyWtqrAjnwjN',interaction=board.interactions.find((item:any)=>item.externalID===requestID)
 assert.equal(interaction.status,'rejected');assert.equal(interaction.response.decision,'deny')
 const winner=db.query('SELECT * FROM permission_ledger WHERE decision_slot=?').get(requestID) as any
 assert.equal(winner.event_type,'cancelled');assert.equal(winner.id,'per_g0VYeVhyT00XzS04yhz9')
 const before=stage==='after'?JSON.parse(fs.readFileSync(root+'/before-public-facts.json','utf8')):undefined
 let oldValidator:any,newValidator:any
 if(stage==='after'){
  assert.deepEqual(interaction.response.termination,{status:winner.event_type,ledgerEventID:winner.id,reason:winner.reason})
  assert.deepEqual(interaction.time,before.interaction.time);assert.equal(interaction.id,before.interaction.id)
  assert.deepEqual(board.task.executionLifecycle,before.board.task.executionLifecycle)
  for(const prior of before.board.interactions.filter((item:any)=>item.type==='permission'&&item.status==='answered')){
   const current=board.interactions.find((item:any)=>item.id===prior.id)
   assert.deepEqual(current.response,prior.response);assert.deepEqual(current.time,prior.time)
  }
  const changed=await fetch('http://127.0.0.1:'+port+'/task/'+taskID+'/board',{headers:{'if-none-match':before.etag}})
  oldValidator={status:changed.status,etag:changed.headers.get('etag'),interaction:(await changed.json() as any).interactions.find((item:any)=>item.id===interaction.id)};assert.equal(changed.status,200)
  const current=await fetch('http://127.0.0.1:'+port+'/task/'+taskID+'/board',{headers:{'if-none-match':response.headers.get('etag')!}})
  newValidator={status:current.status,etag:current.headers.get('etag')};assert.equal(current.status,304)
 }
 const winners=db.query('SELECT id,request_id,event_type,reason,time_created FROM permission_ledger WHERE decision_slot IN (SELECT request_id FROM permission_ledger WHERE event_type=\'requested\' AND task_id=?) ORDER BY time_created,id').all(taskID)
 if(before)assert.deepEqual(winners,before.taskWinners)
 const result={at:new Date().toISOString(),stage,http:response.status,etag:response.headers.get('etag'),board,interaction,originalWinner:winner,taskWinners:winners,oldValidator,newValidator}
 fs.writeFileSync(root+'/'+stage+'-public-facts.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({stage,http:response.status,task:board.task.status,interaction:{id:interaction.id,externalID:requestID,status:interaction.status,response:interaction.response,time:interaction.time},oldValidator:oldValidator?.status,currentValidator:newValidator?.status}))
}finally{db.close(true)}
