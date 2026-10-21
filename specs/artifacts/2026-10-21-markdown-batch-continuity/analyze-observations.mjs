import fs from 'node:fs'
const root=import.meta.dirname,result={boundary:'Offline description of actual passive logs;no UI test,DOM assertion or pass/fail threshold',phases:[]}
for(const phase of ['before','after','correction']){
 const names=fs.readdirSync(root).filter(n=>n.startsWith(phase+'-observation-')&&n.endsWith('.json')),events=new Map()
 for(const name of names)for(const row of JSON.parse(fs.readFileSync(root+'/'+name,'utf8')))if(row.message.startsWith('MD497 '))events.set(row.timestamp+'\0'+row.message,{timestamp:row.timestamp,...JSON.parse(row.message.slice(6))})
 const owners=new Map()
 for(const row of [...events.values()].sort((a,b)=>a.at-b.at)){
  if(!owners.has(row.owner))owners.set(row.owner,[])
  owners.get(row.owner).push(row)
 }
 result.phases.push({phase,observedFiles:names,events:events.size,owners:[...owners].map(([owner,rows])=>{
  const commits=rows.filter(row=>row.kind==='commit'),shrinks=commits.filter(row=>row.after<row.before)
  return {owner,observations:rows.length,creates:rows.filter(r=>r.kind==='create').length,disposes:rows.filter(r=>r.kind==='dispose').length,first:commits[0],last:commits.at(-1),shrinks,finalWindow:commits.filter(r=>r.textLength===commits.at(-1)?.textLength).slice(0,22)}
 })})
}
fs.writeFileSync(root+'/presentation-observation.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result.phases.map(p=>({phase:p.phase,events:p.events,owners:p.owners.map(o=>({owner:o.owner,commits:o.observations,final:o.last&&{blocks:o.last.after,textLength:o.last.textLength},shrinks:o.shrinks.map(s=>({before:s.before,after:s.after,at:s.at}))}))}))))
