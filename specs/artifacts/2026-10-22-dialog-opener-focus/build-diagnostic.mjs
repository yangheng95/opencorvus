import path from 'node:path'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from '../../packages/overlay/node_modules/vite/dist/node/index.js'
const repo=path.resolve(import.meta.dirname,'../..')
const replace=(source,a,b)=>{assert.equal(source.split(a).length,2,'Passive diagnostic anchor: '+a);return source.replace(a,b)}
process.chdir(repo+'/packages/overlay')
const loaded=await loadConfigFromFile({command:'build',mode:'production'},repo+'/packages/overlay/vite.config.ts')
await build({...loaded.config,configFile:false,plugins:[{
 name:'owned-dialog-opener-observation',enforce:'pre',
 transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/components/ui/Dialog.tsx'))return
  source=replace(source,'  let dialogRef: HTMLElement | undefined',`  let observedOpener531: Element | null = null
  const observeFocus531 = (phase:string,event:Event) => {
    const active=document.activeElement
    console.debug("DF531",JSON.stringify({phase,id:rest.id,class:local.class,modal:local.modal,originTag:observedOpener531?.tagName,originID:observedOpener531?.id,originButton:observedOpener531?.tagName==="BUTTON"?observedOpener531.textContent?.trim().slice(0,80):undefined,originConnected:observedOpener531?.isConnected,originRects:observedOpener531?.getClientRects().length,focusTag:active?.tagName,focusID:active?.id,insideDialog:active?dialogRef?.contains(active):false,prevented:event.defaultPrevented,at:performance.now()}))
  }
  let dialogRef: HTMLElement | undefined`)
  return replace(source,'          onInteractOutside={handleInteractOutside}',`          onOpenAutoFocus={(event) => {
            observedOpener531=document.activeElement
            observeFocus531("open-before-caller",event)
            rest.onOpenAutoFocus?.(event)
            observeFocus531("open-after-caller",event)
          }}
          onCloseAutoFocus={(event) => {
            observeFocus531("close-before-caller",event)
            rest.onCloseAutoFocus?.(event)
            observeFocus531("close-after-caller",event)
          }}
          onInteractOutside={handleInteractOutside}`)
 },
},...(loaded.config.plugins??[])],build:{...loaded.config.build,outDir:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/dialog-opener-focus-531-before-bundle/bin/ui'}})
