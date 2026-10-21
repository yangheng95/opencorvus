import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/markdown-batch-continuity-497-after'
const initial=JSON.parse(fs.readFileSync(root+'/after-request.json','utf8'))
const names=fs.readdirSync(run+'/evidence').filter(n=>/^provider-.*-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.json$/)![1])-Number(b.match(/-(\d+)\.json$/)![1]))
const audit=JSON.parse(fs.readFileSync(run+'/evidence/'+names.at(-1),'utf8'))
assert.equal(audit.maxRequests,8);assert.equal(audit.requests.length,4)
for(const request of audit.requests){assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.streaming,true);assert.equal(request.status,200);assert.equal(request.response_reader.terminal.kind,'eof')}
const messageID=Identifier.ascending('message')
const text='MD497CORRECTION。上一条48段正文自然完成，但参考定义前只有一个换行，仍属于上一段，首参考链接没有解析。本次仅纠正排版格式，请重新完整输出48段相同要求的长文。在第48段末句之后必须输出两个连续换行，即保留一个完全空白行，再输出独立参考定义。参考定义后也保留一个完全空白行再输出MD497REFERENCEEND。请注意首段链接标签与末尾定义大小写一致、定义行不要带句号或其它尾随字符，不要在定义后继续正文。不要调用工具，不改动或删除上一条消息。原完整要求：\n\n'+initial.body.parts[0].text
const body={...initial.body,messageID,parts:[{type:'text',text}]}
fs.writeFileSync(root+'/after-correction-request.json',JSON.stringify({url:initial.url,body,sessionID:initial.sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({messageID,priorActualRequests:4,maximumScopeRequests:8,maximumBatchRequests:16,at:new Date().toISOString()}))
const response=await fetch(initial.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/after-correction-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
