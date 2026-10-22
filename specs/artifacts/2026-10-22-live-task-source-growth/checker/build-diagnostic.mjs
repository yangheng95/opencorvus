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
   source='import { createEffect as traceEffect537, onCleanup as traceCleanup537, untrack as traceUntrack537 } from "solid-js"\nlet traceNextPart537=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner537=++traceNextPart537
  let signature537=""
  let partTarget537=false
  traceEffect537(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    partTarget537=Boolean(p.sessionID)
    if(signature!==signature537){
      if(Boolean(p.sessionID)) traceUntrack537(() => console.warn("MT537",JSON.stringify({kind:"part-binding",owner:owner537,previous:signature537,current:signature,at:performance.now()})))
      signature537=signature
    }
  })
  traceCleanup537(() => {if(partTarget537) console.warn("MT537",JSON.stringify({kind:"part-dispose",owner:owner537,signature:signature537,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect537 } from "solid-js"\nlet traceNextSource537=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner537=++traceNextSource537
  let lastSource537=""
  let sourceTarget537=false
  traceSourceEffect537(() => {
    const current=sourceIdentity(props.source)
    sourceTarget537=Boolean(props.source.sessionID)
    if(current!==lastSource537){
      if(Boolean(props.source.sessionID)) untrack(() => console.warn("MT537",JSON.stringify({kind:"source-binding",owner:sourceOwner537,previous:lastSource537,current,at:performance.now()})))
      lastSource537=current
    }
  })
  onMount(() => {if(Boolean(props.source.sessionID))console.warn("MT537",JSON.stringify({kind:"source-mount",owner:sourceOwner537,identity:lastSource537,at:performance.now()}))})
  onCleanup(() => {if(sourceTarget537)console.warn("MT537",JSON.stringify({kind:"source-dispose",owner:sourceOwner537,identity:lastSource537,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner537} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner537=++traceNextSource537
  let lastGroup537=""
  let groupTarget537=false
  traceSourceEffect537(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    groupTarget537=props.sources.some(s=>Boolean(s.sessionID))
    if(current!==lastGroup537){
      if(props.sources.some(s=>Boolean(s.sessionID))) untrack(() => console.warn("MT537",JSON.stringify({kind:"source-group-binding",owner:groupOwner537,previous:lastGroup537,current,at:performance.now()})))
      lastGroup537=current
    }
  })
  onCleanup(() => {if(groupTarget537)console.warn("MT537",JSON.stringify({kind:"source-group-dispose",owner:groupOwner537,identity:lastGroup537,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/components/SubagentConversationPanel.tsx')){
   source='import { appStore as traceApp537 } from "../store/app"\n'+source
   source=replace(source,'  const [conversation, { refetch }] = createResource','  let traceReadMembership537=""\n  const [conversation, { refetch }] = createResource')
   source=replace(source,'        const delta = await loadSubagentConversation({',`        if(!previous) console.warn("MT537",JSON.stringify({kind:"transcript-read-start",sessionID:target.sessionID,sourceKind:target.source.kind,afterSequence:previous?.lastLiveSequence,afterEpoch:previous?.liveEpoch,at:performance.now()}))
        const delta = await loadSubagentConversation({`)
   source=replace(source,'        // Solid owns settlement of the original resource request.',`        const traceMembership537=JSON.stringify([target.sessionID,delta.transcriptMode,delta.liveEpoch,delta.messages.map(m=>[m.messageID,m.parts.map(p=>p.id)])])
        if(traceMembership537!==traceReadMembership537) console.warn("MT537",JSON.stringify({kind:"transcript-read-end",sessionID:target.sessionID,afterSequence:previous?.lastLiveSequence,afterEpoch:previous?.liveEpoch,mode:delta.transcriptMode,epoch:delta.liveEpoch,sequence:delta.lastLiveSequence,messages:delta.messages.map(m=>({messageID:m.messageID,parts:m.parts.map(p=>({id:p.id,type:p.type}))})),at:performance.now()}))
        traceReadMembership537=traceMembership537
        // Solid owns settlement of the original resource request.`)
   return replace(source,'  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())',`  let tracePanel537=""
  createEffect(() => {
    const current=displayedConversation(),signature=JSON.stringify([traceApp537.connectionStatus,targetKey(),requestKey(),current?.messages.length??0,props.active(),current?.liveEpoch??0])
    if(signature!==tracePanel537){
      if(props.sessionID()) untrack(() => console.warn("MT537",JSON.stringify({kind:"panel-state",previous:tracePanel537,current:signature,at:performance.now()})))
      tracePanel537=signature
    }
  })
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())`)
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext537=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner537=++traceNext537')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner537 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect537, onMount as traceMount537, onCleanup as traceCleanup537, untrack as traceUntrack537 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner537 } = createStreamingTextPartModel(props)
  let traceElement537: HTMLDivElement | undefined
  let traceSnapshot537: Record<string,unknown> | undefined
  const traceBinding537 = (kind:string) => traceUntrack537(() => {
    const identity=traceElement537?.closest<HTMLElement>("[data-quotation-message]")
    if(!identity?.dataset.quotationSession || !identity.closest(".subagent-conversation-panel")) return
    traceSnapshot537={owner:traceOwner537,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),observedAt:performance.now()}
    console.warn("MT537",JSON.stringify({...traceSnapshot537,kind,at:performance.now()}))
  })
  let tracePrevious537: {blocks:number,streaming:boolean} | undefined
  traceMount537(() => traceBinding537("body-mount"))
  traceCleanup537(() => {if(traceSnapshot537) console.warn("MT537",JSON.stringify({...traceSnapshot537,kind:"body-dispose",snapshot:"last-normal-observation",at:performance.now()}))})
  traceEffect537(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true
    if(!tracePrevious537||(blocks===0)!==(tracePrevious537.blocks===0)||blocks<tracePrevious537.blocks||streaming!==tracePrevious537.streaming)traceBinding537("body-state")
    tracePrevious537={blocks,streaming}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement537} data-observed-renderer={traceOwner537} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-before-bundle/bin/ui'}})
