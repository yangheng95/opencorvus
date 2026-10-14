import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve('.tmp-codex-directory-target-01a133'),file=path.join(root,'run-dot-native.mjs')
const before=fs.readFileSync(file,'utf8');let after=before;const applied=[]
function replace(label,from,to){if(after.split(from).length!==2)throw Error('Exact wrapper seam required: '+label);after=after.replace(from,to);applied.push({label,from,to,count:1})}
replace('browse modes',"const relocationUIMode=", "const browseUIMode=['browse-ui-prepare','browse-ui-register','browse-ui-before','browse-ui-after'].includes(mode)\nconst relocationUIMode=")
replace('allowed modes',"'relocation-ui-after'].includes(mode)||","'relocation-ui-after','browse-ui-prepare','browse-ui-register','browse-ui-before','browse-ui-after'].includes(mode)||")
const conditions=after.split('||relocationUIMode').length-1;after=after.replaceAll('||relocationUIMode','||relocationUIMode||browseUIMode');applied.push({label:'same host/config/fixture/budget conditions',count:conditions})
replace('independent original client namespace',"const root=path.join(scratch,relocationUIMode?","const root=path.join(scratch,browseUIMode?'browse-ui-native-'+mode.slice(10)+'-'+host:relocationUIMode?")
const prepares=after.split("mode==='relocation-ui-prepare'").length-1;after=after.replaceAll("mode==='relocation-ui-prepare'","mode==='relocation-ui-prepare'||mode==='browse-ui-prepare'");applied.push({label:'same prepare budgets',count:prepares})
replace('exact target scripts',"const targetArgs=relocationUIMode?", "const targetArgs=browseUIMode?[path.join(scratch,'directory-target-browse-after-tools',mode==='browse-ui-before'||mode==='browse-ui-after'?'verify-state.mjs':'fixture-tool.mjs'),mode.slice(10)]:relocationUIMode?")
fs.writeFileSync(path.join(root,'run-dot-native.before-browse-ui.mjs'),before,{flag:'wx'});fs.writeFileSync(file,after)
fs.writeFileSync(path.join(root,'browse-wrapper-full-change.json'),JSON.stringify({before,after,applied},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({applied,fixtureCreated:false,serviceStarted:false}))
