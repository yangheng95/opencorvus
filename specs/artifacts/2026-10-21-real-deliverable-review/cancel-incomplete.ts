import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const root=import.meta.dir,accepted=JSON.parse(fs.readFileSync(root+'/task-create-corrected-response.json','utf8')).result
assert.equal(accepted.task_id,'tsk_g00VYeMccK0078SroWDw')
assert(accepted.directory.replaceAll('\\','/').startsWith('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/real-deliverable-review-501-before/runtime/data/projects/'))
const body={surface:'api',reason:'The QA operator ends this incomplete private run before its fixed12-request scope can be exhausted. Four actual internal memory requests made the original test budget insufficient;retain all evidence and repeat the original two-file acceptance in a separately reviewed finite scope.'}
const response=await fetch('http://127.0.0.1:18889/task/'+accepted.task_id+'/cancel?directory='+encodeURIComponent(accepted.directory),{method:'POST',headers:{'content-type':'application/json','x-opencorvus-request-id':randomUUID()},body:JSON.stringify(body)}),result=await response.json()
fs.writeFileSync(root+'/incomplete-cancellation.json',JSON.stringify({at:new Date().toISOString(),taskID:accepted.task_id,request:body,status:response.status,result},null,2)+'\n',{flag:'wx'})
assert.equal(response.status,202)
console.log(JSON.stringify({status:response.status,result}))
