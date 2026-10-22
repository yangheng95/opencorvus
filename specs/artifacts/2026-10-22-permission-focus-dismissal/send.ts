import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
import {ownedJSON} from './http-json'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/permission-focus-dismissal-530-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const text='PERMISSION530START。这是既有普通成员的一次有限公开来源阅读输入，不是新的委派。请用webfetch各读取一次 https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ 和 https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText ，按实际工具结果说明各自能支持什么结论；若失败如实记录，不用其他URL重试。不读写项目文件、不运行命令、不新建或委派成员/Task/Mission/Goal。最后输出4节中文，三级标题依次“权限阅读第01节”至“权限阅读第04节”，每节约150字，说明读取状态、来源身份和原文与推断边界，不声称实际操作或验收界面，另起一段PERMISSION530END。所有正文和工具结果保持正常可见。'
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message'),body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19029:19031)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const {response,result}=await ownedJSON(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},host.deadlineAt)
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
