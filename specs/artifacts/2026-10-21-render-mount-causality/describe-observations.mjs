import fs from 'node:fs'
const root=import.meta.dirname,member='ses_h5G4X4aAZ9tXCnm4rR5G',result={at:new Date().toISOString(),scopes:[],qualification:'Descriptive inspection of emitted private lifecycle/range logs; no DOM/visual assertions, pass/fail test or continuous-frame claim. Source console window500.'}
for(const stage of ['before','after']){
 const files=fs.readdirSync(root).filter(name=>new RegExp('^'+stage+'-console-\\d{3}\\.json$').test(name)).sort(),events=new Map()
 const samples=files.map(file=>{
  const rows=JSON.parse(fs.readFileSync(root+'/'+file,'utf8'))
  for(const row of rows)events.set(row.timestamp+'\0'+row.message,{...JSON.parse(row.message.slice(6)),timestamp:row.timestamp})
  return {file,count:rows.length,first:rows[0]?.timestamp,last:rows.at(-1)?.timestamp}
 })
 const rows=[...events.values()].sort((a,b)=>a.at-b.at),bodies=new Map()
 for(const row of rows.filter(r=>r.kind.startsWith('body-'))){
  if(!bodies.has(row.owner))bodies.set(row.owner,{owner:row.owner,sessionID:row.sessionID,messageID:row.messageID,partID:row.partID,mounts:[],disposals:[],states:[]})
  const body=bodies.get(row.owner),fact={at:row.at,timestamp:row.timestamp,textLength:row.textLength,streaming:row.streaming,htmlBlocks:row.htmlBlocks,pending:row.pending}
  body[row.kind==='body-mount'?'mounts':row.kind==='body-dispose'?'disposals':'states'].push(fact)
 }
 const ranges=rows.filter(r=>r.kind==='virtual-range')
 const retirements=rows.filter(r=>r.kind==='row-dispose').map(row=>({retirement:row,precedingRange:ranges.filter(r=>r.at<=row.at).at(-1)}))
 const scope={stage,samples,eventCount:rows.length,replacements:rows.filter(r=>r.kind==='tree-replaced'),rangeCount:ranges.length,retirements,bodies:[...bodies.values()],memberBodies:[...bodies.values()].filter(r=>r.sessionID===member)}
 result.scopes.push(scope)
 console.log(JSON.stringify({stage,samples:samples.length,eventCount:rows.length,rangeCount:ranges.length,memberOwners:scope.memberBodies.map(r=>({owner:r.owner,partID:r.partID,mounts:r.mounts.length,disposals:r.disposals.length,final:r.states.at(-1)})),retirements:retirements.map(r=>({id:r.retirement.id,epoch:r.retirement.treeEpoch,range:r.precedingRange?.range,rangeItems:r.precedingRange?.items,indexes:r.precedingRange?.indexes,keepMounted:r.precedingRange?.keepMounted}))}))
}
// These descriptions are derived; raw console captures remain original files.
fs.writeFileSync(root+'/observations.json',JSON.stringify(result,null,2)+'\n')
const compact={...result,scopes:result.scopes.map(s=>({...s,samples:s.samples.map((v,i)=>({index:i+1,count:v.count,first:v.first,last:v.last})),rawEvidence:s.stage==='before'?'before-console-010.json':'after-console-008.json',bodies:s.bodies.map(({states,...body})=>({...body,stateCount:states.length,firstState:states[0],finalState:states.at(-1)})),memberBodies:s.memberBodies.map(({states,...body})=>({...body,stateCount:states.length,firstState:states[0],finalState:states.at(-1)}))}))}
fs.writeFileSync(root+'/observations-summary.json',JSON.stringify(compact,null,2)+'\n')
