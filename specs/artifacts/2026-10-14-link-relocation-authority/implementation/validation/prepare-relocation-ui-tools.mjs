import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('.tmp-codex-directory-target-01a133'),source=path.join(root,'copy-kind-after-tools'),target=path.join(root,'relocation-permission-after-tools')
fs.mkdirSync(target)
const replacements=[['copy-kind-after-01a133','relocation-permission-after-01a133'],['copy-kind-after','relocation-permission-after'],['real-desktop-copy-link-kind','real-desktop-relocation-permission'],['copy-link-kind.fixture/v1','relocation-permission.fixture/v1'],['18457','18458'],['COPY ROOT','RELOCATION ROOT'],['COPY DATA','RELOCATION DATA'],['COPY TREE','RELOCATION TREE'],['Real desktop Copy link-kind preservation only','Real desktop relocation permission only']]
const changes=[]
for(const name of ['fixture-support.mjs','fixture-tool.mjs','launch.ps1','native-host.ts','owned-launch-functions.ps1','shutdown.ps1']){
 const before=fs.readFileSync(path.join(source,name),'utf8');let after=before;const applied=[]
 for(const [from,to] of replacements){const count=after.split(from).length-1;if(count){after=after.replaceAll(from,to);applied.push({from,to,count})}}
 if(name==='fixture-tool.mjs'){
  const replace=(label,from,to)=>{if(after.split(from).length!==2)throw Error('Exact fixture seam required: '+label);after=after.replace(from,to);applied.push({label,from,to,count:1})}
  replace('new control literal','const links = [','files.push({ role: "root", path: "project-b/root-marker.txt", bytes: tiny("RELOCATION INNER A 01a133\\r\\n") })\nconst links = [')
  replace('declared targets and two new links','const directories = { root: ["data", "context", "source-tree"], b: [] }',String.raw`for (const item of links) item.targetDirectory = join("root", "data")
links.push({ role: "root", path: "aliases/root-back", text: projects.root, kind: "junction", targetDirectory: projects.root },
  { role: "root", path: "context/relative", text: "../project-b", kind: "dir", targetDirectory: join("root", "project-b") })
const directories = { root: ["data", "context", "source-tree", "project-b", "aliases"], b: [] }`)
  replace('fixed seven links','links.length === 5','links.length === 7')
  replace('explicit actual target','samePath(actual.realpath?.value, join("root", "data"))','samePath(actual.realpath?.value, item.targetDirectory)')
 }
 fs.writeFileSync(path.join(target,name),after,{flag:'wx'});changes.push({name,before,after,applied})
}
fs.writeFileSync(path.join(target,'full-preparation-changes.json'),JSON.stringify(changes,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({files:changes.length,target,fixtureCreated:false,serviceStarted:false,links:7}))
