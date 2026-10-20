import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dir,files=new Map([
 ['d:\\myhexin-local\\opencorvus\\packages\\opencorvus\\src\\project\\project.ts','project-before.ts'],
 ['d:\\myhexin-local\\opencorvus\\packages\\opencorvus\\src\\util\\git.ts','git-before.ts'],
]),loaded:Array<{path:string,snapshot:string,at:number}>=[]
Bun.plugin({name:'492-immutable-before-source',setup(builder){builder.onLoad({filter:/[\\/]src[\\/](?:project[\\/]project|util[\\/]git)\.ts$/},input=>{
 const snapshot=files.get(path.resolve(input.path).toLowerCase());assert(snapshot,'Exact original source module')
 loaded.push({path:input.path,snapshot,at:performance.now()})
 return{contents:fs.readFileSync(path.join(root,snapshot),'utf8'),loader:'ts'}
})}})
process.on('exit',()=>fs.writeFileSync(path.resolve(process.env.OPENCORVUS_HOME!,'../evidence/source-selection.json'),JSON.stringify({revision:'2963e80510616309b75f913560683bde54330c5f',loaded,boundary:'Private immutable two-file pre-change control;real original module resolution and all other current production sources;not production fallback'},null,2)+'\n',{flag:'wx'}))
