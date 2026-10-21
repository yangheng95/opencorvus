import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/member-locale-stream-516-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message')
const text='LOCALE516START。继续当前既有普通成员的一次有限排版阅读验收，不是新的委派。仅在可见正文输出，不调用任何工具、不读取写入文件、不运行命令、不委派或创建成员、不创建Task/Mission/Goal。请连续写24节中文文章，依次用三级标题“第01节”到“第24节”。每节写约180字，说明阅读长文时如何区分原文、来源与展示建议，不声称你实际操作或验收过界面。每节正文后给一个三行JavaScript示例代码围栏，只用局部字符串/数组演示对应阅读概念，不访问网络或文件。每节独立完整，不省略中间各节，不做提纲。最后另起一段写LOCALE516END。正常连续输出，不人为等待、不总结工具结果。'
const body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?18975:18977)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
