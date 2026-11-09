import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root] = process.argv.slice(2)
const read = async file => JSON.parse(await fs.readFile(path.join(root,file),"utf8"))
const projects=await read("seed.json")
const launch=await read("before-startup.json")
const url=launch.url
const facts=[]
for(const {mode,route,project,parallel,identity} of [
  {mode:"project-chat",route:"/coding/chat/session",project:projects.a,parallel:false,identity:"isolated-conversation-project-chat-intent"},
  {mode:"project-work",route:"/coding/work/session",project:projects.b,parallel:true,identity:"isolated-conversation-project-work-intent"},
  {mode:"global-chat",route:"/global/chat",parallel:false,identity:"isolated-conversation-global-chat-intent"},
  {mode:"global-work",route:"/global/work",parallel:true,identity:"isolated-conversation-global-work-intent"},
]){
  const headers={"content-type":"application/json","x-opencorvus-request-id":identity}
  if(project) headers["x-opencorvus-directory"]=project.directory
  const once=async()=> {
    const r=await fetch(url+route,{method:"POST",headers,body:"{}"})
    assert.equal(r.status,201,await r.clone().text())
    const {session}=await r.json()
    assert.equal(session.kind,"assistant")
    if(project) assert.equal(session.directory,project.directory)
    assert.equal(session.metadata.conversation.experience,mode.split("-")[1])
    return {status:r.status,requestID:r.headers.get("x-opencorvus-request-id"),session:{id:session.id,projectID:session.projectID,directory:session.directory,experience:session.metadata.conversation.experience}}
  }
  const runs=parallel ? await Promise.all([once(),once()]) : [await once(),await once()]
  for(const run of runs){
    const r=await fetch(url+"/session/"+run.session.id,{headers:{"x-opencorvus-directory":run.session.directory}})
    assert.equal(r.status,200)
    const session=await r.json()
    assert.equal(session.id,run.session.id)
    assert.equal(session.projectID,run.session.projectID)
  }
  const directory=project?.directory
  let projected
  if(directory){
    const experience=mode.split("-")[1]
    const response=await fetch(url+"/coding/"+experience+"/sessions",{headers:{"x-opencorvus-directory":directory}})
    assert.equal(response.status,200)
    const {sessions}=await response.json()
    projected=sessions.map(session=>session.id)
    for(const run of runs) assert.ok(projected.includes(run.session.id))
  }
  facts.push({mode,route,parallel,identity,runs,distinctSessions:new Set(runs.map(run=>run.session.id)).size,distinctProjects:new Set(runs.map(run=>run.session.projectID)).size,projected})
}
await fs.writeFile(path.join(root,"before-creation-replay.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))
const sample=facts[0].runs[1].session
const page=new URL("/ui/",url)
page.search=new URLSearchParams({sessionID:sample.id,sessionKind:"conversation",directory:sample.directory,experience:"chat"}).toString()
console.log(page.href)