import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import { CredentialRedactor } from '../../packages/opencorvus/script/real-provider-audit'
const repo='D:/myhexin-local/opencorvus'
const scratch=path.join(repo,'.tmp-product-iteration/provider-stream-error-342')
const evidence=path.join(repo,'specs/artifacts/2026-10-05-connection-workspace-authority/provider-stream-error-342')
const run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/provider-stream-error-342-history-04'
const redactor=new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync('C:/Users/hengu/AppData/Local/opencorvus/data/auth.json','utf8')))
const save=(name:string,value:unknown)=>fs.writeFileSync(path.join(evidence,name),redactor.redact(JSON.stringify(value,null,2))+'\n',{flag:'wx'})
fs.mkdirSync(path.join(evidence,'checks'),{recursive:true})
for(const name of ['overlay-types-authority.log','build-authority.log','import-04.log','readiness-04.log','shutdown-04.log','launch-04.log']){
 fs.writeFileSync(path.join(evidence,'checks',name),redactor.redact(fs.readFileSync(path.join(scratch,name),'utf8')),{flag:'wx'})
}
for(const name of ['startup.json','launch-owner.json','import-custody.json','evidence/native-host-ready.json','evidence/native-host-settled.json','stdout.log','stderr.log','runtime/log/dev.log']){
 fs.writeFileSync(path.join(evidence,'history-04',path.basename(name)),redactor.redact(fs.readFileSync(path.join(run,name),'utf8')),{flag:'wx'})
}
const settled=JSON.parse(fs.readFileSync(path.join(run,'evidence/native-host-settled.json'),'utf8'))
assert.equal(settled.terminal.exitCode,0)
assert.equal(settled.physicalCompletion,true)
assert.equal(settled.outputDrainComplete,true)
assert.equal(settled.requestCleanupComplete,true)
const nativeBirth=Number(BigInt(settled.target.processInstanceID.slice(6))/10000n-62135596800000n)
const logs=fs.readFileSync(path.join(run,'runtime/log/dev.log'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))
const asset=logs.find(x=>x.service==='server'&&x.data?.path==='/ui/assets/main-DrobkXyT.js'&&x.data?.status==='completed')
assert.equal(asset.data.statusCode,200)
const sqlite=new Database(path.join(run,'runtime/data/opencorvus.db'),{readonly:true})
sqlite.exec('BEGIN')
let facts:any
try{
 const messages=sqlite.query('SELECT id,data FROM message ORDER BY time_created,id').all() as any[]
 const error=messages.find(row=>row.id==='msg_g0VXofL0v00voJgQANZ1')
 const exported=JSON.parse(fs.readFileSync(path.join(scratch,'actual-session-export.json'),'utf8'))
 assert.deepEqual(JSON.parse(error.data).error,exported.messages.find((m:any)=>m.info.id===error.id).info.error)
 assert.equal(messages.length,9)
 const counts=(name:string)=>(sqlite.query(`SELECT count(*) as n FROM "${name}"`).get() as any).n
 facts={messages:9,assistantMessages:messages.filter(row=>JSON.parse(row.data).role==='assistant').length,parts:counts('part')+counts('tool_part_request'),providerRequests:counts('provider_activity_request'),error:{id:error.id,error:JSON.parse(error.data).error}}
 assert.equal(facts.parts,21)
 assert.equal(facts.providerRequests,0)
}finally{sqlite.exec('ROLLBACK');sqlite.close()}
save('checks/actual-history-final.json',{checkedAt:new Date().toISOString(),source:'Actual341 readonly session export and formal production import, no fabricated messages',facts,asset,initialLauncherHandle:57394,launcherExitCode:0,native:settled,elapsedMs:Date.parse(settled.observedAtUtc)-nativeBirth,credentialStaging:'None; history only, model catalog intentionally absent',screenshots:{'01-error-summary.png':'Initial viewport misses target; retained as incomplete capture','02-error-summary-visible.png':'Readable summary, upper edge clipped','03-error-details.png':'Entire error card and exact raw packet manually reviewed','04-error-summary-final.png':'Full collapsed card after keyboard Return, manually reviewed'},copy:'Actual double-click showed Copied. Browser virtual clipboard returned unrelated older contents; raw read kept privately. Source uses Host native clipboard, so browser virtual read does not prove actual copy content. Content verification remains incomplete.',limitations:['No fresh upstream overload reproduction','No child Dock or Side Chat visual error occurrence in this run','No new model request','Original341 Memory retry_wait/pending1 retained outside imported conversation']})
let scanned=0
function scan(dir:string){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else if(/\.(json|md|log|txt|ts|ps1)$/.test(file)){const text=fs.readFileSync(file,'utf8');assert.equal(redactor.redact(text),text,`Unredacted credential content: ${file}`);scanned++}}}
scan(evidence)
console.log(JSON.stringify({checked:true,filesScanned:scanned,providerRequests:facts.providerRequests,messages:facts.messages,elapsedMs:Date.parse(settled.observedAtUtc)-nativeBirth}))
