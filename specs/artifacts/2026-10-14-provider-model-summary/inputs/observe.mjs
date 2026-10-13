import fs from 'node:fs'
const stage=process.argv[2]
if(!['before','after','overflow'].includes(stage))throw Error('Exact own stage required')
const port=stage==='before'?18624:stage==='after'?18626:18628,root='.tmp-codex-provider-model-summary-01a133/'+stage
const ready=JSON.parse(fs.readFileSync(root+'/ready.json','utf8'))
const facts=[]
for(const [scope,directory]of [['global',''],...ready.projects.map(p=>[p.label,p.directory])]){
 const get=async name=>{const route=scope==='global'?name==='config'?'global/config':'global/providers':name+'?directory='+encodeURIComponent(directory),response=await fetch('http://127.0.0.1:'+port+'/'+route),body=await response.json();if(response.status!==200)throw Error('Own public '+route+' returned '+response.status);return body}
 const config=await get('config'),response=await get('provider'),catalog=scope==='global'?response.catalog:response
 facts.push({scope,directory,providers:Object.entries(config.provider).filter(([id])=>id.startsWith('owned-summary-')).map(([id,p])=>({id,configuredIDs:Object.keys(p.models??{}),catalogIDs:Object.keys(catalog.all.find(p=>p.id===id)?.models??{})}))})
}
fs.writeFileSync(root+'/public-model-facts.json',JSON.stringify({at:new Date().toISOString(),facts,boundary:'Actual public config/catalog projection only; no credential content retained'},null,2)+'\n')
console.log(JSON.stringify(facts))
