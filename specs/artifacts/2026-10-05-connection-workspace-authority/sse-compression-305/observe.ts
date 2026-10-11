import fs from 'node:fs/promises'
import http from 'node:http'
import { createGunzip } from 'node:zlib'
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/sse-compression-305-live-01'
const out='D:/myhexin-local/opencorvus/.tmp-product-iteration/sse-compression-305/live-compression-observation.json'
const selected=JSON.parse(await fs.readFile(root+'/task-selection.json','utf8'))
const parts=new Map<string,any>()
const startedAt=new Date().toISOString()
let wireBytes=0,decodedBytes=0,events=0,fieldBytes=0,rawBytes=0,terminal:any
const url='http://127.0.0.1:18268/task/'+selected.taskID+'/events?directory='+encodeURIComponent(selected.directory)+'&after_live=0'
let request:http.ClientRequest
const response=await new Promise<http.IncomingMessage>((resolve,reject)=>{
 request=http.get(url,{headers:{'accept-encoding':'gzip'}},resolve)
 request.on('error',reject)
 request.setTimeout(120_000,()=>request.destroy(new Error('Owned stream inactivity')))
})
if(response.statusCode!==200||response.headers['content-encoding']!=='gzip')throw Error('Actual compressed Task stream required')
const decoder=createGunzip()
const closed=Promise.withResolvers<void>()
response.once('close',()=>closed.resolve())
response.on('error',error=>decoder.destroy(error))
response.on('data',chunk=>wireBytes+=chunk.byteLength)
response.pipe(decoder)
const deadline=setTimeout(()=>request.destroy(new Error('Owned stream deadline')),900_000)
const text=new TextDecoder()
let pending=''
try{
 for await(const chunk of decoder){
  decodedBytes+=chunk.byteLength
  pending+=text.decode(chunk,{stream:true}).replaceAll('\r\n','\n')
  let i:number
  while((i=pending.indexOf('\n\n'))>=0){
   const frame=pending.slice(0,i);pending=pending.slice(i+2)
   const data=frame.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');if(!data)continue
   const event=JSON.parse(data);events++
   if(event.type==='message.part.delta'){
    const p=event.payload;if(typeof p.value!=='string')throw Error('Required complete value missing')
    const key=JSON.stringify([p.sessionID,p.messageID,p.partID,p.field]);const previous=parts.get(key)
    const bytes=Buffer.byteLength(p.value),raw=Buffer.byteLength(p.delta)
    fieldBytes+=bytes;rawBytes+=raw
    parts.set(key,{sessionID:p.sessionID,messageID:p.messageID,partID:p.partID,field:p.field,count:(previous?.count??0)+1,
     firstChars:previous?.firstChars??p.value.length,lastChars:p.value.length,value:p.value,
     fieldBytes:(previous?.fieldBytes??0)+bytes,rawBytes:(previous?.rawBytes??0)+raw,
     discontinuities:[...(previous?.discontinuities??[]),...(previous&&previous.value+p.delta!==p.value?[{at:new Date().toISOString(),previousChars:previous.value.length,chars:p.value.length,delta:p.delta}]:[])]})
   }
   if(['task.completed','task.failed','task.cancelled'].includes(event.type)){terminal={type:event.type,eventID:event.event_id??event.id,at:new Date().toISOString()};break}
  }
  if(terminal)break
 }
}finally{
 clearTimeout(deadline);response.unpipe(decoder);decoder.destroy();response.destroy();request.destroy();await closed.promise
 await fs.writeFile(out,JSON.stringify({startedAt,endedAt:new Date().toISOString(),taskID:selected.taskID,encoding:response.headers['content-encoding'],vary:response.headers.vary,events,wireBytes,decodedBytes,fieldBytes,rawBytes,terminal,parts:[...parts.values()]},null,2)+'\n',{flag:'wx'})
}
console.log(JSON.stringify({events,wireBytes,decodedBytes,ratio:wireBytes/decodedBytes,terminal,parts:parts.size}))
