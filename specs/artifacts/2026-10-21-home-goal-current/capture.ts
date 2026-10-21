import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/home-goal-current-506-after',partID='prt_g0VYeNHpt00RNOnwctXO'
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try {
 const row=db.query('SELECT r.id,r.message_id messageID,m.session_id sessionID,o.data FROM tool_part_request r JOIN tool_part_outcome o ON o.request_part_id=r.id JOIN message m ON m.id=r.message_id WHERE r.id=?').get(partID) as any
 assert(row)
 const original=JSON.parse(row.data)
 const params=new URLSearchParams({directory:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before/runtime/data/projects/2026/10/21/914ad776-f3b7-4073-a514-c2f97c293905'})
 const response=await fetch(`http://127.0.0.1:18919/session/${row.sessionID}/message/${row.messageID}/part/${partID}?${params}`),part=await response.json() as any
 assert.equal(response.status,200);assert.equal(part.id,partID);assert.equal(part.sessionID,row.sessionID);assert.equal(part.messageID,row.messageID);assert.equal(part.state.status,'error');assert.equal(original.outcome,'failed');assert.deepEqual(part.state.failure,original.failure)
 const result={at:new Date().toISOString(),http:response.status,id:part.id,sessionID:part.sessionID,messageID:part.messageID,tool:part.tool,transportStatus:part.state.status,persistedOutcome:original.outcome,failure:part.state.failure,qualification:'Exact original canonical Tool failure, retained by the actual public message-Part read; UI labels are qualified only by manual screenshots'}
 fs.writeFileSync(root+'/public-original-tool.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({http:response.status,id:part.id,status:part.state.status,failure:{kind:part.state.failure.kind,name:part.state.failure.name},originalFailure:'Exact full canonical value'}))
}finally{db.close(true)}
