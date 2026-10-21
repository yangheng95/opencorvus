import fs from 'node:fs'
const root=import.meta.dirname,events=new Map()
for(const name of fs.readdirSync(root).filter(n=>/^before-console-\d+\.json$/.test(n)))for(const row of JSON.parse(fs.readFileSync(root+'/'+name,'utf8'))){if(!row.message.startsWith('MD503 '))continue;const data=JSON.parse(row.message.slice(6));events.set(row.timestamp+'\0'+row.message,{...data,timestamp:row.timestamp})}
const rows=[...events.values()].sort((a,b)=>a.at-b.at),owners=new Map()
for(const row of rows){if(!owners.has(row.owner))owners.set(row.owner,[]);owners.get(row.owner).push(row)}
const summary={events:rows.length,owners:[...owners].map(([owner,observations])=>({owner,creates:observations.filter(r=>r.kind==='create').length,disposed:observations.filter(r=>r.kind==='dispose').length,bindings:[...new Map(observations.filter(r=>r.partID).map(r=>[r.messageID+'\0'+r.partID,{messageID:r.messageID,partID:r.partID,at:r.at,textLength:r.textLength}])).values()],first:observations[0],last:observations.at(-1)}))}
fs.writeFileSync(root+'/before-observation-description.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({events:summary.events,owners:summary.owners.map(o=>({owner:o.owner,created:o.creates,disposed:o.disposed,bindings:o.bindings.length,firstAt:o.first.at,lastAt:o.last.at,firstLength:o.first.textLength,lastLength:o.last.textLength})).slice(-36)}))
