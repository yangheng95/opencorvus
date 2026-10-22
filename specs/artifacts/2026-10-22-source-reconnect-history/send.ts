import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
import {ownedJSON} from './http-json'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-reconnect-history-535-'+stage
assert.equal(stage,'after','One explicit after input only')
const plan=JSON.parse(fs.readFileSync(root+'/plan.json','utf8'))
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,plan.maximumRequestsPerStartedScope)
const text=fs.readFileSync(root+'/objective.txt','utf8').trim()
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message'),body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19049:19049)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:plan.maximumRequestsPerStartedScope,dispatchAt:new Date().toISOString()}))
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const {response,result}=await ownedJSON(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},host.deadlineAt)
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
