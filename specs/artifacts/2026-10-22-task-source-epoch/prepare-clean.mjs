import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const original=import.meta.dirname,prior=path.resolve(original,'../task-source-cleanup-536c'),root=path.resolve(original,'../task-source-clean-536d')
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const repair=(s)=>{
 s=replace(s,'  let signature536=""','  let signature536=""\n  let partTarget536=false')
 s=replace(s,'    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])','    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])\n    partTarget536=p.sessionID==="ses_h0gcSAerl0lMXEbz1cq3"')
 s=replace(s,'traceCleanup536(() => {if(part().sessionID==="ses_h0gcSAerl0lMXEbz1cq3")','traceCleanup536(() => {if(partTarget536)')
 s=replace(s,'  let lastSource536=""','  let lastSource536=""\n  let sourceTarget536=false')
 s=replace(s,'    const current=sourceIdentity(props.source)','    const current=sourceIdentity(props.source)\n    sourceTarget536=props.source.sessionID==="ses_h0gcSAerl0lMXEbz1cq3"')
 s=replace(s,'onCleanup(() => {if(props.source.sessionID==="ses_h0gcSAerl0lMXEbz1cq3")','onCleanup(() => {if(sourceTarget536)')
 s=replace(s,'  let lastGroup536=""','  let lastGroup536=""\n  let groupTarget536=false')
 s=replace(s,'    const current=JSON.stringify(props.sources.map(sourceIdentity))','    const current=JSON.stringify(props.sources.map(sourceIdentity))\n    groupTarget536=props.sources.some(s=>s.sessionID==="ses_h0gcSAerl0lMXEbz1cq3")')
 s=replace(s,'onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_h0gcSAerl0lMXEbz1cq3"))','onCleanup(() => {if(groupTarget536)')
 s=replace(s,'  let traceElement536: HTMLDivElement | undefined','  let traceElement536: HTMLDivElement | undefined\n  let traceSnapshot536: Record<string,unknown> | undefined')
 const statement='    console.warn("MT536",JSON.stringify({kind,owner:traceOwner536,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))'
 s=replace(s,statement,'    traceSnapshot536={owner:traceOwner536,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),observedAt:performance.now()}\n    console.warn("MT536",JSON.stringify({...traceSnapshot536,kind,at:performance.now()}))')
 s=replace(s,'  traceCleanup536(() => traceBinding536("body-dispose"))','  traceCleanup536(() => {if(traceSnapshot536) console.warn("MT536",JSON.stringify({...traceSnapshot536,kind:"body-dispose",snapshot:"last-normal-observation",at:performance.now()}))})')
 return s
}
// Repair the current private observer and derive one current implementation.
const repaired=repair(fs.readFileSync(original+'/build-diagnostic.mjs','utf8'))
fs.writeFileSync(original+'/build-diagnostic.mjs',repaired)
fs.mkdirSync(root)
const plan=JSON.parse(fs.readFileSync(prior+'/plan.json','utf8'))
Object.assign(plan,{scope:'task-source-clean-536d',ports:{before:19057,after:19057},source:'Closed536c-before;after copies closed536d-before',flow:'Corrected passive observer;actual Task retirement and same-page epoch recovery;no business input'})
fs.writeFileSync(root+'/plan.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','qualify-provider.ps1','read-task.ts']){
 fs.writeFileSync(root+'/'+file,fs.readFileSync(prior+'/'+file,'utf8').replaceAll('task-source-cleanup-536c','task-source-clean-536d').replaceAll('19055','19057'),{flag:'wx'})
}
let data=fs.readFileSync(prior+'/prepare-data.ts','utf8').replaceAll('task-source-cleanup-536c','task-source-clean-536d').replaceAll('task-source-epoch-536','task-source-cleanup-536c')
data=replace(data,"const priorStage=stage==='before'?'after':'before'","const priorStage='before'")
data=replace(data,"base+'/task-source-cleanup-536c-after'","base+'/task-source-cleanup-536c-before'")
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
fs.writeFileSync(root+'/build-diagnostic.mjs',repaired.replaceAll('task-source-epoch-536','task-source-clean-536d'),{flag:'wx'})
const formal=fs.readFileSync(original+'/build-diagnostic.mjs','utf8')
fs.writeFileSync(root+'/build-formal.mjs',formal.slice(0,formal.indexOf('await build('))+"await build({...loaded.config,configFile:false,build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/task-source-clean-536d-after-bundle/bin/ui'}})\n",{flag:'wx'})
