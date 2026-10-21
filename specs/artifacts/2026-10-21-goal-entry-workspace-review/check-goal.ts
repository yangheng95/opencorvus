import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/home-goal-entry-496-after'
const sessionID='ses_-zURMAPDezzYEZEGiYFw',goalID='pev_g0VYdpb8c00tG1GJp5RS'
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try {
 const owner=db.query('SELECT project_id,directory,kind FROM session WHERE id=?').get(sessionID) as any
 assert.equal(owner.kind,'assistant')
 const response=await fetch('http://127.0.0.1:18873/continuous-goal/chat/'+sessionID+'?directory='+encodeURIComponent(owner.directory))
 assert.equal(response.status,200)
 const goal=await response.json() as any
 assert.equal(goal.id,goalID);assert.equal(goal.status,'complete');assert.equal(goal.turnBudget,1);assert.equal(goal.turnsAccepted,1)
 const events=(db.query("SELECT id,type,seq,payload FROM protocol_event WHERE aggregate_id=? AND type LIKE 'continuous_goal.%' ORDER BY seq").all(sessionID) as any[]).map(e=>({...e,payload:JSON.parse(e.payload)}))
 assert.equal(events.filter(e=>e.type==='continuous_goal.created').length,1)
 assert.equal(events.filter(e=>e.type==='continuous_goal.continuation_requested').length,1)
 const completed=events.findLast(e=>e.type==='continuous_goal.updated')!
 assert.equal(completed.payload.input.status,'complete')
 const requests=(db.query('SELECT r.id,r.data FROM tool_part_request r JOIN message m ON m.id=r.message_id WHERE m.session_id=? ORDER BY r.time_created').all(sessionID) as any[]).map(r=>({id:r.id,...JSON.parse(r.data)}))
 assert.deepEqual(requests.map(r=>r.tool),['webfetch','update_continuous_goal'])
 assert.equal(requests[0].input.url,'https://example.com/')
 const outcomes=requests.map(r=>{
  const row=db.query('SELECT data FROM tool_part_outcome WHERE request_part_id=?').get(r.id) as any
  const result=JSON.parse(row.data);assert.equal(result.outcome,'completed');return {tool:r.tool,outcome:result.outcome}
 })
 const usage=db.query("SELECT u.id,u.agent_id,u.total_tokens,CASE WHEN e.id IS NULL THEN 'outside-current-goal-at-request-start' ELSE 'associated' END AS scope FROM provider_usage_event u LEFT JOIN protocol_event e ON e.type='continuous_goal.usage' AND json_extract(e.payload,'$.usage_id')=u.id AND json_extract(e.payload,'$.goal_id')=? WHERE u.session_id=? ORDER BY u.occurred_at,u.id").all(goalID,sessionID) as any[]
 assert.equal(usage.filter(r=>r.scope==='associated').reduce((s,r)=>s+r.total_tokens,0),goal.tokensUsed)
 const files=fs.readdirSync(run+'/evidence').filter(n=>/^provider-.*-\d+\.json$/.test(n)).sort((a,b)=>Number(a.split('-').at(-1)!.split('.')[0])-Number(b.split('-').at(-1)!.split('.')[0]))
 const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+files.at(-1),'utf8'))
 assert.equal(audit.maxRequests,10);assert(audit.requests.length<=10)
 for(const r of audit.requests){assert.equal(r.model,'gpt-6.1-sol');assert.equal(r.streaming,true);assert.equal(r.status,200);assert.equal(r.response_reader.state,'settled');assert.equal(r.response_reader.terminal.kind,'eof')}
 const result={observedAt:new Date().toISOString(),http:{status:response.status,goal},owner:{kind:owner.kind},events,outcomes,usage,provider:{maximum:10,actual:audit.requests.length,requests:audit.requests.map((r:any)=>({model:r.model,streaming:r.streaming,status:r.status,reader:r.response_reader}))},boundary:'Real UI-confirmed isolated goal;read-only public HTTP and persisted production facts. No synthetic messages,model substitutes or UI assertions.'}
 fs.writeFileSync(root+'/goal-runtime.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({status:goal.status,turnsAccepted:goal.turnsAccepted,tokensUsed:goal.tokensUsed,outcomes,requests:audit.requests.length,associatedUsage:usage.filter(r=>r.scope==='associated').length}))
}finally{db.close(true)}
