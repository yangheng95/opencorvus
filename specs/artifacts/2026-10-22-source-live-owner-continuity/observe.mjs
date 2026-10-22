import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname
const captures=[],union=new Map()
for(const name of fs.readdirSync(root).filter(n=>/^console-\d+\.json$/.test(n)).sort()){
 const rows=JSON.parse(fs.readFileSync(root+'/'+name))
 captures.push({name,rows:rows.length,first:rows[0]?.timestamp,last:rows.at(-1)?.timestamp,assets:[...new Set(rows.map(r=>r.url))]})
 for(const row of rows){const key=JSON.stringify([row.timestamp,row.message,row.url]);union.set(key,{...JSON.parse(row.message.slice(6)),timestamp:row.timestamp,url:row.url})}
}
const events=[...union.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.at-b.at)
const input=JSON.parse(fs.readFileSync(root+'/before-request.json'))
const active=events.filter(e=>e.timestamp>=input.at)
const groups=Object.groupBy(active,e=>e.kind),owners=Object.groupBy(active.filter(e=>e.kind.startsWith('body')),e=>e.owner)
const response=JSON.parse(fs.readFileSync(root+'/before-response-private.json'))
const text=response.result.parts.filter(p=>p.type==='text').map(p=>p.text).join('\n')
const facts=JSON.parse(fs.readFileSync(root+'/manual-observations.json'))
const result={at:new Date().toISOString(),measurement:'Read-only event/DOM observations,not UI assertions or continuous-frame capture',captures,totalUniqueEvents:events.length,inputAt:input.at,activeEventCounts:Object.fromEntries(Object.entries(groups).map(([key,rows])=>[key,rows.length])),activeBindings:groups['part-binding']??[],activeDisposals:active.filter(e=>e.kind.endsWith('dispose')),bodyOwners:Object.entries(owners).map(([owner,rows])=>({owner,partIDs:[...new Set(rows.map(e=>e.partID))],messageIDs:[...new Set(rows.map(e=>e.messageID))],events:rows})),snapshots:facts.map(f=>({stage:f.stage,at:f.at,scroll:f.dom.scroll,sources:f.dom.sourceLabels??f.dom.sources,tailBodies:(f.dom.bodies??f.dom.bodyOwners).slice(-4)})),response:{status:response.status,finish:response.result.info.finish,assistantMessageID:response.result.info.id,textLength:text.length,headings:(text.match(/^### 来源阅读第\d{2}节/gm)??[]).length,codeBlocks:(text.match(/^```/gm)??[]).length/2,starts:text.slice(0,32),ends:text.slice(-40)},scope:'Existing one ordinary member;two public sources;one visible input;not all entries,virtual history shift,concurrent members,reconnect or cold clipboard qualification'}
fs.writeFileSync(root+'/owner-observation.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({captures,totalUniqueEvents:result.totalUniqueEvents,activeEventCounts:result.activeEventCounts,bindings:result.activeBindings,disposals:result.activeDisposals,bodyOwners:result.bodyOwners.map(o=>({owner:o.owner,partIDs:o.partIDs,states:o.events.map(e=>({kind:e.kind,blocks:e.htmlBlocks,streaming:e.streaming,textLength:e.textLength,at:e.timestamp}))})),response:result.response},null,2))
