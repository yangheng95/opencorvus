import fs from 'node:fs'
import assert from 'node:assert/strict'
import {ownedJSON} from './http-json'
const stage=process.argv[2],label=process.argv[3];assert(['before','after'].includes(stage));assert(/^[a-z0-9-]+$/.test(label))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/permission-focus-dismissal-530-'+stage
const request=JSON.parse(fs.readFileSync(root+'/'+stage+'-request.json','utf8')),host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const url=new URL(request.url);url.pathname='/permission'
const {response,result}=await ownedJSON(url,{method:'GET'},host.deadlineAt);assert.equal(response.status,200)
const observation={at:new Date().toISOString(),status:response.status,inputMessageID:request.body.messageID,dispatchAt:request.at,elapsedMs:Date.now()-Date.parse(request.at),pending:result.filter((p:any)=>p.sessionID===request.sessionID)}
fs.writeFileSync(root+'/'+stage+'-'+label+'-pending.json',JSON.stringify(observation,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({at:observation.at,status:response.status,elapsedMs:observation.elapsedMs,pending:observation.pending.map((p:any)=>({id:p.id,sessionID:p.sessionID,tool:p.toolName,created:p.timeCreated,host:p.scope.resource.endpoint?.hostname}))}))
