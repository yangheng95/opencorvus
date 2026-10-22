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
   source='import { createEffect as traceEffect535, onCleanup as traceCleanup535, untrack as traceUntrack535 } from "solid-js"\nlet traceNextPart535=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner535=++traceNextPart535
  let signature535=""
  traceEffect535(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature535){
      if(p.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") traceUntrack535(() => console.warn("MT535",JSON.stringify({kind:"part-binding",owner:owner535,previous:signature535,current:signature,at:performance.now()})))
      signature535=signature
    }
  })
  traceCleanup535(() => {if(part().sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") console.warn("MT535",JSON.stringify({kind:"part-dispose",owner:owner535,signature:signature535,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect535 } from "solid-js"\nlet traceNextSource535=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner535=++traceNextSource535
  let lastSource535=""
  traceSourceEffect535(() => {
    const current=sourceIdentity(props.source)
    if(current!==lastSource535){
      if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.warn("MT535",JSON.stringify({kind:"source-binding",owner:sourceOwner535,previous:lastSource535,current,at:performance.now()})))
      lastSource535=current
    }
  })
  onMount(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.warn("MT535",JSON.stringify({kind:"source-mount",owner:sourceOwner535,identity:lastSource535,at:performance.now()}))})
  onCleanup(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.warn("MT535",JSON.stringify({kind:"source-dispose",owner:sourceOwner535,identity:lastSource535,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner535} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner535=++traceNextSource535
  let lastGroup535=""
  traceSourceEffect535(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    if(current!==lastGroup535){
      if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")) untrack(() => console.warn("MT535",JSON.stringify({kind:"source-group-binding",owner:groupOwner535,previous:lastGroup535,current,at:performance.now()})))
      lastGroup535=current
    }
  })
  onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN"))console.warn("MT535",JSON.stringify({kind:"source-group-dispose",owner:groupOwner535,identity:lastGroup535,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/components/SubagentConversationPanel.tsx')){
   source='import { appStore as traceApp535 } from "../store/app"\n'+source
   return replace(source,'  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())',`  let tracePanel535=""
  createEffect(() => {
    const current=displayedConversation(),signature=JSON.stringify([traceApp535.connectionStatus,targetKey(),requestKey(),conversation.state,conversation.loading,current?.messages.length??0,props.active()])
    if(signature!==tracePanel535){
      if(props.sessionID()==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.warn("MT535",JSON.stringify({kind:"panel-state",previous:tracePanel535,current:signature,at:performance.now()})))
      tracePanel535=signature
    }
  })
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())`)
  }

  if(file.endsWith('/services/markdown-render.ts')){
   source=replace(source,'    resultHtml = []','    console.warn("MT535",JSON.stringify({kind:"renderer-send",owner,revision:request.revision,textLength:request.text.length,streaming:request.streaming,at:performance.now()}))\n    resultHtml = []')
   source=replace(source,'    receive(reply, inFlight)','    console.warn("MT535",JSON.stringify({kind:"renderer-reply",owner,revision:reply.revision,start:reply.start,blocks:reply.html.length,done:reply.done,error:reply.error,at:performance.now()}))\n    receive(reply, inFlight)')
   source=replace(source,'        if (result) {','        if (result) {\n          console.warn("MT535",JSON.stringify({kind:"renderer-cache-hit",owner,revision,textLength:text.length,blocks:result.artifact.html.length,at:performance.now()}))')
   return source
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext535=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner535=++traceNext535')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner535 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect535, onMount as traceMount535, onCleanup as traceCleanup535, untrack as traceUntrack535 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner535 } = createStreamingTextPartModel(props)
  let traceElement535: HTMLDivElement | undefined
  const traceBinding535 = (kind:string) => traceUntrack535(() => {
    const identity=traceElement535?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_-zUS0WzzQzzDOGrIbYwN") return
    console.warn("MT535",JSON.stringify({kind,owner:traceOwner535,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious535: {blocks:number,streaming:boolean,pending:boolean} | undefined
  traceMount535(() => traceBinding535("body-mount"))
  traceCleanup535(() => traceBinding535("body-dispose"))
  traceEffect535(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true,waiting=pending()
    if(!tracePrevious535||(blocks===0)!==(tracePrevious535.blocks===0)||blocks<tracePrevious535.blocks||streaming!==tracePrevious535.streaming||waiting!==tracePrevious535.pending)traceBinding535("body-state")
    tracePrevious535={blocks,streaming,pending:waiting}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement535} data-observed-renderer={traceOwner535} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-reconnect-history-535-before-bundle/bin/ui'}})
