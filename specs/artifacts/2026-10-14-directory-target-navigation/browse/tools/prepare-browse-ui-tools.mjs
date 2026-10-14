import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('.tmp-codex-directory-target-01a133'),source=path.join(root,'relocation-permission-after-tools'),target=path.join(root,'directory-target-browse-after-tools')
fs.mkdirSync(target)
const changes=[]
for(const name of ['fixture-support.mjs','fixture-tool.mjs','launch.ps1','native-host.ts','owned-launch-functions.ps1','shutdown.ps1','check-syntax.ps1']){
 const before=fs.readFileSync(path.join(source,name),'utf8');let after=before;const applied=[]
 for(const [from,to] of [['relocation-permission-after','directory-target-browse-after'],['relocation-permission.fixture/v1','directory-target-browse.fixture/v1'],['real-desktop-relocation-permission','real-desktop-directory-target-browse'],['18458','18459'],['/ui-bundle/bin/bun.exe','/browse-ui-bundle/bin/bun.exe'],['RELOCATION','BROWSE']]){
  const count=after.split(from).length-1;if(count){after=after.replaceAll(from,to);applied.push({from,to,count})}
 }
 if(name==='fixture-tool.mjs'){
  const replace=(label,from,to)=>{if(after.split(from).length!==2)throw Error('Exact fixture seam required: '+label);after=after.replace(from,to);applied.push({label,from,to,count:1})}
  replace('owned outside directory link','const directories = {',`links.push({ role: "root", path: "outside-alias", text: projects.b, kind: "junction", targetDirectory: projects.b })
const extraLinks = [
  { role: "root", path: "file-alias", text: "root-marker.txt", kind: "file" },
  { role: "root", path: "broken-alias", text: "missing-dir", kind: "dir" },
]
const pickerLiteral = tiny("BROWSE UPLOAD 01a133\\r\\n")
const directories = {`)
  replace('literal budget includes picker','files.reduce((count, item) => count + item.bytes.byteLength, 0)','files.reduce((count, item) => count + item.bytes.byteLength, pickerLiteral.length)')
  replace('eight healthy directory links','links.length === 7','links.length === 8')
  replace('declared extra inputs','directories, links, registrationPlan,','directories, links, extraLinks, picker: { name: "browser-upload.txt", bytesBase64: pickerLiteral.toString("base64") }, registrationPlan,')
  replace('fixture extras and correct scope','files: [], links: [], git: []','files: [], links: [], extraLinks: [], git: []')
  replace('qualification boundary','Real desktop relocation permission only; no directory-target browsing, future-tree or model acceptance is claimed','Real desktop directory-target browsing and alias destinations; no model or non-Windows acceptance is claimed')
  replace('actual extra links and picker before original reads','  result.preparedMarkers = await markerFacts(fixture, "prepared")',`  for (const item of extraLinks) {
    const full = join(item.role, item.path)
    await fs.symlink(item.text, full, item.kind)
    const original = await observe(full)
    requireFact(original.entry?.symbolicLink === true && original.readlink?.state === "present", "Actual extra symbolic entry required")
    fixture.extraLinks.push({ ...item, full, original })
  }
  const picker = path.join(runRoot, "inputs", "browser-upload.txt")
  await fs.writeFile(picker, pickerLiteral, { flag: "wx" })
  fixture.pickerInputs.push({ full: picker, bytesBase64: pickerLiteral.toString("base64"), original: await observe(picker, true) })
  result.preparedMarkers = await markerFacts(fixture, "prepared")`)
 }
 fs.writeFileSync(path.join(target,name),after,{flag:'wx'});changes.push({name,before,after,applied})
}
fs.writeFileSync(path.join(target,'full-preparation-changes.json'),JSON.stringify(changes,null,2)+'\n',{flag:'wx'})
const wrapper=path.join(root,'run-dot-native.mjs'),before=fs.readFileSync(wrapper,'utf8');let after=before;const applied=[]
function replace(label,from,to){if(after.split(from).length!==2)throw Error('Exact wrapper seam required: '+label);after=after.replace(from,to);applied.push({label,from,to,count:1})}
replace('browse modes',"const relocationUIMode=", "const browseUIMode=['browse-ui-prepare','browse-ui-register','browse-ui-before','browse-ui-after'].includes(mode)\nconst relocationUIMode=")
replace('allowed modes',"'relocation-ui-after'].includes(mode)","'relocation-ui-after','browse-ui-prepare','browse-ui-register','browse-ui-before','browse-ui-after'].includes(mode)")
const conditions=after.split('||relocationUIMode').length-1;after=after.replaceAll('||relocationUIMode','||relocationUIMode||browseUIMode');applied.push({label:'same host/config/fixture/budget conditions',count:conditions})
replace('independent original client namespace',"const root=path.join(scratch,relocationUIMode?","const root=path.join(scratch,browseUIMode?'browse-ui-native-'+mode.slice(10)+'-'+host:relocationUIMode?")
const prepares=after.split("mode==='relocation-ui-prepare'").length-1;after=after.replaceAll("mode==='relocation-ui-prepare'","mode==='relocation-ui-prepare'||mode==='browse-ui-prepare'");applied.push({label:'same prepare budgets',count:prepares})
replace('exact target scripts',"const targetArgs=relocationUIMode?", "const targetArgs=browseUIMode?[path.join(scratch,'directory-target-browse-after-tools',mode==='browse-ui-before'||mode==='browse-ui-after'?'verify-state.mjs':'fixture-tool.mjs'),mode.slice(10)]:relocationUIMode?")
fs.writeFileSync(path.join(root,'run-dot-native.before-browse-ui.mjs'),before,{flag:'wx'});fs.writeFileSync(wrapper,after)
fs.writeFileSync(path.join(root,'browse-wrapper-full-change.json'),JSON.stringify({before,after,applied},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({target,files:changes.length,wrapperChanges:applied,fixtureCreated:false,serviceStarted:false}))
