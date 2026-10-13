import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root = path.resolve(process.argv[2]!)
const authSource = process.argv[3]!
const { installProcessShims } = await import("../packages/opencorvus/src/runtime/shims")
installProcessShims()
const { declareNativeTaskProcessDeployment } = await import("../packages/opencorvus/src/runtime/task-process-deployment")
declareNativeTaskProcessDeployment()
const { CredentialRedactor, RealProviderAudit, installProcessProviderAudit } = await import("../packages/opencorvus/script/real-provider-audit")
const redactor = new CredentialRedactor()
const publish = async (name: string, data: unknown) => fs.writeFile(path.join(root, name), redactor.redact(JSON.stringify(data, null, 2)))
const { stageDiagnosticProvider } = await import("../packages/opencorvus/script/evolution-diagnostic-provider")
await fs.mkdir(path.join(root, "runtime", "data"), { recursive: true })
const authority = await stageDiagnosticProvider({ authSource, dataDirectory: path.join(root, "runtime", "data"), modelID: "gpt-6.1-sol", redactor })
const state = installProcessProviderAudit(() => {
  let audit!: InstanceType<typeof RealProviderAudit>
  const persist = () => { void publish("provider-audit.json", { pid: process.pid, model: "gpt-6.1-sol", requests: audit.requests }) }
  audit = new RealProviderAudit("gpt-6.1-sol", 6, persist, { copiedOAuthExpiresAt: authority.copiedOAuthExpiresAt }, undefined, { redactor })
  return { audit, persist }
})
const { Log } = await import("../packages/opencorvus/src/util/log")
await Log.init({ print: false })
const { Config } = await import("../packages/opencorvus/src/config/config")
const { Instance } = await import("../packages/opencorvus/src/project/instance")
const { Auth } = await import("../packages/opencorvus/src/auth")
const { Provider } = await import("../packages/opencorvus/src/provider/provider")
const { SessionStatus } = await import("../packages/opencorvus/src/session/status")
const { Session } = await import("../packages/opencorvus/src/session")
const { Database } = await import("../packages/opencorvus/src/storage/db")
const { listenWithRecoveredServerRuntime } = await import("../packages/opencorvus/src/cli/server-runtime")
const { freezeOverlayUiDirectory } = await import("../packages/opencorvus/src/server/overlay-ui")
const { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded } = await import("../packages/opencorvus/src/engine/host-recovery")
const physical = await import("../packages/opencorvus/src/runtime/process-occurrence")
const directory = path.join(root, "project")
await fs.mkdir(directory, { recursive: true })
const git = (args: string[]) => {
  const result = Bun.spawnSync(["git", "-C", directory, ...args], { stdout: "pipe", stderr: "pipe" })
  assert.equal(result.exitCode, 0, `Owned Git ${args[0]} failed`)
}
git(["init"])
git(["config", "user.name", "Owned Provider Qualification"])
git(["config", "user.email", "owned-shutdown@example.invalid"])
await fs.writeFile(path.join(directory, "README.md"), "# Owned Provider runnable regression qualification\n")
git(["add", "README.md"])
git(["commit", "-m", "Owned isolated model qualification"])
await Config.updateGlobalPatch({ provider: { 'owned-sol-empty': {name:'Own empty declaration',api:'http://127.0.0.1:1/empty/v1',models:{},options:{metadata:{removed:null}}} }, model: "openai/gpt-6.1-sol", small_model: "openai/gpt-6.1-sol", prompt_profile: { active: "base" }, experimental: { memory: { enabled: false } } })
const ownConfig = await Config.getGlobal()
assert.deepEqual(ownConfig.provider?.['owned-sol-empty']?.models,{})
assert.deepEqual(ownConfig.provider?.['owned-sol-empty']?.options?.metadata,{})
const ownOverlay = Config.previewOverlayUpdate(ownConfig,{},Config.Overlay.parse({prompt:{owned:null}}))
assert.deepEqual(ownOverlay.nextOverlay,{prompt:{}})
await publish('empty-config-ready.json',{models:{},metadata:{},nextOverlay:ownOverlay.nextOverlay,model:'openai/gpt-6.1-sol',boundary:'Actual fresh Config writer and current overlay primitive before real streaming execution'})
await Instance.provide({ directory, fn: async () => {
  const credential = await Auth.get("openai")
  assert.equal(credential?.type, "oauth")
  const model = await Provider.getModel("openai", "gpt-6.1-sol")
  assert.equal(model.api.id, "gpt-6.1-sol")
  await publish("authority-ready.json", { pid: process.pid, owner: physical.currentRuntimeProcessOccurrence(), credential: "available", target: "openai/gpt-6.1-sol", apiModel: model.api.id, pairedModels: true, catalog: "projected", executionStarted: false })
} })
let runtime: Awaited<ReturnType<typeof listenWithRecoveredServerRuntime>> | undefined
let success=false
const stop=async()=> runtime ? runtime.server.stop(true) : Instance.disposeAll()
const deadline=setTimeout(()=>{ void stop() },480_000)
try {
  runtime=await listenWithRecoveredServerRuntime({disposeInstances:()=>Instance.disposeAll(),options:{hostname:"127.0.0.1",port:18592,overlayUiSource:freezeOverlayUiDirectory({directory:path.resolve("../../.tmp-codex-provider-empty-declarations-01a133/ui-after")})},recover:async()=>{
    const result=await recoverStartedTaskExecutions({scopeProjectWorktree:directory})
    assertStartedTaskProjectRecoverySucceeded(result)
  }})
  await runtime.recovery
  const origin=new URL("http://127.0.0.1:18592")
  state.audit.localOrigins.add(origin.origin)
  const preflight=await state.audit.preflight({serverURL:origin,model:"openai/gpt-6.1-sol",inactivityMs:180_000,activity:SessionStatus.getActivity})
  await publish("preflight-ready.json",{preflight,requestCount:state.audit.requests.length,executionStarted:false})
  const response=await state.audit.nativeFetch(new URL("/global/chat/start",origin),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestID:crypto.randomUUID(),model:"openai/gpt-6.1-sol",text:"Empty configuration objects and overlay merge regression qualification. Reply with exactly READY. No tools are needed."})})
  assert.equal(response.status,202)
  const chat=await response.json() as any
  await publish("accepted.json",{status:response.status,sessionID:chat.session.id,messageID:chat.messageID})
  let result:any
  let signature=""
  let lastActivity=Date.now()
  for (;;) {
    const url=new URL(`/session/${chat.session.id}/message`,origin)
    url.searchParams.set("directory",chat.session.directory)
    const read=await state.audit.nativeFetch(url)
    assert.equal(read.status,200)
    const messages=await read.json() as any[]
    const assistant=messages.find(entry=>entry.info.role==="assistant"&&entry.info.parentID===chat.messageID)
    const next=JSON.stringify({messages,activity:SessionStatus.getActivity(chat.session.id)})
    if(next!==signature){signature=next;lastActivity=Date.now()}
    if(assistant?.info.error)throw Error(`Provider qualification: ${JSON.stringify(assistant.info.error)}`)
    if(assistant?.info.time.completed){result=assistant;break}
    if(state.audit.exhausted)throw Error("Qualification request budget exhausted")
    if(Date.now()-lastActivity>180_000)throw Error("Provider qualification inactivity")
    await Bun.sleep(500)
  }
  const text=result.parts.filter((part:any)=>part.type==="text").map((part:any)=>part.text).join("").trim()
  assert.equal(text,"READY")
  assert.equal(result.info.providerID,"openai")
  assert.equal(result.info.modelID,"gpt-6.1-sol")
  const request=state.audit.requests.find(entry=>{
    const context=entry.response_reader.requestContext
    return context?.sessionID===chat.session.id && context.streamRequest.requestID===chat.messageID && context.streamRequest.agentID==="chat" && context.activity?.assistantMessageID===result.info.id
  })
  assert(request)
  assert.equal(request.model,"gpt-6.1-sol")
  assert.equal(request.streaming,true)
  assert.equal(request.status,200)
  let readerSignature=""
  let readerActivity=Date.now()
  for (;;) {
    const observations=state.audit.requests.map(entry=>entry.response_reader)
    const next=JSON.stringify(observations)
    if(next!==readerSignature){readerSignature=next;readerActivity=Date.now()}
    if(observations.every(observed=>observed.state==="settled"))break
    if(Date.now()-readerActivity>180_000)throw Error("Provider qualification reader inactivity")
    await Bun.sleep(500)
  }
  for(const entry of state.audit.requests){
    assert.equal(entry.model,"gpt-6.1-sol")
    assert.equal(entry.status,200)
    assert.equal(entry.streaming,true)
    assert.equal(entry.response_reader.terminal?.kind,"eof")
  }
  assert.equal(request.response_reader.state,"settled")
  assert.equal(request.response_reader.terminal?.kind,"eof")
  await publish("qualified.json",{success:true,status:202,sessionID:chat.session.id,messageID:chat.messageID,assistantID:result.info.id,text,model:result.info.modelID,provider:result.info.providerID,completedAt:result.info.time.completed,request,requests:state.audit.requests})
  success=true
} catch(error){
  await publish("failure.json",{message:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined,requests:state.audit.requests})
} finally {
  clearTimeout(deadline)
  await stop()
  await Database.awaitEffectIdle(5000)
  Database.close()
  await Log.close()
  state.audit[Symbol.dispose]()
  await publish("provider-audit-final.json",{model:"gpt-6.1-sol",requests:state.audit.requests})
  await publish("terminal.json",{pid:process.pid,success,completedAt:new Date().toISOString(),listenerStop:"settled",copiedPairCleanup:"parent after actual exit"})
}
process.exit(success?0:1)
