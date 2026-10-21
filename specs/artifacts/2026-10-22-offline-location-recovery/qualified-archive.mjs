import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-offline-location-recovery'
const plan=JSON.parse(fs.readFileSync(root+'/qualified-plan.json','utf8')),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/offline-location-recovery-515-'
const auth=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/auth.json','utf8'))
const secrets=[auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20).map(value=>Buffer.from(value))
assert(secrets.length>=3)
function scan(data){assert.equal(secrets.some(secret=>data.includes(secret)),false,'Actual credentials in qualified evidence')}
function input(file){const data=fs.readFileSync(file);scan(data);return data}
function write(name,data){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);scan(bytes);fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'})}
function json(name,data){write(name,JSON.stringify(data,null,2)+'\n')}
function compressed(name,data){scan(data);const bytes=gzipSync(data);assert(gunzipSync(bytes).equals(data));write(name,bytes)}
for(const name of ['prepare-qualified.mjs','qualified-plan.json','qualified-prepare-data.ts','qualified-ui-serve.ts','qualified-ui-launch.ps1','qualified-ui-shutdown.ps1','qualified-ui-settle.ps1','qualified-api-launch.ps1','qualified-api-shutdown.ps1','qualified-api-settle.ps1','qualified-api-prepare-authority.mjs','qualified-api-retire-authority.mjs','qualified-preserve.ts','qualified-archive.mjs','qualified-api-authority-preparation.json','qualified-api-authority-retirement.json','qualified-task-recovery.json','qualified-browser-error-observation.json','14-qualified-task-offline.png','15-qualified-task-restored.png'])write(name,input(root+'/'+name))
const terminals={ui:input(base+'qualified-ui-service/evidence/physical-terminal.json').toString('utf8'),api:input(base+'qualified-api/evidence/physical-terminal-and-pair-cleanup.json').toString('utf8')}
compressed('qualified-physical-terminals.json.gz',Buffer.from(JSON.stringify(terminals)))
compressed('qualified-data-preparations.json.gz',Buffer.from(JSON.stringify(Object.fromEntries(['qualified-ui','qualified-api'].map(stage=>[stage,input(root+'/'+stage+'-data-preparation.json').toString('utf8')])))))
compressed('qualified-data-preservation-observation.json.gz',input(root+'/qualified-data-preservation-observation.json'))
const preservation=JSON.parse(fs.readFileSync(root+'/qualified-data-preservation-observation.json','utf8'))
json('qualified-data-summary.json',preservation.scopes.map(scope=>({stage:scope.stage,source:scope.source,schema:scope.schema,canonical:scope.canonical,tables:Object.keys(scope.counts).length,originalRows:Object.values(scope.counts).reduce((n,v)=>n+v.original,0),originalRowDifferences:scope.originalRowDifferences,countChanges:Object.entries(scope.counts).filter(([,v])=>v.original!==v.current)})))
const requests=[],errors=[]
for(const stage of ['qualified-ui','qualified-api'])for(const row of fs.readFileSync(base+stage+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(text=>JSON.parse(text))){
 if(row.service==='server'&&row.message==='request'&&row.data?.status==='completed')requests.push({stage,time:row.time,requestID:row.data.requestID,method:row.data.method,path:row.data.path,statusCode:row.data.statusCode,duration:row.data.duration})
 if(row.level==='error')errors.push({stage,time:row.time,service:row.service,message:row.message,path:row.data?.path,statusCode:row.data?.statusCode,error:row.data?.error})
}
json('qualified-network-observation.json',{at:new Date().toISOString(),requests,errors,browserErrors:JSON.parse(fs.readFileSync(root+'/qualified-browser-error-observation.json','utf8'))})
write('qualified-preflight-ready.json',input(base+'qualified-api/evidence/preflight-ready.json'))
const api=JSON.parse(terminals.api),ui=JSON.parse(terminals.ui)
json('qualified-resource-summary.json',{at:new Date().toISOString(),originalHandles:{ui:14464,api:49642},originalExitCodes:{ui:0,api:0},ui:{port:18971,originalHandle:ui.originalHandle,native:ui.native,shutdown:ui.shutdown,provider:ui.provider,chain:ui.chain},api:{port:18973,maximum:api.maximumRequests,actual:api.requests,providerQualificationPassed:api.providerQualificationPassed,qualificationFailures:api.qualificationFailures,provider:api.provider,pairedCleanupComplete:api.pairedCleanupComplete,copiedPair:api.copiedPair,chain:api.chain},page:107,pageClosed:true,task:'tsk_g00VYhrJxy00qIC54qvM',manual:'Original Task URL cold Offline,then first healthy automatically restored original Completed Task/body and configured gpt-6.1-sol;no Task selection click or new business Task',budget:'2/8 actual streamed preflight/helper requests;unused capacity retired;prior seven scopes remain 0/0',surface:'Same formal main-DhV28lza;Source CLI;real settings;no response interception'})
console.log(JSON.stringify({requests:requests.length,errors:errors.map(row=>({stage:row.stage,service:row.service,message:row.message,statusCode:row.statusCode,errorName:row.error?.name})),actualModelRequests:api.requests,maximum:api.maximumRequests,providerQualificationPassed:api.providerQualificationPassed,data:preservation.scopes.map(scope=>({stage:scope.stage,differences:scope.originalRowDifferences,countChanges:Object.entries(scope.counts).filter(([,v])=>v.original!==v.current)}))}))
