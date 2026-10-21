import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2];assert(['before','after'].includes(stage));const root=import.meta.dirname,run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-current-validation-521-'+stage
const rows=fs.readFileSync(run+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
const patches=rows.filter(r=>r.service==='server'&&r.message==='request'&&r.data?.method==='PATCH'&&r.data?.path==='/global/config'&&r.data?.status==='completed');assert.equal(patches.length,4)
const requests=patches.map(row=>{
 const phases={}
 for(const r of rows){if(r.service!=='skill-read-diagnostics'||r.data?.http?.requestID!==row.data.requestID)continue;const p=phases[r.data.phase]??={started:0,completed:0,rejected:0,durationSumMs:0,durationMaxMs:0};if(r.data.status==='started')p.started++;else {p[r.data.status==='completed'?'completed':'rejected']++;p.durationSumMs+=r.data.duration??0;p.durationMaxMs=Math.max(p.durationMaxMs,r.data.duration??0)}}
 return{requestID:row.data.requestID,time:row.time,path:row.data.path,status:row.data.statusCode,duration:row.data.duration,phases}
})
const rounds=['cold','repeat'].map(round=>{const dir=root+'/'+stage+'-'+round,write=JSON.parse(fs.readFileSync(dir+'/run-write.json','utf8')),read=JSON.parse(fs.readFileSync(dir+'/run-reader-results.json','utf8')),admission=JSON.parse(fs.readFileSync(dir+'/run-reader-admission.json','utf8'));return{round,write,read,admission,latency:{save:write.writeMs<=10000,restore:write.restoreMs<=5000,reads:read.results.map(r=>({path:r.path,passed:r.ms<=20000}))}}})
const original=JSON.parse(fs.readFileSync(root+'/'+stage+'-original-private.json','utf8'))
const result={at:new Date().toISOString(),stage,originalProjects:original.original.project.length,inventory:rows.filter(r=>r.message==='global mutation project inventory').map(r=>({time:r.time,...r.data})),rounds,requests,errors:rows.filter(r=>r.level==='error').map(r=>({time:r.time,service:r.service,message:r.message,data:r.data})),boundary:'Existing production DEBUG phases;no new probe;duration sums can overlap and are not CPU or exclusive wall time;phase counts explain work and do not substitute real latency/correctness',schema:3}
fs.writeFileSync(root+'/'+stage+'-observation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({stage,inventory:result.inventory,rounds:rounds.map(r=>({round:r.round,save:r.write.writeMs,restore:r.write.restoreMs,accepted:r.write.accepted,restored:r.write.restored,latency:r.latency})),work:requests.map(r=>({id:r.requestID,duration:r.duration,initial:r.phases['project.identity.initial'],admitted:r.phases['project.identity.admitted'],git:r.phases['project.identity.git']})),errors:result.errors.length}))
