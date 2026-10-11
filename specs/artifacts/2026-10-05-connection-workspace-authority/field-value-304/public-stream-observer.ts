import fs from 'node:fs/promises'
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/field-value-304-live-01'
const out='D:/myhexin-local/opencorvus/.tmp-product-iteration/field-value-304/live-field-observation.json'
const selected=JSON.parse(await fs.readFile(root+'/task-selection.json','utf8'))
const controller=new AbortController()
const deadline=setTimeout(()=>controller.abort(new Error('Owned stream deadline')),900_000)
const parts=new Map<string,any>()
const startedAt=new Date().toISOString()
let wireBytes=0,events=0,fieldBytes=0,rawBytes=0,terminal:any
const response=await fetch('http://127.0.0.1:18267/task/'+selected.taskID+'/events?directory='+encodeURIComponent(selected.directory)+'&after_live=0',{signal:controller.signal})
if(!response.ok)throw Error('Owned Task stream HTTP '+response.status)
const reader=response.body!.getReader(),decoder=new TextDecoder()
let pending=''
try{
 for(;;){
  const chunk=await reader.read();if(chunk.done)break
  wireBytes+=chunk.value.byteLength;pending+=decoder.decode(chunk.value,{stream:true}).replaceAll('\r\n','\n')
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
     firstSequence:previous?.firstSequence??event.live_sequence??event.liveSequence,lastSequence:event.live_sequence??event.liveSequence,
     firstChars:previous?.firstChars??p.value.length,lastChars:p.value.length,value:p.value,
     fieldBytes:(previous?.fieldBytes??0)+bytes,rawBytes:(previous?.rawBytes??0)+raw,
     discontinuities:[...(previous?.discontinuities??[]),...(previous&&previous.value+p.delta!==p.value?[{at:new Date().toISOString(),previousChars:previous.value.length,chars:p.value.length,delta:p.delta}]:[])]})
   }
   if(['task.completed','task.failed','task.cancelled'].includes(event.type)){terminal={type:event.type,eventID:event.event_id??event.id,at:new Date().toISOString()};break}
  }
  if(terminal)break
 }
}finally{
 controller.abort();clearTimeout(deadline);await reader.cancel();reader.releaseLock()
 await fs.writeFile(out,JSON.stringify({startedAt,endedAt:new Date().toISOString(),taskID:selected.taskID,events,wireBytes,fieldBytes,rawBytes,terminal,parts:[...parts.values()]},null,2)+'\n',{flag:'wx'})
}
console.log(JSON.stringify({events,wireBytes,fieldBytes,rawBytes,terminal,parts:parts.size}))
