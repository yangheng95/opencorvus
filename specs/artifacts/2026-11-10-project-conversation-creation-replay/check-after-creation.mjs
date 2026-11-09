import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root,phase] = process.argv.slice(2)
assert.ok(["initial","restart"].includes(phase))
const read = async file => JSON.parse(await fs.readFile(path.join(root,file),"utf8"))
const write = (file,value) => fs.writeFile(path.join(root,file),JSON.stringify(value,null,2)+"\n")
const projects=await read("seed.json")
const launch=await read("after-startup.json")
assert.equal(launch.occurrenceID,"iteration-b154-after")
const {url}=launch
const a=projects["after-a"].directory, b=projects["after-b"].directory
const key="actual-same-create-request"
const endpoints=(experience,id="")=>"/coding/"+experience+"/session"+(id?"/"+id:"")
async function request(directory,route,method="GET",body,status=200){
  const headers={"x-opencorvus-directory":directory}
  if(body) headers["content-type"]="application/json"
  const response=await fetch(url+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})})
  assert.equal(response.status,status,await response.clone().text())
  return {status:response.status,requestID:response.headers.get("x-opencorvus-request-id"),body:await response.json()}
}
const create=(dir,experience,requestID=key,model)=>request(dir,endpoints(experience),"POST",{requestID,...(model?{model}:{})},201)
const list=(dir,experience)=>request(dir,"/coding/"+experience+"/sessions")
const label=(dir,experience,id,title)=>request(dir,endpoints(experience,id),"PATCH",{title})
const sessionOf=r=>r.body.session
const listIDs=r=>r.body.sessions.map(s=>s.id)
const view=(session,experience)=>{
  const page=new URL("/ui/",url)
  page.search=new URLSearchParams({sessionID:session.id,sessionKind:"conversation",directory:session.directory,experience}).toString()
  return page.href
}
if(phase==="initial"){
  const aChat=await create(a,"chat")
  const replayA=await create(a,"chat")
  const [bWork,replayB,aWork,bChat]=await Promise.all([create(b,"work"),create(b,"work"),create(a,"work"),create(b,"chat")])
  assert.deepEqual(sessionOf(replayA),sessionOf(aChat))
  assert.deepEqual(sessionOf(replayB),sessionOf(bWork))
  assert.equal(new Set([aChat,bWork,aWork,bChat].map(x=>sessionOf(x).id)).size,4)
  assert.deepEqual([aChat,aWork,bChat,bWork].map(x=>sessionOf(x).directory),[a,a,b,b])
  const independent=await create(a,"chat","independent-intent")
  assert.equal(new Set([sessionOf(aChat).id,sessionOf(independent).id]).size,2)
  const conflict=await request(a,endpoints("chat"),"POST",{requestID:key,model:"unconfigured-review/catalog-model"},409)
  assert.equal(conflict.body.name,"ProjectConversationCreationConflictError")
  assert.equal(conflict.body.data.sessionID,sessionOf(aChat).id)
  const deleted=await create(a,"chat","disposable-deleted-intent")
  const terminal=await request(a,endpoints("chat",sessionOf(deleted).id),"DELETE")
  const gone=await request(a,endpoints("chat"),"POST",{requestID:"disposable-deleted-intent"},410)
  assert.equal(gone.body.name,"ProjectConversationCreationUnavailableError")
  assert.equal(gone.body.data.sessionID,sessionOf(deleted).id)
  const archived=await request(a,endpoints("work",sessionOf(aWork).id)+"/archive","PATCH",{archived:true})
  assert.ok(Number.isFinite(sessionOf(archived).time.archived))
  const archiveReplay=await create(a,"work")
  assert.equal(sessionOf(archiveReplay).id,sessionOf(aWork).id)
  assert.equal(sessionOf(archiveReplay).time.archived,sessionOf(archived).time.archived)
  const aNamed=await label(a,"chat",sessionOf(aChat).id,"One conversation after retry")
  const bNamed=await label(b,"work",sessionOf(bWork).id,"One Work after parallel retry")
  const independentNamed=await label(a,"chat",sessionOf(independent).id,"Separate creation action")
  const chats=await list(a,"chat"), work=await list(b,"work")
  assert.deepEqual(listIDs(chats).sort(),[sessionOf(aNamed).id,sessionOf(independentNamed).id].sort())
  assert.deepEqual(listIDs(work),[sessionOf(bNamed).id])
  const facts={aChat,replayA,aNamed,bWork,replayB,bNamed,aWork,bChat,independent,independentNamed,conflict,deleted,terminal,gone,archived,archiveReplay,chats,work}
  await write("after-initial-acceptance.json",facts)
  console.log(JSON.stringify({a:sessionOf(aNamed).id,b:sessionOf(bNamed).id,independent:sessionOf(independentNamed).id,deleted:terminal.body,gone:gone.status,archived:sessionOf(archived).time.archived}))
  console.log(view(sessionOf(aNamed),"chat"))
}else{
  const prior=await read("after-initial-acceptance.json")
  const [chat,work,archived,other]=await Promise.all([create(a,"chat"),create(b,"work"),create(a,"work"),create(b,"chat")])
  for(const [current,previous] of [[chat,prior.aNamed],[work,prior.bNamed],[archived,prior.archiveReplay],[other,prior.bChat]]){
    assert.equal(sessionOf(current).id,sessionOf(previous).id)
    assert.equal(sessionOf(current).projectID,sessionOf(previous).projectID)
    assert.equal(sessionOf(current).time.created,sessionOf(previous).time.created)
  }
  assert.equal(sessionOf(archived).time.archived,sessionOf(prior.archived).time.archived)
  const gone=await request(a,endpoints("chat"),"POST",{requestID:"disposable-deleted-intent"},410)
  assert.equal(gone.body.name,"ProjectConversationCreationUnavailableError")
  assert.equal(gone.body.data.sessionID,sessionOf(prior.deleted).id)
  const chats=await list(a,"chat"), workList=await list(b,"work")
  assert.deepEqual(listIDs(chats).sort(),listIDs(prior.chats).sort())
  assert.deepEqual(listIDs(workList),listIDs(prior.work))
  for(const r of [chat,work,archived,other]){
    const session=sessionOf(r)
    const messages=await request(session.directory,"/session/"+session.id+"/message")
    assert.deepEqual(messages.body,[])
  }
  const facts={chat,work,archived,other,gone,chats,workList}
  await write("after-restart-acceptance.json",facts)
  console.log(JSON.stringify({chat:sessionOf(chat).id,work:sessionOf(work).id,archived:sessionOf(archived).time.archived,removed:gone.status}))
  console.log(view(sessionOf(chat),"chat"))
}