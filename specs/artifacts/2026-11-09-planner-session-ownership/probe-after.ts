import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Session } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/session/index.ts"
import { TaskPlan } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/task-plan.ts"
import { PlannerTool } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/planner.ts"
import { Tool } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/tool.ts"
import { NotFoundError } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/storage/db.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const directory="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b36/project-after"
let observed:any
try {
 await Instance.provide({directory,fn:async()=>{
  const a=await Session.create({kind:"root",title:"Owned planner audit A"})
  const b=await Session.create({kind:"root",title:"Owned planner audit B"})
  const context=(sessionID:string):Tool.Context=>({sessionID,messageID:"planner-direct-probe-message",agent:"isolated-checker",abort:new AbortController().signal,messages:[],executionSurface:Tool.executionSurface([PlannerTool.id],[]),extra:{projectID:Instance.project.id},metadata(){}})
  const tool=await PlannerTool.init()
  const root=await tool.execute({action:"add_task",goal:"Original A plan"},context(a.id))
  const id=JSON.parse(root.output).id
  const foreignUpdate=await tool.execute({action:"update_task",taskId:id,status:"completed",notes:"Updated from B"},context(b.id))
  assert.deepEqual(JSON.parse(foreignUpdate.output),{error:`Task ${id} not found`})
  const foreignChild=await tool.execute({action:"add_task",parentId:id,goal:"B child under A parent"},context(b.id)).catch((error:unknown)=>error)
  assert.ok(foreignChild instanceof NotFoundError)
  assert.deepEqual(foreignChild.data,{message:`Parent task ${id} not found for session ${b.id}`})
  const bRoot=JSON.parse((await tool.execute({action:"add_task",goal:"Original B plan"},context(b.id))).output)
  const bChild=JSON.parse((await tool.execute({action:"add_task",parentId:bRoot.id,goal:"B owned child"},context(b.id))).output)
  const bUpdate=await tool.execute({action:"update_task",taskId:bChild.id,status:"in_progress",progressPct:60,notes:"Owned evidence"},context(b.id))
  assert.deepEqual(JSON.parse(bUpdate.output),{id:bChild.id,goal:"B owned child",status:"in_progress",progressPct:60,notes:"Owned evidence"})
  const aAfter=TaskPlan.list(a.id)
  assert.deepEqual(aAfter.map(({goal,status,notes})=>({goal,status,notes})),[{goal:"Original A plan",status:"pending",notes:null}])
  const bList=await tool.execute({action:"list_tasks"},context(b.id))
  const listed=JSON.parse(bList.output)
  assert.equal(listed.count,2)
  assert.equal(listed.tree,`<task-plan>\n[ ] Original B plan [${bRoot.id}]\n  [~] B owned child (60%) — Owned evidence [${bChild.id}]\n</task-plan>\n\nUse the planner tool to update task status, add subtasks, or modify the plan.`)
  observed={date:new Date().toISOString(),projectID:Instance.project.id,sessions:{a:a.id,b:b.id},foreignUpdate,foreignChild:{name:foreignChild.name,data:foreignChild.data},aAfter,bAfter:TaskPlan.list(b.id),bList,qualification:"Direct real Tool wrapper, Sessions and persisted database; no model, canonical Message or Tool Part."}
 }})
 await Instance.disposeAll()
 await Instance.provide({directory,fn:async()=>{
  assert.deepEqual(TaskPlan.list(observed.sessions.a),observed.aAfter)
  assert.deepEqual(TaskPlan.list(observed.sessions.b),observed.bAfter)
  observed.instanceReloadExact=true
 }})
 await fs.writeFile("C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b36/after-observed.json",JSON.stringify(observed,null,2)+"\n")
 console.log(JSON.stringify({sessions:observed.sessions,aPlans:observed.aAfter.length,bPlans:observed.bAfter.length,foreignUpdate:JSON.parse(observed.foreignUpdate.output),foreignParentError:observed.foreignChild,instanceReloadExact:observed.instanceReloadExact}))
} finally {await Instance.disposeAll()}
