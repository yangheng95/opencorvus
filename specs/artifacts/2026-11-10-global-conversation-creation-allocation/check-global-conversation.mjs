import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root,phase]=process.argv.slice(2)
assert.ok(["initial","restart"].includes(phase))
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const write=(name,value)=>fs.writeFile(path.join(root,name),JSON.stringify(value,null,2)+"\n")
const before=await read("before-preserved-conversations.json")
const launch=await read("after-startup.json")
assert.equal(launch.occurrenceID,"iteration-b155-after")
const {url}=launch
async function request(route,{method="GET",body,directory,status=200}={}){
  const headers={}
  if(body!==undefined)headers["content-type"]="application/json"
  if(directory)headers["x-opencorvus-directory"]=directory
  const response=await fetch(url+route,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})})
  assert.equal(response.status,status,await response.clone().text())
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json()}
}
const key="isolated-global-conversation-shared"
const create=(experience,requestID=key)=>request("/global/"+experience,{method:"POST",body:{requestID},status:201})
const session=r=>r.body.session
const facts={}
for(const experience of ["chat","work"]){
  const old=before[experience].session
  const actual=await request("/session/"+old.id,{directory:old.directory})
  for(const field of ["id","projectID","directory","title"]) assert.equal(actual.body[field],old[field])
  assert.equal(actual.body.time.created,old.time.created)
  facts["preserved_"+experience]=actual
}
if(phase==="initial"){
  const chat=await create("chat")
  const serial=await create("chat")
  const [work,parallel]=await Promise.all([create("work"),create("work")])
  assert.deepEqual(session(chat),session(serial))
  assert.deepEqual(session(work),session(parallel))
  const independent=await create("chat","isolated-independent-global-chat")
  assert.equal(new Set([chat,work,independent].map(x=>session(x).id)).size,3)
  assert.equal(new Set([chat,work,independent].map(x=>session(x).projectID)).size,3)
  for(const [experience,r,title] of [
    ["chat",chat,"One global Chat after retry"],["work",work,"One global Work after retry"],
    ["chat",independent,"A separate global action"],
  ]) {
    const s=session(r)
    const result=await request("/coding/"+experience+"/session/"+s.id,{method:"PATCH",body:{title},directory:s.directory})
    assert.equal(session(result).title,title)
    facts[experience+(r===independent?"_independent":"_named")]=result
  }
  const conflict=await request("/global/work",{method:"POST",body:{requestID:key,model:"unconfigured-review/catalog-model"},status:409})
  assert.equal(conflict.body.name,"GlobalCreationAllocationConflictError")
  assert.equal(conflict.body.data.requestID,key)
  const owned=await create("work","isolated-deleted-global-work")
  const disposable=session(owned)
  const rootOfAnonymous=path.join(root,"profile-before-ready","data","projects")
  const relative=path.relative(rootOfAnonymous,disposable.directory)
  assert.ok(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative),disposable.directory)
  const ownership=await request("/project/current",{directory:disposable.directory})
  assert.equal(ownership.body.id,disposable.projectID)
  const deleted=await request("/project/current",{method:"DELETE",directory:disposable.directory,body:{surface:"api",reason:"Retire this disposable global creation review sample"}})
  assert.equal(deleted.body.status,"committed")
  assert.equal(deleted.body.projectID,disposable.projectID)
  const gone=await request("/global/work",{method:"POST",body:{requestID:"isolated-deleted-global-work"},status:410})
  assert.equal(gone.body.name,"GlobalCreationAcceptedTargetUnavailableError")
  assert.equal(gone.body.data.targetID,disposable.id)
  Object.assign(facts,{chat,serial,work,parallel,independent,conflict,owned,deleted,gone})
}else{
  const old=await read("after-initial-acceptance.json")
  const expected=await read("prepared-v11-global-work.json")
  const [chat,work,prepared]=await Promise.all([create("chat"),create("work"),create("work",expected.requestID)])
  for(const [name,current] of [["chat",chat],["work",work]]){
    const original=session(old[name+"_named"])
    for(const field of ["id","projectID","directory","title"]) assert.equal(session(current)[field],original[field])
    assert.equal(session(current).time.created,original.time.created)
  }
  assert.equal(session(prepared).projectID,expected.projectID)
  assert.equal(session(prepared).directory,expected.directory)
  assert.deepEqual(session(prepared).metadata.configOverlay,expected.initialConfigOverlay)
  const preparedReplay=await create("work",expected.requestID)
  assert.equal(session(preparedReplay).id,session(prepared).id)
  const gone=await request("/global/work",{method:"POST",body:{requestID:"isolated-deleted-global-work"},status:410})
  assert.equal(gone.body.data.targetID,old.gone.body.data.targetID)
  for(const current of [chat,work,prepared]){
    const s=session(current)
    const history=await request("/session/"+s.id+"/message",{directory:s.directory})
    assert.deepEqual(history.body,[])
  }
  Object.assign(facts,{chat,work,prepared,preparedReplay,gone})
  const selected=session(chat)
  const page=new URL("/ui/",url)
  page.search=new URLSearchParams({sessionID:selected.id,sessionKind:"conversation",directory:selected.directory,experience:"chat"}).toString()
  console.log(page.href)
}
await write("after-"+phase+"-acceptance.json",facts)
console.log(JSON.stringify({phase,chat:session(facts.chat).id,work:session(facts.work).id,conflict:facts.conflict?.status,gone:facts.gone.status}))