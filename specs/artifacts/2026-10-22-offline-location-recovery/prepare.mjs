import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../source-entry-navigation-514'),base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22',scope='offline-location-recovery-515'
const ports={'before-ui':18963,'before-api':18965,'after-ui':18967,'after-api':18969,'after-api-restart':18969,'after-api-session':18969,'after-api-supersede':18969}
const stages=Object.keys(ports),psStages=stages.map(s=>"'"+s+"'").join(','),psPorts='@{'+Object.entries(ports).map(([s,p])=>"'"+s+"'="+p).join(';')+'}'
const sources=Object.fromEntries(stages.map(stage=>[stage,base+'/'+({
 'before-ui':'source-entry-navigation-514-after','before-api':'source-entry-navigation-514-after',
 'after-ui':scope+'-before-ui','after-api':scope+'-before-api','after-api-restart':scope+'-after-api',
 'after-api-session':scope+'-after-api-restart','after-api-supersede':scope+'-after-api-session',
}[stage])]))
for(const file of ['launch.ps1','serve.ts','shutdown.ps1','settle.ps1','preserve.ts','build.mjs','prepare-data.ts']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('source-entry-navigation-514',scope)
 code=code.replaceAll('Sources operation and reading review','Offline startup location review').replaceAll('Sources reading','Offline first-healthy workspace recovery')
 code=code.replaceAll("[ValidateSet('before','after')]",'[ValidateSet('+psStages+')]')
 code=code.replaceAll('@{before=18959;after=18961}',psPorts)
 if(file==='serve.ts'){
  const start=code.indexOf("const stage=({'18959'"),end=code.indexOf('\nconst packageRoot=',start);assert(start>=0&&end>start)
  code=code.slice(0,start)+`const ports=${JSON.stringify(ports)} as Record<string,number>
const stage=Object.keys(ports).find(value=>path.resolve(runtime)===path.resolve('${base}/${scope}-'+value+'/runtime'))
assert(stage);assert.equal(Number(portText),ports[stage])`+code.slice(end)
 }
 if(file==='prepare-data.ts'){
  code=code.replace("['before','after'].includes(stage)",JSON.stringify(stages)+'.includes(stage)')
  const current="source=stage==='before'?base+'/goal-home-hierarchy-513-after':base+'/'+name+'-before'";assert(code.includes(current))
  code=code.replace(current,'source=('+JSON.stringify(sources)+' as Record<string,string>)[stage]')
 }
 if(file==='build.mjs')code=code.replace("??'after'","??'after-ui'")
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
for(const stage of ['before-ui','before-api'])fs.cpSync(base+'/source-entry-navigation-514-after-bundle/bin/ui',base+'/'+scope+'-'+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
fs.writeFileSync(root+'/scope-plan.json',JSON.stringify({base,scope,ports,sources,models:{maximum:0,actual:0},ui:'Formal source CLI /ui;real UI server settings and absent API listener;no fake response or browser hidden state'},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({scope,ports,maximumModels:0,source:'Closed514-after'}))
