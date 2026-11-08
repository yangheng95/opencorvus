import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
assert.ok(phase==="before"||phase==="after")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b43"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
try {
 await Instance.provide({directory:seed.directory,fn:async()=>{
  const project=await Project.update({projectID:Instance.project.id,name:"Memory File Identity"})
  const inputs=[
   {title:"Multi-section original note",content:"## First section\nmultirowprobe first original evidence. 保留第一节原文。\n\n## Second section\nmultirowprobe second original evidence. 保留第二节原文。",importance:80,confidence:90},
   {title:"Separate original note",content:"multirowprobe evidence belongs to a separate original file.",importance:50,confidence:75},
  ]
  const files=inputs.map(input=>({...Memory.writeFile({projectId:project.id,source:"user",kind:"note",...input}),content:input.content}))
  const search=Memory.search({projectId:project.id,query:"multirowprobe",limit:20})
  assert.equal(search.length,3)
  assert.equal(new Set(search.map(result=>result.fileId)).size,2)
  const chunks=files.map(file=>({fileID:file.id,chunks:Memory.getChunksInProject({fileId:file.id,projectId:project.id})}))
  assert.deepEqual(chunks.map(item=>item.chunks.length),[2,1])
  for(const file of files)assert.equal(chunks.find(item=>item.fileID===file.id)!.chunks.map(chunk=>chunk.content).join("\n\n"),file.content)
  const record={phase,date:new Date().toISOString(),project:{id:project.id,name:project.name,worktree:project.worktree},files,chunks,search,qualification:"Actual owned Memory writer, SQLite chunks and FTS. Original backend returns chunk results; UI is accepted separately through manual interaction."}
  await fs.writeFile(`${root}/${phase}-memory.json`,JSON.stringify(record,null,2)+"\n")
  console.log(JSON.stringify({phase,projectID:project.id,files:files.length,searchChunks:search.length,rankedFiles:search.map(result=>result.fileId)}))
 }})
}finally{await Instance.disposeAll()}
