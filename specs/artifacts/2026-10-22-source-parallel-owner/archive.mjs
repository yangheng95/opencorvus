import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-source-parallel-owner',run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-parallel-owner-532-before'
const names=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','build.mjs','build-diagnostic.mjs','source-diagnostic.txt','send.ts','http-json.ts','inspect.ts','describe.mjs','archive.mjs','plan.json','before-authority-preparation.json','before-authority-retirement.json','before-data-preparation.json','before-request.json','before-first-allowed-persistence.json','before-settled-persistence.json','manual-observations.json','browser-errors.json']
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name)||/^console-\d+\.json$/.test(name))names.push(name)
for(const name of names)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(file,name)=>{const original=fs.readFileSync(file),compressed=gzipSync(original);assert(gunzipSync(compressed).equals(original));fs.writeFileSync(out+'/'+name+'.gz',compressed,{flag:'wx'})}
for(const name of ['result-observation.json','data-preservation-observation.json','before-build.log'])compress(root+'/'+name,name)
for(const name of ['physical-terminal-and-pair-cleanup.json','public-shutdown.json'])compress(run+'/evidence/'+name,'before-'+name)
const result=JSON.parse(fs.readFileSync(root+'/result-observation.json')),proof=JSON.parse(fs.readFileSync(run+'/evidence/physical-terminal-and-pair-cleanup.json'))
assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.maximumRequests,8);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)
for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),screenshots:names.filter(name=>name.endsWith('.png')).length,...result.resources,unusedActiveRequestsRetired:proof.maximumRequests-proof.requests,totalAuthorityMembersRetired:proof.copiedPair.length+result.resources.retiredPrivateMembers,provider:proof.provider,assets:result.assets,runtimeErrors:result.runtimeErrors,browserErrors:result.browserErrors,limits:result.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:names.length,screenshots:names.filter(name=>name.endsWith('.png')).length,actual:proof.requests,maximum:proof.maximumRequests,authorityMembersRetired:proof.copiedPair.length+result.resources.retiredPrivateMembers}))
