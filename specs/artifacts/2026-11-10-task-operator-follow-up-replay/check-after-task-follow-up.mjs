
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root,phase="initial"]=process.argv.slice(2)
const get=async n=>JSON.parse(await fs.readFile(path.join(root,n+".json"),"utf8"))
const launch=await get("after-startup")
const base=await get("before-task-follow-up"),smoke=await get("candidate-smoke")
const main=path.join(root,"project-task"),sibling=path.join(root,"project-task-sibling")
const model="b161-review/offline",next="b161-next/offline",mainTask=base.task.data.task_id
const options=(method,body)=>({method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
const call=async(route,method="GET",body,directory=main,expect)=>{
  const u=new URL(route,launch.url);u.searchParams.set("directory",directory)
  const r=await fetch(u,options(method,body));const x={status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:await r.json()}
  if(expect!==undefined) assert.equal(x.status,expect,JSON.stringify({route,...x}))
  return x
}
const brief=async(id,directory=main)=>{const r=await call("/task/"+id,"GET",undefined,directory,200);return {sessionID:r.data.sessionID,status:r.data.status,lifecycle:r.data.executionLifecycle}}
const send=async(id,body,directory=main,expected=202)=>{
  const x=await call("/task/"+id+"/message","POST",body,directory,expected)
  if(x.status!==202)return x
  const d=x.data,user=d.user_message.info
  assert.equal(d.wake_status,"accepted");assert.ok(d.ingress_id)
  return {status:x.status,trace:x.trace,ingressID:d.ingress_id,wakeStatus:d.wake_status,user:{
    id:user.id,sessionID:user.sessionID,model:user.model,
    parts:d.user_message.parts.map(p=>Object.fromEntries(Object.entries({id:p.id,type:p.type,text:p.text,url:p.url,filename:p.filename}).filter(([,value])=>value!==undefined))),
  }}
}
const create=async(key,directory=main,desired=model)=>{const r=await call("/task","POST",{
  title:key,request:"Isolated Task acceptance review",requestID:key,productPillar:"work",promptProfile:"dynamic",model:desired
},directory,202);return r.data.task_id}
const wait=async (id,test,directory=main)=>{
  const end=Date.now()+20_000
  do{
    const v=await brief(id,directory)
    if(test(v))return v
    await new Promise(resolve=>setTimeout(resolve,280))
  }while(Date.now()<end)
  throw new Error("Task did not settle "+id)
}
const note={text:"B161 candidate acceptance on the upgraded historical Task",source:"panel",model,requestID:"b161-after-replay-v13"}
let proof
if(phase==="initial"){
  const terminal=await wait(mainTask,x=>x.status==="failed" && x.lifecycle.epoch===4)
  const moved=await send(mainTask,note)
  assert.equal(moved.ingressID,smoke.a.data.ingress_id)
  assert.equal(moved.user.id,smoke.a.data.user_message.info.id)
  assert.notEqual(moved.user.sessionID,terminal.sessionID)
  assert.deepEqual(await brief(mainTask),terminal)
  const distinctTask=await create("B161 separate author intent and cancellation",sibling)
  const sameKeyOther=await send(distinctTask,note,sibling)
  assert.notEqual(sameKeyOther.user.id,moved.user.id)
  const cancellation=await call("/task/"+distinctTask+"/cancel","POST",{surface:"api",reason:"Close the isolated acceptance comparison"},sibling,202)
  const cancelled=await wait(distinctTask,x=>x.status==="cancelled",sibling)
  const cancelledReplay=await send(distinctTask,note,sibling)
  assert.equal(cancelledReplay.ingressID,sameKeyOther.ingressID)
  assert.equal(cancelledReplay.user.id,sameKeyOther.user.id)
  assert.deepEqual(await brief(distinctTask,sibling),cancelled)
  const removed=await call("/task/"+distinctTask,"DELETE",{surface:"api",reason:"Remove only isolated Task acceptance comparison"},sibling,200)
  const deletedReplay=await send(distinctTask,note,sibling,404)
  assert.equal(deletedReplay.data.name,"NotFoundError")
  const foreign=await send(mainTask,note,sibling,404)
  const unkeyedTask=await create("B161 unkeyed distinct authored actions",sibling)
  const noKey={text:"Explicitly independent unkeyed notes",source:"panel",model}
  const unkeyed=await Promise.all([send(unkeyedTask,noKey,sibling),send(unkeyedTask,noKey,sibling)])
  assert.notEqual(unkeyed[0].user.id,unkeyed[1].user.id)
  assert.notEqual(unkeyed[0].ingressID,unkeyed[1].ingressID)
  const updated=await call("/config","PATCH",{model:next,enabled_providers:["b161-next"],provider:{
    "b161-review":null,"b161-next":{name:"Replacement local model",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
      models:{offline:{name:"Offline replacement",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}}},
  }},main,200)
  const projection=(await call("/config/providers","GET",undefined,main,200)).data.providers.flatMap(p=>Object.keys(p.models).map(m=>p.id+"/"+m))
  assert.equal(updated.data.model,next);assert.deepEqual(projection,[next])
  const retired=await send(mainTask,note)
  assert.deepEqual(retired.user,moved.user)
  assert.equal(retired.ingressID,moved.ingressID)
  const drift=await send(mainTask,{...note,model:next},main,409)
  assert.equal(drift.data.name,"TaskOperatorMessageRequestConflictError")
  const freshRetired=await send(mainTask,{...note,requestID:"b161-new-retired-sample"},main,400)
  assert.equal(freshRetired.data.name,"ProviderModelNotFoundError")
  assert.deepEqual(await brief(mainTask),terminal)
  const fresh=await send(mainTask,{...note,model:next,requestID:"b161-distinct-follow-up-after-retirement",
    text:"A distinct follow-up explicitly opens the next execution",attachments:[{mime:"text/plain",filename:"follow-up.txt",data:"QXV0aG9yIGlucHV0"}]})
  const latest=await brief(mainTask)
  assert.equal(latest.lifecycle.epoch,5)
  assert.notEqual(fresh.user.id,moved.user.id)
  assert.equal(fresh.user.parts.find(p=>p.type==="file").filename,"follow-up.txt")
  proof={terminal,moved,distinctTask,sameKeyOther,cancellation,cancelled,cancelledReplay,removed,deletedReplay,foreign,
    unkeyedTask,unkeyed,projectModel:{configured:updated.data.model,projection},retired,drift,freshRetired,fresh,latest}
}else{
  const before=await get("after-initial")
  const beforeTask=await brief(mainTask)
  const [original,replay]=await Promise.all([send(mainTask,note),send(mainTask,note)])
  assert.deepEqual(original.user,before.retired.user)
  assert.deepEqual(replay.user,before.retired.user)
  assert.equal(replay.ingressID,before.retired.ingressID)
  const deletedReplay=await send(before.distinctTask,note,sibling,404)
  assert.equal(deletedReplay.data.name,"NotFoundError")
  const afterTask=await brief(mainTask)
  assert.deepEqual(afterTask,beforeTask)
  proof={beforeTask,original,replay,deletedReplay,afterTask}
}
await fs.writeFile(path.join(root,"after-"+phase+".json"),JSON.stringify(proof,null,2)+"\n")
console.log(JSON.stringify({phase,stableIngress:proof.retired?.ingressID??proof.replay.ingressID,movedSession:proof.moved?.user.sessionID??proof.original.user.sessionID,
  cancelledEpoch:proof.cancelled?.lifecycle.epoch,epoch:proof.latest?.lifecycle.epoch??proof.afterTask.lifecycle.epoch}))
