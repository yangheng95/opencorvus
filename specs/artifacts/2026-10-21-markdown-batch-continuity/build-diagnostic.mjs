import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..')
const stage=process.argv[2]??'before';assert(stage==='before'||stage==='after')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-markdown-batch-observation',enforce:'pre',
 transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/components/text-part-model.ts'))return
  source='import { untrack as traceUntrack497 } from "solid-js"\n'+source
  source=replace(source,'export function createStreamingTextPartModel','let traceNext497 = 0\nexport function createStreamingTextPartModel')
  source=replace(source,'  let latestStreaming = false',`  let latestStreaming = false
  const traceOwner497 = ++traceNext497
  const traceCommit497 = (next: string[]) => {
    console.debug("MD497", JSON.stringify(traceUntrack497(() => ({kind:"commit",owner:traceOwner497,revision,receivedRevision,before:frozenHtml().length,after:next.length,target:target.length,complete,pending:pending(),streaming:props.streaming===true,textLength:props.text.length,at:performance.now()}))))
    setFrozenHtml(next)
  }
  console.debug("MD497",JSON.stringify({kind:"create",owner:traceOwner497,at:performance.now()}))
  onCleanup(() => console.debug("MD497",JSON.stringify({kind:"dispose",owner:traceOwner497,at:performance.now()})))`)
  source=source.replaceAll('setFrozenHtml(next.slice())','traceCommit497(next.slice())').replaceAll('setFrozenHtml(target.slice())','traceCommit497(target.slice())').replaceAll('setFrozenHtml([])','traceCommit497([])')
  return source
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,minify:false,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/markdown-batch-continuity-497-'+stage+'-bundle/bin/ui'}})
