
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root]=process.argv.slice(2)
const receipt=JSON.parse(await fs.readFile(path.join(root,"fresh-startup.json"),"utf8"))
assert.equal(receipt.occurrenceID,"iteration-b161-fresh")
const directory=path.join(root,"project-fresh")
const call=async(route,method,body,status)=>{
  const u=new URL(route,receipt.url);u.searchParams.set("directory",directory)
  const r=await fetch(u,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  const d=await r.json();assert.equal(r.status,status,JSON.stringify(d))
  return {status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:d}
}
const provider={name:"Fresh local review",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
  models:{offline:{name:"Offline",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}}}
const model="b161-fresh/offline"
const cfg=await call("/config","PATCH",{model,enabled_providers:["b161-fresh"],provider:{"b161-fresh":provider}},200)
assert.equal(cfg.data.model,model)
const t=await call("/task","POST",{requestID:"fresh-task",title:"Fresh schema Task",request:"Isolated fresh Task review",
  promptProfile:"dynamic",productPillar:"work",model},202)
const body={requestID:"fresh-operator-note",source:"api",text:"One follow-up on a new database",model}
const route="/task/"+t.data.task_id+"/message"
const [a,b]=await Promise.all([call(route,"POST",body,202),call(route,"POST",body,202)])
assert.equal(a.data.ingress_id,b.data.ingress_id);assert.equal(a.data.user_message.info.id,b.data.user_message.info.id)
const result={task:t,model,sends:[a,b].map(r=>({status:r.status,trace:r.trace,ingressID:r.data.ingress_id,messageID:r.data.user_message.info.id}))}
await fs.writeFile(path.join(root,"fresh-acceptance.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result))
