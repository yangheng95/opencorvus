import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..'),stage=process.argv[2]
assert(stage==='before'||stage==='after')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-mount-causality-observation',enforce:'pre',
 transform(source,id){
  const file=id.replaceAll('\\','/')
  if(stage==='after'&&file.endsWith('/virtua/lib/solid/index.jsx')){
   console.log('507 passive Virtualizer dataSlice observation installed on the pinned Solid source')
   return replace(source,'        return { _items: items, _indexes: indexes };',`        if (props.scrollRef?.id === "chatScroll") untrack(() => console.debug("MT507", JSON.stringify({kind:"virtual-range",range:range(),data:props.data.slice(),items:items.slice(),indexes:indexes.slice(),keepMounted:props.keepMounted?.slice(),offset:store.$getScrollOffset(),viewport:store.$getViewportSize(),at:performance.now()})))
        return { _items: items, _indexes: indexes };`)
  }
  if(file.endsWith('/store/card-tree.ts')){
   source='import { untrack as traceUntrack507 } from "solid-js"\n'+source
   return replace(source,'  setCardTreeStore("treeEpoch", (epoch) => epoch + 1)','  traceUntrack507(() => console.debug("MT507",JSON.stringify({kind:"tree-replaced",previous:cardTreeStore.treeEpoch,options,at:performance.now()})))\n  setCardTreeStore("treeEpoch", (epoch) => epoch + 1)')
  }
  if(file.endsWith('/components/Conversation.tsx')){
   source=replace(source,'  const item = createMemo(props.item)',`  const item = createMemo(props.item)
  let traceRow507: HTMLDivElement | undefined
  const traceRowFact507 = (kind: string) => untrack(() => {
    const scroll=traceRow507?.closest<HTMLElement>("#chatScroll"),rect=traceRow507?.getBoundingClientRect(),viewport=scroll?.getBoundingClientRect()
    console.debug("MT507",JSON.stringify({kind,id:item().id,treeEpoch:cardTreeStore.treeEpoch,replaceCause:cardTreeStore.treeReplacementCause,connected:traceRow507?.isConnected,top:rect?.top,bottom:rect?.bottom,height:rect?.height,viewportTop:viewport?.top,viewportBottom:viewport?.bottom,scrollTop:scroll?.scrollTop,scrollHeight:scroll?.scrollHeight,clientHeight:scroll?.clientHeight,buffer:VIRTUAL_BUFFER_PIXELS,at:performance.now()}))
  })
  onMount(() => traceRowFact507("row-mount"))
  onCleanup(() => traceRowFact507("row-dispose"))`)
   return replace(source,'<div class="conversation-virtual-item" data-virtual-card-id={item().id}>','<div ref={traceRow507} class="conversation-virtual-item" data-virtual-card-id={item().id}>')
  }
  if(file.endsWith('/components/CardParts.tsx'))return replace(source,
   '<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>',
   '<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  if(file.endsWith('/components/text-part-model.ts')){
   source='let traceNext507 = 0\n'+source
   source=replace(source,'  let latestStreaming = false','  let latestStreaming = false\n  const traceOwner507 = ++traceNext507')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner507 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect507, onMount as traceMount507, onCleanup as traceCleanup507, untrack as traceUntrack507 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner507 } = createStreamingTextPartModel(props)
  let traceElement507: HTMLDivElement | undefined
  const traceBinding507 = (kind: string) => traceUntrack507(() => {
    const identity=traceElement507?.closest<HTMLElement>("[data-quotation-message]")
    console.debug("MT507",JSON.stringify({kind,owner:traceOwner507,messageID:identity?.dataset.quotationMessage,sessionID:identity?.dataset.quotationSession,partID:identity?.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  traceMount507(() => traceBinding507("body-mount"))
  traceCleanup507(() => traceBinding507("body-dispose"))
  traceEffect507(() => { const blocks=frozenHtml().length,waiting=pending(); traceBinding507("body-state") })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement507} data-observed-renderer={traceOwner507} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,minify:false,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/render-mount-causality-507-'+stage+'-bundle/bin/ui'}})
