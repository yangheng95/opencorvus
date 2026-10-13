import fs from "node:fs"
import path from "node:path"
import { acquireProcessLock } from "../packages/opencorvus/src/util/process-lock"
const stage=process.argv[3]!
if(!["final","postfix","shortbase"].includes(stage))throw Error("Exact own lease stage required")
const root=path.resolve(".tmp-codex-provider-test-lifecycle-01a133/"+stage),label=process.argv[2]!
if(!/^[a-z0-9-]+$/.test(label))throw Error("Own lease label required")
const target=path.join(root,"runtime/data/auth.json"),ready=path.join(root,`lease-${label}-ready.json`),signal=path.join(root,`lease-${label}-release`)
if(fs.existsSync(ready)||fs.existsSync(signal))throw Error("Fresh own lease occurrence required")
const release=await acquireProcessLock(target,{realpath:false}),started=Date.now()
const auth=JSON.parse(fs.readFileSync(target,"utf8"))
fs.writeFileSync(ready,JSON.stringify({pid:process.pid,target,label,started,credentialGenerations:Object.fromEntries(Object.entries(auth).map(([id,value])=>[id,(value as {generation:string}).generation])),boundary:"Actual production lock on own canonical fake Auth; no credential values"},null,2))
console.log("Own Auth lease acquired")
try{while(!fs.existsSync(signal)){if(Date.now()-started>300_000)throw Error("Own lease expired without explicit release");await Bun.sleep(100)}}
finally{await release();fs.writeFileSync(path.join(root,`lease-${label}-terminal.json`),JSON.stringify({pid:process.pid,label,released:true,at:Date.now()},null,2))}
console.log("Own Auth lease released")
