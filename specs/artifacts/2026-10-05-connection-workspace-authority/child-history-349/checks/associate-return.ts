import fs from 'node:fs'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
const root=path.resolve('specs/artifacts/2026-10-05-connection-workspace-authority/child-history-349')
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'))
const audit=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'live-01/child-history-349-live-01-final-provider-audit.json.gz'))).toString())
const qualification=read('checks/actual-qualification.json'),shots=read('screenshot-times.json')
const selected=shots.filter((s:any)=>['05-over-32-parts-before-return.png','06-first-return-over-cache-boundary.png','07-agent-list-return.png'].includes(s.file))
const interval={from:Date.parse(selected[0].at),to:Date.parse(selected.at(-1).at)}
const readers=audit.requests.filter((r:any)=>r.response_reader.boundAt<=interval.to&&r.response_reader.terminal.at>=interval.from).map((r:any)=>({context:r.response_reader.requestContext,from:new Date(r.response_reader.boundAt).toISOString(),to:new Date(r.response_reader.terminal.at).toISOString(),terminal:r.response_reader.terminal.kind}))
const workerLast=audit.requests.filter((r:any)=>r.response_reader.requestContext.sessionID===qualification.workerID&&r.response_reader.requestContext.streamRequest.agentID==='base-researcher').at(-1)
const result={shots:selected,interval,readers,workerLastEOF:new Date(workerLast.response_reader.terminal.at).toISOString(),boundary:'Actual reader timing only; temporal overlap cannot by itself establish DOM remount, scroll owner, or root cause. First reopen screenshot follows worker EOF.'}
fs.writeFileSync(path.join(root,'checks/return-phase-association.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'})
fs.copyFileSync(path.resolve('.tmp-product-iteration/child-history-349/associate-return.ts'),path.join(root,'checks/associate-return.ts'),fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify(result))
