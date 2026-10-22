import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/clipboard-literal-525-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const first='<div data-label="&quot; &amp; &lt; &gt; &#39;">中文🙂</div>',second='&amp;lt; &amp;gt; &amp;amp; &quot; &#39;'
const text=['COPY525START','这是当前既有普通成员的一次有限字符阅读输入，不是新的委派。请先原样回显下列两块围栏，保留每一个实体串、字符、空格、引号与换行，不把实体解释成对应字符。','```html',first,'```','```text',second,'```','然后连续写24节中文文章，三级标题依次“字符阅读第01节”到“字符阅读第24节”，每节约180字，说明原文字符、实体写法、转义层次、引用和推断的区别。不调用工具、不读写文件、不运行命令、不委派或创建成员/Task/Mission/Goal，不声称实际操作或验收了任何界面。正文正常连续输出，不人为等待，不省略中间节或只列提纲，最后另起一行COPY525END。'].join('\n')
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message'),body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19009:19011)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,literalMaterials:{first,second},at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as any
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
