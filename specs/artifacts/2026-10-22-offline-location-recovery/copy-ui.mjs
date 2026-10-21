import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2]
assert(['after-api','after-api-restart','after-api-session','after-api-supersede'].includes(stage))
const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/offline-location-recovery-515-'
fs.cpSync(base+'after-ui-bundle/bin/ui',base+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Copied same formal after-ui resource to owned '+stage)
