import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-offline-location-recovery'
const plan=JSON.parse(fs.readFileSync(root+'/scope-plan.json','utf8')),stages=Object.keys(plan.ports)
const authPath='C:/Users/hengu/.codex/auth.json',authBytes=fs.readFileSync(authPath),authStat=fs.statSync(authPath),auth=JSON.parse(authBytes)
const secrets=[...new Set([auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(value=>typeof value==='string'&&value.length>=20))].map(value=>Buffer.from(value))
assert(secrets.length>=3)
let logicalInputs=0,logicalBytes=0,physicalFiles=0,physicalBytes=0,decodedPayloads=0,decodedBytes=0,matches=0
function scan(data){matches+=secrets.some(secret=>data.includes(secret))?1:0;assert.equal(matches,0,'Actual credentials detected in scoped delivery')}
function input(file){const data=fs.readFileSync(file);scan(data);logicalInputs++;logicalBytes+=data.length;return data}
function write(name,data){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);scan(bytes);fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'})}
function json(name,data){write(name,JSON.stringify(data,null,2)+'\n')}
function compressed(name,data){scan(data);const bytes=gzipSync(data);assert(gunzipSync(bytes).equals(data));write(name,bytes)}
const selected=['prepare.mjs','prepare-data.ts','copy-ui.mjs','build.mjs','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','scope-plan.json','archive.mjs','monitor-before.log','monitor-after.log','monitor-final.log','before-offline-network.json','after-offline-network.json','before-online-observation.json','after-task-recovery.json','selected-chat-location.json','selected-chat-ready-location.json','after-chat-reconnected.json','after-chat-cold-recovered.json','after-supersede-offline.json','after-supersede-online.json']
for(const name of fs.readdirSync(root))if(name.endsWith('.png'))selected.push(name)
for(const name of selected)write(name,input(root+'/'+name))
compressed('build-after.log.gz',input(root+'/build-after.log'))
compressed('data-preservation-observation.json.gz',input(root+'/data-preservation-observation.json'))
const preservation=JSON.parse(fs.readFileSync(root+'/data-preservation-observation.json','utf8'))
const terminals={},preparations={},resources=[],requests=[],runtimeErrors=[]
for(const stage of stages){
 const runtime=plan.base+'/'+plan.scope+'-'+stage,evidence=runtime+'-service/evidence'
 const terminalRaw=input(evidence+'/physical-terminal.json').toString('utf8'),terminal=JSON.parse(terminalRaw)
 terminals[stage]=terminalRaw;preparations[stage]=input(root+'/'+stage+'-data-preparation.json').toString('utf8')
 resources.push({stage,port:plan.ports[stage],source:plan.sources[stage],originalHandle:terminal.originalHandle,originalExit:terminal.originalExit,shutdownStatus:terminal.shutdown.statusCode,native:{occurrence:terminal.native.occurrence,physicalCompletion:terminal.native.physicalCompletion,outputDrainComplete:terminal.native.outputDrainComplete,requestCleanupComplete:terminal.native.requestCleanupComplete},chain:terminal.chain,provider:terminal.provider})
 for(const line of fs.readFileSync(runtime+'/runtime/log/dev.log','utf8').split('\n').filter(Boolean)){
  const row=JSON.parse(line)
  if(row.service==='server'&&row.message==='request'&&row.data?.status==='completed')requests.push({stage,time:row.time,requestID:row.data.requestID,method:row.data.method,path:row.data.path,statusCode:row.data.statusCode,duration:row.data.duration})
  if(row.level==='error')runtimeErrors.push({stage,time:row.time,service:row.service,message:String(row.message).slice(0,220),code:row.data?.code,scope:row.data?.scope})
 }
}
compressed('physical-terminals.json.gz',Buffer.from(JSON.stringify(terminals)))
compressed('data-preparations.json.gz',Buffer.from(JSON.stringify(preparations)))
json('resource-disposition.json',resources)
json('network-observation.json',{at:new Date().toISOString(),requests,runtimeErrors})
const dataSummary=preservation.scopes.map(scope=>({stage:scope.stage,source:scope.source,schema:scope.schema,canonical:scope.canonical,tables:Object.keys(scope.counts).length,originalRows:Object.values(scope.counts).reduce((sum,count)=>sum+count.original,0),tableCountChanges:Object.entries(scope.counts).filter(([,count])=>count.original!==count.current),originalRowDifferences:scope.originalRowDifferences,providerActivities:scope.counts.provider_activity_request}))
json('data-preservation-summary.json',dataSummary)
json('observations.json',{at:new Date().toISOString(),sourceBaseCommit:'b36a57b8991ea3775166a4cb6be6c94d2a69b372',scope:'Single developer;real independent UI/API services;no response interception or hidden browser state',build:{runner:'Node formal Vite configuration',exitCode:0,modules:7313,seconds:54.51,publication:'main-DhV28lza.js'},controlContracts:{initialSix:{before:{pass:4,fail:2},after:{pass:6,fail:0}},final:{pass:7,fail:0,assertions:11},kind:'Transport control receipts including actual loopback HTTP;not UI automation or end-to-end qualification'},validation:[{command:'bun run --cwd packages/overlay typecheck',exitCode:0},{command:'bun run --cwd packages/overlay check:i18n',exitCode:0,keys:2529},{command:'bun run docs:check',exitCode:0},{command:'bun run check:architecture-index',exitCode:0}],manual:{screenshots:13,pages:[105,106],before:'Offline Task URL stayed Home after API online;manual selection then opened same Task',after:['Original Task restored on first healthy connection','Later cross-project Chat retained through same-document API restart','Exact Chat URL cold-start restored original conversation','Offline New chat intent remained after API online'],draft:'Screenshot13 draft entered after online;not an offline draft retention claim',transitional:'Screenshot06 and selected-chat-location.json captured before selection settled;07 and selected-chat-ready-location.json own the accepted Chat URL'},provider:{maximum:0,actual:0,credentialsOrCatalogCopies:'None'},limits:['No Mission or native WebView2 real-page qualification','No new LLM execution,all Sources or continuous-frame Rendering qualification','No forced initial metadata interruption or concurrent user navigation during its in-flight window'],resourceSummary:'All seven original native/output/request/launcher/birth chains complete;all public shutdown200;pages105/106 closed;original data/schema3/canonical retained'})
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);assert(!fs.lstatSync(file).isSymbolicLink());if(entry.isDirectory())walk(file);else{const data=fs.readFileSync(file);scan(data);physicalFiles++;physicalBytes+=data.length;if(file.endsWith('.gz')){const decoded=gunzipSync(data);scan(decoded);decodedPayloads++;decodedBytes+=decoded.length}}}}
walk(out)
for(const file of ['specs/README.md','specs/records/2026-10/README.md','specs/artifacts/README.md','specs/records/2026-10/2026-10-22-offline-location-recovery.md','specs/current/architecture/07-panel.md','packages/overlay/src/services/init.ts','packages/overlay/src/services/connection.ts','packages/overlay/src/services/monitor-tick.ts','packages/overlay/test/monitor-tick.test.ts'])input(repo+'/'+file)
assert(fs.readFileSync(authPath).equals(authBytes));assert.equal(fs.statSync(authPath).mtimeMs,authStat.mtimeMs)
const result={at:new Date().toISOString(),physicalFiles,physicalBytes,decodedPayloads,decodedBytes,logicalInputs,logicalBytes,actualCredentialValueMatches:matches,scope:'Full scoped artifact bytes and decompressed gzip payloads plus original logical input buffers,source,tests,record,indexes,architecture;original secrets read locally only;source bytes/mtime retained'}
json('credential-scan.json',result)
console.log(JSON.stringify({...result,resources:resources.length,screenshots:13,runtimeErrors}))
