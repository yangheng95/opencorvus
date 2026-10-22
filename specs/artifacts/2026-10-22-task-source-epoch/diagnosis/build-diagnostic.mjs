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
  if(file.endsWith('/solid-js/dist/solid.js')){
   source="Error.stackTraceLimit=100;\nconst cleanupActive536=new WeakSet();\nconst cleanupFrames536=[];\n"+source
   source=replace(source,"function cleanNode(node) {","function cleanNode(node) {\n if(cleanupActive536.has(node)) console.warn(\"MT536C\",JSON.stringify({kind:\"cleanup-reentry\",computation:String(node.fn).slice(0,1000),frames:cleanupFrames536.slice(),stack:new Error().stack}));\n cleanupActive536.add(node);\n try {")
   source=replace(source,"for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();","for (i = node.cleanups.length - 1; i >= 0; i--) {\n cleanupFrames536.push(String(node.cleanups[i]).slice(0,1800));\n try {node.cleanups[i]();} finally {cleanupFrames536.pop();}\n }")
   return replace(source,"}\nfunction reset(node, top) {","} finally {cleanupActive536.delete(node)}\n}\nfunction reset(node, top) {")
  }
  if(file.endsWith('/components/CardParts.tsx')){
   source='import { createEffect as traceEffect536, onCleanup as traceCleanup536, untrack as traceUntrack536 } from "solid-js"\nlet traceNextPart536=0\n'+source
   source=replace(source,'  const part = () => props.part',`  const part = () => props.part
  const owner536=++traceNextPart536
  let signature536=""
  traceEffect536(() => {
    const p=part(),signature=JSON.stringify([p.type,p.id,p.messageID,p.sessionID])
    if(signature!==signature536){
      if(p.sessionID==="ses_h0gcSAerl0lMXEbz1cq3") traceUntrack536(() => console.warn("MT536",JSON.stringify({kind:"part-binding",owner:owner536,previous:signature536,current:signature,at:performance.now()})))
      signature536=signature
    }
  })
  traceCleanup536(() => {if(part().sessionID==="ses_h0gcSAerl0lMXEbz1cq3") console.warn("MT536",JSON.stringify({kind:"part-dispose",owner:owner536,signature:signature536,at:performance.now()}))})`)
   return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  }
  if(file.endsWith('/components/SourceParts.tsx')){
   source='import { createEffect as traceSourceEffect536 } from "solid-js"\nlet traceNextSource536=0\n'+source
   source=replace(source,'  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)',`  const sourceOwner536=++traceNextSource536
  let lastSource536=""
  traceSourceEffect536(() => {
    const current=sourceIdentity(props.source)
    if(current!==lastSource536){
      if(props.source.sessionID==="ses_h0gcSAerl0lMXEbz1cq3") untrack(() => console.warn("MT536",JSON.stringify({kind:"source-binding",owner:sourceOwner536,previous:lastSource536,current,at:performance.now()})))
      lastSource536=current
    }
  })
  onMount(() => {if(props.source.sessionID==="ses_h0gcSAerl0lMXEbz1cq3")console.warn("MT536",JSON.stringify({kind:"source-mount",owner:sourceOwner536,identity:lastSource536,at:performance.now()}))})
  onCleanup(() => {if(props.source.sessionID==="ses_h0gcSAerl0lMXEbz1cq3")console.warn("MT536",JSON.stringify({kind:"source-dispose",owner:sourceOwner536,identity:lastSource536,at:performance.now()}))})
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)`)
   source=replace(source,'<div class="msg-source-entry" data-has-excerpt=','<div data-observed-source={sourceOwner536} class="msg-source-entry" data-has-excerpt=')
   return replace(source,'  let group!: HTMLDivElement',`  const groupOwner536=++traceNextSource536
  let lastGroup536=""
  traceSourceEffect536(() => {
    const current=JSON.stringify(props.sources.map(sourceIdentity))
    if(current!==lastGroup536){
      if(props.sources.some(s=>s.sessionID==="ses_h0gcSAerl0lMXEbz1cq3")) untrack(() => console.warn("MT536",JSON.stringify({kind:"source-group-binding",owner:groupOwner536,previous:lastGroup536,current,at:performance.now()})))
      lastGroup536=current
    }
  })
  onCleanup(() => {if(props.sources.some(s=>s.sessionID==="ses_h0gcSAerl0lMXEbz1cq3"))console.warn("MT536",JSON.stringify({kind:"source-group-dispose",owner:groupOwner536,identity:lastGroup536,at:performance.now()}))})
  let group!: HTMLDivElement`)
  }

  if(file.endsWith('/components/SubagentConversationPanel.tsx')){
   source='import { appStore as traceApp536 } from "../store/app"\n'+source
   source=replace(source,'        const delta = await loadSubagentConversation({',`        if(target.sessionID==="ses_h0gcSAerl0lMXEbz1cq3") console.warn("MT536",JSON.stringify({kind:"transcript-read-start",sessionID:target.sessionID,sourceKind:target.source.kind,afterSequence:previous?.lastLiveSequence,afterEpoch:previous?.liveEpoch,at:performance.now()}))
        const delta = await loadSubagentConversation({`)
   source=replace(source,'        // Solid owns settlement of the original resource request.',`        if(target.sessionID==="ses_h0gcSAerl0lMXEbz1cq3") console.warn("MT536",JSON.stringify({kind:"transcript-read-end",sessionID:target.sessionID,mode:delta.transcriptMode,epoch:delta.liveEpoch,sequence:delta.lastLiveSequence,messages:delta.messages.length,at:performance.now()}))
        // Solid owns settlement of the original resource request.`)
   return replace(source,'  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())',`  let tracePanel536=""
  createEffect(() => {
    const current=displayedConversation(),signature=JSON.stringify([traceApp536.connectionStatus,targetKey(),requestKey(),conversation.state,conversation.loading,current?.messages.length??0,props.active(),current?.liveEpoch??0,current?.lastLiveSequence??0])
    if(signature!==tracePanel536){
      if(props.sessionID()==="ses_h0gcSAerl0lMXEbz1cq3") untrack(() => console.warn("MT536",JSON.stringify({kind:"panel-state",previous:tracePanel536,current:signature,at:performance.now()})))
      tracePanel536=signature
    }
  })
  const transcriptRefresh = createSubagentTranscriptRefreshController(() => refetch())`)
  }

  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext536=0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner536=++traceNext536')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner536 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect536, onMount as traceMount536, onCleanup as traceCleanup536, untrack as traceUntrack536 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner536 } = createStreamingTextPartModel(props)
  let traceElement536: HTMLDivElement | undefined
  const traceBinding536 = (kind:string) => traceUntrack536(() => {
    const identity=traceElement536?.closest<HTMLElement>("[data-quotation-message]")
    if(identity?.dataset.quotationSession!=="ses_h0gcSAerl0lMXEbz1cq3") return
    console.warn("MT536",JSON.stringify({kind,owner:traceOwner536,messageID:identity.dataset.quotationMessage,sessionID:identity.dataset.quotationSession,partID:identity.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  let tracePrevious536: {blocks:number,streaming:boolean} | undefined
  traceMount536(() => traceBinding536("body-mount"))
  traceCleanup536(() => traceBinding536("body-dispose"))
  traceEffect536(() => {
    const blocks=frozenHtml().length,streaming=props.streaming===true
    if(!tracePrevious536||(blocks===0)!==(tracePrevious536.blocks===0)||blocks<tracePrevious536.blocks||streaming!==tracePrevious536.streaming)traceBinding536("body-state")
    tracePrevious536={blocks,streaming}
  })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement536} data-observed-renderer={traceOwner536} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/task-source-cleanup-536c-before-bundle/bin/ui'}})
