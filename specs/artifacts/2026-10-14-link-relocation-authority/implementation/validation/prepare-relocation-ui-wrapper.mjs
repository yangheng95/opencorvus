import fs from 'node:fs'
const root='.tmp-codex-directory-target-01a133',file=root+'/run-dot-native.mjs',before=fs.readFileSync(file,'utf8'),changes=[]
fs.writeFileSync(root+'/run-dot-native.before-relocation-ui.mjs',before,{flag:'wx'})
let after=before
function replace(label,from,to){if(after.split(from).length!==2)throw Error('Exact wrapper seam required: '+label);after=after.replace(from,to);changes.push({label,from,to})}
replace('new UI category','const guardMode=',"const relocationUIMode=['relocation-ui-prepare','relocation-ui-register','relocation-ui-before','relocation-ui-after'].includes(mode)\nconst guardMode=")
replace('four exact new modes',"'future-top-read'].includes(mode)||","'future-top-read','relocation-ui-prepare','relocation-ui-register','relocation-ui-before','relocation-ui-after'].includes(mode)||")
replace('new modes Node only',"mode==='future-top-prepare'||copyUIMode)&&host!=='node'","mode==='future-top-prepare'||copyUIMode||relocationUIMode)&&host!=='node'")
replace('no invented UUID',"mode==='future-top-prepare'||copyUIMode)&&fixtureID","mode==='future-top-prepare'||copyUIMode||relocationUIMode)&&fixtureID")
replace('same runtime/native config',"mode==='entry-name'||guardMode||copyUIMode?'canonical-entry-name.inputs.json'","mode==='entry-name'||guardMode||copyUIMode||relocationUIMode?'canonical-entry-name.inputs.json'")
replace('distinct original namespaces',"scratch,topMode?'future-top-native-'","scratch,relocationUIMode?'relocation-ui-native-'+mode.slice(14)+'-'+host:topMode?'future-top-native-'")
replace('prepare execution cap',"mode==='guard-prepare'||mode==='copy-ui-prepare'?60000:","mode==='guard-prepare'||mode==='copy-ui-prepare'||mode==='relocation-ui-prepare'?60000:")
replace('other UI execution cap',"guardMode||copyUIMode?120000:","guardMode||copyUIMode||relocationUIMode?120000:")
replace('prepare actual output inactivity',"mode==='guard-prepare'||mode==='copy-ui-prepare'?20000:","mode==='guard-prepare'||mode==='copy-ui-prepare'||mode==='relocation-ui-prepare'?20000:")
replace('other UI actual output inactivity',"guardMode||copyUIMode?30000:","guardMode||copyUIMode||relocationUIMode?30000:")
replace('actual new target arguments',"const targetArgs=topMode?","const targetArgs=relocationUIMode?[path.join(scratch,'relocation-permission-after-tools',mode==='relocation-ui-before'||mode==='relocation-ui-after'?'verify-state.mjs':'fixture-tool.mjs'),mode.slice(14)]:topMode?")
fs.writeFileSync(file,after)
fs.writeFileSync(root+'/relocation-ui-wrapper-exact-changes.json',JSON.stringify({before,after,changes},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({changes:changes.length,fixtureCreated:false,serviceStarted:false}))
