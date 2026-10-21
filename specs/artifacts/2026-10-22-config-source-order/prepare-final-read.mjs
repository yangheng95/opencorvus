import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=import.meta.dirname,prior=path.resolve(root,'../offline-location-recovery-515')
let data=fs.readFileSync(root+'/prepare-data.ts','utf8'),head="const stage=process.argv[2];assert(['before','after'].includes(stage))";assert(data.includes(head))
data=data.replace(head,"const stage='final-read'").replaceAll('modelInputBudget:4','modelInputBudget:0').replace('Paired authority staged separately;source fully closed;fixed4 requests including preflight/helpers','Complete public catalog only;no credentials or provider requests;source closed')
const target='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read'
data+=`\nfs.copyFileSync('C:/Users/hengu/AppData/Local/opencorvus/data/models.json',target+'/runtime/data/models.json',fs.constants.COPYFILE_EXCL);console.log('Complete public model catalog only;no credentials staged;model budget0')\n`
fs.writeFileSync(root+'/prepare-final-read.ts',data,{flag:'wx'})
let serve=fs.readFileSync(prior+'/serve.ts','utf8'),start=serve.indexOf('const ports='),end=serve.indexOf('\nconst packageRoot=',start);assert(start>=0&&end>start)
serve=serve.slice(0,start)+`const stage='final-read';assert.equal(path.resolve(runtime),path.resolve('${target}/runtime'));assert.equal(Number(portText),18991)`+serve.slice(end)
serve=serve.replaceAll('Offline startup location review; no credentials or model catalog copied','Final source order read;complete public catalog only;no credentials;zero model requests').replaceAll('Offline first-healthy workspace recovery;zero model budget;no credentials or catalog','Final Windows source order/zero model budget/public catalog only/no credentials').replace('Real development CLI/UI;zero-model historical read qualification; no Provider credential qualification','Final source order actual CLI/UI;zero-model/public-catalog read qualification;no Provider credential qualification')
fs.writeFileSync(root+'/serve-final-read.ts',serve,{flag:'wx'})
console.log('Final exact-source zero-model launcher sources prepared;no process started')
