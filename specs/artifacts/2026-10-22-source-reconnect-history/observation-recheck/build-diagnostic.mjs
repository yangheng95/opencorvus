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
   source='import { createEffect as traceEffect535b, onCleanup as traceCleanup535b, untrack as traceUntrack535b } from "solid-js"\nlet traceNextPart535b=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner535b=++traceNextPart535b
  let signature535b=""
  traceEffect535b(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature535b){
      if(p.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") traceUntrack535b(() => console.warn("MT535b",JSON.stringify({kind:"part-binding",owner:owner535b,previous:signature535b,current:signature,at:performance.now()})))
      signature535b=signature
    }
  })
  traceCleanup535b(() => {if(part().sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") console.warn("MT535b",JSON.stringify({kind:"part-dispose",owner:owner535b,signature:signature535b,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect535b } from "solid-js"\nlet traceNextSource535b=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner535b=++traceNextSource535b
  let lastSource535b=""
  traceSourceEffect535b(() => {
    const current=sourceIdentity(props.source)
    if(current!==lastSource535b){
      if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.warn("MT535b",JSON.stringify({kind:"source-binding",owner:sourceOwner535b,previous:lastSource535b,current,at:performance.now()})))
      lastSource535b=current
    }
  })
  onMount(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.warn("MT535b",JSON.stringify({kind:"source-mount",owner:sourceOwner535b,identity:lastSource535b,at:performance.now()}))})
  onCleanup(() => {if(props.source.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")console.warn("MT535b",JSON.stringify({kind:"source-dispose",owner:sourceOwner535b,identity:lastSource535b,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner535b} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner535b=++traceNextSource535b
  let lastGroup535b=""
  traceSourceEffect535b(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    if(current!==lastGroup535b){
      if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN")) untrack(() => console.warn("MT535b",JSON.stringify({kind:"source-group-binding",owner:groupOwner535b,previous:lastGroup535b,current,at:performance.now()})))
      lastGroup535b=current
    }
  })
  onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_-zUS0WzzQzzDOGrIbYwN"))console.warn("MT535b",JSON.stringify({kind:"source-group-dispose",owner:groupOwner535b,identity:lastGroup535b,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/components/SubagentConversationPanel.tsx')){
   source='import { appStore as traceApp535b } from "../store/app"\n'+source
   return replace(source,'  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())',`  let tracePanel535b=""
  createEffect(() => {
    const current=displayedConversation(),signature=JSON.stringify([traceApp535b.connectionStatus,targetKey(),requestKey(),conversation.state,conversation.loading,current?.messages.length??0,props.active()])
    if(signature!==tracePanel535b){
      if(props.sessionID()==="ses_-zUS0WzzQzzDOGrIbYwN") untrack(() => console.warn("MT535b",JSON.stringify({kind:"panel-state",previous:tracePanel535b,current:signature,at:performance.now()})))
      tracePanel535b=signature
    }
  })
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())`)
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext535b=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner535b=++traceNext535b')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner535b }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect535b, onMount as traceMount535b, onCleanup as traceCleanup535b, untrack as traceUntrack535b } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner535b } = createStreamingTextPartModel(props)
  let traceElement535b: HTMLDivElement | undefined
  const traceBinding535b = (kind:string) => traceUntrack535b(() => {
    const identity=traceElement535b?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_-zUS0WzzQzzDOGrIbYwN") return
    console.warn("MT535b",JSON.stringify({kind,owner:traceOwner535b,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious535b: {blocks:number,streaming:boolean} | undefined
  traceMount535b(() => traceBinding535b("body-mount"))
  traceCleanup535b(() => traceBinding535b("body-dispose"))
  traceEffect535b(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true
    if(!tracePrevious535b||(blocks===0)!==(tracePrevious535b.blocks===0)||blocks<tracePrevious535b.blocks||streaming!==tracePrevious535b.streaming)traceBinding535b("body-state")
    tracePrevious535b={blocks,streaming}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement535b} data-observed-renderer={traceOwner535b} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-reconnect-observation-535-before-bundle/bin/ui'}})
