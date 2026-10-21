import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {installNativeTaskStreamObserver} from './network-observer'
const [,runtime,,evidence,,portText,occurrence]=process.argv.slice(2)
const stage=({'18951':'live','18953':'review'} as Record<string,string>)[portText];assert(stage)
assert.equal(path.resolve(runtime),path.resolve(`C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/native-stream-reconnect-512-${stage}/runtime`))
const targetFile=path.join(import.meta.dir,stage+'-network-target.json')
installNativeTaskStreamObserver({evidence,port:Number(portText),occurrence,taskID:()=>JSON.parse(fs.readFileSync(targetFile,'utf8')).taskID,allowedActions:['calibration','browser'],mode:'response-error'})
await import('../task-member-stream-504/serve')
