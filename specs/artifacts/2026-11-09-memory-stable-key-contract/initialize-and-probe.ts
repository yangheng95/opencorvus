import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { Instance } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { Project } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/project/project.ts"
import { Memory } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/memory/index.ts"
import { declareNativeTaskProcessDeployment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/runtime/task-process-deployment.ts"
declareNativeTaskProcessDeployment()
const phase=process.argv[2]
assert.ok(phase==="before"||phase==="after")
const root="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b45"
const seed=JSON.parse(await fs.readFile(`${root}/seed.json`,"utf8"))[phase]
const expectedMessage="Memory key must contain at least one Unicode letter or number"
try {
 await Instance.provide({directory:seed.directory,fn:async()=>{
  const project=await Project.update({projectID:Instance.project.id,name:"Memory Stable Keys"})
  const retryAttempts:any[]=[]
  for(let attempt=1;attempt<=2;attempt++){
   const content=`retrykeyprobe original attempt ${attempt}.`
   try{
    const file=Memory.writeFile({projectId:project.id,title:"Retry note",content,source:"user",key:"---"})
    retryAttempts.push({attempt,outcome:"accepted",file,content})
   }catch(error){
    if(phase==="before")throw error
    assert.ok(error instanceof Error)
    assert.equal(error.name,"InvalidMemoryKeyError")
    assert.deepEqual((error as any).data,{message:expectedMessage,code:"invalid_memory_key"})
    retryAttempts.push({attempt,outcome:"error",name:error.name,data:(error as any).data})
   }
  }
  if(phase==="before"){
   assert.deepEqual(retryAttempts.map(item=>item.outcome),["accepted","accepted"])
   assert.equal(new Set(retryAttempts.map(item=>item.file.id)).size,2)
  }else assert.deepEqual(retryAttempts.map(item=>item.outcome),["error","error"])
  const canonicalOriginal=Memory.writeFile({projectId:project.id,title:"Stable original note",content:"stablekeyprobe first original revision.",source:"user",key:"  RÉSUMÉ_记录!  "})
  const canonicalContent="stablekeyprobe current original revision."
  const canonicalCurrent=Memory.writeFile({projectId:project.id,title:"Current stable original note",content:canonicalContent,source:"user",key:"re-sume 记录"})
  assert.equal(canonicalCurrent.id,canonicalOriginal.id)
  assert.equal(canonicalCurrent.key,"re-sume-记录")
  const unkeyed=[1,2].map(item=>{
   const content=`unkeyedprobe original item ${item}.`
   return {...Memory.writeFile({projectId:project.id,title:`Unkeyed original note ${item}`,content,source:"user"}),content}
  })
  assert.equal(new Set(unkeyed.map(item=>item.id)).size,2)
  const stableSearch=Memory.search({projectId:project.id,query:"stablekeyprobe",limit:20})
  assert.equal(stableSearch.length,1);assert.equal(stableSearch[0].fileId,canonicalOriginal.id);assert.equal(stableSearch[0].content,canonicalContent)
  const retrySearch=phase==="before"?Memory.search({projectId:project.id,query:"retrykeyprobe",limit:20}):undefined
  if(retrySearch)assert.deepEqual(retrySearch.map(item=>item.fileId).sort(),retryAttempts.map(item=>item.file.id).sort())
  const files=Memory.listFiles({projectId:project.id})
  const expected=[{...canonicalCurrent,content:canonicalContent},...unkeyed,...retryAttempts.filter(item=>item.outcome==="accepted").map(item=>({...item.file,content:item.content}))]
  assert.deepEqual(files.map(file=>file.id).sort(),expected.map(file=>file.id).sort())
  for(const file of expected)assert.equal(Memory.getChunksInProject({fileId:file.id,projectId:project.id}).map(chunk=>chunk.content).join("\n\n"),file.content)
  const record={phase,date:new Date().toISOString(),profilePath:process.env.OPENCORVUS_HOME,project:{id:project.id,name:project.name,worktree:project.worktree},retryAttempts,canonicalOriginal,canonicalCurrent,stableSearch,retrySearch,files:expected,qualification:"Actual isolated writer/SQLite/FTS. Provided empty-normalized key and intentionally omitted key are distinct contracts. No Session, message, Provider or model."}
  await fs.writeFile(`${root}/${phase}-domain-probe.json`,JSON.stringify(record,null,2)+"\n")
  console.log(JSON.stringify({phase,retryOutcomes:retryAttempts.map(item=>item.outcome),stableFileID:canonicalCurrent.id,canonicalKey:canonicalCurrent.key,unkeyedFiles:unkeyed.length,listedFiles:files.length}))
 }})
}finally{await Instance.disposeAll()}
