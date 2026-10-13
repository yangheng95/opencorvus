import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-product-iteration/fork-latency-407')
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14'
const profile=JSON.parse(fs.readFileSync(path.join(root,'fork-latency-407-before/evidence/before.cpuprofile'),'utf8'))
const operation=JSON.parse(fs.readFileSync(path.join(scratch,'copy-health-before.json'),'utf8'))
const start=Date.parse(operation.copied.startedAt)*1000,end=Date.parse(operation.copied.completedAt)*1000
const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map()
for(const n of profile.nodes)for(const child of n.children??[])parents.set(child,n.id)
const sampleCounts=new Map(),self=new Map(),inclusive=new Map();let time=profile.startTime,matched=0,maxDelta=0,total=0
for(let i=0;i<profile.samples.length;i++){
 const delta=profile.timeDeltas[i],next=time+delta,overlap=Math.max(0,Math.min(next,end)-Math.max(time,start))
 if(overlap>0){const id=profile.samples[i];matched++;total+=overlap;maxDelta=Math.max(maxDelta,delta);sampleCounts.set(id,(sampleCounts.get(id)||0)+1);self.set(id,(self.get(id)||0)+overlap);for(let n=id;n!==undefined;n=parents.get(n))inclusive.set(n,(inclusive.get(n)||0)+overlap)}
 time=next
}
const frame=id=>({id,...nodes.get(id).callFrame,samples:sampleCounts.get(id)||0,selfMs:(self.get(id)||0)/1000,inclusiveMs:(inclusive.get(id)||0)/1000})
const hot=[...self.keys()].sort((a,b)=>self.get(b)-self.get(a)).slice(0,15).map(id=>{const stack=[];for(let n=id;n!==undefined;n=parents.get(n))stack.push(frame(n));return {leaf:frame(id),stack}})
const app=[...inclusive.keys()].filter(id=>nodes.get(id).callFrame.url.includes('/packages/opencorvus/src/')).sort((a,b)=>inclusive.get(b)-inclusive.get(a)).slice(0,28).map(frame)
const logs=fs.readFileSync(path.join(root,'long-source-reading-406-live/runtime/log/dev.log'),'utf8').split(/\r?\n/).flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}}).filter(e=>Date.parse(e.time)*1000>=profile.startTime&&e.service==='server'&&e.message==='request'&&(/side-chat|global\/health/.test(e.data?.path)))
const result={window:{startedAt:operation.copied.startedAt,completedAt:operation.copied.completedAt,profileStart:profile.startTime,profileEnd:profile.endTime,matchedSamples:matched,coveredMs:total/1000,maxSampleGapMs:maxDelta/1000},app,hot,requests:logs,boundary:'Sampling and request timing, not an automated UI assertion. Durations include sampling gaps; inspect stacks and actual write statements before attributing CPU cost.'}
fs.writeFileSync(path.join(scratch,'profile-analysis.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({window:result.window,app:app.slice(0,15),hot:hot.slice(0,5).map(x=>({leaf:x.leaf,stack:x.stack.map(f=>`${f.functionName} ${f.url}:${f.lineNumber+1}`)}))},null,2))
