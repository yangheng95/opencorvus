import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2];assert(['before','after'].includes(stage))
const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22'
fs.cpSync(base+'/member-stream-reading-524-after-bundle/bin/ui',base+'/clipboard-literal-525-'+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true})
console.log('Same formal main-DJESc7Su copied into fresh owned bundle')
