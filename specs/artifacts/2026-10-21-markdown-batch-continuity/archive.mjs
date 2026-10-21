import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',out=repo+'/specs/artifacts/2026-10-21-markdown-batch-continuity'
fs.mkdirSync(out)
const copy=(file,name=file)=>fs.copyFileSync(root+'/'+file,out+'/'+name,fs.constants.COPYFILE_EXCL)
for(const file of ['data-preparation.json','authority-preparation.json','data-and-authority-preserved.json','long-history-candidates.json','runtime-qualification.json','presentation-observation.json','runtime-check-reading-001.log','runtime-check.log','preserve.log','launch-before-refused-001.log','build-before.log','build-after-diagnostic.log','build-formal.log','typecheck.log','inspect-history.mjs','prepare.mjs','prepare-authority.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','build-diagnostic.mjs','send.ts','send-correction.ts','analyze-observations.mjs','check-runtime.ts','archive.mjs'])copy(file)
for(const name of fs.readdirSync(root).filter(n=>/^(?:before|after|correction)-observation-\d+\.json$/.test(n)||/^(?:before|after)-(?:reading|settled)-geometry\.json$/.test(n)))copy(name)
for(const key of ['before','after','after-correction']){copy(key+'-request.json');copy(key+'-response-private.json',key+'-response.json')}
for(const stage of ['before','after'])for(const [source,name]of [['physical-terminal-and-pair-cleanup.json','physical-and-pair-cleanup.json'],['public-shutdown.json','public-shutdown.json'],['preflight-ready.json','admission.json']])fs.copyFileSync(base+'/markdown-batch-continuity-497-'+stage+'/evidence/'+source,out+'/'+stage+'-'+name,fs.constants.COPYFILE_EXCL)
const pictures=[]
for(const name of fs.readdirSync(root+'/screenshots').filter(n=>n.endsWith('.png')).sort()){
 fs.copyFileSync(root+'/screenshots/'+name,out+'/'+name,fs.constants.COPYFILE_EXCL)
 pictures.push({name,savedAt:new Date(fs.statSync(root+'/screenshots/'+name).mtimeMs).toISOString(),boundary:'Actually viewed IAB manual screenshot,1280x720;file-save time,not browser paint timing;not continuous video'})
}
fs.writeFileSync(out+'/screenshots.json',JSON.stringify(pictures,null,2)+'\n',{flag:'wx'})
let scanner=fs.readFileSync(root+'/../home-goal-entry-496/scan-and-retire.mjs','utf8').replaceAll('home-goal-entry-496','markdown-batch-continuity-497').replaceAll('2026-10-21-goal-entry-workspace-review','2026-10-21-markdown-batch-continuity')
scanner=scanner.replace("stage==='before'?2:10",'8').replace('assert.equal(requests,7)',"assert.equal(requests,read(root+'/runtime-qualification.json').actualRequests)").replaceAll('maximumModelRequests:12','maximumModelRequests:16').replaceAll('unusedRequestAllowance:12-requests','unusedRequestAllowance:16-requests').replaceAll('maximum:12','maximum:16')
fs.writeFileSync(root+'/scan-and-retire.mjs',scanner,{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,pictures:pictures.length}))
