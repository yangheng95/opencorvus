import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
import {ownedJSON} from './http-json'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-parallel-owner-532-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const text='PARALLEL532START。这是既有普通成员一次有限公开文档阅读，不是新委派。请在同一步并行各调用一次webfetch，读取 https://www.w3.org/TR/wai-aria-1.2/ 和 https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText ，各URL只调用一次；失败如实记下，不用其他URL重试。不读取/修改项目文件、不执行命令、不创建/委派成员、Task、Mission或Goal。根据实际结果输出6节中文，三级标题依次“并行来源第01节”至“并行来源第06节”，每节约150字，区分引用内容和你自己的推断，不声称实际操作/验收界面。最后另起一段PARALLEL532END。所有正文与工具结果保持正常可见。'
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message'),body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19037:19039)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const {response,result}=await ownedJSON(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},host.deadlineAt)
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
