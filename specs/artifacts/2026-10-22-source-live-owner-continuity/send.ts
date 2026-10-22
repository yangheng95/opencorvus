import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Identifier} from '../../packages/opencorvus/src/id/id'
import {ownedJSON} from './http-json'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-live-owner-continuity-529-'+stage
const preflight=JSON.parse(fs.readFileSync(run+'/evidence/preflight-ready.json','utf8'))
assert.equal(preflight.preflight.credential,'usable');assert.equal(preflight.preflight.catalog,'projected');assert.equal(preflight.preflight.actualModel,'gpt-6.1-sol');assert.equal(preflight.maxRequests,8)
const text='SOURCE529START。本次是既有普通成员的一次有限来源阅读输入，不是新委派。请用webfetch各读取一次https://www.w3.org/WAI/ARIA/apg/patterns/tabs/和https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText，按实际工具结果说明两项来源能支持的结论；若失败如实说明，不重试其他URL。不读写项目文件、不运行命令、不创建或委派成员/Task/Mission/Goal。随后连续输出24节中文，三级标题依次“来源阅读第01节”至“来源阅读第24节”，每节约180字，具体解释来源身份、原文与推断、字符编码和长文阅读。第1节和第12节后各附一个三行JavaScript代码围栏，仅局部字符串示例。不省略中间节、不只列提纲、不人为等待、不声称实际操作或验收任何界面，最后另起一段SOURCE529END。工具结果与正文正常可见。'
const sessionID='ses_-zUS0WzzQzzDOGrIbYwN',messageID=Identifier.ascending('message'),body={messageID,agent:'work',model:{providerID:'openai',modelID:'gpt-6.1-sol'},parts:[{type:'text',text}]},url=new URL('http://127.0.0.1:'+(stage==='before'?19025:19027)+'/session/'+sessionID+'/message')
url.searchParams.set('directory','C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project')
fs.writeFileSync(root+'/'+stage+'-request.json',JSON.stringify({url:String(url),body,sessionID,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,sessionID,messageID,maximumScopeRequests:8,dispatchAt:new Date().toISOString()}))
const host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const {response,result}=await ownedJSON(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},host.deadlineAt)
fs.writeFileSync(root+'/'+stage+'-response-private.json',JSON.stringify({status:response.status,result,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:response.status,assistantMessageID:result.info?.id,finish:result.info?.finish,errorName:result.info?.error?.name,parts:result.parts?.map((p:any)=>({id:p.id,type:p.type,length:p.text?.length}))}))
if(!response.ok||result.info?.error)process.exitCode=1
