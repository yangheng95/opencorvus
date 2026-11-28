import fs from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { prepareWorkArtifactRuntimeEnvironment } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/work-artifact/presentation.ts"
import { WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST, WorkArtifactTargetPackageManifestSchema, verifyWorkArtifactTargetPackageManifest } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/work-artifact/runtime/package-manifest.ts"
import { WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH, parseWorkArtifactRuntimeLock } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/work-artifact/runtime/runtime-lock.ts"
const directory=import.meta.dir,host="C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261127-sales-workbook/host"
const manifest=WorkArtifactTargetPackageManifestSchema.parse(await Bun.file(path.join(host,WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST)).json())
const lock=parseWorkArtifactRuntimeLock(await Bun.file(path.join(host,WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH)).json())
await verifyWorkArtifactTargetPackageManifest({root:host,target:manifest.target,lock})
const executable=path.join(host,manifest.files.find(file=>file.kind==="executable")!.path)
const env={...process.env,...await prepareWorkArtifactRuntimeEnvironment(directory),...lock.runtimes[0].execution_policy.environment}
const source=path.join(directory,"validated-2/北仓结算交接简报.pptx"),candidate=path.join(directory,"native-position-probe.pptx")
await fs.copyFile(source,candidate)
const run=promisify(execFile),results=[]
for(const args of [["set",candidate,"/slide[2]/chart[1]","--prop","dataLabels.position=insideEnd","--json"],["get",candidate,"/slide[2]/chart[1]","--json"],["validate",candidate,"--json"]]) {
 const result=await run(executable,args,{cwd:directory,env,windowsHide:true,timeout:45000,maxBuffer:1024*1024});results.push(JSON.parse(result.stdout))
}
const html=await run(executable,["view",candidate,"html"],{cwd:directory,env,windowsHide:true,timeout:45000,maxBuffer:4*1024*1024})
await fs.writeFile(path.join(directory,"native-position-probe.html"),html.stdout)
const facts={runtime:lock.runtimes[0].version,verifiedManagedFiles:manifest.files.length,sourceBytes:(await fs.stat(source)).size,candidateBytes:(await fs.stat(candidate)).size,results}
await fs.writeFile(path.join(directory,"native-position-probe.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify({runtime:facts.runtime,verifiedManagedFiles:facts.verifiedManagedFiles,results:facts.results}))
