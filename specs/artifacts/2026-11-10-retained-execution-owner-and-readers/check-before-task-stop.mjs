import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2]
const read=async f=>JSON.parse(await fs.readFile(path.join(root,f),"utf8"))
const seed=await read("seed.json"),launch=await read("before-startup.json")
assert.equal(launch.url,"http://127.0.0.1:39364")
const call=async (method,route,body)=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",seed.directory)
  const response=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json()}
}
const model="b157-loopback/offline"
const config=await call("PATCH","/config",{
  model,
  provider:{"b157-loopback":{name:"Isolated loopback review",npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",
    models:{offline:{name:"Offline review",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}}}}},
})
const result={configuration:{status:config.status,requestID:config.requestID,model:config.body.model??null}}
if(config.status===200){
  const created=await call("POST","/task",{
    title:"Isolated Task delete before execution",
    request:"A disposable Task for the local retention checker.",
    productPillar:"work",model,promptProfile:"dynamic",requestID:"b157-task-delete-context",
  })
  Object.assign(result,{created})
  if(created.status===202){
    const id=created.body.task_id
    const gone=await call("DELETE","/task/"+id,{surface:"api",reason:"Delete only the isolated task used by the local retention checker"})
    Object.assign(result,{gone})
  }
}
await fs.writeFile(path.join(root,"before-task-stop.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result))
