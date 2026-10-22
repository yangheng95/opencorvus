import fs from 'node:fs'
import path from 'node:path'
const old=import.meta.dirname,root=path.resolve(old,'../task-source-cleanup-536c')
fs.mkdirSync(root)
const plan=JSON.parse(fs.readFileSync(old+'/plan.json','utf8'))
Object.assign(plan,{scope:'task-source-cleanup-536c',ports:{before:19055,after:19055},source:'Closed536-after;after copies closed536c-before',flow:'Actual Task retirement/reconnect cleanup root diagnosis;no business inputs',maximumRequestsPerStartedScope:4})
fs.writeFileSync(root+'/plan.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'})
for(const file of ['launch.ps1','shutdown.ps1','settle.ps1','prepare-authority.mjs','retire-authority.mjs','preserve.ts','qualify-provider.ps1','read-task.ts']){
 fs.writeFileSync(root+'/'+file,fs.readFileSync(old+'/'+file,'utf8').replaceAll('task-source-epoch-536','task-source-cleanup-536c').replaceAll('19053','19055'),{flag:'wx'})
}
const data=fs.readFileSync(old+'/prepare-data.ts','utf8').replaceAll('task-source-epoch-536','task-source-cleanup-536c').replaceAll('source-reconnect-observation-535','task-source-epoch-536')
fs.writeFileSync(root+'/prepare-data.ts',data,{flag:'wx'})
let build=fs.readFileSync(old+'/build-diagnostic.mjs','utf8').replaceAll('task-source-epoch-536','task-source-cleanup-536c')
const anchor="  const file=id.replaceAll('\\\\','/')"
if(build.split(anchor).length!==2)throw Error('Transform anchor')
const prefix='Error.stackTraceLimit=100;\nconst cleanupActive536=new WeakSet();\nconst cleanupFrames536=[];\n'
const start='function cleanNode(node) {\n if(cleanupActive536.has(node)) console.warn("MT536C",JSON.stringify({kind:"cleanup-reentry",computation:String(node.fn).slice(0,1000),frames:cleanupFrames536.slice(),stack:new Error().stack}));\n cleanupActive536.add(node);\n try {'
const loop='for (i = node.cleanups.length - 1; i >= 0; i--) {\n cleanupFrames536.push(String(node.cleanups[i]).slice(0,1800));\n try {node.cleanups[i]();} finally {cleanupFrames536.pop();}\n }'
const transform=[
"  if(file.endsWith('/solid-js/dist/solid.js')){",
'   source='+JSON.stringify(prefix)+'+source',
'   source=replace(source,"function cleanNode(node) {",'+JSON.stringify(start)+')',
'   source=replace(source,"for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();",'+JSON.stringify(loop)+')',
'   return replace(source,'+JSON.stringify('}\nfunction reset(node, top) {')+','+JSON.stringify('} finally {cleanupActive536.delete(node)}\n}\nfunction reset(node, top) {')+')',
'  }'
].join('\n')
build=build.replace(anchor,anchor+'\n'+transform)
fs.writeFileSync(root+'/build-diagnostic.mjs',build,{flag:'wx'})
