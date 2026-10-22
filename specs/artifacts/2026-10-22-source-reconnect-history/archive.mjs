import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),recheck=path.resolve(root,'../source-reconnect-observation-535'),out=repo+'/specs/artifacts/2026-10-22-source-reconnect-history',sub=out+'/observation-recheck',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),result=read(root+'/result-observation.json')
const common=['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','qualify-provider.ps1','build-diagnostic.mjs','plan.json','browser-errors.json']
const initial=[...common,'http-json.ts','send.ts','objective.txt','check-result.ts','describe.mjs','archive.mjs','after-request.json','after-checked-result.json','after-checker-original-error.json','after-early-input-original.log','after-input.log']
const narrow=[...common,'read-canonical.ts','after-canonical-read.json','before-reload-boundary.json','before-source-reading-console.json']
for(const stage of ['before','after'])for(const suffix of ['data-preparation.json','authority-preparation.json','authority-retirement.json']){initial.push(stage+'-'+suffix);narrow.push(stage+'-'+suffix)}
for(const [folder,names]of [[root,initial],[recheck,narrow]])for(const name of fs.readdirSync(folder))if(/^\d\d-.*\.png$/.test(name)||/^[a-z-]+-dom\.json$/.test(name))names.push(name)
for(const [folder,names]of [[root,initial],[recheck,narrow]])for(const name of names)assert(fs.statSync(folder+'/'+name).isFile(),name)
for(const [folder,target,names]of [[root,out,initial],[recheck,sub,narrow]])for(const name of names)fs.copyFileSync(folder+'/'+name,target+'/'+name,fs.constants.COPYFILE_EXCL)
let compressed=0
const compress=(data,target)=>{const bytes=Buffer.isBuffer(data)?data:Buffer.from(data),packed=gzipSync(bytes);assert(gunzipSync(packed).equals(bytes));fs.writeFileSync(target+'.gz',packed,{flag:'wx'});compressed++}
for(const name of ['before-build.log','data-preservation-observation.json','before-offline-console.json','after-input-final-console.json','result-observation.json'])compress(fs.readFileSync(root+'/'+name),out+'/'+name)
for(const name of ['before-build.log','data-preservation-observation.json','before-baseline-ready-console.json','before-offline-console.json','after-final-console.json'])compress(fs.readFileSync(recheck+'/'+name),sub+'/'+name)
for(const scope of result.scopes){
 const run=base+scope.name+'-'+scope.stage,target=scope.phase==='initial'?out:sub,proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json')
 assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.requests,scope.requests);assert.equal(proof.maximumRequests,scope.maximum)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 proof.provider=scope.provider
 proof.archiveProjection='Original native/EOF/budget/cleanup fields;qualified provider identity/status/stream/end only;request payload and headers omitted'
 compress(JSON.stringify(proof,null,2)+'\n',target+'/'+scope.stage+'-physical-terminal-and-pair-cleanup.json')
 const shutdown=read(run+'/evidence/public-shutdown.json');assert.equal(shutdown.statusCode,200)
 compress(JSON.stringify(shutdown,null,2)+'\n',target+'/'+scope.stage+'-public-shutdown.json')
}
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),screenshots:result.screenshots,actualRequests:result.actualRequests,maximumRequests:result.maximumRequests,unusedScopeRequestsRetired:result.maximumRequests-result.actualRequests,authorityMembersRetired:result.authorityMembersRetired,scopes:result.scopes,initialWindow:result.initialWindow,recheckWindow:{events:result.recheckWindow.events,phases:result.recheckWindow.phases,eventsByKind:result.recheckWindow.eventsByKind,sameBodyDescription:result.recheckWindow.sameBodyDescription,sameSourceDescription:result.recheckWindow.sameSourceDescription},input:{handle:result.inputHandle,exit:result.inputExit,status:result.inputResult.status,sessionID:result.inputResult.sessionID,inputMessageID:result.inputResult.inputMessageID,finalTextLength:result.inputResult.finalTextLength,sourceIdentity:result.inputResult.sourceIdentity},limits:result.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({initialFiles:initial.length,recheckFiles:narrow.length,compressed,screenshots:result.screenshots,requests:result.actualRequests,maximum:result.maximumRequests,retired:result.authorityMembersRetired}))
