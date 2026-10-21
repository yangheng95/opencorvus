import fs from 'node:fs/promises'
import path from 'node:path'
const {installProcessShims}=await import('../../packages/opencorvus/src/runtime/shims');installProcessShims()
const {StreamQueryScope}=await import('./stream-client')
const {observedProcessOccurrence}=await import('../../packages/opencorvus/src/runtime/process-occurrence')
const root=import.meta.dir,runtime=process.env.OPENCORVUS_HOME!,cwd=path.join(runtime,'owner-command'),output=process.argv[2]
await fs.mkdir(cwd,{recursive:true})
const streams=new Set<string>(),scope=new StreamQueryScope(path.join(runtime,'owner-queries'),2),grandchildFile=path.join(cwd,'grandchild.json')
const first=await scope.submit(process.execPath,[root+'/owner-target.mjs',grandchildFile],cwd,{onData(stream,bytes){if(stream==='stdout'&&bytes.toString()==='owner-target-ready\n')streams.add('first')}})
const second=await scope.submit(process.execPath,['-e',"process.stderr.write('owner-peer-ready\\n');setInterval(()=>{},1000)"],cwd,{onData(stream,bytes){if(stream==='stderr'&&bytes.toString()==='owner-peer-ready\n')streams.add('second')}})
const deadline=Date.now()+15000
while(streams.size!==2){if(Date.now()>deadline)throw Error('Owner fixture real data did not arrive');await Bun.sleep(10)}
const targets=await Promise.all([first,second].map(async item=>JSON.parse(await fs.readFile(item.request.ready_file,'utf8'))))
const grandchild=JSON.parse(await fs.readFile(grandchildFile,'utf8')),grandchildIdentity=observedProcessOccurrence(grandchild.grandchildPID)
if(!grandchildIdentity)throw Error('Exact owned grandchild identity required')
await fs.writeFile(output,JSON.stringify({at:new Date().toISOString(),owner:scope.owner,helper:await scope.ready,requests:[first.request,second.request],targets,grandchild:grandchildIdentity,actualStreams:[...streams],scopeQueries:2},null,2)+'\n',{flag:'wx'})
await new Promise(()=>{})
