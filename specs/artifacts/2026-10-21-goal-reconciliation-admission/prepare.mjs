import fs from 'node:fs'
const root=import.meta.dirname,old=root+'/../goal-deliverable-navigation-498',base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
let code=fs.readFileSync(old+'/prepare.ts','utf8')
code=code.replace("const stage=process.argv[2];assert(stage==='before'||stage==='after')","const stage='after'")
 .replace("name='goal-deliverable-navigation-498',source=base+'/markdown-batch-continuity-497-after'","name='goal-reconciliation-admission-499',source=base+'/goal-deliverable-navigation-498-after-data'")
 .replace("source+'/evidence/physical-terminal-and-pair-cleanup.json'","base+'/goal-deliverable-navigation-498-after/evidence/physical-terminal.json'")
 .replace("assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)","assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200)")
 .replaceAll('18881','18883')
 .replaceAll("source native/reader/launcher settled and auth/models retired","source498 native/reader/launcher settled;no authority pair staged")
 .replaceAll('498 ','499 ')
fs.writeFileSync(root+'/prepare-data.ts',code,{flag:'wx'})
for(const name of ['check-reads.ts','preserve.ts']){
 let body=fs.readFileSync(old+'/'+name,'utf8').replaceAll('goal-deliverable-navigation-498','goal-reconciliation-admission-499').replaceAll('18881','18883')
 if(name==='preserve.ts')body=body.replace("['before','after']","['after']")
 fs.writeFileSync(root+'/'+name,body,{flag:'wx'})
}
const rows=fs.readFileSync(base+'/goal-deliverable-navigation-498-after-data/runtime/log/dev.log','utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line))
const failures=rows.filter(row=>row.service==='continuous-goal'&&row.message==='goal project reconciliation failed')
const probe=failures.filter(row=>row.data.directory.endsWith('member-live-rendering-412-fresh\\project')).slice(0,12)
fs.writeFileSync(root+'/before-observation.json',JSON.stringify({source:'Original498-after Source CLI actual log,now physically settled',scope:'same project and unchanged scheduler path at2685cb9ca',totalGoalProjectFailures:failures.length,sample:probe.map(row=>({time:row.time,directory:row.data.directory,errorType:row.data.error.split(':')[0]})),sampleIntervalsMs:probe.slice(1).map((row,i)=>Date.parse(row.time)-Date.parse(probe[i].time)),allConfigFailures:rows.filter(r=>r.service==='project.open'&&r.message==='project.open.stage'&&r.data.stage==='config.validate'&&r.data.status==='failed').length},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({beforeFailures:failures.length,firstTwelve:probe.length}))
