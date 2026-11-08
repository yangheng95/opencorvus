import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { Database, NotFoundError, eq } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/storage/db.ts"
import { MemoryFileTable, MemoryChunkTable } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/memory.sql.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
assert.ok(phase==="before"||phase==="after")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b42"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
const record:any={phase,date:new Date().toISOString(),projects:[],qualification:"Actual isolated domain/SQLite/FTS. The production Tool passes correct pairs; this probe is not evidence of a public writeChunks API or an externally exploitable route."}
try {
 for(const item of seed){
  await Instance.provide({directory:item.directory,fn:async()=>{
   const project=await Project.update({projectID:Instance.project.id,name:item.role==="owner"?"Owner Notes":"Caller Notes"})
   const content=item.role==="owner"?"Original Owner knowledge stays in its real project.":"Original Caller knowledge stays in its real project."
   const file=Memory.writeFile({projectId:project.id,title:item.role==="owner"?"Owner original note":"Caller original note",content,source:"user",kind:"note"})
   record.projects.push({role:item.role,id:project.id,name:project.name,worktree:project.worktree,file,originalContent:content})
  }})
 }
 const owner=record.projects.find((item:any)=>item.role==="owner")
 const caller=record.projects.find((item:any)=>item.role==="caller")
 await Instance.provide({directory:caller.worktree,fn:async()=>{
  try {
   record.foreignPair={outcome:"accepted",chunks:Memory.writeChunks(owner.file.id,caller.id,"crosschunkprobe: mismatched parent identity in the owned diagnostic profile.")}
  }catch(error){
   record.foreignPair={outcome:"error",name:error instanceof Error?error.name:typeof error,data:(error as any)?.data,message:error instanceof Error?error.message:String(error)}
   if(phase==="after"){
    assert.ok(error instanceof NotFoundError)
    assert.deepEqual(error.data,{message:`Memory file ${owner.file.id} not found for project ${caller.id}`})
   }else throw error
  }
  if(phase==="before")assert.equal(record.foreignPair.outcome,"accepted")
  else {
   assert.equal(record.foreignPair.outcome,"error")
   record.ownedReplacement=Memory.writeChunks(caller.file.id,caller.id,"crosschunkprobe: legitimate Caller knowledge belongs to its own original file.")
  }
  record.callerList=Memory.listFiles({projectId:caller.id})
  record.callerSearch=Memory.search({projectId:caller.id,query:"crosschunkprobe",limit:20})
  assert.equal(record.callerSearch.length,1)
  assert.equal(record.callerSearch[0].fileId,phase==="before"?owner.file.id:caller.file.id)
  record.ownerChunks=Memory.getChunksInProject({fileId:owner.file.id,projectId:owner.id})
  assert.equal(record.ownerChunks.map((chunk:any)=>chunk.content).join("\n\n"),owner.originalContent)
  record.callerStoredParents=Database.use(db=>db.select({chunkID:MemoryChunkTable.id,chunkProjectID:MemoryChunkTable.project_id,fileID:MemoryFileTable.id,fileProjectID:MemoryFileTable.project_id,title:MemoryFileTable.title}).from(MemoryChunkTable).innerJoin(MemoryFileTable,eq(MemoryFileTable.id,MemoryChunkTable.file_id)).where(eq(MemoryChunkTable.project_id,caller.id)).all())
 }})
 await fs.writeFile(`${root}/${phase}-domain-probe.json`,JSON.stringify(record,null,2)+"\n")
 console.log(JSON.stringify({phase,foreignPair:record.foreignPair.outcome,searchFileID:record.callerSearch[0].fileId,searchTitle:record.callerSearch[0].fileTitle,callerProjectID:caller.id,storedParents:record.callerStoredParents}))
}finally{await Instance.disposeAll()}
