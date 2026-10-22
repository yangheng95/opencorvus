import fs from 'node:fs'
import path from 'node:path'
const root=import.meta.dirname,prior=path.resolve(root,'../task-scope-empty-state-528')
for(const file of ['prepare-data.ts','serve.ts','launch.ps1','shutdown.ps1','settle.ps1','preserve.ts','build.mjs']){
 let code=fs.readFileSync(prior+'/'+file,'utf8').replaceAll('task-scope-empty-state-528','dialog-opener-focus-531').replaceAll('19021','19033').replaceAll('19023','19035').replaceAll('Task scope empty state','Dialog opener focus')
 if(file==='prepare-data.ts'){
  code=code.replace("base+'/dock-tool-launch-focus-527-after'","base+'/permission-focus-dismissal-530-after'")
  const start=code.indexOf('const proof='),end=code.indexOf('const target=')
  code=code.slice(0,start)+`if(stage==='before'){
 const proof=JSON.parse(fs.readFileSync(source+'/evidence/physical-terminal-and-pair-cleanup.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true);assert.equal(proof.providerQualificationPassed,true);assert.equal(proof.copiedPair.length,2)
 for(const item of proof.chain)assert.equal(item.state,'dead_or_reused')
 const retired=JSON.parse(fs.readFileSync(repo+'/.tmp-product-iteration/permission-focus-dismissal-530/after-authority-retirement.json','utf8'));assert.equal(retired.retired.length,2)
}else{
 const proof=JSON.parse(fs.readFileSync(source+'-service/evidence/physical-terminal.json','utf8'))
 for(const field of ['physicalCompletion','outputDrainComplete','requestCleanupComplete'])assert.equal(proof.native[field],true)
 assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200);assert.equal(proof.provider.maximum,0);assert.equal(proof.provider.actual,0);assert.equal(proof.provider.exhausted,false)
}
`+code.slice(end)
  code=code.replace('No credentials or catalog staged; original source native/source/output/launcher closed; zero model requests','Target zero model requests;no credentials/catalog staged;source physical and authority settlement verified')
 }
 fs.writeFileSync(root+'/'+file,code,{flag:'wx'})
}
fs.writeFileSync(root+'/plan.json',JSON.stringify({scope:'dialog-opener-focus-531',ports:{before:19033,after:19035},maximumRequests:0,actualRequests:0,authority:'No auth/catalog copies or Provider preflight',source:'Closed530-after complete90 tables/schema3/canonical;after uses closed531-before',before:'Passive open/close callback observations on parent b161e40d0',qualification:'Real manual Goal/CommandPalette mouse,keyboard,close focus;no UI tests/messages/new owners'},null,2)+'\n',{flag:'wx'})
console.log('Fresh531 zero-model helpers prepared;no service or authority staged')
