import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22'
fs.cpSync(base+'/offline-location-recovery-515-after-ui-bundle/bin/ui',base+'/member-locale-stream-516-'+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Same formal main-DhV28lza copied into fresh owned bundle')
