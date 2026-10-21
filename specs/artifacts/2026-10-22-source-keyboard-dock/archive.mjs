import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-source-keyboard-dock',run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-keyboard-dock-517-before'
const auth=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/auth.json','utf8')),values=[auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20).map(v=>Buffer.from(v));assert(values.length>=3)
const scan=data=>assert.equal(values.some(value=>data.includes(value)),false,'Actual credential values in delivery')
function input(file){const data=fs.readFileSync(file);scan(data);return data}
function write(name,data){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);scan(bytes);fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'})}
function json(name,data){write(name,JSON.stringify(data,null,2)+'\n')}
function compressed(name,data){scan(data);const bytes=gzipSync(data);assert(gunzipSync(bytes).equals(data));write(name,bytes)}
for(const name of ['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','serve.ts','preserve.ts','copy-ui.mjs','plan.json','before-data-preparation.json','manual-observations.json','browser-errors.json','archive.mjs',...fs.readdirSync(root).filter(name=>name.endsWith('.png'))])write(name,input(root+'/'+name))
compressed('physical-terminal.json.gz',input(run+'-service/evidence/physical-terminal.json'))
compressed('data-preservation-observation.json.gz',input(root+'/data-preservation-observation.json'))
const preservation=JSON.parse(fs.readFileSync(root+'/data-preservation-observation.json','utf8'))
json('data-summary.json',preservation.scopes.map(scope=>({stage:scope.stage,source:scope.source,schema:scope.schema,canonical:scope.canonical,tables:Object.keys(scope.counts).length,originalRows:Object.values(scope.counts).reduce((sum,v)=>sum+v.original,0),originalRowDifferences:scope.originalRowDifferences,countChanges:Object.entries(scope.counts).filter(([,v])=>v.original!==v.current),providerActivities:scope.counts.provider_activity_request})))
const terminal=JSON.parse(fs.readFileSync(run+'-service/evidence/physical-terminal.json','utf8'))
json('resource-summary.json',{at:new Date().toISOString(),originalHandle:5655,originalExit:terminal.originalExit,shutdown:terminal.shutdown,native:terminal.native,launcher:terminal.launcher,chain:terminal.chain,provider:terminal.provider,page:109,pageClosed:true,authority:'No auth/models copied;no new model inputs or messages',unusedAfter:'No new production root cause;after not prepared or started',sourceUI:'Same formal main-DhV28lza;no product source change'})
const rows=fs.readFileSync(run+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
const errors=rows.filter(r=>r.level==='error').map(r=>({time:r.time,service:r.service,message:r.message,path:r.data?.path,statusCode:r.data?.statusCode,error:r.data?.error}))
json('network-observation.json',{at:new Date().toISOString(),requests:rows.filter(r=>r.service==='server'&&r.message==='request'&&r.data?.status==='completed').map(r=>({time:r.time,path:r.data.path,method:r.data.method,statusCode:r.data.statusCode,duration:r.data.duration})),errors})
console.log(JSON.stringify({files:fs.readdirSync(out).length,errors:errors.map(r=>({service:r.service,message:r.message,status:r.statusCode,name:r.error?.name})),models:terminal.provider}))
