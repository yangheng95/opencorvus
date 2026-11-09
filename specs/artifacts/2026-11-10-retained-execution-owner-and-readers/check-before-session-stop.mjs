import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2]
const read=async f=>JSON.parse(await fs.readFile(path.join(root,f),"utf8"))
const seed=await read("seed.json"),launch=await read("before-startup.json")
assert.equal(launch.url,"http://127.0.0.1:39364")
const call=async(method,route,body)=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",seed.directory)
  const response=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json()}
}
const create=await call("POST","/session",{kind:"assistant",title:"Disposable standalone Session"});
const standalone=create.status===200?await call("DELETE","/session/"+create.body.id):null
const task=await call("POST","/task",{
  title:"Isolated root Session delete before execution",
  request:"A disposable Task root for the local retention checker.",
  productPillar:"work",model:"b157-loopback/offline",promptProfile:"dynamic",requestID:"b157-root-session-delete-context",
})
const active=task.status===202?await call("GET","/task/"+task.body.task_id):null
const rootSession=active?.body?.sessionID
const taskOwned=rootSession?await call("DELETE","/session/"+rootSession+"?deleteTasks=true"):null
const page=await call("GET","/session?limit=1&search=Mission")
const result={create,standalone,task,active,taskOwned,page}
await fs.writeFile(path.join(root,"before-session-stop.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify({session:create.status,standalone:standalone?.status,disposition:standalone?.body?.status,task:task.status,active:active?.status,rootSession,rootDelete:taskOwned?.status,rootReason:taskOwned?.body?.name,firstPage:page?.body?.length}))
