import fs from 'node:fs'
import assert from 'node:assert/strict'
import {Database} from 'bun:sqlite'
import {ownedJSON} from './http-json'
const root=import.meta.dir,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-reconnect-history-535-after'
const request=JSON.parse(fs.readFileSync(root+'/after-request.json','utf8')),host=JSON.parse(fs.readFileSync(run+'/evidence/native-host-ready.json','utf8'))
const url=new URL(request.url),sessionID=request.sessionID;url.searchParams.set('limit','200')
const {response,result}=await ownedJSON(url,{method:'GET'},host.deadlineAt)
assert.equal(response.status,200)
const user=result.find((row:any)=>row.info.id===request.body.messageID)
assert.equal(user.info.role,'user');assert.equal(user.parts.find((part:any)=>part.type==='text')?.text,request.body.parts[0].text)
const replies=result.filter((row:any)=>row.info.parentID===request.body.messageID),final=replies.at(-1)
assert.equal(final.info.finish,'stop');assert(Number.isSafeInteger(final.info.time.completed))
const text=final.parts.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n')
assert(text.includes('RECONNECT535END'));for(let index=1;index<=12;index++)assert(text.includes('重连来源第'+String(index).padStart(2,'0')+'节'))
const tools=replies.flatMap((row:any)=>row.parts.filter((part:any)=>part.type==='tool').map((part:any)=>({messageID:row.info.id,...part})))
assert.equal(tools.length,1);assert.equal(tools[0].tool,'webfetch');assert.equal(tools[0].state.status,'completed')
const sources=replies.flatMap((row:any)=>row.parts.filter((part:any)=>part.type==='source-url').map((part:any)=>({messageID:row.info.id,...part})))
assert.equal(sources.length,1);assert.equal(sources[0].url,'https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/');assert.equal(sources[0].toolPartID,tools[0].id)
const db=new Database(run+'/runtime/data/opencorvus.db',{readonly:true,create:false})
try{
 db.exec('BEGIN')
 const stored=db.query('SELECT data FROM message WHERE id=?').get(final.info.id) as {data:string}
 assert.equal(JSON.parse(stored.data).time.completed,final.info.time.completed)
 const persistedSource=db.query('SELECT data FROM part WHERE id=?').get(sources[0].id) as {data:string}
 assert.equal(JSON.parse(persistedSource.data).sourceId,sources[0].sourceId)
 const resultProjection={at:new Date().toISOString(),status:response.status,scope:'Actual public messages and readonly original SQLite facts for the one535 input',sessionID,inputMessageID:request.body.messageID,inputCreatedAt:user.info.time.created,assistant:replies.map((row:any)=>({id:row.info.id,parentID:row.info.parentID,created:row.info.time.created,completed:row.info.time.completed,finish:row.info.finish,modelID:row.info.modelID,providerID:row.info.providerID,parts:row.parts.map((part:any)=>({id:part.id,type:part.type,...(part.type==='text'?{text:part.text}:{}),...(part.type==='source-url'?{sourceId:part.sourceId,toolPartID:part.toolPartID,url:part.url,title:part.title}:{}),...(part.type==='tool'?{tool:part.tool,status:part.state.status,input:part.state.input,time:part.state.time}:{})}))})),finalTextLength:text.length,sourceIdentity:{id:sources[0].id,sourceId:sources[0].sourceId,toolPartID:sources[0].toolPartID,messageID:sources[0].messageID,url:sources[0].url,title:sources[0].title},toolCount:tools.length,sourceCount:sources.length}
 fs.writeFileSync(root+'/after-checked-result.json',JSON.stringify(resultProjection,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({status:response.status,sessionID,inputMessageID:request.body.messageID,finalMessageID:final.info.id,finish:final.info.finish,finalTextLength:text.length,tools:tools.length,sources:sources.length}))
}finally{db.exec('ROLLBACK');db.close(true)}
