
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root]=process.argv.slice(2)
const launch=JSON.parse(await fs.readFile(path.join(root,"before-startup.json"),"utf8"))
assert.equal(launch.url,"http://127.0.0.1:39384")
const dir=path.join(root,"project-task")
const sibling=path.join(root,"project-task-sibling")
const model="b161-review/offline"
const call=async(route,{method="GET",body,project=dir,expect,projectData=x=>x}={})=>{
  const url=new URL(route,launch.url); url.searchParams.set("directory",project)
  const r=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  const item={status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:projectData(await r.json())}
  if(expect!==undefined)assert.equal(r.status,expect,JSON.stringify({route,project,...item}))
  return item
}
const post=(route,body,project,expect,projectData)=>call(route,{method:"POST",body,project,expect,projectData})
const patch={model,enabled_providers:["b161-review"],provider:{"b161-review":{
  name:"Isolated Task ingress review",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
  models:{offline:{name:"Offline",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}},
}}}
const catalogs={}
for(const project of [dir,sibling]){
  const config=await call("/config",{project,method:"PATCH",body:patch,expect:200,projectData:d=>d.model})
  const catalog=await call("/config/providers",{project,expect:200,projectData:d=>d.providers.flatMap(p=>Object.keys(p.models).map(m=>p.id+"/"+m))})
  assert.deepEqual(catalog.data,[model])
  assert.equal(config.data,model)
  catalogs[path.basename(project)]={config,catalog}
}
const task=async(title,project)=>post("/task",{
  title,request:"Isolated local operator-note acceptance review",requestID:title,productPillar:"work",promptProfile:"dynamic",model,
},project,202)
const a=await task("B161 main Task follow-up",dir)
const b=await task("B161 sibling Task follow-up",sibling)
const get=(t,project)=>call("/task/"+t.data.task_id,{project,expect:200,projectData:d=>({
  id:d.id,sessionID:d.sessionID,title:d.title,status:d.status,executionLifecycle:d.executionLifecycle
})})
const before=await get(a,dir)
const other=await get(b,sibling)
const taskRoute=t=>"/task/"+t.data.task_id+"/message"
const note={text:"B161 exact operator note delivered after a missing receipt",source:"panel",model}
const inParallel={...note,text:"B161 parallel exact operator note with one caller intent"}
const reduce=d=>d.user_message?{mode:d.mode,resumed:d.resumed,status:d.status,wakeStatus:d.wakeStatus,
  user:{id:d.user_message.info.id,sessionID:d.user_message.info.sessionID,model:d.user_message.info.model,
    text:d.user_message.parts.filter(p=>p.type==="text").map(p=>p.text)}}:d
const rejected=await post(taskRoute(a),{...note,requestID:"b161-one-follow-up"},dir,400)
const first=await post(taskRoute(a),note,dir,202,reduce)
const replay=await post(taskRoute(a),note,dir,202,reduce)
const concurrent=await Promise.all([post(taskRoute(a),inParallel,dir,202,reduce),post(taskRoute(a),inParallel,dir,202,reduce)])
const peer=await post(taskRoute(b),note,sibling,202,reduce)
assert.equal(new Set([first,replay,...concurrent].map(r=>r.data.user.id)).size,4)
assert.equal(new Set([first,replay,...concurrent].map(r=>r.data.user.sessionID)).size,1)
assert.notEqual(first.data.user.sessionID,peer.data.user.sessionID)
const final=await get(a,dir)
const peerFinal=await get(b,sibling)
const proof={catalogs,task:a,sibling:b,before,other,rejected,first,replay,concurrent,peer,final,peerFinal}
await fs.writeFile(path.join(root,"before-task-follow-up.json"),JSON.stringify(proof,null,2)+"\n")
console.log(JSON.stringify({primary:a.data.task_id,sibling:b.data.task_id,mainSession:final.data.sessionID,otherSession:peerFinal.data.sessionID,
rejected:rejected.status,receipts:[first,replay,...concurrent,peer].map(r=>[r.status,r.data.user.id,r.data.wakeStatus,r.data.status])},null,2))
