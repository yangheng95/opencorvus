import fs from 'node:fs'
import assert from 'node:assert/strict'
const stage=process.argv[2];assert(['before','after'].includes(stage));const base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22'
fs.cpSync(base+'/offline-location-recovery-515-after-ui-bundle/bin/ui',base+'/config-admitted-discovery-518-'+stage+'-bundle/bin/ui',{recursive:true,force:false,errorOnExist:true});console.log('Formal main-DhV28lza copied to fresh owned before bundle')
