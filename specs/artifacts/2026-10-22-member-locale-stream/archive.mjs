import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-member-locale-stream',run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/member-locale-stream-516-before'
const authPath='C:/Users/hengu/.codex/auth.json',authBytes=fs.readFileSync(authPath),authStat=fs.statSync(authPath),auth=JSON.parse(authBytes)
const values=[...new Set([auth.OPENAI_API_KEY,auth.tokens?.id_token,auth.tokens?.access_token,auth.tokens?.refresh_token].filter(v=>typeof v==='string'&&v.length>=20))].map(v=>Buffer.from(v));assert(values.length>=3)
function scan(data){assert.equal(values.some(value=>data.includes(value)),false,'Actual credential values in scoped delivery')}
function input(file){const data=fs.readFileSync(file);scan(data);return data}
function write(name,data){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);scan(bytes);fs.writeFileSync(out+'/'+name,bytes,{flag:'wx'})}
function json(name,data){write(name,JSON.stringify(data,null,2)+'\n')}
function compressed(name,data){scan(data);const bytes=gzipSync(data);assert(gunzipSync(bytes).equals(data));write(name,bytes)}
for(const name of ['prepare.mjs','prepare-data.ts','prepare-authority.mjs','launch.ps1','shutdown.ps1','settle.ps1','retire-authority.mjs','preserve.ts','send.ts','describe.ts','copy-ui.mjs','plan.json','before-data-preparation.json','before-authority-preparation.json','before-authority-retirement.json','before-request.json','manual-observations.json','english-return.json','browser-errors.json','result-observation.json','archive.mjs',...fs.readdirSync(root).filter(name=>name.endsWith('.png'))])write(name,input(root+'/'+name))
write('preflight-ready.json',input(run+'/evidence/preflight-ready.json'))
compressed('physical-terminal-and-pair-cleanup.json.gz',input(run+'/evidence/physical-terminal-and-pair-cleanup.json'))
compressed('data-preservation-observation.json.gz',input(root+'/data-preservation-observation.json'))
const preservation=JSON.parse(fs.readFileSync(root+'/data-preservation-observation.json','utf8'))
json('data-summary.json',preservation.scopes.map(scope=>({stage:scope.stage,source:scope.source,schema:scope.schema,canonical:scope.canonical,tables:Object.keys(scope.counts).length,originalRows:Object.values(scope.counts).reduce((sum,v)=>sum+v.original,0),originalRowDifferences:scope.originalRowDifferences,countChanges:Object.entries(scope.counts).filter(([,v])=>v.original!==v.current)})))
const physical=JSON.parse(fs.readFileSync(run+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
json('resource-summary.json',{at:new Date().toISOString(),originalHandle:71428,originalExit:0,sendHandle:51236,sendExit:0,publicShutdown:200,originalNative:physical.native,launcher:physical.launcher,chain:physical.chain,providerQualificationPassed:physical.providerQualificationPassed,qualificationFailures:physical.qualificationFailures,admittedMaximum:physical.maximumRequests,actual:physical.requests,batchMaximum:16,unusedAfter:'8 never admitted;after not prepared or started',runtimePair:physical.copiedPair,pairedCleanupComplete:physical.pairedCleanupComplete,privatePair:'Both members retired;see before-authority-retirement.json',page:108,pageClosed:true,sourceUI:'main-DhV28lza from515;production code unchanged',scope:'One existing member prompt;no new Task,Mission,Goal or delegation;no UI automation'})
assert(fs.readFileSync(authPath).equals(authBytes));assert.equal(fs.statSync(authPath).mtimeMs,authStat.mtimeMs)
console.log(JSON.stringify({copiedFiles:fs.readdirSync(out).length,actual:physical.requests,maximum:physical.maximumRequests,providerQualificationPassed:physical.providerQualificationPassed,originalHandle:71428,sourceAuth:'Bytes/mtime retained'}))
