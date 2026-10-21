import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../goal-home-hierarchy-513'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='source-entry-navigation-514'
for(const file of ['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','prepare-data.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('goal-home-hierarchy-513',scope).replaceAll('18955','18959').replaceAll('18957','18961')
 code=code.replaceAll('Goal home hierarchy review','Sources operation and reading review').replaceAll('Goal home hierarchy','Sources reading')
 if(file==='prepare-data.ts')code=code.replace("base+'/native-stream-reconnect-512-historical'","base+'/goal-home-hierarchy-513-after'")
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.cpSync(base+'/goal-home-hierarchy-513-after-bundle/bin/ui',base+'/'+scope+'-before-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Fresh514 before18959/conditional after18961;zero models;closed513-after source;formal current UI')
