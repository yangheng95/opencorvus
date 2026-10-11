import { Duplex } from 'node:stream'
import { createGzip,createGunzip,constants } from 'node:zlib'
const encode=new TextEncoder()
const first='data: 首帧 🌐\n\n'
let finish
const last=new Promise(resolve=>finish=resolve)
const source=new ReadableStream({async start(c){c.enqueue(encode.encode(first));await last;c.enqueue(encode.encode('data: end\n\n'));c.close()}})
const compressed=source.pipeThrough(Duplex.toWeb(createGzip({flush:constants.Z_SYNC_FLUSH})))
const decoded=compressed.pipeThrough(Duplex.toWeb(createGunzip()))
const reader=decoded.getReader()
const timer=setTimeout(()=>{throw Error('codec probe deadline')},3000)
const chunk=await reader.read()
const text=new TextDecoder().decode(chunk.value)
if(text!==first)throw Error('first frame delayed or changed')
finish()
let remainder=''
for(;;){const chunk=await reader.read();if(chunk.done)break;remainder+=new TextDecoder().decode(chunk.value)}
reader.releaseLock()
let cancelled
const cancelledPromise=new Promise(resolve=>cancelled=resolve)
const open=new ReadableStream({start(c){c.enqueue(encode.encode(first))},cancel(reason){cancelled(String(reason))}})
const openReader=open.pipeThrough(Duplex.toWeb(createGzip({flush:constants.Z_SYNC_FLUSH}))).getReader()
await openReader.read();await openReader.cancel('owned consumer closed')
const reason=await cancelledPromise
openReader.releaseLock();clearTimeout(timer)
console.log(JSON.stringify({runtime:process.versions.bun?'bun':'node',first:text,remainder,cancelReason:reason}))
