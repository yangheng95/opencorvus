import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const [runtime,project,evidence,receiptPath,portText,occurrence]=process.argv.slice(2)
assert(runtime&&project&&evidence&&receiptPath&&portText&&occurrence)
assert.equal(process.env.OPENCORVUS_HOME,runtime)
const stage='final-read';assert.equal(path.resolve(runtime),path.resolve('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read/runtime'));assert.equal(Number(portText),18991)
const packageRoot=path.resolve(import.meta.dir,'../../packages/opencorvus'),source=(name:string)=>pathToFileURL(path.join(packageRoot,name)).href
const {installProcessShims}=await import(source('src/runtime/shims.ts'));installProcessShims()
await fs.mkdir(evidence,{recursive:true})
const {RealProviderAudit,installProcessProviderAudit}=await import(source('script/real-provider-audit.ts'))
let audit: InstanceType<typeof RealProviderAudit>
const persist=()=>fsSync.writeFileSync(path.join(evidence,'provider-audit-current.json'),JSON.stringify({at:new Date().toISOString(),maximum:audit.maxRequests,actual:audit.requests.length,exhausted:audit.exhausted,requests:audit.requests,scope:'Final source order read;complete public catalog only;no credentials;zero model requests'},null,2)+'\n')
audit=new RealProviderAudit('gpt-6.1-sol',0,persist)
audit.localOrigins.add('http://127.0.0.1:'+portText)
installProcessProviderAudit(()=>({audit,persist}));persist()
const physical=await import(source('src/runtime/process-occurrence.ts')),owner=physical.currentRuntimeProcessOccurrence(),parent=physical.observedProcessOccurrence(process.ppid)
assert(parent);assert.equal(physical.observeRuntimeProcessOccurrence(parent),'exact_live')
await fs.writeFile(path.join(evidence,'target-admitted.json'),JSON.stringify({owner,parent,occurrence,port:Number(portText),mode:'Final Windows source order/zero model budget/public catalog only/no credentials',stage},null,2),{flag:'wx'})
const monitor=(async()=>{
 let previous='',active=Date.now()
 for(;;){
  let receipt:any,logSize=0
  try{receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  try{logSize=(await fs.stat(path.join(runtime,'log/dev.log'))).size}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  const state=JSON.stringify({receipt,logSize});if(state!==previous){previous=state;active=Date.now()}
  if(receipt){
   assert.equal(receipt.occurrenceID,occurrence);assert.equal(receipt.outcome,'listening');assert.equal(receipt.pid,process.pid)
   const response=await fetch('http://127.0.0.1:'+portText+'/global/health'),health=await response.json() as any
   assert.equal(response.status,200);assert.equal(health.healthy,true)
   persist()
   await fs.writeFile(path.join(evidence,'service-ready.json'),JSON.stringify({owner,parent,occurrence,receipt,health,observedAt:new Date().toISOString(),qualification:'Final source order actual CLI/UI;zero-model/public-catalog read qualification;no Provider credential qualification'},null,2),{flag:'wx'})
   return
  }
  if(Date.now()-active>180000)throw Error('First-run CLI no activity for180s')
  await new Promise(resolve=>setTimeout(resolve,250))
 }
})()
process.argv=[process.execPath,path.join(packageRoot,'src/index.ts'),'serve','--hostname','127.0.0.1','--port',portText,'--project-dir',project,'--startup-receipt',receiptPath,'--startup-occurrence',occurrence,'--parent-pid',String(parent.pid),'--parent-process-instance-id',parent.processInstanceID,'--log-level','DEBUG']
try{await Promise.all([import(source('src/index.ts')),monitor])}finally{persist()}
