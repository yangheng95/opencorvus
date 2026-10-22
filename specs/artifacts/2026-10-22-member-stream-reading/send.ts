import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/member-stream-reading-524-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,12)
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message')
const text='READING524START。本次是对当前既有普通成员的一次有限来源阅读输入，不是新的委派。请先用read读取当前自有隔离项目README.md的前30行，再用webfetch读取https://arxiv.org/abs/2509.11035v1。按工具真实结果解释两项来源各自说明了什么、可以支持哪些结论及局限；若网页失败如实说明，不用其他URL重试。不要修改任何文件、运行命令、委派/创建成员或Task/Mission/Goal。完成读取后连续写24节中文文章，三级标题依次为“阅读第01节”到“阅读第24节”，每节约180字，围绕区分原文、来源、推断、建议及长文阅读作具体说明，不声称你实际操作或验收过界面。每节后附三行JavaScript代码围栏，只用局部字符串/数组展示阅读记录，不访问网络/文件。不要省略中间节、不要只列提纲、不人为等待，最后另起一段写READING524END。所有模型文本和工具结果保持正常可见。'
const body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19005:19007)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:12,dispatchAt:new Date().toISOString()}))
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
