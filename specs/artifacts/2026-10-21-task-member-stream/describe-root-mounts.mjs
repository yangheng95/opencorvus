import fs from 'node:fs'
const root=import.meta.dirname,rows=new Map(),messageID='msg_g0VYf0Re800qDS7AJB5z'
for(const name of fs.readdirSync(root).filter(name=>/^before-console-\d+\.json$/.test(name)))for(const row of JSON.parse(fs.readFileSync(root+'/'+name,'utf8'))){if(!row.message.startsWith('MD504 '))continue;rows.set(row.timestamp+'\0'+row.message,{...JSON.parse(row.message.slice(6)),timestamp:row.timestamp})}
const events=[...rows.values()].sort((a,b)=>a.at-b.at),owners=new Set(events.filter(row=>row.messageID===messageID).map(row=>row.owner))
const description=[...owners].map(owner=>{const observations=events.filter(row=>row.owner===owner);return {owner,mount:observations.find(row=>row.kind==='mount'),firstBinding:observations.find(row=>row.messageID),dispose:observations.find(row=>row.kind==='dispose')}})
const result={at:new Date().toISOString(),messageID,owners:description,boundary:'Actual original main request renderer mounts, not member9–12. Main viewport virtualization exists; original exact recycling trigger unproven. Warm accepted HTML on remount is distinguished from a visible Rendering flash. No UI assertions, no continuous-frame claim.'}
fs.writeFileSync(root+'/before-main-mount-description.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({messageID,owners:description.map(row=>({owner:row.owner,at:row.mount?.timestamp,htmlBlocks:row.mount?.htmlBlocks,pending:row.mount?.pending,disposed:!!row.dispose})),boundary:result.boundary}))
