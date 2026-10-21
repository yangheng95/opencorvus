import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {observeRuntimeProcessOccurrence} from '../../packages/opencorvus/src/runtime/process-occurrence'
export function handshakeObserver(gate:string,cwd:string){
 const chunks:Buffer[]=[],facts:any[]=[]
 assert.equal(path.dirname(path.resolve(gate)),path.resolve(cwd))
 return{facts,onData(stream:string,bytes:Buffer,input:any){
  if(stream!=='stdout')return
  chunks.push(bytes)
  if(Buffer.concat(chunks).equals(Buffer.from('early\n'))){
   const ready=JSON.parse(fs.readFileSync(input.request.ready_file,'utf8'))
   const identity={pid:ready.target_pid,processInstanceID:ready.target_process_instance_id,occurrenceID:input.request.request_id}
   const state=observeRuntimeProcessOccurrence(identity);assert.equal(state,'exact_live')
   const receivedAt=performance.now();fs.writeFileSync(gate,JSON.stringify({requestID:input.request.request_id,receivedAt}),{flag:'wx'})
   facts.push({requestID:input.request.request_id,receivedAt,target:identity,state,actualBytes:6})
  }
 }}
}
