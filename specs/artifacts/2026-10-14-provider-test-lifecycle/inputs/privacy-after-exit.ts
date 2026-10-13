import fs from "node:fs/promises"
import path from "node:path"
const root=path.resolve(process.argv[2]!)
const {CredentialRedactor}=await import("../packages/opencorvus/script/real-provider-audit")
const redactor=new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile(path.join(root,"runtime/data/auth.json"),"utf8")))
await fs.writeFile(path.join(root,"privacy-ready.json"),JSON.stringify({knownCredentials:"Collected only in memory before parent post-exit cleanup",pid:process.pid}))
const start=Date.now()
for(;;){
 try{await fs.access(path.join(root,"exit.json"));break}catch{}
 if(Date.now()-start>180000)throw Error("Own physical exit not observed for privacy qualification")
 await Bun.sleep(250)
}
const destination=path.join(root,"redacted-logs");await fs.mkdir(destination,{recursive:true})
const files=[path.join(root,"stdout.log"),path.join(root,"stderr.log"),...(await fs.readdir(path.join(root,"runtime/log"))).filter(x=>x.endsWith(".log")).map(x=>path.join(root,"runtime/log",x))]
const observations=[]
for(const file of files){
 const text=await fs.readFile(file,"utf8"),rawContainsKnownCredential=redactor.containsCredential(text)
 const safe=redactor.redact(text)
 await fs.writeFile(path.join(destination,path.basename(file)),safe)
 observations.push({file:path.relative(root,file),bytes:Buffer.byteLength(text),rawContainsKnownCredential,archivedContainsKnownCredential:redactor.containsCredential(safe)})
}
const result={boundary:"Actual credential bytes retained only in memory; completed original logs scanned after physical exit and pair cleanup",files:observations}
await fs.writeFile(path.join(root,"privacy-qualified.json"),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
if(observations.some(x=>x.rawContainsKnownCredential))process.exit(1)
