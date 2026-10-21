import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
const stage=process.argv[2];assert(stage==='before'||stage==='after')
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/markdown-batch-continuity-497-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message')
const text='MD497REFERENCE。这是当前既有普通成员的一次有限排版阅读验收，不是新委派。只输出文字，不调用任何工具，不读写文件或运行命令，不创建或委派成员，不创建Task、Mission、Goal。请一次连续写48个中文短段落，每段约100字，依次以“第01段”到“第48段”开头，每段之间空一行，介绍阅读长文时如何区分原文、来源与展示建议，不声称实际操作过界面。第一段必须包含这段Markdown参考链接：[阅读入口][md497-reference]。前47段中不要定义该链接，也不要使用其他链接。第48段写完后另起一行在文末写唯一的参考定义：[md497-reference]: https://example.com/ 。定义后另起一段写MD497REFERENCEEND。不要把全文包进代码围栏，不用列表或表格，不插入解释，不人为等待。'
const body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?18875:18877)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
