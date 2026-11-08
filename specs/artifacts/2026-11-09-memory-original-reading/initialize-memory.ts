import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
assert.ok(phase==="before"||phase==="after")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b44"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
try {
 await Instance.provide({directory:seed.directory,fn:async()=>{
  const project=await Project.update({projectID:Instance.project.id,name:"Original Memory Reading"})
  const content=Array.from({length:60},(_,index)=>`Line ${String(index+1).padStart(3,"0")}: original memory content for reading, selecting, and reference.`).join("\n")
  const inputs=[{role:"following",title:"Following original note",content:"The next original note remains separately reachable."},{role:"long",title:"Long original note",content}]
  const files=inputs.map(({role,...input})=>({...Memory.writeFile({projectId:project.id,source:"user",kind:"note",...input}),role,content:input.content}))
  for(const file of files)assert.equal(Memory.getChunksInProject({fileId:file.id,projectId:project.id}).map(chunk=>chunk.content).join("\n\n"),file.content)
  await fs.writeFile(`${root}/${phase}-memory.json`,JSON.stringify({phase,date:new Date().toISOString(),project:{id:project.id,name:project.name,worktree:project.worktree},files,qualification:"Actual owned writer and stored original content. UI keyboard/selection acceptance is manual; no model or clipboard use."},null,2)+"\n")
  console.log(JSON.stringify({phase,projectID:project.id,files:files.length,longLines:content.split("\n").length}))
 }})
}finally{await Instance.disposeAll()}
