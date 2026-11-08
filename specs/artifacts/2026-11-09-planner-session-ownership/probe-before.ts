import fs from "node:fs/promises"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Session } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/session/index.ts"
import { TaskPlan } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/task-plan.ts"
import { PlannerTool } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/planner.ts"
import { Tool } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/tool.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const directory="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b36/project-before"
let observed:unknown
try {
 await Instance.provide({directory,fn:async()=>{
  const a=await Session.create({kind:"root",title:"Owned planner audit A"})
  const b=await Session.create({kind:"root",title:"Owned planner audit B"})
  const context=(sessionID:string):Tool.Context=>({sessionID,messageID:"planner-direct-probe-message",agent:"isolated-checker",abort:new AbortController().signal,messages:[],executionSurface:Tool.executionSurface([PlannerTool.id],[]),extra:{projectID:Instance.project.id},metadata(){}})
  const tool=await PlannerTool.init()
  const root=await tool.execute({action:"add_task",goal:"Original A plan"},context(a.id))
  const id=JSON.parse(root.output).id
  const before=TaskPlan.list(a.id)
  const foreignUpdate=await tool.execute({action:"update_task",taskId:id,status:"completed",notes:"Updated from B"},context(b.id))
  const foreignChild=await tool.execute({action:"add_task",parentId:id,goal:"B child under A parent"},context(b.id))
  const bList=await tool.execute({action:"list_tasks"},context(b.id))
  observed={date:new Date().toISOString(),projectID:Instance.project.id,sessions:{a:a.id,b:b.id},before,foreignUpdate,foreignChild,aAfter:TaskPlan.list(a.id),bAfter:TaskPlan.list(b.id),bList,qualification:"Direct production Tool wrapper and real Sessions/database; no model, canonical Message or fake Tool Part persisted."}
 }})
 await fs.writeFile("C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b36/before-observed.json",JSON.stringify(observed,null,2)+"\n")
 console.log(JSON.stringify(observed))
} finally {await Instance.disposeAll()}
