import fs from 'node:fs'
const root=import.meta.dirname
const owner=JSON.parse(fs.readFileSync(root+'/task-create-corrected-response.json')).result
const data=fs.readFileSync(root+'/prepare-recovery-data.ts','utf8').replaceAll('recovery','recovery-final')
fs.writeFileSync(root+'/prepare-recovery-final-data.ts',data,{flag:'wx'})
for(const kind of ['launch','serve','shutdown','settle']){
 const ext=kind==='serve'?'ts':'ps1'
 let body=fs.readFileSync(root+'/'+kind+'-recovery.'+ext,'utf8').replaceAll('recovery','recovery-final').replaceAll('18893','18895')
 if(kind==='launch')body=body.replace('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project',owner.directory.replaceAll('\\','/'))
 fs.writeFileSync(root+'/'+kind+'-recovery-final.'+ext,body,{flag:'wx'})
}
console.log('Prepared final independent recovery clone from original failure,scopeexact new Project,port18895')
