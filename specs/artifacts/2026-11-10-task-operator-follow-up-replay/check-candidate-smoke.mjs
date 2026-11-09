
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root]=process.argv.slice(2)
const get=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const launch=await get("after-startup.json"),seed=await get("before-task-follow-up.json")
const directory=path.join(root,"project-task"),id=seed.task.data.task_id
const req=async (route,method="GET",body)=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",directory)
  const r=await fetch(url,{method,...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})})
  const d=await r.json()
  return {status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:d}
}
const body={text:"B161 candidate acceptance on the upgraded historical Task",source:"panel",model:"b161-review/offline",requestID:"b161-after-replay-v13"}
const route="/task/"+id+"/message"
const [a,b]=await Promise.all([req(route,"POST",body),req(route,"POST",body)])
const c=await req(route,"POST",{...body,text:"B161 changed text under the same key"})
for (const r of [a,b]) assert.equal(r.status,202,JSON.stringify(r))
assert.equal(a.data.ingress_id,b.data.ingress_id)
assert.equal(a.data.user_message.info.id,b.data.user_message.info.id)
assert.equal(c.status,409,JSON.stringify(c))
assert.equal(c.data.name,"TaskOperatorMessageRequestConflictError")
const d=await req("/task/"+id)
assert.equal(d.data.executionLifecycle.epoch,4)
const result={a,b,c,epoch:d.data.executionLifecycle.epoch}
await fs.writeFile(path.join(root,"candidate-smoke.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify({id:a.data.user_message.info.id,ingress:a.data.ingress_id,epoch:result.epoch,conflict:c.data.name}))
