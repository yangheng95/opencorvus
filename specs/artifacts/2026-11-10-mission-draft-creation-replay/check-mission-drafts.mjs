import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root,phase]=process.argv.slice(2)
assert.ok(["initial","restart"].includes(phase))
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const launch=await read("after-startup.json")
assert.equal(launch.occurrenceID,"iteration-b156-after")
assert.equal(launch.url,"http://127.0.0.1:39356")
const project=await read("seed.json")
const other=await read("seed-other.json")
const call=async (route,opts={})=>{
  const directory=opts.directory===undefined?project.directory:opts.directory
  const url=new URL(route,launch.url)
  if(directory)url.searchParams.set("directory",directory)
  const resp=await fetch(url,opts.body===undefined?{method:opts.method??"GET"}:{method:opts.method??"POST",headers:{"content-type":"application/json"},body:JSON.stringify(opts.body)})
  const data=await resp.json()
  assert.equal(resp.status,opts.status??200,JSON.stringify(data))
  return {status:resp.status,requestID:resp.headers.get("x-opencorvus-request-id"),data}
}
const saved={
  requestID:"isolated-shared-manual-draft",
  title:"Scoped API review draft",
  request:"Preserve this exact initial request during replay.",
  productPillar:"work",
  expertSquadIDs:["dynamic"],
}
const otherIntent={...saved,requestID:"isolated-independent-manual-draft"}
const discarded={...saved,title:"Disposable API review draft",requestID:"isolated-deleted-manual-draft"}
const movable={...saved,title:"Moved project review draft",requestID:"isolated-movable-manual-draft"}
const edited="Current draft text after the operator edit."
const save=(body=saved,directory=project.directory,status=200)=>call("/mission/draft",{body,directory,status})
const action=(draft,name,body,method="PATCH")=>call("/mission/"+draft.data.missionID+name,{method,body,directory:draft.data.directory})
const pair=r=>[r.data.missionID,r.data.sessionID]
const records={}
if(phase==="initial"){
  const original=await save()
  const serial=await save()
  const parallel=await Promise.all([save(),save()])
  for(const r of [serial,...parallel])assert.deepEqual(r.data,original.data)
  const independent=await save(otherIntent)
  const otherProject=await save(saved,other.directory)
  assert.equal(new Set([original,independent,otherProject].map(r=>r.data.missionID)).size,3)
  assert.equal(new Set([original,independent,otherProject].map(r=>r.data.sessionID)).size,3)
  const editedReceipt=await action(original,"/draft",{expectedRequest:saved.request,request:edited})
  assert.equal(editedReceipt.data.pendingPrompt.text,edited)
  const afterEdit=await save()
  assert.deepEqual(pair(afterEdit),pair(original))
  assert.equal(afterEdit.data.pendingPrompt.text,edited)
  const conflict=await save({...saved,request:edited},project.directory,409)
  assert.equal(conflict.data.name,"MissionDraftCreationConflictError")
  assert.equal(conflict.data.data.reason,"identity")
  const archive=await action(original,"/archive",{archived:true,surface:"api",reason:"Archive only this isolated draft during replay review"})
  assert.ok(archive.data.archived)
  const archiveReplay=await save()
  assert.deepEqual(pair(archiveReplay),pair(original))
  assert.equal(archiveReplay.data.archived,archive.data.archived)
  assert.equal(archiveReplay.data.pendingPrompt.text,edited)
  const restored=await action(original,"/archive",{archived:false})
  assert.deepEqual(pair(restored),pair(original))
  assert.equal(restored.data.pendingPrompt.text,edited)

  const completedEarlier=process.argv[4]==="after-observed-delete-recovery" ? await save(discarded,project.directory,410) : undefined
  const disposable=completedEarlier ? {data:{...completedEarlier.data.data,directory:project.directory}} : await save(discarded)
  assert.equal(disposable.data.directory,project.directory)
  const deleted=await action(disposable,"",{surface:"api",reason:"Retire this disposable draft from the isolated review"}, "DELETE")
  assert.equal(deleted.data,true)
  const gone=await save(discarded,project.directory,410)
  assert.equal(gone.data.name,"MissionDraftCreationUnavailableError")
  assert.equal(gone.data.data.sessionID,disposable.data.sessionID)

  const temporary=(await call("/global/work",{directory:null,body:{requestID:"isolated-mission-move-project"},status:201})).data.session
  const source=temporary.directory
  const relatives=(parent,child)=>{const relative=path.relative(parent,child);return relative&&!relative.startsWith("..")&&!path.isAbsolute(relative)}
  assert.ok(relatives(path.join(root,"profile-after","data","projects"),source))
  const sourceProject=await call("/project/current",{directory:source})
  assert.equal(sourceProject.data.id,temporary.projectID)
  const note="The isolated project move kept this original file."
  await fs.writeFile(path.join(source,"move-review.txt"),note,{flag:"wx"})
  const beforeMove=await save(movable,source)
  const destinationParent=path.join(root,"promotion-destinations")
  const name="Mission move acceptance"
  const move=await call("/project/current/promote-anonymous",{directory:source,body:{destinationParent,name}})
  const destination=path.join(destinationParent,name)
  assert.equal(move.data.directory,destination)
  assert.equal(move.data.project.id,temporary.projectID)
  assert.equal(await fs.readFile(path.join(destination,"move-review.txt"),"utf8"),note)
  const afterMove=await save(movable,destination)
  assert.deepEqual(pair(afterMove),pair(beforeMove))
  assert.equal(afterMove.data.directory,destination)
  assert.equal(afterMove.data.pendingPrompt.text,movable.request)
  Object.assign(records,{original,serial,parallel,independent,otherProject,editedReceipt,afterEdit,conflict,archive,archiveReplay,restored,disposable,deleted,gone,beforeMove,move,afterMove})
}else{
  const initial=await read("after-initial.json")
  const [original,otherProject,gone,moved]=await Promise.all([
    save(),save(saved,other.directory),save(discarded,project.directory,410),save(movable,initial.move.data.directory),
  ])
  assert.deepEqual(pair(original),pair(initial.original))
  assert.equal(original.data.pendingPrompt.text,edited)
  assert.deepEqual(pair(otherProject),pair(initial.otherProject))
  assert.deepEqual(pair(moved),pair(initial.afterMove))
  assert.equal(gone.data.data.sessionID,initial.gone.data.data.sessionID)
  for(const r of [original,otherProject,moved]) {
    assert.equal(r.data.boardLane,"backlog")
    assert.deepEqual(r.data.tasks,[])
  }
  Object.assign(records,{original,otherProject,gone,moved})
}
await fs.writeFile(path.join(root,"after-"+phase+".json"),JSON.stringify(records,null,2)+"\n")
console.log(JSON.stringify({phase,original:pair(records.original),elsewhere:pair(records.otherProject),gone:records.gone.status,moved:pair(records.afterMove??records.moved)}))
