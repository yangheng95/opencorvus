import fs from 'node:fs'
const root=import.meta.dirname,events=new Map()
for(const name of fs.readdirSync(root).filter(name=>/^before-console-\d+\.json$/.test(name)))for(const row of JSON.parse(fs.readFileSync(root+'/'+name,'utf8'))){if(!row.message.startsWith('MD504 '))continue;const data=JSON.parse(row.message.slice(6));events.set(row.timestamp+'\0'+row.message,{...data,timestamp:row.timestamp})}
const rows=[...events.values()].sort((a,b)=>a.at-b.at),owners=new Map()
for(const row of rows){if(!owners.has(row.owner))owners.set(row.owner,[]);owners.get(row.owner).push(row)}
const summary={at:new Date().toISOString(),events:rows.length,owners:[...owners].map(([owner,observations])=>({owner,creates:observations.filter(row=>row.kind==='create').length,disposed:observations.filter(row=>row.kind==='dispose').length,bindings:[...new Map(observations.filter(row=>row.partID).map(row=>[row.messageID+'\0'+row.partID,{messageID:row.messageID,sessionID:row.sessionID,partID:row.partID}])).values()],first:observations[0],last:observations.at(-1)}))}
fs.writeFileSync(root+'/before-observation-description.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({events:summary.events,owners:summary.owners.map(owner=>({owner:owner.owner,created:owner.creates,disposed:owner.disposed,bindings:owner.bindings,firstLength:owner.first.textLength,lastLength:owner.last.textLength})),boundary:'Observed events only; browser500-entry windows may have gaps; no UI assertions or continuous-frame proof'}))
