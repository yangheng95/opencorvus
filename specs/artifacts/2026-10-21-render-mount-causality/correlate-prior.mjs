import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../task-member-stream-504'),file='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/task-member-stream-504-before/runtime/log/dev.log'
const rows=fs.readFileSync(file,'utf8').split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return[]}}).filter(r=>r.time>='2026-10-21T05:49:15.000Z'&&r.time<='2026-10-21T05:53:00.000Z')
const mounts=JSON.parse(fs.readFileSync(prior+'/before-main-mount-description.json','utf8')).owners
const fullReads=rows.filter(r=>r.service==='server'&&r.data?.path==='/task/tsk_g00VYf0QVV00zBt1vWF3/conversation').map(r=>({time:r.time,method:r.data.method,status:r.data.status,statusCode:r.data.statusCode,requestID:r.data.requestID,duration:r.data.duration}))
const errors=rows.filter(r=>r.service==='overlay:runtime').map(r=>({time:r.time,message:r.message,errorMessage:r.data?.message,details:r.data?.details}))
const nearby=mounts.filter(item=>item.dispose).map(item=>({owner:item.owner,dispose:item.dispose.timestamp,nextOwner:mounts[mounts.indexOf(item)+1]?.owner,requests:rows.filter(r=>r.service==='server'&&r.data?.status==='completed'&&Math.abs(Date.parse(r.time)-Date.parse(item.dispose.timestamp))<400).map(r=>({time:r.time,path:r.data.path,method:r.data.method,statusCode:r.data.statusCode}))}))
const result={at:new Date().toISOString(),source:file,window:{from:'2026-10-21T05:49:15.000Z',through:'2026-10-21T05:53:00.000Z'},originalMounts:mounts,fullConversationReads:fullReads,overlayErrors:errors,nearby,qualification:'Original recorded times/requests. Temporal proximity is not a causal proof; no original virtual ranges or per-frame film exists.'}
fs.writeFileSync(root+'/prior-correlation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({originalOwners:mounts.length,fullReads:fullReads.length/2,overlayErrors:errors.length,messages:[...new Set(errors.map(e=>e.errorMessage))]}))
