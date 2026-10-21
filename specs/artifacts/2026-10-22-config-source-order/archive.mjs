import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),out=repo+'/specs/artifacts/2026-10-22-config-source-order',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-'
const copy=(name,file=root+'/'+name)=>fs.copyFileSync(file,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compressed=(name,file=root+'/'+name)=>{const raw=fs.readFileSync(file),gzip=gzipSync(raw);assert(gunzipSync(gzip).equals(raw));fs.writeFileSync(out+'/'+name+'.gz',gzip,{flag:'wx'})}
for(const name of ['prepare.mjs','prepare-data.ts','repair-serve.mjs','launch.ps1','launch-before-owned-project-repair.ps1','copy-ui.mjs','prepare-authority.mjs','retire-authority.mjs','settle.ps1','shutdown.ps1','preserve.ts','read-config.mjs','read-config-before-precondition-repair.mjs','read-precondition-failure.json','plan.json','after-initial-config.json','after-project-override-config.json','after-browser-errors.json','archive.mjs'])copy(name)
for(const name of ['precedence-before.log','config-contracts-after.log','backend-typecheck.log','serve.ts','before-data-preservation-observation.json','data-preservation-observation.json'])compressed(name)
for(const stage of ['before','after']){
 for(const suffix of ['data-preparation.json','authority-preparation.json','authority-retirement.json'])copy(stage+'-'+suffix)
 copy(stage+'-preflight-ready.json',base+stage+'/evidence/preflight-ready.json')
 compressed(stage+'-physical-terminal.json',base+stage+'/evidence/physical-terminal-and-pair-cleanup.json')
}
for(const name of ['failed.json','native-host-ready.json','native-host-settled.json','launcher-child-exit.json','failure-physical-observation.json'])compressed('failed-before-startup-'+name,base+'before/failed-before-startup-evidence/'+name)
for(const name of ['01-before-home.jpg','02-before-mode.jpg','03-after-home.jpg','04-after-mode.jpg','05-after-project-override.jpg'])copy(name)
const commandSummary={at:new Date().toISOString(),before:{originalHandle:79508,exit:1,pass:4,fail:2,expects:12,log:'precedence-before.log.gz'},after:{originalHandle:51914,exit:0,files:[{file:'config-source-precedence.test.ts',pass:6,expects:12},{file:'config-layer-inheritance.test.ts',pass:23,expects:72},{file:'config-peer-convergence.test.ts',pass:7,expects:8},{file:'config-global-project-validation.test.ts',pass:4,expects:26}],pass:40,fail:0,expects:118,log:'config-contracts-after.log.gz'},backendTypecheck:{originalHandle:3478,exit:0},formalUI:'Existing unchanged main-DhV28lza from515;no new UI source/build claim',ui:'Five actual screenshots manually viewed;no UI automated tests',services:{firstFailed:{originalChunk:'7e2bff',exit:1,requests:0},before:{originalHandle:8872,exit:0,tab:112,closed:true},after:{originalHandle:45522,exit:0,tab:113,closed:true}},boundary:'Exact original tool outcomes recorded by root;logs retain original test/runtime output. Backend contracts are not UI qualification;manual screenshots are separate.'}
fs.writeFileSync(out+'/validation-summary.json',JSON.stringify(commandSummary,null,2)+'\n',{flag:'wx'})
const scopes=['before','after'].map(stage=>({stage,physical:JSON.parse(fs.readFileSync(base+stage+'/evidence/physical-terminal-and-pair-cleanup.json','utf8')),privateRetirement:JSON.parse(fs.readFileSync(root+'/'+stage+'-authority-retirement.json','utf8'))}))
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),maximumBatchRequests:8,actualRequests:scopes.reduce((n,s)=>n+s.physical.requests,0),scopes,boundary:'Both original source/native/output/request/launcher/physical birth chains complete;runtime and private paired members retired independently. Failed first tool had no staged runtime authority or provider request.'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,requests:scopes.reduce((n,s)=>n+s.physical.requests,0),maximum:8,production:'One loadStateOnce source-order condition;no schema,protocol or UI source change'}))
