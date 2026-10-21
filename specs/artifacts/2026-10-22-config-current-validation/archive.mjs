import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,out=path.resolve(root,'../../specs/artifacts/2026-10-22-config-current-validation'),run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-current-validation-521-before'
const copy=(name,file=root+'/'+name)=>fs.copyFileSync(file,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compressed=(name,file=root+'/'+name)=>{const raw=fs.readFileSync(file),gzip=gzipSync(raw);assert(gunzipSync(gzip).equals(raw));fs.writeFileSync(out+'/'+name+'.gz',gzip,{flag:'wx'})}
for(const name of ['prepare.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','copy-ui.mjs','preserve.ts','start-round.mjs','inspect.mjs','observe-data.ts','plan.json','before-data-preparation.json','before-authority-preparation.json','before-authority-retirement.json','before-observation.json','data-observation.json','browser-errors.json','archive.mjs'])copy(name)
for(const name of ['01-current-general.jpg','02-current-write-providers.jpg','03-current-providers-loaded.jpg','04-current-complete-restore.jpg'])copy(name)
for(const round of ['before-cold','before-repeat']){
 fs.mkdirSync(out+'/'+round)
 for(const name of ['config-write.ts','prepare-readers.ts','readers.mjs','reader.log','writer.log'])compressed(round+'/'+name)
 for(const name of ['run-reader-ready.json','run-checker-ready.json','run-write-start.json','run-reader-admission.json','run-reader-results.json','run-write.json','run-reader-selection.json','history-run-verified.json'])copy(round+'/'+name)
}
copy('preflight-ready.json',run+'/evidence/preflight-ready.json')
compressed('physical-terminal.json',run+'/evidence/physical-terminal-and-pair-cleanup.json')
compressed('data-preservation.json',root+'/data-preservation-observation.json')
const physical=JSON.parse(fs.readFileSync(run+'/evidence/physical-terminal-and-pair-cleanup.json','utf8')),retirement=JSON.parse(fs.readFileSync(root+'/before-authority-retirement.json','utf8'))
fs.writeFileSync(out+'/resource-summary.json',JSON.stringify({at:new Date().toISOString(),originalServiceHandle:4097,originalExit:0,tab:115,closed:true,maximumBatchRequests:4,actualRequests:physical.requests,physical,privateRetirement:retirement,boundary:'Original service/native/output/request/launcher and exact physical births complete;all runtime/private paired members retired;no business inputs or user process'},null,2)+'\n',{flag:'wx'})
const observation=JSON.parse(fs.readFileSync(root+'/before-observation.json','utf8'))
fs.writeFileSync(out+'/validation-summary.json',JSON.stringify({at:new Date().toISOString(),versionSource:'1ce25a68ed9864191a001892819ef636e42636b1',originalProjects:167,allCurrentCandidates:168,rounds:observation.rounds.map(r=>({round:r.round,write:r.write,read:r.read,latency:r.latency})),originalHandles:{cold:{writer:9576,writerExit:1,reader:15727,readerExit:0},repeat:{writer:23530,writerExit:1,reader:29645,readerExit:0}},sourceErrors:observation.errors,ui:'Four original manual screenshots;unchanged formal main-DhV28lza;no UI automated tests or new frontend build',scope:'Current full production config service/browser HostTransport/real Source CLI HTTP;complete restoration accepted;save10s/restore5s fail/read20s pass;no sampled projects or threshold changes'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,actualModelRequests:physical.requests,maximum:4,productionChanges:0,allCurrentCandidates:168}))
