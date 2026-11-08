import fs from "node:fs/promises"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
if(phase!=="before"&&phase!=="after") throw new Error("Expected owned before/after phase")
const directory="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b38"
const seed=JSON.parse(await fs.readFile(`${directory}/seed.json`,"utf8"))
const projects=[]
try {
 for(const item of seed[phase]) {
  await Instance.provide({directory:item.directory,fn:async()=>{
   const project=await Project.update({projectID:Instance.project.id,name:item.name})
   projects.push({id:project.id,name:project.name,worktree:project.worktree})
  }})
 }
 await fs.writeFile(`${directory}/${phase}-projects.json`,JSON.stringify({phase,projects},null,2)+"\n")
 console.log(JSON.stringify({phase,projectCount:projects.length}))
} finally {await Instance.disposeAll()}
