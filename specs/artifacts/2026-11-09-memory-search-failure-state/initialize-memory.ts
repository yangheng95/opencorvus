import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
assert.ok(phase==="before"||phase==="after")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b46"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
try {
 await Instance.provide({directory:seed.directory,fn:async()=>{
  const project=await Project.update({projectID:Instance.project.id,name:"Memory Search Recovery"})
  const inputs=[
   {query:"oldsearchprobe",title:"Earlier original note",content:"oldsearchprobe previous original search result."},
   {query:"newsearchprobe",title:"Next original note",content:"newsearchprobe current original search result."},
  ]
  const files=inputs.map(({query,...input})=>({...Memory.writeFile({projectId:project.id,source:"user",kind:"note",...input}),query,content:input.content}))
  const searches=Object.fromEntries(files.map(file=>{
   const results=Memory.search({projectId:project.id,query:file.query,limit:20})
   assert.equal(results.length,1);assert.equal(results[0].fileId,file.id);assert.equal(results[0].content,file.content)
   return [file.query,results]
  }))
  await fs.writeFile(`${root}/${phase}-memory.json`,JSON.stringify({phase,date:new Date().toISOString(),project:{id:project.id,name:project.name,worktree:project.worktree},files,searches,qualification:"Actual isolated Memory writer and FTS. Browser failures are caused only by normal shutdown of the owned server, not injected."},null,2)+"\n")
  console.log(JSON.stringify({phase,projectID:project.id,files:files.length,queries:Object.keys(searches)}))
 }})
}finally{await Instance.disposeAll()}
