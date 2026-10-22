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
   source='import { createEffect as traceEffect532, onCleanup as traceCleanup532, untrack as traceUntrack532 } from "solid-js"\nlet traceNextPart532=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner532=++traceNextPart532
  let signature532=""
  traceEffect532(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature532){
      if(p.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") traceUntrack532(() => console.debug("MT532",JSON.stringify({kind:"part-binding",owner:owner532,previous:signature532,current:signature,at:performance.now()})))
      signature532=signature
    }
  })
  traceCleanup532(() => {if(part().sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") console.debug("MT532",JSON.stringify({kind:"part-dispose",owner:owner532,signature:signature532,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect532 } from "solid-js"\nlet traceNextSource532=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner532=++traceNextSource532
  let lastSource532=""
  traceSourceEffect532(() => {
    const current=sourceIdentity(props.source)
    if(current!==lastSource532){
      if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.debug("MT532",JSON.stringify({kind:"source-binding",owner:sourceOwner532,previous:lastSource532,current,at:performance.now()})))
      lastSource532=current
    }
  })
  onMount(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.debug("MT532",JSON.stringify({kind:"source-mount",owner:sourceOwner532,identity:lastSource532,at:performance.now()}))})
  onCleanup(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.debug("MT532",JSON.stringify({kind:"source-dispose",owner:sourceOwner532,identity:lastSource532,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner532} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner532=++traceNextSource532
  let lastGroup532=""
  traceSourceEffect532(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    if(current!==lastGroup532){
      if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")) untrack(() => console.debug("MT532",JSON.stringify({kind:"source-group-binding",owner:groupOwner532,previous:lastGroup532,current,at:performance.now()})))
      lastGroup532=current
    }
  })
  onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN"))console.debug("MT532",JSON.stringify({kind:"source-group-dispose",owner:groupOwner532,identity:lastGroup532,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext532=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner532=++traceNext532')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner532 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect532, onMount as traceMount532, onCleanup as traceCleanup532, untrack as traceUntrack532 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner532 } = createStreamingTextPartModel(props)
  let traceElement532: HTMLDivElement | undefined
  const traceBinding532 = (kind:string) => traceUntrack532(() => {
    const identity=traceElement532?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_-zUS0WzzQzzDOGrIbYwN") return
    console.debug("MT532",JSON.stringify({kind,owner:traceOwner532,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious532: {blocks:number,streaming:boolean} | undefined
  traceMount532(() => traceBinding532("body-mount"))
  traceCleanup532(() => traceBinding532("body-dispose"))
  traceEffect532(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true
    if(!tracePrevious532||(blocks===0)!==(tracePrevious532.blocks===0)||blocks<tracePrevious532.blocks||streaming!==tracePrevious532.streaming)traceBinding532("body-state")
    tracePrevious532={blocks,streaming}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement532} data-observed-renderer={traceOwner532} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-parallel-owner-532-before-bundle/bin/ui'}})
