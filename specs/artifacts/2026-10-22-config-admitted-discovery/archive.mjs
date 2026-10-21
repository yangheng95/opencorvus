import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-config-admitted-discovery',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-'
const auth=JSON.parse(fs.readFileSync('C:/Users/hengu/.codex/auth.json','utf8')),values=[auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20).map(v=>Buffer.from(v));assert(values.length>=3)
function scan(data){assert.equal(values.some(v=>data.includes(v)),false,'Actual credentials in evidence')}
function input(file){const data=fs.readFileSync(file);scan(data);return data}
function write(name,data){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);scan(bytes);fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'})}
function json(name,data){write(name,JSON.stringify(data,null,2)+'\n')}
function compressed(name,data){scan(data);const bytes=gzipSync(data);assert(gunzipSync(bytes).equals(data));write(name,bytes)}
for(const name of ['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','copy-ui.mjs','build-after.mjs','start-round.mjs','inspect.mjs','archive.mjs','plan.json','after-tool-pre-admission-failure.json','before-browser-errors.json','after-browser-errors.json','backend-typecheck.log','git-discovery-tests.log','git-discovery-tests-fixed.log','git-discovery-tests-final.log','filesystem-identity-tests.log',...fs.readdirSync(root).filter(name=>name.endsWith('.png'))])write(name,input(root+'/'+name))
compressed('build-after.log.gz',input(root+'/build-after.log'))
const resources=[],data=[],memory=[]
for(const stage of ['before','after']){
 for(const name of ['data-preparation','authority-preparation','authority-retirement','observation'])write(stage+'-'+name+'.json',input(root+'/'+stage+'-'+name+'.json'))
 write(stage+'-preflight-ready.json',input(base+stage+'/evidence/preflight-ready.json'))
 compressed(stage+'-physical-terminal.json.gz',input(base+stage+'/evidence/physical-terminal-and-pair-cleanup.json'))
 compressed(stage+'-data-preservation.json.gz',input(root+'/'+stage+'-data-preservation-observation.json'))
 const physical=JSON.parse(fs.readFileSync(base+stage+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
 resources.push({stage,port:stage==='before'?18983:18985,originalHandle:stage==='before'?5047:78859,originalExit:0,publicShutdown:200,native:physical.native,launcher:physical.launcher,chain:physical.chain,maximum:physical.maximumRequests,actual:physical.requests,providerQualificationPassed:physical.providerQualificationPassed,qualificationFailures:physical.qualificationFailures,provider:physical.provider,runtimePair:physical.copiedPair,pairedCleanupComplete:physical.pairedCleanupComplete,page:stage==='before'?110:111,pageClosed:true})
 const preservation=JSON.parse(fs.readFileSync(root+'/'+stage+'-data-preservation-observation.json','utf8')).scopes[0]
 data.push({stage,source:preservation.source,schema:preservation.schema,canonical:preservation.canonical,tables:Object.keys(preservation.counts).length,originalRows:Object.values(preservation.counts).reduce((n,v)=>n+v.original,0),originalRowDifferences:preservation.originalRowDifferences,countChanges:Object.entries(preservation.counts).filter(([,v])=>v.original!==v.current),providerActivities:preservation.counts.provider_activity_request})
 for(const round of ['cold','repeat']){
  const dir=stage+'-'+round;fs.mkdirSync(out+'/'+dir)
  for(const name of fs.readdirSync(root+'/'+dir))if(/\.(?:ts|mjs|json)$/.test(name))write(dir+'/'+name,input(root+'/'+dir+'/'+name))
 }
}
json('resource-summary.json',{at:new Date().toISOString(),batchMaximum:8,actual:resources.reduce((n,v)=>n+v.actual,0),unused:'All unused quota retired with original scopes;no business model input',resources})
json('data-summary.json',data)
json('validation-summary.json',{at:new Date().toISOString(),sourceBase:'26a82ae3ef0fbf15272b3ea5ce91fb22ace24680',production:'Only exact registered worktrees use their physically checked durable row as the candidate;complete current Git/occurrence/registry validation remains under original admission',tests:{git:{pass:10,skip:1,fail:0,assertions:28},filesystem:{pass:6,fail:0,assertions:8},initialFixtureFailure:'Inherited registration omitted occurrence;original guard retained;fixed producer and reran original suite;logs preserved'},build:{runner:'Node formal Vite configuration',exit:0,publication:'main-DhV28lza',displayedDuration:'1m8s',sourceUIChanges:'None'},backendTypecheck:{exit:0},manual:{files:9,fullLayoutViews:8,partial:'05-after-general.png captured only a header fragment;retained as observation,not full layout qualification;05b captured complete page',pages:[110,111],actualInteractions:'General Ask,Providers during writer and after catalog load,complete Ask restore;all saved images viewed'},thresholds:{saveMs:10000,restoreMs:5000,readMs:20000},performance:'After both rounds correct complete canonical restoration and readers pass20s;save10s/restore5s remain failed;see original observations and checker exit contracts',tools:'After writer occurrence prefix rejected before PATCH due overbroad proof-name generator;original reader98482/service78859 preserved;exact repair snapshots and failure record retained',limits:['No Mission/native WebView2 or new business Task/stream qualification','No claim of all original fields equal in target:normal availability and capacity metadata differences preserved','DEBUG mixed workload timings;phase sums overlap and are not exclusive CPU or disk costs']})
console.log(JSON.stringify({files:fs.readdirSync(out).length,actual:resources.reduce((n,v)=>n+v.actual,0),maximum:8,allProviderQualified:resources.every(v=>v.providerQualificationPassed),data:data.map(v=>({stage:v.stage,tables:v.tables,originalRows:v.originalRows,canonical:v.canonical,differences:v.originalRowDifferences}))}))
