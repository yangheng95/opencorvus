import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const scratch=path.resolve('.tmp-codex-directory-target-01a133')
const config=JSON.parse(await fs.readFile(path.join(scratch,'dot-mixed-qualifier.inputs.json'),'utf8'))
const mode=process.argv[2],host=process.argv[3],fixtureID=process.argv[4]
if(!['prepare','read'].includes(mode)||!['node','bun'].includes(host)||mode==='prepare'&&host!=='node'||mode==='read'&&!fixtureID)throw Error('Exact planned mode/host/fixture required')
const root=path.join(scratch,'dot-native-'+mode+'-'+host)
await fs.mkdir(root)
const names=['runtime','evidence','home','appdata','localappdata','temp','xdg-config','xdg-data','xdg-cache','xdg-state']
for(const name of names)await fs.mkdir(path.join(root,name))
const environment={}
for(const name of ['PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE'])if(process.env[name]!==undefined)environment[name]=process.env[name]
for(const [key,name] of Object.entries({HOME:'home',USERPROFILE:'home',APPDATA:'appdata',LOCALAPPDATA:'localappdata',TEMP:'temp',TMP:'temp',TMPDIR:'temp',XDG_CONFIG_HOME:'xdg-config',XDG_DATA_HOME:'xdg-data',XDG_CACHE_HOME:'xdg-cache',XDG_STATE_HOME:'xdg-state',OPENCORVUS_HOME:'runtime'}))environment[key]=path.join(root,name)
environment.HOMEDRIVE=path.parse(environment.HOME).root.slice(0,2)
environment.HOMEPATH=environment.HOME.slice(2)
environment.OPENCORVUS_TASK_PROCESS_MODE='native'
environment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS='1'
environment.OPENCORVUS_DISABLE_AUTOUPDATE='1'
const occurrence='directory-target-dot-'+mode+'-'+host+'-'+randomUUID(),deadlineAt=Date.now()+30000
const evidence=path.join(root,'evidence'),executable=config.runtimes[host].executable
const targetArgs=[path.join(scratch,'dot-mixed-qualifier.mjs'),mode,'--host',host,...(mode==='read'?['--fixture-id',fixtureID]:[])]
const hostArgs=[path.join(scratch,'native-host.ts'),'--owned-host',evidence,occurrence,String(deadlineAt),'3000',executable,...targetArgs]
const input={mode,host,fixtureID,occurrence,root,evidence,hostExecutable:config.runtimes.bun.executable,hostArgs,executable,targetArgs,deadlineAt,executionCapMs:30000,inactivityTimeoutMs:3000,environmentNames:Object.keys(environment),parentPID:process.pid,admittedAtUtc:new Date().toISOString(),qualification:'Existing NativeFacade run owns the only child streams, true output inactivity and original physical/output/request joins; no outer inactivity timer or model/API/UI acceptance'}
await fs.writeFile(path.join(root,'original-input.json'),JSON.stringify(input,null,2),{flag:'wx'})
const child=spawn(input.hostExecutable,hostArgs,{cwd:root,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']})
const collect=async source=>{const chunks=[];for await(const part of source)chunks.push(Buffer.from(part));return Buffer.concat(chunks)}
const output=collect(child.stdout),errorOutput=collect(child.stderr)
const terminal=new Promise(resolve=>{
 const errors=[]
 child.on('error',error=>errors.push(Object.fromEntries(Object.getOwnPropertyNames(error).map(key=>[key,error[key]]))))
 child.once('close',(code,signal)=>resolve({code,signal,errors}))
})
const outcomes=await Promise.allSettled([terminal,output,errorOutput])
for(const [index,name] of [[1,'stdout.bin'],[2,'stderr.bin']])if(outcomes[index].status==='fulfilled')await fs.writeFile(path.join(root,name),outcomes[index].value,{flag:'wx'})
const receipt={occurrence,hostPID:child.pid,parentPID:process.pid,terminal:outcomes[0].status==='fulfilled'?outcomes[0].value:null,outputJoins:outcomes.slice(1).map((item,index)=>({stream:index?'stderr':'stdout',status:item.status,bytes:item.status==='fulfilled'?item.value.length:null,error:item.status==='rejected'?String(item.reason):undefined})),joinedAtUtc:new Date().toISOString()}
await fs.writeFile(path.join(root,'parent-joined.json'),JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({root,receipt}))
if(outcomes.some(item=>item.status==='rejected'))process.exitCode=1
else process.exitCode=receipt.terminal.code??1
