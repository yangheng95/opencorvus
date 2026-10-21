import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..'),stage=process.argv[2]
assert(stage==='before'||stage==='after')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-member-renderer-observation',enforce:'pre',
 transform(source,id){
  const file=id.replaceAll('\\','/')
  if(file.endsWith('/components/CardParts.tsx'))return replace(source,
   '<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>',
   '<div data-quotation-message={part().messageID} data-quotation-session={part().sessionID} data-observed-part={part().id}>')
  if(file.endsWith('/components/text-part-model.ts')){
   source='import { untrack as traceUntrack503 } from "solid-js"\nlet traceNext503 = 0\n'+source
   source=replace(source,'  let latestStreaming = false',`  let latestStreaming = false
  const traceOwner503 = ++traceNext503
  const traceCommit503 = (next: string[]) => {
    const facts = traceUntrack503(() => ({kind:"commit",owner:traceOwner503,revision,receivedRevision,before:frozenHtml().length,after:next.length,target:target.length,complete,pending:pending(),streaming:props.streaming===true,textLength:props.text.length,at:performance.now()}))
    if(facts.before!==facts.after)console.debug("MD503",JSON.stringify(facts))
    setFrozenHtml(next)
  }
  console.debug("MD503",JSON.stringify({kind:"create",owner:traceOwner503,at:performance.now()}))
  onCleanup(() => console.debug("MD503",JSON.stringify({kind:"dispose",owner:traceOwner503,at:performance.now()})))`)
   source=source.replaceAll('setFrozenHtml(next.slice())','traceCommit503(next.slice())').replaceAll('setFrozenHtml(target.slice())','traceCommit503(target.slice())').replaceAll('setFrozenHtml([])','traceCommit503([])')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner503 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect503, onMount as traceMount503, untrack as traceUntrack503 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner503 } = createStreamingTextPartModel(props)
  let traceElement503: HTMLDivElement | undefined
  const traceBinding503 = (kind: string) => traceUntrack503(() => {
    const identity = traceElement503?.closest<HTMLElement>("[data-quotation-message]")
    console.debug("MD503",JSON.stringify({kind,owner:traceOwner503,messageID:identity?.dataset.quotationMessage,sessionID:identity?.dataset.quotationSession,partID:identity?.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  traceMount503(() => traceBinding503("mount"))
  traceEffect503(() => { const text=props.text,streaming=props.streaming; traceBinding503("input") })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement503} data-observed-renderer={traceOwner503} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,minify:false,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/member-stream-owner-503-'+stage+'-bundle/bin/ui'}})
