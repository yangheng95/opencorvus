import fs from 'node:fs'
const root=import.meta.dirname,names=fs.readdirSync(root).filter(n=>/^after-console-\d+\.json$/.test(n)).sort()
const samples=names.map(name=>({name,...JSON.parse(fs.readFileSync(root+'/'+name,'utf8'))}))
const byEvent=new Map()
for(const sample of samples)for(const log of sample.logs){
 const prefix='LV508 ',index=log.message.indexOf(prefix);if(index<0)continue
 const event=JSON.parse(log.message.slice(index+prefix.length));byEvent.set(log.timestamp+'\0'+log.message,{...event,timestamp:log.timestamp})
}
const events=[...byEvent.values()].sort((a,b)=>a.document-b.document||a.at-b.at)
const grouped=new Map()
for(const event of events){if(!event.sessionID)continue;const key=JSON.stringify([event.document,event.owner]);const list=grouped.get(key)??[];list.push(event);grouped.set(key,list)}
const owners=[...grouped.entries()].map(([key,rows])=>({identity:JSON.parse(key),bindings:[...new Set(rows.map(r=>JSON.stringify([r.sessionID,r.messageID,r.partID])))].map(s=>JSON.parse(s)),first:rows[0],last:rows.at(-1),mounts:rows.filter(r=>r.kind==='body-mount').map(r=>r.timestamp),disposals:rows.filter(r=>r.kind==='body-dispose').map(r=>r.timestamp),emptyWhilePending:rows.filter(r=>r.pending&&r.htmlBlocks===0).map(r=>({at:r.timestamp,textLength:r.textLength,streaming:r.streaming})),blockCounts:[...new Set(rows.map(r=>r.htmlBlocks))]}))
const result={at:new Date().toISOString(),sampleWindows:samples.map(s=>({name:s.name,at:s.at,logs:s.logs.length,first:s.logs[0]?.timestamp,last:s.logs.at(-1)?.timestamp})),events,owners,disposeSemantics:'Last normal observer-state facts cached before cleanup; disposal does not evaluate reactive getters'}
fs.writeFileSync(root+'/after-console-description.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({events:events.length,samples:result.sampleWindows,memberOwners:owners.filter(o=>o.bindings.some(b=>b[0]==='ses_hMgssyDsC0xd7DISDP6d'||b[0]==='ses_hLCAejj9kewYbP2FByPb')).map(o=>({identity:o.identity,bindings:o.bindings,mounts:o.mounts,disposals:o.disposals,first:o.first.timestamp,last:o.last.timestamp,blocks:o.blockCounts,cold:o.emptyWhilePending.length}))}))
