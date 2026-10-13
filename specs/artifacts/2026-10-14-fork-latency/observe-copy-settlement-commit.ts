import fs from 'node:fs'
import path from 'node:path'
import {Database} from 'bun:sqlite'
const origin='http://127.0.0.1:18521'
const source='ses_-zUS2EY0ezzjFidQwBy1'
const root='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/long-source-reading-406-live'
const directory=path.join(root,'project').replaceAll('/','\\')
const output=path.resolve(import.meta.dir,'copy-settlement-commit.json')
const db=new Database(path.join(root,'runtime/data/opencorvus.db'),{readonly:true})
async function observe(route:string,method='GET'){
 const startedAt=new Date().toISOString(),start=performance.now()
 try{const response=await fetch(origin+route,{method,signal:AbortSignal.timeout(30000)});const body=await response.json();return {route,method,startedAt,completedAt:new Date().toISOString(),durationMs:performance.now()-start,status:response.status,body}}
 catch(error:any){return {route,method,startedAt,completedAt:new Date().toISOString(),durationMs:performance.now()-start,error:error.name,message:error.message}}
}
function publicationState(sessionID:string){
 const q=db.query(`SELECT COUNT(*) AS publications, COALESCE(SUM((SELECT COUNT(*) FROM bus_publication_phase_receipt p WHERE p.occurrence_id=b.occurrence_id)),0) AS phases
 FROM bus_publication_outbox b WHERE json_extract(b.properties,'$.info.id')=? OR json_extract(b.properties,'$.info.sessionID')=? OR json_extract(b.properties,'$.part.sessionID')=? OR json_extract(b.properties,'$.sessionID')=?`)
 try{return q.get(sessionID,sessionID,sessionID,sessionID) as {publications:number;phases:number}}finally{q.finalize()}
}
let copied:Awaited<ReturnType<typeof observe>>|undefined
try{
 const started=performance.now()
 const copy=observe(`/session/${source}/side-chat?${new URLSearchParams({directory})}`,'POST').then(value=>{copied=value;return value})
 const observations=[]
 for(let index=0;index<300;index++){
  const healthy=await observe('/global/health')
  const receipt=copied?.body?.id?publicationState(copied.body.id):undefined
  observations.push({healthy,receipt})
  if(receipt&&receipt.publications>0&&receipt.phases===receipt.publications*3)break
  if(copied&&copied.status!==200)break
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 const result={source,directory,copied:await copy,settledObservedAfterMs:performance.now()-started,observations,
  boundary:'Actual public copy and health requests through all canonical target publication phase receipts. Read-only SQL observes the real copied Session; no UI automation.'}
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({copyStatus:result.copied.status,copyMs:result.copied.durationMs,target:result.copied.body?.id,settledMs:result.settledObservedAfterMs,
  last:observations.at(-1)?.receipt,healthSamples:observations.length,healthMaximumMs:Math.max(...observations.map(x=>x.healthy.durationMs)),output}))
}finally{db.close(true)}
