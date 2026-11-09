import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root=process.argv[2]
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),"utf8"))
const launch=await read("before-startup.json"), seed=await read("seed.json")
assert.equal(launch.occurrenceID,"iteration-b157-before")
assert.equal(launch.url,"http://127.0.0.1:39364")
const call=async(route,opts={})=>{
  const url=new URL(route,launch.url)
  if(opts.directory)url.searchParams.set("directory",opts.directory)
  const r=await fetch(url,opts.body===undefined?{}:{method:opts.method??"POST",headers:{"content-type":"application/json"},body:JSON.stringify(opts.body)})
  const body=await r.json()
  return {status:r.status,requestID:r.headers.get("x-opencorvus-request-id"),body}
}
const globalRoutes=["/mission?limit=50","/work-ledger?limit=80","/work-ledger/archive?limit=80"]
const baseline=await Promise.all(globalRoutes.map(route=>call(route)))
assert.deepEqual(baseline.map(r=>r.status),[404,404,200])
const save=async (name,key)=>call("/mission/draft",{directory:seed.directory,body:{
  title:name,request:"This isolated draft is for real retention acceptance.",productPillar:"work",expertSquadIDs:["dynamic"],requestID:key,
}})
const visible=await save("Keep this Mission visible","b157-visible-mission")
const disposable=await save("Disposable Mission retention test","b157-disposable-mission")
assert.equal(visible.status,200)
assert.equal(disposable.status,200)
assert.equal(disposable.body.directory,seed.directory)
const deletion=await call("/mission/"+disposable.body.missionID,{directory:seed.directory,method:"DELETE",body:{
  surface:"api",reason:"Retire only the isolated B157 verification draft",
}})
assert.equal(deletion.status,500)
const scoped=await call("/mission?limit=1",{directory:seed.directory})
const facts={baseline,visible,disposable,deletion,scoped}
await fs.writeFile(path.join(root,"before-baseline.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify({lists:baseline.map(r=>r.status),deletion:deletion.status,scope:scoped.status,newlyRetired:disposable.body.sessionID}))
