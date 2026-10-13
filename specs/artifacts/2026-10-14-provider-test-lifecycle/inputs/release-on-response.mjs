import fs from 'node:fs/promises'
import path from 'node:path'
const stage=process.argv[4]
if(!['postfix','shortbase'].includes(stage))throw Error('Exact own stage required')
const root=path.resolve('.tmp-codex-provider-test-lifecycle-01a133/'+stage)
const label=process.argv[2],baseline=Number(process.argv[3])
if(!/^[a-z0-9-]+$/.test(label)||!Number.isInteger(baseline))throw Error('Exact own input required')
const started=Date.now(),release=path.join(root,`lease-${label}-release`)
await fs.writeFile(path.join(root,`controller-${label}-ready.json`),JSON.stringify({started,baseline,absoluteLimit:60000,boundary:'Own lock fault input only; observes actual native HTTP response; no browser control'}))
let matched,expired=false
try{
 while(true){
  const requests=JSON.parse(await fs.readFile(path.join(root,'participant-requests.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '[]';throw e}))
  matched=requests.find(r=>r.id>baseline&&r.respondedAt)
  if(matched)break
  if(Date.now()-started>=60000){expired=true;break}
  await new Promise(r=>setTimeout(r,20))
 }
}finally{
 await fs.writeFile(release,'release')
 await fs.writeFile(path.join(root,`controller-${label}-terminal.json`),JSON.stringify({started,at:Date.now(),baseline,matched,expired},null,2))
}
console.log(JSON.stringify({matched,expired}))
if(expired)process.exitCode=1
