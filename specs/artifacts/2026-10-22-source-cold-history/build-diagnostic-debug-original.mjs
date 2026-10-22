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
   source='import { createEffect as traceEffect534, onCleanup as traceCleanup534, untrack as traceUntrack534 } from "solid-js"\nlet traceNextPart534=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner534=++traceNextPart534
  let signature534=""
  traceEffect534(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature534){
      if(p.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") traceUntrack534(() => console.debug("MT534",JSON.stringify({kind:"part-binding",owner:owner534,previous:signature534,current:signature,at:performance.now()})))
      signature534=signature
    }
  })
  traceCleanup534(() => {if(part().sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") console.debug("MT534",JSON.stringify({kind:"part-dispose",owner:owner534,signature:signature534,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect534 } from "solid-js"\nlet traceNextSource534=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner534=++traceNextSource534
  let lastSource534=""
  traceSourceEffect534(() => {
    const current=sourceIdentity(props.source)
    if(current!==lastSource534){
      if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.debug("MT534",JSON.stringify({kind:"source-binding",owner:sourceOwner534,previous:lastSource534,current,at:performance.now()})))
      lastSource534=current
    }
  })
  onMount(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.debug("MT534",JSON.stringify({kind:"source-mount",owner:sourceOwner534,identity:lastSource534,at:performance.now()}))})
  onCleanup(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.debug("MT534",JSON.stringify({kind:"source-dispose",owner:sourceOwner534,identity:lastSource534,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner534} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner534=++traceNextSource534
  let lastGroup534=""
  traceSourceEffect534(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    if(current!==lastGroup534){
      if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")) untrack(() => console.debug("MT534",JSON.stringify({kind:"source-group-binding",owner:groupOwner534,previous:lastGroup534,current,at:performance.now()})))
      lastGroup534=current
    }
  })
  onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN"))console.debug("MT534",JSON.stringify({kind:"source-group-dispose",owner:groupOwner534,identity:lastGroup534,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/services/markdown-render.ts')){
   source=replace(source,'    resultHtml = []','    console.debug("MT534",JSON.stringify({kind:"renderer-send",owner,revision:request.revision,textLength:request.text.length,streaming:request.streaming,at:performance.now()}))\n    resultHtml = []')
   source=replace(source,'    receive(reply, inFlight)','    console.debug("MT534",JSON.stringify({kind:"renderer-reply",owner,revision:reply.revision,start:reply.start,blocks:reply.html.length,done:reply.done,error:reply.error,at:performance.now()}))\n    receive(reply, inFlight)')
   source=replace(source,'        if (result) {','        if (result) {\n          console.debug("MT534",JSON.stringify({kind:"renderer-cache-hit",owner,revision,textLength:text.length,blocks:result.artifact.html.length,at:performance.now()}))')
   return source
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext534=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner534=++traceNext534')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner534 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect534, onMount as traceMount534, onCleanup as traceCleanup534, untrack as traceUntrack534 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner534 } = createStreamingTextPartModel(props)
  let traceElement534: HTMLDivElement | undefined
  const traceBinding534 = (kind:string) => traceUntrack534(() => {
    const identity=traceElement534?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_-zUS0WzzQzzDOGrIbYwN") return
    console.debug("MT534",JSON.stringify({kind,owner:traceOwner534,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious534: {blocks:number,streaming:boolean,pending:boolean} | undefined
  traceMount534(() => traceBinding534("body-mount"))
  traceCleanup534(() => traceBinding534("body-dispose"))
  traceEffect534(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true,waiting=pending()
    if(!tracePrevious534||(blocks===0)!==(tracePrevious534.blocks===0)||blocks<tracePrevious534.blocks||streaming!==tracePrevious534.streaming||waiting!==tracePrevious534.pending)traceBinding534("body-state")
    tracePrevious534={blocks,streaming,pending:waiting}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement534} data-observed-renderer={traceOwner534} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-cold-history-534-before-bundle/bin/ui'}})
