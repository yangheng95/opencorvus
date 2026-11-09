
import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
const [root,phase,receipt="before-startup.json"]=process.argv.slice(2)
const get=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const put=async(name,value)=>fs.writeFile(path.join(root,name),JSON.stringify(value,null,2)+"\n")
const launch=await get(receipt)
assert.equal(launch.outcome,"listening")
const primary=path.join(root,"project-primary")
const sibling=path.join(root,"project-sibling")
const retired="b159-retired/offline"
const current="b159-current/offline"
const provider=name=>({name,npm:"@ai-sdk/openai-compatible",api:"http://127.0.0.1:1/v1",models:{offline:{
  name:"Local closed review model",tool_call:true,modalities:{input:["text"],output:["text"]},limit:{context:32000,output:4096}
}}})
const call=async(route,{method="GET",body,project=primary,expect,projectData=(data)=>data}={})=>{
  const url=new URL(route,launch.url)
  url.searchParams.set("directory",project)
  const r=await fetch(url,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})})
  const result={status:r.status,trace:r.headers.get("x-opencorvus-request-id"),data:projectData(await r.json())}
  if(expect!==undefined) assert.equal(r.status,expect,JSON.stringify({route,method,...result}))
  return result
}
const post=(route,body,extra={})=>call(route,{method:"POST",body,...extra})
const catalog=project=>call("/config/providers",{project,expect:200,projectData:d=>d.providers
  .filter(p=>p.id.startsWith("b159-")).flatMap(p=>Object.keys(p.models).map(m=>p.id+"/"+m)).sort()})
