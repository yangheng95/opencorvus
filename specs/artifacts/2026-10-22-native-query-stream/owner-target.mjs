import fs from 'node:fs'
import {spawn} from 'node:child_process'
const grandchild=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true})
fs.writeFileSync(process.argv[2],JSON.stringify({targetPID:process.pid,grandchildPID:grandchild.pid}),{flag:'wx'})
process.stdout.write('owner-target-ready\n')
setInterval(()=>{},1000)
