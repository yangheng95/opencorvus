import fs from 'node:fs'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/startup-location-discovery-510-',out={observedAt:new Date().toISOString(),stages:[]}
for(const stage of ['before','after']){
 const events=fs.readFileSync(base+stage+'-service/runtime-dev-private.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const requests=events.filter(e=>e.service==='server'&&e.message==='request'&&e.data?.status==='completed')
 const completed=requests.map(e=>({time:e.time,requestID:e.data.requestID,method:e.data.method,path:e.data.path,status:e.data.statusCode,durationMs:e.data.duration}))
 const discoveryErrors=events.filter(e=>e.service==='server'&&e.data?.path==='/global/projects/discover'&&e.level==='error').map(e=>({time:e.time,requestID:e.data.requestID,status:e.data.statusCode,error:e.data.error}))
 const initErrors=events.filter(e=>e.service==='overlay:runtime'&&(e.message==='initApp'||e.data?.message?.includes('global/projects/discover'))).map(e=>({time:e.time,message:e.message,data:e.data}))
 out.stages.push({stage,initialRequests:completed.filter(e=>!e.path.startsWith('/ui/')&&!e.path.startsWith('/favicon')).slice(0,28),discovery:completed.filter(e=>e.path==='/global/projects/discover'),healthProbes:completed.filter(e=>e.path==='/global/health'),discoveryErrors,initErrors})
}
fs.writeFileSync(root+'/startup-request-observation.json',JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify(out.stages.map(s=>({stage:s.stage,discovery:s.discovery,healthProbes:s.healthProbes.length,discoveryErrors:s.discoveryErrors.length,initErrors:s.initErrors.length}))))
