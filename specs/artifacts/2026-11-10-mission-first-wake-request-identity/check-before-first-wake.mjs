import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
const b=process.argv[2],read=async file=>JSON.parse(await fs.readFile(path.join(b,file),"utf8"))
const launch=await read("before-startup.json"), seed=await read("project-mission-wake-seed.json")
assert.equal(launch.url,"http://127.0.0.1:39368")
assert.equal(launch.occurrenceID,"iteration-b158-before")
const model="b158-loopback/offline"
const call=async(route,method="GET",body,dir=seed.directory)=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",dir)
  const response=await fetch(url,{method,...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})})
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),data:await response.json()}
}
const config=await call("/config","PATCH",{model,provider:{"b158-loopback":{
  name:"Isolated closed loopback",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
  models:{offline:{name:"Offline review",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}},
}}})
assert.equal(config.status,200,JSON.stringify(config.data))
assert.equal(config.data.model,model)
const body={text:"One first Mission invocation in serial.",productPillar:"work",expertSquadIDs:["dynamic"],model,requestID:"b158-same-initial-wake"}
const wake=input=>call("/mission/wake","POST",input)
const one=await wake(body)
const replay=await wake(body)
const parallelBody={...body,text:"One first Mission invocation in parallel.",requestID:"b158-parallel-initial-wake"}
const parallel=await Promise.all([wake(parallelBody),wake(parallelBody)])
const list=await call("/mission?limit=20")
await fs.writeFile(path.join(b,"before-wake-replays.json"),JSON.stringify({config:{status:config.status,requestID:config.requestID,model},sent:{body,parallelBody},one,replay,parallel,list},null,2)+"\n")
console.log(JSON.stringify({one,replay,parallel,list:list.status}))
