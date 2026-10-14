import fs from 'node:fs'
import path from 'node:path'
const scratch=path.resolve('.tmp-codex-directory-target-01a133'),previous=JSON.parse(fs.readFileSync(path.join(scratch,'future-short.inputs.json'),'utf8'))
const declarations=[
 {id:'same-parent-same-stem',source:'A/publication-source-folder',target:'A/publication-target-folder',controls:[]},
 {id:'same-parent-different-stem',source:'A/source-description-folder',target:'A/destination-description-folder',controls:[]},
 {id:'cross-parent-stage-final',source:'A/deep/staging-description-folder',target:'A/destination-description-folder',controls:[]},
 {id:'cross-parent-colliding-final',source:'A/deep/staging-description-folder',target:'A/destination-description-folder',controls:['A/destination-alpha-folder','A/destination-alpine-folder']},
]
const cases=declarations.map(({id,source,target,controls})=>({id,directories:[source,source+'/r','B',...controls],lateDirectories:[],files:[{path:source+'/r/marker.txt',literal:'TOP ROOT NOTE\r\n'},{path:'B/marker.txt',literal:'TOP INDEPENDENT B\r\n'}],links:[],shortOf:source,generatedLink:source+'/u',operations:[{method:'rename',source,target}],observations:[source,source+'/r/marker.txt',source+'/u',source+'/u/marker.txt',target,target+'/r/marker.txt',target+'/u',target+'/u/marker.txt','B/marker.txt',...controls]}))
const input={...previous,schema:'future-top-name-input/v1',runRoot:'C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/future-top-name-01a133',maximumDeclaredBytes:512,cases,totalDeclaredLiteralBytes:2*cases.reduce((n,c)=>n+c.files.reduce((m,f)=>m+Buffer.byteLength(f.literal),0),0)}
if(input.totalDeclaredLiteralBytes>input.maximumDeclaredBytes)throw Error('Original literal budget exceeded')
fs.writeFileSync(path.join(scratch,'future-top-name.inputs.json'),JSON.stringify(input,null,2)+'\n',{flag:'wx'})
const changes=[],originals=[]
function replace(text,label,before,after){if(text.split(before).length!==2)throw Error('Exact single source seam required: '+label);changes.push({label,before,after});return text.replace(before,after)}
let qualifier=fs.readFileSync(path.join(scratch,'future-short-qualifier.mjs'),'utf8');originals.push({path:'future-short-qualifier.mjs',text:qualifier})
qualifier=replace(qualifier,'input name',"'future-short.inputs.json'","'future-top-name.inputs.json'")
changes.push({label:'fixture schema',before:'future-short-fixture/v1',after:'future-top-name-fixture/v1',count:qualifier.split('future-short-fixture/v1').length-1})
qualifier=qualifier.replaceAll('future-short-fixture/v1','future-top-name-fixture/v1')
qualifier=replace(qualifier,'original actual root-alias text',"rawRelativeText=shortBasename+'/r'","rawRelativeText='../'+shortBasename+'/r'")
qualifier=replace(qualifier,'actual original alias location',"const sourceAlias=path.join('A/deep/tree',path.basename(prepared.shortPath.path)),targetAlias=path.join('A/result',path.basename(prepared.shortPath.path))","const sourceAlias=path.join(path.dirname(spec.operations[0].source),path.basename(prepared.shortPath.path)),targetAlias=path.join(path.dirname(spec.operations[0].target),path.basename(prepared.shortPath.path))")
qualifier=replace(qualifier,'actual published root alias observation',"   const markers=[];for(const file of spec.files)",String.raw`   const targetRelative=spec.operations[0].target,targetFact=after.find(row=>row.relative===targetRelative)
   assert.ok(targetFact?.shortPath?.path)
   const actualAlias=path.join(path.dirname(targetRelative),path.basename(targetFact.shortPath.path))
   after.push(await capture(root,actualAlias),await capture(root,actualAlias+'/r/marker.txt'))
   const markers=[];for(const file of spec.files)`)
fs.writeFileSync(path.join(scratch,'future-top-name-qualifier.mjs'),qualifier,{flag:'wx'})
let wrapper=fs.readFileSync(path.join(scratch,'run-dot-native.mjs'),'utf8');originals.push({path:'run-dot-native.mjs',text:wrapper})
fs.writeFileSync(path.join(scratch,'run-dot-native.before-future-top-name.mjs'),wrapper,{flag:'wx'})
wrapper=replace(wrapper,'top mode category',"const shortMode=","const topMode=['future-top-prepare','future-top-read'].includes(mode)\nconst shortMode=")
wrapper=replace(wrapper,'exact new modes',"'future-short-read'].includes(mode)||","'future-short-read','future-top-prepare','future-top-read'].includes(mode)||")
wrapper=replace(wrapper,'new prepare host',"mode==='future-short-prepare'||copyUIMode)&&host!=='node'","mode==='future-short-prepare'||mode==='future-top-prepare'||copyUIMode)&&host!=='node'")
wrapper=replace(wrapper,'original read UUID',"mode==='future-short-read')&&!fixtureID","mode==='future-short-read'||mode==='future-top-read')&&!fixtureID")
wrapper=replace(wrapper,'prepare without UUID',"mode==='future-short-prepare'||copyUIMode)&&fixtureID","mode==='future-short-prepare'||mode==='future-top-prepare'||copyUIMode)&&fixtureID")
wrapper=replace(wrapper,'fixed top input',"scratch,shortMode?'future-short.inputs.json'","scratch,topMode?'future-top-name.inputs.json':shortMode?'future-short.inputs.json'")
wrapper=replace(wrapper,'own new namespace',"scratch,shortMode?'future-short-native-'","scratch,topMode?'future-top-native-'+mode.slice(11)+'-'+host:shortMode?'future-short-native-'")
wrapper=replace(wrapper,'same execution cap',"executionCapMs=relocationMode||shortMode?","executionCapMs=relocationMode||shortMode||topMode?")
wrapper=replace(wrapper,'same output cap',"inactivityTimeoutMs=relocationMode||shortMode?","inactivityTimeoutMs=relocationMode||shortMode||topMode?")
wrapper=replace(wrapper,'actual target input',"const targetArgs=shortMode?","const targetArgs=topMode?[path.join(scratch,'future-top-name-qualifier.mjs'),mode.slice(11),host,...(fixtureID?[fixtureID]:[])]:shortMode?")
fs.writeFileSync(path.join(scratch,'run-dot-native.mjs'),wrapper)
fs.writeFileSync(path.join(scratch,'future-top-name-exact-tool-changes.json'),JSON.stringify({originals,changes,qualifier,wrapper},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({casesPerHost:cases.length,declaredLiteralBytes:input.totalDeclaredLiteralBytes,changes:changes.length,syntaxRun:false,fixtureCreated:false}))
