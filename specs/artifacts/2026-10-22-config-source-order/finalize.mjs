import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {gzipSync,gunzipSync} from 'node:zlib'
const root=import.meta.dirname,out=path.resolve(root,'../../specs/artifacts/2026-10-22-config-source-order'),run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read'
const copy=(name,file=root+'/'+name)=>fs.copyFileSync(file,out+'/'+name,fs.constants.COPYFILE_EXCL)
const compressed=(name,file=root+'/'+name)=>{const raw=fs.readFileSync(file),gzip=gzipSync(raw);assert(gunzipSync(gzip).equals(raw));fs.writeFileSync(out+'/'+name+'.gz',gzip,{flag:'wx'})}
for(const name of ['verify-original.mjs','source-bytes-and-directories.json','source-bytes-and-directories-final.json','prepare-final-read.mjs','prepare-final-read.ts','serve-final-read.ts','launch-final-read.ps1','read-final.mjs','final-read-config.json','final-browser-errors.json','shutdown-final-read.ps1','settle-final-read.ps1','finalize.mjs','06-final-case-home.jpg','07-final-case-mode.jpg','final-read-data-preparation.json'])copy(name)
for(const name of ['precedence-final.log','precedence-case-before.log','precedence-case-after.log','backend-typecheck-final.log'])compressed(name)
compressed('final-read-data-preservation.json',root+'/data-preservation-observation.json')
compressed('final-read-physical-terminal.json',run+'/evidence/physical-terminal.json')
const validationFile=out+'/validation-summary.json',validation=JSON.parse(fs.readFileSync(validationFile,'utf8'))
validation.final={sourceCaseTest:{originalHandle:88046,exit:0,pass:8,fail:0,expects:16},previousCaseFailure:{originalHandle:52378,exit:1,pass:7,fail:1},retainedOtherFiles:{pass:34,expects:106},uniqueCurrentTests:{pass:42,fail:0,expects:122},backendTypecheck:{originalHandle:1609,exit:0},zeroModelFinalService:{originalHandle:43298,exit:0,tab:114,closed:true},manualScreenshots:7,boundary:'Final8 source cases replace earlier6 source cases in original40;repeat runs not added to unique counts. Original40 matrix retained above.'}
fs.writeFileSync(validationFile,JSON.stringify(validation,null,2)+'\n')
const resourcesFile=out+'/resource-summary.json',resources=JSON.parse(fs.readFileSync(resourcesFile,'utf8'))
resources.finalZeroModel=JSON.parse(fs.readFileSync(run+'/evidence/physical-terminal.json','utf8'));resources.actualRequests+=resources.finalZeroModel.provider.actual
fs.writeFileSync(resourcesFile,JSON.stringify(resources,null,2)+'\n')
console.log(JSON.stringify({files:fs.readdirSync(out).length,currentUniqueTests:42,expects:122,screenshots:7,modelRequests:resources.actualRequests,maximum:8,allCurrentOwnedPagesClosed:true}))
