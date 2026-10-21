import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,repo=path.resolve(root,'../..'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',out=repo+'/specs/artifacts/2026-10-21-goal-entry-workspace-review'
fs.mkdirSync(out)
const copy=(source,name)=>fs.copyFileSync(source,path.join(out,name),fs.constants.COPYFILE_EXCL)
for(const name of ['data-preparation.json','authority-preparation.json','data-and-authority-preserved.json','goal-runtime.json','check-goal.ts','check-goal-failed-001.log','check-goal-private.log','prepare.mjs','prepare-authority.mjs','prepare-data.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','archive.mjs'])copy(root+'/'+name,name)
for(const stage of ['before','after'])for(const [source,name]of [['physical-terminal-and-pair-cleanup.json','physical-and-pair-cleanup.json'],['public-shutdown.json','public-shutdown.json'],['preflight-ready.json','admission.json']])copy(base+'/home-goal-entry-496-'+stage+'/evidence/'+source,stage+'-'+name)
const pictures=[]
for(const name of fs.readdirSync(root+'/screenshots').filter(n=>n.endsWith('.png')).sort()){
 copy(root+'/screenshots/'+name,name)
 pictures.push({name,savedAt:new Date(fs.statSync(root+'/screenshots/'+name).mtimeMs).toISOString(),boundary:'Actual manual IAB interaction and viewed screenshot,1280x720;file save time is not browser paint timing'})
}
fs.writeFileSync(out+'/screenshots.json',JSON.stringify(pictures,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:fs.readdirSync(out).length,screenshots:pictures.length,productionChanges:0}))
