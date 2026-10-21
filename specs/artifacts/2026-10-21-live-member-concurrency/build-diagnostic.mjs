import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..'),stage=process.argv[2]
assert(stage==='before'||stage==='after')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-live-member-lifecycle-observation',enforce:'pre',
 transform(source,id){
  const file=id.replaceAll('\\','/')
  if(file.endsWith('/store/card-tree.ts')){
   source='import { untrack as traceUntrack508 } from "solid-js"\n'+source
   return replace(source,'  setCardTreeStore("treeEpoch", (epoch) => epoch + 1)','  traceUntrack508(() => console.debug("LV508",JSON.stringify({kind:"tree-replaced",document:performance.timeOrigin,previous:cardTreeStore.treeEpoch,options,at:performance.now()})))\n  setCardTreeStore("treeEpoch", (epoch) => epoch + 1)')
  }
  if(file.endsWith('/components/CardParts.tsx'))return replace(source,'<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>','<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext508 = 0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner508 = ++traceNext508')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner508 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect508, onMount as traceMount508, onCleanup as traceCleanup508, untrack as traceUntrack508 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner508 } = createStreamingTextPartModel(props)
  let traceElement508: HTMLDivElement | undefined
  let traceIdentityObserver508: MutationObserver | undefined
  let traceSignature508 = ""
  let traceLatest508: Record<string, unknown> | undefined
  const traceBinding508 = (kind: string, force = false) => traceUntrack508(() => {
    const identity=traceElement508?.closest<HTMLElement>("[data-quotation-message]")
    const facts={kind,document:performance.timeOrigin,owner:traceOwner508,messageID:identity?.dataset.quotationMessage,sessionID:identity?.dataset.quotationSession,partID:identity?.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}
    traceLatest508 = facts
    const signature=JSON.stringify([facts.messageID,facts.sessionID,facts.partID,facts.streaming,facts.htmlBlocks,facts.pending])
    if(force||signature!==traceSignature508){traceSignature508=signature;console.debug("LV508",JSON.stringify(facts))}
  })
  traceMount508(() => {
    traceBinding508("body-mount",true)
    const identity=traceElement508?.closest<HTMLElement>("[data-quotation-message]")
    if(identity){traceIdentityObserver508=new MutationObserver(() => traceBinding508("body-binding"));traceIdentityObserver508.observe(identity,{attributes:true,attributeFilter:["data-quotation-message","data-quotation-session","data-observed-part"]})}
  })
  traceCleanup508(() => {traceIdentityObserver508?.disconnect();if(traceLatest508)console.debug("LV508",JSON.stringify({...traceLatest508,kind:"body-dispose",at:performance.now()}))})
  traceEffect508(() => {const text=props.text,streaming=props.streaming,blocks=frozenHtml().length,waiting=pending();traceBinding508("body-state")})`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement508} data-observed-document={performance.timeOrigin} data-observed-renderer={traceOwner508} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,minify:false,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/live-member-concurrency-508-'+stage+'-bundle/bin/ui'}})

