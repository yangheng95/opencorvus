
import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
const [root]=process.argv.slice(2)
const get=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const [startup,seed]=await Promise.all([get("before-startup.json"),get("before-task-follow-up.json")])
const directory=path.join(root,"project-task"),id=seed.task.data.task_id
const call=async(route,method="GET",body)=>{
  const u=new URL(route,startup.url)
  u.searchParams.set("directory",directory)
  const r=await fetch(u,{method,...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})})
  return {status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:await r.json()}
}
const read=async()=>{
  const x=await call("/task/"+id); assert.equal(x.status,200)
  return {status:x.data.status,life:x.data.executionLifecycle,sessionID:x.data.sessionID}
}
async function waitFor(test,limit=24_000){
  const deadline=Date.now()+limit
  do{
    const s=await read()
    if(test(s))return s
    await new Promise(r=>setTimeout(r,280))
  }while(Date.now()<deadline)
  throw new Error("task lifecycle did not converge")
}
const failed=await waitFor(t=>t.status==="failed")
const body={text:"B161 exact operator note delivered after a missing receipt",source:"panel",model:"b161-review/offline"}
const add=async()=>{
  const x=await call("/task/"+id+"/message","POST",body)
  assert.equal(x.status,202)
  assert.equal(x.data.wake_status,"accepted")
  assert.ok(x.data.ingress_id)
  return {status:x.status,trace:x.trace,ingressID:x.data.ingress_id,wakeStatus:x.data.wake_status,
    userMessageID:x.data.user_message.info.id,sessionID:x.data.user_message.info.sessionID}
}
const reopened=await add()
const secondFailure=await waitFor(t=>t.status==="failed" && t.life.epoch===failed.life.epoch+1)
const repeated=await add()
const third=await waitFor(t=>t.life.epoch===secondFailure.life.epoch+1)
assert.notEqual(reopened.userMessageID,repeated.userMessageID)
assert.notEqual(reopened.ingressID,repeated.ingressID)
assert.equal(reopened.sessionID,repeated.sessionID)
const proof={failed,reopened,secondFailure,repeated,third}
await fs.writeFile(path.join(root,"before-terminal-replay.json"),JSON.stringify(proof,null,2)+"\n")
console.log(JSON.stringify(proof))
