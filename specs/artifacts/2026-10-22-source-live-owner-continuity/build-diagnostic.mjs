import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,'Diagnostic build anchor: '+a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-source-owner-observation',enforce:'pre',
 transform(source,id){
  const file=id.replaceAll('\\','/')
  if(file.endsWith('/components/CardParts.tsx')){
   source='import { createEffect as traceEffect529, onCleanup as traceCleanup529, untrack as traceUntrack529 } from "solid-js"\nlet traceNextPart529=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner529=++traceNextPart529
  let signature529=""
  traceEffect529(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature529){
      if(p.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") traceUntrack529(() => console.debug("MT529",JSON.stringify({kind:"part-binding",owner:owner529,previous:signature529,current:signature,at:performance.now()})))
      signature529=signature
    }
  })
  traceCleanup529(() => {if(part().sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") console.debug("MT529",JSON.stringify({kind:"part-dispose",owner:owner529,signature:signature529,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext529=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner529=++traceNext529')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner529 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect529, onMount as traceMount529, onCleanup as traceCleanup529, untrack as traceUntrack529 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner529 } = createStreamingTextPartModel(props)
  let traceElement529: HTMLDivElement | undefined
  const traceBinding529 = (kind:string) => traceUntrack529(() => {
    const identity=traceElement529?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_-zUS0WzzQzzDOGrIbYwN") return
    console.debug("MT529",JSON.stringify({kind,owner:traceOwner529,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious529: {blocks:number,streaming:boolean} | undefined
  traceMount529(() => traceBinding529("body-mount"))
  traceCleanup529(() => traceBinding529("body-dispose"))
  traceEffect529(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true
    if(!tracePrevious529||(blocks===0)!==(tracePrevious529.blocks===0)||blocks<tracePrevious529.blocks||streaming!==tracePrevious529.streaming)traceBinding529("body-state")
    tracePrevious529={blocks,streaming}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement529} data-observed-renderer={traceOwner529} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-live-owner-continuity-529-before-bundle/bin/ui'}})
