import fs from 'node:fs'
const root=import.meta.dirname,old=root+'/../goal-deliverable-navigation-498'
let code=fs.readFileSync(old+'/prepare.ts','utf8')
 .replace("name='goal-deliverable-navigation-498',source=base+'/markdown-batch-continuity-497-after'","name='goal-deliverable-interface-500',source=base+'/goal-reconciliation-admission-499-after-data'")
 .replace("source+'/evidence/physical-terminal-and-pair-cleanup.json'","base+'/goal-reconciliation-admission-499-after/evidence/physical-terminal.json'")
 .replace("assert.equal(proof.launcher.originalChildExit,0);assert.equal(proof.pairedCleanupComplete,true)","assert.equal(proof.launcher.childExitCode,0);assert.equal(proof.originalExit,0);assert.equal(proof.shutdown.statusCode,200)")
 .replaceAll('18879','18885').replaceAll('18881','18887')
 .replaceAll('source native/reader/launcher settled and auth/models retired','source499 native/reader/launcher settled;no authority pair staged')
 .replaceAll('498 ','500 ')
fs.writeFileSync(root+'/prepare-data.ts',code,{flag:'wx'})
fs.writeFileSync(root+'/preserve.ts',fs.readFileSync(old+'/preserve.ts','utf8'),{flag:'wx'})
