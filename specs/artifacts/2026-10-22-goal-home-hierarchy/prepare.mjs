import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../startup-location-discovery-510'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='goal-home-hierarchy-513'
for(const file of ['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','prepare-data.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('startup-location-discovery-510',scope).replaceAll('18941','18955').replaceAll('18943','18957')
 code=code.replaceAll('Startup location and directory discovery review','Goal home hierarchy review').replaceAll('Startup link restoration','Goal home hierarchy')
 if(file==='prepare-data.ts')code=code.replace("base+'/agent-rail-identity-509-final'","base+'/native-stream-reconnect-512-historical'")
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.cpSync(base+'/native-stream-reconnect-512-historical-bundle/bin/ui',base+'/'+scope+'-before-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Fresh513 before18955/after18957;zero models;closed512-historical source;formal baseline UI')
