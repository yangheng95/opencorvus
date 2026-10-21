import fs from 'node:fs'
import assert from 'node:assert/strict'
const root=import.meta.dirname,base='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21',run=base+'/task-member-stream-504-before',authority=run+'-authority'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),proof=read(run+'/evidence/physical-terminal-and-pair-cleanup.json'),retirement=read(root+'/before-authority-retirement.json'),preparation=read(root+'/before-authority-preparation.json')
assert.equal(proof.native.physicalCompletion,true);assert.equal(proof.native.outputDrainComplete,true);assert.equal(proof.native.requestCleanupComplete,true);assert.equal(proof.launcher.originalChildExit,0)
assert.equal(proof.maximumRequests,24);assert.equal(proof.requests,15);assert.deepEqual(preparation.scopeBudgets,{before:24,after:24});assert.equal(preparation.maximumBatchRequests,48)
for(const source of proof.provider){assert.equal(source.model,'gpt-6.1-sol');assert.equal(source.streaming,true);assert.equal(source.status,200);assert.equal(source.sourceReader.terminal.kind,'eof')}
const disposition=[...['auth.json','models.json'].map(name=>({name,runtimeExists:fs.existsSync(run+'/runtime/data/'+name),authorityExists:fs.existsSync(authority+'/'+name)}))]
assert.equal(retirement.maximumRequests,24)
const result={at:new Date().toISOString(),originalConsoleReportedMaximum:12,originalRetirementJSONMaximum:retirement.maximumRequests,actualScopeMaximum:proof.maximumRequests,actualRequests:proof.requests,upfrontTotalMaximum:preparation.maximumBatchRequests,disposition,correction:'Original retirement checker correctly asserted24 and cumulative15<=24. Its canonical retirement JSON correctly reported24; only console.log retained the inherited literal maximum12. Actual preflight/native budget and prepared scopes are24/24 total48. No request scope reset or extension occurred. This descriptor corrects the console caption, not the original JSON.',unusedBudget:{before:9,conditionalAfter:24,afterStarted:false,disposition:'retired; no production root-cause fix established'}}
fs.writeFileSync(root+'/before-authority-retirement-budget-correction.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result))
