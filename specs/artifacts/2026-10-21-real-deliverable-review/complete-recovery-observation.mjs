import fs from 'node:fs'
const root=import.meta.dirname
let code=fs.readFileSync(root+'/check-recovery-final-http.ts','utf8')
code=code.replaceAll('recovery-final-http-','recovery-final-observation-')
 .replace("assert.equal(late.status,200);assert.equal((late.body as any).status,'rejected');assert.equal((late.body as any).response.decision,'deny')", "assert.equal(late.status,400);assert.deepEqual(late.body,{name:'ProviderModelNotFoundError',data:{providerID:'openai',modelID:'gpt-6.1-sol',suggestions:[]}})")
 .replace("assert.equal(replay.status,202);assert.equal((replay.body as any).status,'cancelled')", "assert.equal(replay.status,400);assert.deepEqual(replay.body,{name:'ProviderModelNotFoundError',data:{providerID:'openai',modelID:'gpt-6.1-sol',suggestions:[]}})")
 .replaceAll('FROM provider_activity','FROM provider_activity_request')
fs.writeFileSync(root+'/check-recovery-observation.ts',code,{flag:'wx'})
for(const stage of ['recovery','recovery-final']){
 const preserve=fs.readFileSync(root+'/preserve.ts','utf8').replace("['before']",JSON.stringify([stage])).replaceAll('data-preservation-observation.json',stage+'-data-preservation-observation.json')
 fs.writeFileSync(root+'/preserve-'+stage+'.ts',preserve,{flag:'wx'})
}
