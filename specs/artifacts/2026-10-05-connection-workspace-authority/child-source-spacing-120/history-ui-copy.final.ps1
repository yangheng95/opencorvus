param([Parameter(Mandatory=$true)][string]$SourceRun,[Parameter(Mandatory=$true)][string]$SourceEvidence,[Parameter(Mandatory=$true)][string]$CaseRun,[Parameter(Mandatory=$true)][string]$CaseEvidence,[Parameter(Mandatory=$true)][string]$CaseLabel,[Parameter(Mandatory=$true)][int]$CasePort,[Parameter(Mandatory=$true)][string]$CasePurpose)
$ErrorActionPreference='Stop'
$copyRun=[IO.Path]::GetFullPath($CaseRun);$copyEvidence=[IO.Path]::GetFullPath($CaseEvidence);$copyLabel=$CaseLabel;$copyPort=$CasePort;$copyPurpose=$CasePurpose
$sourceRun=[IO.Path]::GetFullPath($SourceRun);$sourceEvidence=[IO.Path]::GetFullPath($SourceEvidence)
if($copyPort -ne 18080){throw 'Only admitted120 history port'}
$caseStage='before-01'
$caseRunName='sources-density-history-120-01'
if($copyLabel -ne $caseRunName){throw 'Exact history120 label required'}
if($copyRun -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/'+$caseRunName) -or $copyEvidence -ne [IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/child-source-spacing-120/'+$caseStage)){throw 'Exact fresh120 run/evidence required'}
if(Test-Path -LiteralPath $copyRun){throw 'Preserve existing copy occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $copyPort).Count){throw 'Fresh port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceOwner=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
foreach($value in @($SourceRun,$SourceEvidence,$CaseRun,$CaseEvidence)){if(![IO.Path]::IsPathFullyQualified($value)){throw 'Absolute source/target paths required'}}
if($sourceRun -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/sources-delegated-live-116-01') -or $sourceEvidence -ne [IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/delegated-final-authority-116/live-01') -or [IO.Path]::GetFullPath($sourceOwner.runRoot) -ne $sourceRun -or [IO.Path]::GetFullPath($sourceOwner.settlementEvidenceRoot) -ne $sourceEvidence){throw 'Exact116 source paths required'}
$ready=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'native-host-ready.json')|ConvertFrom-Json -AsHashtable -DateKind String
$settled=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'native-host-settled.json')|ConvertFrom-Json -AsHashtable -DateKind String
foreach($receipt in @($ready,$settled)){if($receipt.occurrence -ne $sourceOwner.occurrence){throw 'Original source native receipt occurrence mismatch'};foreach($b in @(@{receipt=$receipt.host;owner=$sourceOwner.host},@{receipt=$receipt.target;owner=$sourceOwner.nativeTarget})){foreach($f in @('pid','processInstanceID','occurrenceID')){if($b.receipt[$f] -ne $b.owner[$f]){throw 'Actual ready/settled identity mismatch'}}}}
if($ready.outcome -ne 'ready' -or $settled.outcome -ne 'settled' -or !$settled.physicalCompletion -or !$settled.outputDrainComplete -or !$settled.requestCleanupComplete){throw 'Full source ready/settled contract required'}
$states=@(@{expected=$sourceOwner.host;state=(Get-OwnedNativeState $sourceOwner.host)},@{expected=$sourceOwner.nativeTarget;state=(Get-OwnedNativeState $sourceOwner.nativeTarget)})
if(@($states|Where-Object state -ne 'dead_or_reused').Count){throw 'Source116 exact native identity is live'}
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $sourceRun ('runtime/data/'+$name))){throw 'Source pair not absent'}}
$physical=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'sources-delegated-live-116-01-physical-terminal-and-pair-cleanup.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($physical.occurrence -ne $sourceOwner.occurrence -or $physical.physicalCompletion -ne $true -or $physical.pairedCleanupComplete -ne $true -or $physical.nativeSettlement.occurrence -ne $sourceOwner.occurrence -or $physical.nativeSettlement.outcome -ne 'settled' -or $physical.nativeSettlement.physicalCompletion -ne $true -or $physical.nativeSettlement.outputDrainComplete -ne $true -or $physical.nativeSettlement.requestCleanupComplete -ne $true){throw 'Original116 whole native/pair closure required'}
foreach($binding in @(@{receipt=$physical.nativeSettlement.host;owner=$sourceOwner.host},@{receipt=$physical.nativeSettlement.target;owner=$sourceOwner.nativeTarget})){foreach($field in @('pid','processInstanceID','occurrenceID')){if($binding.receipt[$field] -ne $binding.owner[$field]){throw 'Original116 native settlement identity mismatch'}}}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $sourceOwner.port).Count){throw 'Original116 port occupied'}
if($sourceOwner.port -ne 18076 -or $physical.copiedPair.Count -ne 2){throw 'Original116 exact source port/pair receipt required'}
foreach($name in @('auth.json','models.json')){$expected=[IO.Path]::GetFullPath((Join-Path $sourceRun ('runtime/data/'+$name)));$matched=@($physical.copiedPair|Where-Object {[IO.Path]::GetFullPath($_.path) -eq $expected -and $_.presentAfter -eq $false});if($matched.Count -ne 1){throw 'Original116 exact pair cleanup binding required'}}
$guardCode=@'
import assert from "node:assert/strict";
import {Database} from "bun:sqlite";
const fs=await import("node:fs");const path=await import("node:path");
const expected=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));const complete=JSON.parse(fs.readFileSync(path.join(process.argv[3],"task-complete.json"),"utf8"));const selected=JSON.parse(fs.readFileSync(path.join(process.argv[3],"actual-11601-task-selection.json"),"utf8"));
assert.deepEqual(complete.selected,selected);assert.equal(complete.occurrence,expected.occurrence);assert.equal(selected.taskID,expected.taskID);assert.equal(selected.projectID,expected.projectID);assert.equal(selected.requestID,expected.requestID);assert.equal(complete.lifecycle.status,"completed");assert.equal(complete.pinned.rootSessionID,expected.task.session_id);assert.equal(complete.lifecycle.epoch,complete.pinned.epoch);
const owner=JSON.parse(fs.readFileSync(path.join(process.argv[4],"launch-owner.json"),"utf8"));assert.equal(complete.occurrence,owner.occurrence);assert.equal(complete.pid,owner.nativeTarget.pid);assert.equal(path.resolve(selected.directory),path.resolve(owner.project));assert.equal(complete.pinned.taskID,expected.taskID);assert.equal(complete.pinned.projectID,expected.projectID);assert.equal(complete.lifecycle.taskID,expected.taskID);assert.equal(complete.lifecycle.openedEventID,complete.pinned.openedEventID);const db=new Database(process.argv[1],{readonly:true});
try{db.exec("BEGIN");
const task=db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get(expected.taskID);
assert.deepEqual(task,{id:expected.taskID,project_id:expected.projectID,session_id:expected.task.session_id,request_id:expected.requestID,product_pillar:selected.productPillar});
const session=db.query("SELECT id,project_id,directory FROM session WHERE id=?").get(task.session_id);
assert.equal(session.project_id,task.project_id);assert.equal(session.directory.replaceAll("\\","/"),"C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/sources-delegated-live-116-01/project");
const events=db.query("SELECT id,type,payload FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(task.id);
assert.equal(events[0].id,complete.pinned.openedEventID);assert.equal(events[0].type,"task.execution.opened");assert.equal(JSON.parse(events[0].payload).execution_epoch,1);
assert.equal(events.at(-1).id,complete.lifecycle.terminalEventID);assert.equal(events.at(-1).type,"task.completed");assert.equal(JSON.parse(events.at(-1).payload).execution_epoch,1);
assert.deepEqual(events.map(row=>({id:row.id,type:row.type,epoch:JSON.parse(row.payload).execution_epoch})),expected.events.map(row=>({id:row.id,type:row.type,epoch:row.epoch})));const pending=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT o.session_id FROM session_prompt_owner o JOIN tree t ON t.id=o.session_id").all(task.id);assert.equal(pending.length,0);
const actualSources=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT p.id,p.message_id AS messageID,m.session_id AS sessionID,p.data FROM part p JOIN message m ON m.id=p.message_id JOIN tree t ON t.id=m.session_id WHERE json_extract(p.data,'$.type')='source-url' ORDER BY p.time_created,p.id").all(task.id).map(row=>({id:row.id,messageID:row.messageID,sessionID:row.sessionID,payload:JSON.parse(row.data)}));
const researcher=db.query("SELECT id,parent_id,project_id,kind,directory FROM session WHERE id=?").get(expected.sources[0].sessionID);
const originalResearcher=expected.sessions.find(row=>row.id===researcher.id);assert.ok(originalResearcher);assert.equal(researcher.parent_id,originalResearcher.parent_id);assert.equal(researcher.kind,originalResearcher.kind);assert.equal(researcher.project_id,task.project_id);assert.equal(researcher.kind,"explore");assert.equal(researcher.directory,session.directory);
const orch=db.query("SELECT id,parent_id,project_id,kind FROM session WHERE id=?").get(researcher.parent_id);assert.equal(orch.parent_id,task.session_id);assert.equal(orch.project_id,task.project_id);assert.equal(orch.kind,"orchestrator");
const expectedSources=expected.sources;
assert.equal(expectedSources.length,3);assert.deepEqual(actualSources,expectedSources);assert.ok(actualSources.every(row=>row.sessionID===researcher.id));
const inbox=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT i.id FROM protocol_inbox i JOIN protocol_event e ON e.id=i.envelope_id LEFT JOIN protocol_delivery_receipt r ON r.inbox_id=i.id WHERE r.id IS NULL AND ((e.aggregate_type='task' AND e.aggregate_id=?) OR (i.actor='session' AND i.actor_id IN (SELECT id FROM tree)))").all(task.id,task.id);assert.equal(inbox.length,0);
console.log(JSON.stringify({readonly:true,task,session,epoch:1,openedEventID:events[0].id,terminalEventID:events.at(-1).id,promptOwners:pending,pendingInbox:inbox,researcher,orchestrator:orch,sources:actualSources}));
}finally{db.exec("ROLLBACK");db.close();}
'@
$guardOutput=& 'C:/Users/hengu/.bun/bin/bun.exe' -e $guardCode (Join-Path $sourceRun 'runtime/data/opencorvus.db') (Join-Path $sourceEvidence 'child-current-source-facts.json') $sourceEvidence $sourceRun
if($LASTEXITCODE -ne 0){throw 'Actual source116 readonly Task/Session/epoch guard failed'}
$sourceFacts=$guardOutput|ConvertFrom-Json
[IO.Directory]::CreateDirectory($copyRun)|Out-Null
[IO.Directory]::CreateDirectory($copyEvidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRun 'runtime') -Destination (Join-Path $copyRun 'runtime') -Recurse -ErrorAction Stop
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copyRun ('runtime/data/'+$name))){throw 'Copied pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $copyEvidence ($copyLabel+'-history-copy.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$sourceRun;clone=$copyRun;project=$sourceOwner.project;sourceNativeStates=$states;port=$copyPort;credentialStaging='None; source116 untouched; no Task rearm';taskID=$sourceFacts.task.id;rootSessionID=$sourceFacts.task.session_id;sourceFacts=$sourceFacts;purpose=$copyPurpose}
Write-Output ($copyLabel+' fresh CLOSED116 copy prepared; pair absent.')













