import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import { CredentialRedactor } from '../../packages/opencorvus/script/real-provider-audit'
const repo='D:/myhexin-local/opencorvus'
const scratch=path.join(repo,'.tmp-product-iteration/error-copy-343')
const evidence=path.join(repo,'specs/artifacts/2026-10-05-connection-workspace-authority/error-copy-343')
const redactor=new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync('C:/Users/hengu/AppData/Local/opencorvus/data/auth.json','utf8')))
fs.mkdirSync(path.join(evidence,'checks'),{recursive:true})
const save=(file:string,value:unknown)=>fs.writeFileSync(path.join(evidence,file),redactor.redact(JSON.stringify(value,null,2))+'\n',{flag:'wx'})
for(const name of ['export.log','import-before.log','import-after.log','types.log','types-final.log','i18n.log','build.log','build-final.log','launch-before.log','launch-after.log','shutdown-before.log','shutdown-after.log']){
 fs.writeFileSync(path.join(evidence,'checks',name),redactor.redact(fs.readFileSync(path.join(scratch,name),'utf8')),{flag:'wx'})
}
const runs=[]
for(const [stage,handle,asset] of [['before',92775,'main-DrobkXyT.js'],['after',68863,'main-DE9lj1nS.js']] as const){
 const run=`C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/error-copy-343-${stage}-01`
 for(const name of ['startup.json','launch-owner.json','import-custody.json','evidence/native-host-ready.json','evidence/native-host-settled.json','stdout.log','stderr.log','runtime/log/dev.log']){
  fs.writeFileSync(path.join(evidence,`${stage}-01`,path.basename(name)),redactor.redact(fs.readFileSync(path.join(run,name),'utf8')),{flag:'wx'})
 }
 const settled=JSON.parse(fs.readFileSync(path.join(run,'evidence/native-host-settled.json'),'utf8'))
 assert.equal(settled.terminal.exitCode,0)
 assert.equal(settled.physicalCompletion,true)
 assert.equal(settled.outputDrainComplete,true)
 assert.equal(settled.requestCleanupComplete,true)
 const birth=Number(BigInt(settled.target.processInstanceID.slice(6))/10000n-62135596800000n)
 const requests=fs.readFileSync(path.join(run,'runtime/log/dev.log'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)).filter(x=>x.service==='server'&&x.data?.status==='completed')
 const served=requests.find(x=>x.data.path===`/ui/assets/${asset}`)
 assert.equal(served.data.statusCode,200)
 const db=new Database(path.join(run,'runtime/data/opencorvus.db'),{readonly:true})
 db.exec('BEGIN')
 let facts:any
 try{
  const count=(table:string)=>(db.query(`SELECT count(*) AS n FROM "${table}"`).get() as any).n
  const error=db.query('SELECT data FROM message WHERE id=?').get('msg_g0VXofL0v00voJgQANZ1') as any
  facts={messages:count('message'),parts:count('part')+count('tool_part_request'),providerRequests:count('provider_activity_request'),error:JSON.parse(error.data).error}
  assert.equal(facts.messages,9)
  assert.equal(facts.parts,21)
  assert.equal(facts.providerRequests,0)
 }finally{db.exec('ROLLBACK');db.close()}
 runs.push({stage,originalLauncher:handle,launcherExitCode:0,settled,elapsedMs:Date.parse(settled.observedAtUtc)-birth,served,facts})
}
save('checks/actual-runtime.json',{checkedAt:new Date().toISOString(),runs,credentialStaging:'None; history only',uiQualification:'Root manual native button interaction and screenshot review. No UI automation assertions. Actual clipboard reads retained separately; Ctrl+V was manually reviewed in an unsent textarea and cleared.',limits:['No child Dock failure occurrence found in the scanned105 canonical summaries','No desktop Tauri UI test','No new Provider overload request','Original342 stale clipboard read cause remains unknown']})
console.log(JSON.stringify(runs.map(r=>({stage:r.stage,launcher:r.originalLauncher,exit:r.launcherExitCode,messages:r.facts.messages,provider:r.facts.providerRequests,elapsedMs:r.elapsedMs}))))
