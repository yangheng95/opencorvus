import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/dialog-opener-focus-531-'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const preservation=read(root+'/data-preservation-observation.json')
const scopes=[]
for(const [stage,page] of [['before',132],['after',133]]){
 const proof=read(base+stage+'-service/evidence/physical-terminal.json')
 const logs=fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
 const assets=logs.filter(row=>row.service==='server'&&row.data?.path?.startsWith('/ui/assets/main-')&&row.data.status==='completed').map(row=>({time:row.time,path:row.data.path,statusCode:row.data.statusCode}))
 const errors=logs.filter(row=>row.level==='error').map(row=>({time:row.time,service:row.service,message:row.message,errorName:typeof row.data?.error==='object'?row.data.error?.name:undefined}))
 const data=preservation.scopes.find(scope=>scope.stage===stage)
 scopes.push({stage,page,pageState:'Closed',originalServiceHandle:proof.originalHandle,originalServiceExit:proof.originalExit,shutdownStatus:proof.shutdown.statusCode,native:proof.native,chain:proof.chain,launcher:proof.launcher,provider:proof.provider,assets,runtimeErrors:errors,data:{tables:Object.keys(data.counts).length,originalRows:Object.values(data.counts).reduce((n,v)=>n+v.original,0),originalRowDifferences:data.originalRowDifferences,providerActivities:data.counts.provider_activity_request,source:data.source,schema:data.schema,canonical:data.canonical},manualObservations:read(root+'/'+stage+'-manual-observations.json'),browserErrors:read(root+'/'+stage+'-browser-errors.json')})
}
const events=[];const seen=new Set()
for(const name of fs.readdirSync(root).filter(name=>/^before-console-.*\.json$/.test(name))){
 const rows=read(root+'/'+name)
 for(const row of rows){const key=JSON.stringify([row.timestamp,row.message,row.url]);if(row.message?.includes('DF531')&&!seen.has(key)){seen.add(key);events.push(row)}}
}
const result={at:new Date().toISOString(),scope:'dialog-opener-focus-531',screenshots:20,actualRequests:0,maximumRequests:0,authority:'No auth/catalog copy or Provider preflight',beforeDiagnosticEvents:events,scopes,limits:['No Goal creation, mutation, run or LLM qualification; no new Session/message/Task/Mission','CommandPalette custom close owner checked with mouse and composer hotkey; FileEditor dirty owner reviewed in code only','No new live qualification of disconnected/hidden/disabled opener or newer focus owner branches','The before passive diagnostic builder targets parent b161e40d0; do not apply it to the changed callback split','Zero-model page model-configuration banner is expected isolation context; browser/runtime logs are classified separately','User page/process/database at18571 untouched; sources are fully settled QA copies; no blanket Sources/Rendering completion claim']}
fs.writeFileSync(root+'/result-observation.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({events:events.length,scopes:scopes.map(s=>({stage:s.stage,service:s.originalServiceHandle,exit:s.originalServiceExit,shutdown:s.shutdownStatus,assets:s.assets,errors:s.runtimeErrors,browserErrors:s.browserErrors,data:s.data}))}))