const overlay=(body,project)=>call("/config",{method:"PATCH",body,project,expect:200,projectData:d=>({model:d.model,disabled:d.disabled_providers??[]})})
const wakeInput={requestID:"b159-real-wake",text:"Keep this accepted Mission wake after the catalog change",productPillar:"work",expertSquadIDs:["dynamic"],model:retired}
const unselected={...wakeInput,requestID:"b159-implicit-model",text:"Keep this accepted Mission with the original implicit model"}
delete unselected.model
const pending="Keep this accepted manual Mission dispatch after the catalog change"
const dispatchInput={requestID:"b159-real-dispatch",model:retired}
const terminalInput={...wakeInput,requestID:"b159-closed",text:"Keep this closed Mission outcome after the catalog change"}
const messages=async(result,project=primary)=>call("/session/"+result.data.sessionID+"/message",{project,expect:200,projectData:d=>d.filter(m=>m.info.role==="user").map(m=>({
  id:m.info.id,model:m.info.model,requestID:m.info.extra?.wake_reason?.requestID,
  openedEventID:m.info.extra?.wake_reason?.openedEventID,text:m.parts.filter(p=>p.type==="text").map(p=>p.text)
}))})
const wake=(body,extra={})=>post("/mission/wake",body,extra)
const closeBody={surface:"api",reason:"Close only the isolated replay evidence Mission."}
let proof={}
if(phase==="seed"){
  const config={model:retired,enabled_providers:["b159-retired","b159-current"],provider:{"b159-retired":provider("Retiring catalog"),"b159-current":provider("Current catalog")}}
  proof.config=await overlay(config)
  proof.siblingConfig=await overlay(config,sibling)
  proof.catalog=await catalog(primary)
  assert.deepEqual(proof.catalog.data,[current,retired])
  proof.first=await wake(wakeInput,{expect:200})
  proof.replay=await wake(wakeInput,{expect:200})
  assert.deepEqual(proof.replay.data,proof.first.data)
  proof.implicit=await wake(unselected,{expect:200})
  proof.draft=await post("/mission/draft",{title:"B159 accepted dispatch",request:pending,productPillar:"work",expertSquadIDs:["dynamic"],requestID:"b159-draft"},{expect:200})
  const route="/mission/"+proof.draft.data.missionID+"/dispatch"
  proof.dispatch=await post(route,dispatchInput,{expect:200})
  proof.dispatchReplay=await post(route,dispatchInput,{expect:200})
  assert.deepEqual(proof.dispatchReplay.data,proof.dispatch.data)
  proof.terminal=await wake(terminalInput,{expect:200})
  proof.close=await post("/mission/"+proof.terminal.data.missionID+"/abort",closeBody,{expect:200})
  proof.closed=await wake(terminalInput,{expect:409})
  assert.equal(proof.closed.data.name,"MissionExecutionWakeClosedError")
  proof.sibling=await wake(wakeInput,{project:sibling,expect:200})
  assert.notEqual(proof.sibling.data.sessionID,proof.first.data.sessionID)
  proof.messages=await Promise.all([messages(proof.first),messages(proof.implicit),messages(proof.dispatch),messages(proof.terminal),messages(proof.sibling,sibling)])
  for(const m of proof.messages){
    assert.equal(m.data.length,1)
    assert.deepEqual(m.data[0].model,{providerID:"b159-retired",modelID:"offline"})
    assert.ok(m.data[0].openedEventID)
  }
}else{
  const seed=await get("seed.json")
  if(phase==="before")proof.change=await overlay({model:current,provider:{"b159-retired":null},enabled_providers:["b159-current"]})
  proof.catalog=await catalog(primary)
  proof.siblingCatalog=await catalog(sibling)
  assert.deepEqual(proof.catalog.data,[current])
  assert.deepEqual(proof.siblingCatalog.data,[current,retired])
  const route="/mission/"+seed.draft.data.missionID+"/dispatch"
  proof.replay=await wake(wakeInput)
  proof.parallel=await Promise.all([wake(wakeInput),wake(wakeInput)])
  proof.explicit=await wake({...wakeInput,missionID:seed.first.data.missionID})
  proof.implicit=await wake(unselected)
  proof.dispatchReplay=await post(route,dispatchInput)
  proof.closed=await wake(terminalInput)
  proof.closedChanged=await wake({...terminalInput,text:"A different request under the closed author key"})
  proof.wakeChanged=await wake({...wakeInput,text:"A different request under the open author key"})
  proof.dispatchChanged=await post(route,{...dispatchInput,model:current})
  proof.invalidFresh=await wake({...wakeInput,requestID:"b159-never-accepted-retired-model"})
  proof.currentFresh=await wake({...wakeInput,model:current,text:"A newly admitted Mission uses the current catalog",requestID:"b159-new-current-model"},{expect:200})
  proof.sibling=await wake(wakeInput,{project:sibling,expect:200})
  assert.deepEqual(proof.sibling.data,seed.sibling.data)
  proof.messages=await Promise.all([messages(seed.first),messages(seed.implicit),messages(seed.dispatch),messages(seed.terminal),messages(proof.sibling,sibling)])
  assert.deepEqual(proof.messages.map(m=>m.data),seed.messages.map(m=>m.data))
  if(phase!=="before"){
    const baseline=await get("before.json")
    for(const replay of [proof.replay,...proof.parallel])assert.deepEqual({status:replay.status,data:replay.data},{status:200,data:seed.first.data})
    assert.deepEqual(proof.explicit.data,{...seed.first.data,created:false})
    assert.equal(proof.explicit.status,200)
    assert.equal(proof.implicit.status,200)
    assert.deepEqual(proof.implicit.data,seed.implicit.data)
    assert.equal(proof.dispatchReplay.status,200)
    assert.deepEqual(proof.dispatchReplay.data,seed.dispatch.data)
    assert.equal(proof.closed.status,409)
    assert.equal(proof.closed.data.name,"MissionExecutionWakeClosedError")
    assert.equal(proof.closed.data.data.closureEventID,seed.closed.data.data.closureEventID)
    for(const changed of [proof.closedChanged,proof.wakeChanged,proof.dispatchChanged]){
      assert.equal(changed.status,409)
      assert.equal(changed.data.name,"MissionExecutionWakeInputConflictError")
    }
    assert.equal(proof.invalidFresh.status,400)
    assert.equal(proof.invalidFresh.data.data.message,baseline.invalidFresh.data.data.message)
    assert.deepEqual(proof.currentFresh.data,baseline.currentFresh.data)
  }
  proof.freshMessage=await messages(proof.currentFresh)
  assert.deepEqual(proof.freshMessage.data[0].model,{providerID:"b159-current",modelID:"offline"})
}
await put(phase+".json",proof)
console.log(JSON.stringify(Object.fromEntries(Object.entries(proof).filter(([,v])=>v?.status!==undefined).map(([k,v])=>[k,[v.status,v.data?.name??v.data?.sessionID??v.data]])),null,2))
