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
   source='import { untrack as traceUntrack504 } from "solid-js"\nlet traceNext504 = 0\n'+source
   source=replace(source,'  let latestStreaming = false',`  let latestStreaming = false
  const traceOwner504 = ++traceNext504
  const traceCommit504 = (next: string[]) => {
    const facts = traceUntrack504(() => ({kind:"commit",owner:traceOwner504,revision,receivedRevision,before:frozenHtml().length,after:next.length,target:target.length,complete,pending:pending(),streaming:props.streaming===true,textLength:props.text.length,at:performance.now()}))
    if(facts.before!==facts.after)console.debug("MD504",JSON.stringify(facts))
    setFrozenHtml(next)
  }
  console.debug("MD504",JSON.stringify({kind:"create",owner:traceOwner504,at:performance.now()}))
  onCleanup(() => console.debug("MD504",JSON.stringify({kind:"dispose",owner:traceOwner504,at:performance.now()})))`)
   source=source.replaceAll('setFrozenHtml(next.slice())','traceCommit504(next.slice())').replaceAll('setFrozenHtml(target.slice())','traceCommit504(target.slice())').replaceAll('setFrozenHtml([])','traceCommit504([])')
   return replace(source,'return { frozenHtml, pending, error }','return { frozenHtml, pending, error, traceOwner504 }')
  }
  if(file.endsWith('/components/TextPart.tsx')){
   source='import { createEffect as traceEffect504, onMount as traceMount504, untrack as traceUntrack504 } from "solid-js"\n'+source
   source=replace(source,'  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)',`  const { frozenHtml, pending, error, traceOwner504 } = createStreamingTextPartModel(props)
  let traceElement504: HTMLDivElement | undefined
  const traceBinding504 = (kind: string) => traceUntrack504(() => {
    const identity = traceElement504?.closest<HTMLElement>("[data-quotation-message]")
    console.debug("MD504",JSON.stringify({kind,owner:traceOwner504,messageID:identity?.dataset.quotationMessage,sessionID:identity?.dataset.quotationSession,partID:identity?.dataset.observedPart,textLength:props.text.length,streaming:props.streaming===true,htmlBlocks:frozenHtml().length,pending:pending(),at:performance.now()}))
  })
  traceMount504(() => traceBinding504("mount"))
  traceEffect504(() => { const text=props.text,streaming=props.streaming; traceBinding504("input") })`)
   return replace(source,'<div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>','<div ref={traceElement504} data-observed-renderer={traceOwner504} class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>')
  }
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,minify:false,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/task-member-stream-504-'+stage+'-bundle/bin/ui'}})
