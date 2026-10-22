import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../goal-home-hierarchy-513'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='goal-current-experience-523'
for(const file of ['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','prepare-data.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('goal-home-hierarchy-513',scope).replaceAll('18955','19001').replaceAll('18957','19003').replaceAll('Goal home hierarchy','Current Goal experience')
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.cpSync(base+'/offline-location-recovery-515-after-ui-bundle/bin/ui',base+'/'+scope+'-before-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Fresh523 before19001/after19003; current515 UI; closed512 complete source; zero models/no credentials')
