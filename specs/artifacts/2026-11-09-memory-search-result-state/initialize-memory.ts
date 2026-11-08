import fs from "node:fs/promises"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
if(phase!=="before"&&phase!=="after")throw new Error("Owned before/after phase required")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b41"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
try {
 await Instance.provide({directory:seed.directory,fn:async()=>{
  const project=await Project.update({projectID:Instance.project.id,name:"Memory Search Evidence"})
  const files=[
   Memory.writeFile({projectId:project.id,title:"Original locale note / 原始记录",source:"user",kind:"note",content:"corvuslocale evidence: keep this original bilingual note. 保留原始笔记内容。",importance:75,confidence:90}),
   Memory.writeFile({projectId:project.id,title:"Another original fact",source:"user",kind:"fact",content:"Separate original evidence belongs to this isolated project."}),
  ]
  const record={phase,project:{id:project.id,name:project.name,worktree:project.worktree},files,search:Memory.search({projectId:project.id,query:"corvuslocale",limit:20})}
  if(record.search.length!==1||record.search[0].fileId!==files[0].id||record.search[0].score<=0)throw new Error("Actual owned FTS contract failed")
  await fs.writeFile(`${root}/${phase}-memory.json`,JSON.stringify(record,null,2)+"\n")
  console.log(JSON.stringify({phase,projectID:project.id,files:files.length,searchScore:record.search[0].score}))
 }})
}finally{await Instance.disposeAll()}
