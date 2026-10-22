import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,'Passive diagnostic anchor: '+a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-permission-close-cause-observation',enforce:'pre',
 transform(source,id){
  const file=id.replaceAll('\\','/')
  if(file.endsWith('/components/ui/Dialog.tsx')){
   source=replace(source,'  function closeFromKobalte(nextOpen: boolean) {',`  function closeFromKobalte(nextOpen: boolean) {
    console.debug("DL530",JSON.stringify({kind:"close-request",id:rest.id,nextOpen,modal:local.modal,focusTag:document.activeElement?.tagName,at:performance.now()}))`)
   source=replace(source,'  function handleInteractOutside(event: Event) {',`  function handleInteractOutside(event: Event) {
    console.debug("DL530",JSON.stringify({kind:"interact-outside",id:rest.id,event:event.type,originalEvent:(event as CustomEvent).detail?.originalEvent?.type,modal:local.modal,backdropClose:local.backdropClose,defaultPrevented:event.defaultPrevented,focusTag:document.activeElement?.tagName,at:performance.now()}))`)
   source=replace(source,'          onInteractOutside={handleInteractOutside}',`          onFocusOutside={(event) => console.debug("DL530",JSON.stringify({kind:"focus-outside",id:rest.id,originalEvent:event.detail.originalEvent.type,defaultPrevented:event.defaultPrevented,at:performance.now()}))}
          onEscapeKeyDown={() => console.debug("DL530",JSON.stringify({kind:"escape-key",id:rest.id,at:performance.now()}))}
          onInteractOutside={handleInteractOutside}`)
   return source
  }
  if(file.endsWith('/components/InteractionDialogHost.tsx'))return replace(source,'          onClose={() => {',`          onClose={() => {
            console.debug("DL530",JSON.stringify({kind:"interaction-dismiss",requestID:it.id,interactionType:it.type,at:performance.now()}))`)
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/permission-focus-dismissal-530-before-bundle/bin/ui'}})
