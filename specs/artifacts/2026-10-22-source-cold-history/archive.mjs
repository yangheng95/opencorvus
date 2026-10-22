import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-source-cold-history',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-cold-history-534-'
const names=['prepare.mjs','prepare-data.ts','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','build-diagnostic.mjs','build-diagnostic-debug-original.mjs','plan.json','describe.mjs','archive.mjs','before-data-preparation.json','after-data-preparation.json','before-console-first.json','before-first-open-dom.json','after-source-reading-dom.json','after-reopen-dom.json','before-browser-errors.json','after-browser-errors.json']
for(const name of fs.readdirSync(root))if(/^\d\d-.*\.png$/.test(name))names.push(name)
for(const name of names)fs.copyFileSync(root+'/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compress=(bytes,name)=>{const source=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),packed=gzipSync(source);assert(gunzipSync(packed).equals(source));fs.writeFileSync(out+'/'+name+'.gz',packed,{flag:'wx'})}
for(const name of ['before-build.log','before-warning-build.log','after-console-first.json','after-console-final.json','result-observation.json','data-preservation-observation.json'])compress(fs.readFileSync(root+'/'+name),name)
for(const stage of ['before','after']){
 const proof=JSON.parse(fs.readFileSync(base+stage+'-service/evidence/physical-terminal.json'))
 assert.equal(proof.originalExit,0);assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.shutdown.statusCode,200)
 for(const key of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[key],true)
 assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 compress(JSON.stringify(proof,null,2)+'\n',stage+'-physical-terminal.json')
}
const result=JSON.parse(fs.readFileSync(root+'/result-observation.json'))
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),screenshots:result.screenshots,actualProviderRequests:0,maximumProviderRequests:0,credentialOrCatalogCopies:0,scopes:result.scopes,warningTimeline:{events:result.warningTimeline.events,counts:result.warningTimeline.counts,longestFirstHtmlWaitMs:result.warningTimeline.longestFirstHtmlWaitMs,lastBodySettlementAfterFirstMountMs:result.warningTimeline.lastBodySettlementAfterFirstMountMs,phases:result.warningTimeline.phases},limits:result.limits},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({copied:names.length,screenshots:10,gzip:8,actualProviderRequests:0,scopes:2}))
