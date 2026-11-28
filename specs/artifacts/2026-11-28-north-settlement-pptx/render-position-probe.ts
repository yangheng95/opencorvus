import fs from "node:fs/promises"
import path from "node:path"
import {bootstrapIsolatedTestRuntime,applyIsolatedTestUserEnvironment} from "D:/myhexin-local/opencorvus/packages/util/src/test-runtime-environment.ts"
import {prepareTestProcessSupervisor} from "D:/myhexin-local/opencorvus/packages/opencorvus/script/prepare-test-process-supervisor.ts"
const supervisor=prepareTestProcessSupervisor();applyIsolatedTestUserEnvironment(await bootstrapIsolatedTestRuntime("runner"));if(supervisor)process.env.OPENCORVUS_PROCESS_SUPERVISOR=supervisor
const {renderOfficeHtml}=await import("D:/myhexin-local/opencorvus/packages/opencorvus/src/work-artifact/office-html-render.ts")
const directory=path.join(import.meta.dir,"native-position-render");await fs.mkdir(directory)
const result=await renderOfficeHtml({html:await fs.readFile(path.join(import.meta.dir,"native-position-probe.html"),"utf8"),format:"pptx",directory,executionAuthority:{kind:"host",cwd:directory},abort:new AbortController().signal,timeoutMs:45000,maxBytes:16000000,maxUnits:3})
await fs.writeFile(path.join(import.meta.dir,"native-position-render.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result))
