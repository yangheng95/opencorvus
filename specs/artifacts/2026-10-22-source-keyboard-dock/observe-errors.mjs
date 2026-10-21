import fs from 'node:fs'
const root=import.meta.dirname,out='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-22-source-keyboard-dock'
const rows=fs.readFileSync('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/source-keyboard-dock-517-before/runtime/log/dev.log','utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line))
const errors=rows.filter(r=>r.level==='error').map(r=>({time:r.time,service:r.service,message:r.message,data:r.data}))
fs.writeFileSync(out+'/error-observation.json',JSON.stringify({at:new Date().toISOString(),errors,scope:'Original actual error fields;zero credentials/catalog;server ModelNotFound/config.validate propagation;not Provider qualification'},null,2)+'\n',{flag:'wx'})
fs.copyFileSync(root+'/observe-errors.mjs',out+'/observe-errors.mjs',fs.constants.COPYFILE_EXCL)
console.log(JSON.stringify({errors:errors.length,server:errors.filter(r=>r.service==='server').map(r=>({status:r.data.statusCode,name:r.data.error?.name}))}))
