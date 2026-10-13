import fs from 'node:fs'
import path from 'node:path'
const root=process.argv[2]!
const {installProcessShims}=await import('../packages/opencorvus/src/runtime/shims')
installProcessShims()
const {freezeOverlayUiDirectory}=await import('../packages/opencorvus/src/server/overlay-ui')
const {Instance}=await import('../packages/opencorvus/src/project/instance')
const {listenWithRecoveredServerRuntime}=await import('../packages/opencorvus/src/cli/server-runtime')
const {recoverStartedTaskExecutions,assertStartedTaskProjectRecoverySucceeded}=await import('../packages/opencorvus/src/engine/host-recovery')
const started=Date.now()
const runtime=await listenWithRecoveredServerRuntime({
 options:{hostname:'127.0.0.1',port:18505,overlayUiSource:freezeOverlayUiDirectory({directory:process.argv[3]!})},
 recover:async()=>{const result=await recoverStartedTaskExecutions({scopeProjectWorktree:process.argv[4]!});assertStartedTaskProjectRecoverySucceeded(result)},
 disposeInstances:()=>Instance.disposeAll(),
})
await runtime.recovery
fs.writeFileSync(path.join(root,'ready.json'),JSON.stringify({pid:process.pid,port:runtime.server.port,started,occurrence:runtime.occurrence,source:'Production listener preparation/recovery and private built UI; fresh credentialless runtime; no model execution'},null,2))
let stopping=false
const stop=async(reason:string)=>{
 if(stopping)return
 stopping=true
 clearInterval(poll);clearTimeout(deadline)
 try{
  await runtime.server.stop(true)
  await runtime.recovery
  fs.writeFileSync(path.join(root,'terminal.json'),JSON.stringify({reason,pid:process.pid,elapsed:Date.now()-started,terminal:'Production process execution settled, listener stopped, runtime handoff released'},null,2))
  process.exit(0)
 }catch(error){console.error(error);process.exit(1)}
}
const poll=setInterval(()=>{if(fs.existsSync(path.join(root,'stop-requested')))void stop('Own pages closed after manual spreadsheet artifact review')},500)
const deadline=setTimeout(()=>void stop('Own isolated service 1200000ms deadline'),1200000)
console.log('Own spreadsheet artifact UI service ready on 18505')
