import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root,phase]=process.argv.slice(2)
assert.ok(["initial","restart"].includes(phase))
const read=async f=>JSON.parse(await fs.readFile(path.join(root,f),"utf8"))
const seed=await read("seed.json"), launch=await read("after-startup.json"), before=await read("before-baseline.json")
assert.equal(launch.url,"http://127.0.0.1:39366")
assert.equal(launch.occurrenceID,"iteration-b157-after")
const directory=seed.directory
const call=async(route,{method="GET",body,dir,status=200}={})=>{
  const url=new URL(route,launch.url)
  if(dir)url.searchParams.set("directory",dir)
  const res=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  const data=await res.json(), requestID=res.headers.get("x-opencorvus-request-id")
  assert.ok((Array.isArray(status)?status:[status]).includes(res.status),JSON.stringify({route,expected:status,status:res.status,requestID,data}))
  return {status:res.status,requestID,data}
}
const origin={surface:"api",reason:"Retire only this isolated Project verification sample"}
const draft=(title,requestID,dir=directory)=>call("/mission/draft",{method:"POST",dir,body:{
  title,request:"Keep this exact draft pending during the retention check.",productPillar:"work",expertSquadIDs:["dynamic"],requestID,
}})
const delMission=(receipt,status=200)=>call("/mission/"+receipt.data.missionID,{method:"DELETE",dir:receipt.data.directory,body:origin,status})
const archiveMission=receipt=>call("/mission/"+receipt.data.missionID+"/archive",{
  method:"PATCH",dir:receipt.data.directory,body:{...origin,archived:true},
})
const {sessionID:visibleSession}=before.visible.body
const verifyCoreLists=async()=>{
  const result=await Promise.all([
    call("/mission?limit=50"),call("/work-ledger?limit=80"),call("/work-ledger/archive?limit=80"),
    call("/session?limit=1&search=Mission",{dir:directory}),
  ])
  assert.ok(result[0].data.some(row=>row.sessionID===visibleSession))
  assert.ok(result[1].data.rows.some(row=>row.sessionID===visibleSession))
  assert.equal(result[3].data[0].id,visibleSession)
  return result
}
const info={}
if(phase==="initial"){
  const core=await verifyCoreLists()
  const m1=await draft("Paging boundary live","b157-paging-boundary-live")
  const m2=await draft("Paging boundary retired","b157-paging-boundary-retired")
  const retired=await delMission(m2)
  assert.equal(retired.data,true)
  const repeated=await delMission(m2)
  assert.equal(repeated.data,true)
  const afterPage=await Promise.all([
    call("/mission?limit=1&search=Paging%20boundary",{dir:directory}),
    call("/session?limit=1&search=Paging%20boundary",{dir:directory}),
    call("/work-ledger?limit=1&search=Paging%20boundary",{dir:directory}),
  ])
  assert.deepEqual(afterPage.map(r=>r.data.rows?.[0]?.sessionID??r.data[0]?.sessionID??r.data[0]?.id),[m1.data.sessionID,m1.data.sessionID,m1.data.sessionID])
  const archivedLive=await draft("Archive visibility keep","b157-archive-visibility-keep")
  const archivedGone=await draft("Archive visibility retire","b157-archive-visibility-retire")
  const liveArchive=await archiveMission(archivedLive)
  const deadArchive=await archiveMission(archivedGone)
  assert.ok(liveArchive.data.archived&&deadArchive.data.archived)
  const archivedRetired=await delMission(archivedGone)
  assert.equal(archivedRetired.data,true)
  const archivedPage=await call("/work-ledger/archive?limit=1&search=Archive%20visibility",{dir:directory})
  assert.equal(archivedPage.data.rows[0].sessionID,archivedLive.data.sessionID)
  const concurrentTarget=await draft("Parallel close target","b157-parallel-close-target")
  const parallel=await Promise.all([delMission(concurrentTarget,[200,409]),delMission(concurrentTarget,[200,409])])
  assert.ok(parallel.some(x=>x.status===200&&x.data===true))
  const concurrentReplay=await delMission(concurrentTarget)
  assert.equal(concurrentReplay.data,true)

  const baselineTask=await read("before-task-stop.json")
  const baselineSession=await read("before-session-stop.json")
  const oldTask=await call("/task/"+baselineTask.created.body.task_id,{method:"DELETE",dir:directory,body:origin})
  const oldRoot=await call("/session/"+baselineSession.active.body.sessionID+"?deleteTasks=true",{method:"DELETE",dir:directory})
  assert.equal(oldTask.data,true)
  assert.equal(oldRoot.data.status,"tombstoned")
  const model="b157-loopback/offline"
  const config=await call("/config",{dir:directory})
  assert.equal(config.data.model,model)
  const task=key=>call("/task",{method:"POST",status:202,dir:directory,body:{
    title:"Isolated terminal owner "+key,request:"Retain normal creation and deletion facts.",
    productPillar:"work",model,promptProfile:"dynamic",requestID:key,
  }})
  const activeTask=await task("b157-first-delete-task")
  const taskDelete=await call("/task/"+activeTask.data.task_id,{method:"DELETE",dir:directory,body:origin})
  assert.equal(taskDelete.data,true)
  const taskReplay=await call("/task/"+activeTask.data.task_id,{method:"DELETE",dir:directory,body:origin})
  assert.equal(taskReplay.data,true)
  const activeRoot=await task("b157-first-delete-root-session")
  const taskView=await call("/task/"+activeRoot.data.task_id,{dir:directory})
  const rootID=taskView.data.sessionID
  assert.ok(rootID)
  const rootDelete=await call("/session/"+rootID+"?deleteTasks=true",{method:"DELETE",dir:directory})
  assert.equal(rootDelete.data.status,"tombstoned")
  const rootReplay=await call("/session/"+rootID+"?deleteTasks=true",{method:"DELETE",dir:directory})
  assert.equal(rootReplay.data.status,"tombstoned")
  const createdSession=await call("/session",{method:"POST",dir:directory,body:{kind:"assistant",title:"Physical standalone comparator"}})
  const removed=await call("/session/"+createdSession.data.id,{method:"DELETE",dir:directory})
  assert.equal(removed.data.status,"physically_deleted")
  const keep=await call("/session/"+m1.data.sessionID,{dir:directory})
  assert.equal(keep.data.title,m1.data.title)
  Object.assign(info,{core,m1,m2,retired,repeated,afterPage,archivedLive,archivedGone,archivedRetired,archivedPage,concurrentTarget,parallel,concurrentReplay,oldTask,oldRoot,activeTask,taskDelete,taskReplay,activeRoot,rootID,rootDelete,rootReplay,createdSession,removed})
}else{
  const previous=await read("after-initial.json")
  const known=await Promise.all([delMission(previous.m2),call("/task/"+previous.activeTask.data.task_id,{method:"DELETE",dir:directory,body:origin}),
    call("/session/"+previous.rootID+"?deleteTasks=true",{method:"DELETE",dir:directory}),call("/work-ledger/archive?limit=1&search=Archive%20visibility",{dir:directory})])
  assert.equal(known[0].data,true)
  assert.equal(known[1].data,true)
  assert.equal(known[2].data.status,"tombstoned")
  assert.equal(known[3].data.rows[0].sessionID,previous.archivedLive.data.sessionID)
  const current=await call("/mission?limit=50")
  assert.ok(current.data.some(row=>row.sessionID===previous.m1.data.sessionID))
  const ledger=await call("/work-ledger?limit=80")
  assert.ok(ledger.data.rows.some(row=>row.sessionID===previous.m1.data.sessionID))
  Object.assign(info,{known,current,ledger})
}
await fs.writeFile(path.join(root,"after-"+phase+".json"),JSON.stringify(info,null,2)+"\n")
console.log(JSON.stringify({phase,mission:info.retired?.status??info.known[0].status,task:info.taskDelete?.status??info.known[1].status,root:info.rootDelete?.data.status??info.known[2].data.status}))
