param([string]$CaseRun,[string]$CaseEvidence,[string]$CaseLabel,[int]$CasePort,[string]$CasePurpose)
$ErrorActionPreference='Stop'
$copyRun=[IO.Path]::GetFullPath($CaseRun);$copyEvidence=[IO.Path]::GetFullPath($CaseEvidence);$copyLabel=$CaseLabel;$copyPort=$CasePort;$copyPurpose=$CasePurpose
$sourceRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/sources-delegated-live-115-01'
if($copyPort -ne 18075){throw 'Only admitted11502 history port'}
$caseStage='history-02'
$caseRunName='sources-delegated-history-115-02'
if($copyLabel -ne $caseRunName){throw 'Exact history11502 label required'}
if($copyRun -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/'+$caseRunName) -or $copyEvidence -ne [IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/sources-delegated-115/'+$caseStage)){throw 'Exact fresh11502 run/evidence required'}
if(Test-Path -LiteralPath $copyRun){throw 'Preserve existing copy occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $copyPort).Count){throw 'Fresh port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceOwner=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$states=@(@{expected=$sourceOwner.host;state=(Get-OwnedNativeState $sourceOwner.host)},@{expected=$sourceOwner.nativeTarget;state=(Get-OwnedNativeState $sourceOwner.nativeTarget)})
if(@($states|Where-Object state -ne 'dead_or_reused').Count){throw 'Source11501 exact native identity is live'}
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $sourceRun ('runtime/data/'+$name))){throw 'Source pair not absent'}}
if($sourceOwner.occurrence -ne 'sources-delegated-live-115-01-491b426c-a907-46a7-af9a-bb391b35d306' -or [IO.Path]::GetFullPath($sourceOwner.project) -ne [IO.Path]::GetFullPath($sourceRun+'/project') -or $sourceOwner.host.pid -ne 38692 -or $sourceOwner.host.processInstanceID -ne 'win32:639270036547684868' -or $sourceOwner.nativeTarget.pid -ne 73196 -or $sourceOwner.nativeTarget.processInstanceID -ne 'win32:639270036557242074'){throw 'Exact original11501 source owner required'}
$sourceEvidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/sources-delegated-115/live-01'
$physical=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'sources-delegated-live-115-01-physical-terminal-and-pair-cleanup.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($physical.occurrence -ne $sourceOwner.occurrence -or $physical.physicalCompletion -ne $true -or $physical.pairedCleanupComplete -ne $true -or $physical.nativeSettlement.occurrence -ne $sourceOwner.occurrence -or $physical.nativeSettlement.outcome -ne 'settled' -or $physical.nativeSettlement.physicalCompletion -ne $true -or $physical.nativeSettlement.outputDrainComplete -ne $true -or $physical.nativeSettlement.requestCleanupComplete -ne $true){throw 'Original11501 whole native/pair closure required'}
foreach($binding in @(@{receipt=$physical.nativeSettlement.host;owner=$sourceOwner.host},@{receipt=$physical.nativeSettlement.target;owner=$sourceOwner.nativeTarget})){foreach($field in @('pid','processInstanceID','occurrenceID')){if($binding.receipt[$field] -ne $binding.owner[$field]){throw 'Original11501 native settlement identity mismatch'}}}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $sourceOwner.port).Count){throw 'Original11501 port occupied'}
if($sourceOwner.port -ne 18074 -or $physical.copiedPair.Count -ne 2){throw 'Original11501 exact source port/pair receipt required'}
foreach($name in @('auth.json','models.json')){$expected=[IO.Path]::GetFullPath((Join-Path $sourceRun ('runtime/data/'+$name)));$matched=@($physical.copiedPair|Where-Object {[IO.Path]::GetFullPath($_.path) -eq $expected -and $_.presentAfter -eq $false});if($matched.Count -ne 1){throw 'Original11501 exact pair cleanup binding required'}}
$failed=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'failed.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($failed.pid -ne $sourceOwner.nativeTarget.pid -or $failed.occurrence -ne $sourceOwner.occurrence -or $failed.error.message -ne 'E2E_REQUEST_BUDGET_EXHAUSTED'){throw 'Actual11501 original budget failure required'}
$audit=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'sources-delegated-live-115-01-final-provider-audit.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($audit.requests.Count -ne 32 -or $audit.exhausted -ne $true){throw 'Original11501 exact cumulative budget evidence required'}
foreach($request in $audit.requests){if($request.model -ne 'gpt-6.1-sol' -or $request.streaming -ne $true -or $request.status -ne 200 -or $request.response_reader.state -ne 'settled' -or $request.response_reader.terminal.kind -ne 'eof'){throw 'Original11501 actual provider scalar contract changed'}}
$guardCode=@'
import assert from "node:assert/strict";
import {Database} from "bun:sqlite";
const db=new Database(process.argv[1],{readonly:true});
try{db.exec("BEGIN");
const task=db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get("tsk_g00VXOqttz00prFbPtvK");
assert.deepEqual(task,{id:"tsk_g00VXOqttz00prFbPtvK",project_id:"prj_h5oPc1HsKsPNLsx8M6GO",session_id:"ses_-zUSb95wYzzIbc6sZ7Qd",request_id:"8af1355a-f62c-4cab-b9f5-100d02af9c75",product_pillar:"work"});
const session=db.query("SELECT id,project_id,directory FROM session WHERE id=?").get(task.session_id);
assert.equal(session.project_id,task.project_id);assert.equal(session.directory.replaceAll("\\","/"),"C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/sources-delegated-live-115-01/project");
const events=db.query("SELECT id,type,payload FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(task.id);
assert.equal(events[0].id,"pev_g0VXOqu4Q00BwpI5mVrf");assert.equal(events[0].type,"task.execution.opened");assert.equal(JSON.parse(events[0].payload).execution_epoch,1);
assert.equal(events.at(-1).id,"pev_g0VXOs9BI00mpxVzMHbN");assert.equal(events.at(-1).type,"task.failed");assert.equal(JSON.parse(events.at(-1).payload).terminalReason,"interrupted");assert.equal(JSON.parse(events.at(-1).payload).execution_epoch,1);
const pending=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT o.session_id FROM session_prompt_owner o JOIN tree t ON t.id=o.session_id").all(task.id);assert.equal(pending.length,0);
const fs=await import("node:fs");
const actualSources=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT p.id,p.message_id AS messageID,m.session_id AS sessionID,p.data FROM part p JOIN message m ON m.id=p.message_id JOIN tree t ON t.id=m.session_id WHERE json_extract(p.data,'$.type')='source-url' ORDER BY p.time_created,p.id").all(task.id).map(row=>({id:row.id,messageID:row.messageID,sessionID:row.sessionID,payload:JSON.parse(row.data)}));
const expected=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
assert.equal(expected.selected.occurrence,"sources-delegated-live-115-01-491b426c-a907-46a7-af9a-bb391b35d306");assert.equal(expected.selected.taskID,task.id);assert.equal(expected.selected.projectID,task.project_id);assert.equal(expected.selected.requestID,task.request_id);
const researcher=db.query("SELECT id,parent_id,project_id,kind,directory FROM session WHERE id=?").get("ses_hHMluivaiGrBTj2IejMm");
assert.equal(researcher.parent_id,"ses_-zUSb94yczzwzBtwQkXj");assert.equal(researcher.project_id,task.project_id);assert.equal(researcher.kind,"explore");assert.equal(researcher.directory,session.directory);
const orch=db.query("SELECT id,parent_id,project_id,kind FROM session WHERE id=?").get(researcher.parent_id);assert.equal(orch.parent_id,task.session_id);assert.equal(orch.project_id,task.project_id);assert.equal(orch.kind,"orchestrator");
const expectedSources=expected.parts.map(row=>({id:row.id,messageID:row.message_id,sessionID:expected.messages.find(m=>m.id===row.message_id)?.session_id,payload:JSON.parse(row.data)})).filter(row=>row.payload.type==="source-url");
assert.equal(expectedSources.length,3);assert.deepEqual(actualSources,expectedSources);assert.ok(actualSources.every(row=>row.sessionID===researcher.id));
const inbox=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT i.id FROM protocol_inbox i JOIN protocol_event e ON e.id=i.envelope_id LEFT JOIN protocol_delivery_receipt r ON r.inbox_id=i.id WHERE r.id IS NULL AND ((e.aggregate_type='task' AND e.aggregate_id=?) OR (i.actor='session' AND i.actor_id IN (SELECT id FROM tree)))").all(task.id,task.id);assert.equal(inbox.length,0);
console.log(JSON.stringify({readonly:true,task,session,epoch:1,openedEventID:events[0].id,terminalEventID:events.at(-1).id,promptOwners:pending,pendingInbox:inbox,researcher,orchestrator:orch,sources:actualSources}));
}finally{db.exec("ROLLBACK");db.close();}
'@
$guardOutput=& 'C:/Users/hengu/.bun/bin/bun.exe' -e $guardCode (Join-Path $sourceRun 'runtime/data/opencorvus.db') (Join-Path $sourceEvidence 'actual-11501-readonly-facts.json')
if($LASTEXITCODE -ne 0){throw 'Actual source11501 readonly Task/Session/epoch guard failed'}
$sourceFacts=$guardOutput|ConvertFrom-Json
[IO.Directory]::CreateDirectory($copyRun)|Out-Null
[IO.Directory]::CreateDirectory($copyEvidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRun 'runtime') -Destination (Join-Path $copyRun 'runtime') -Recurse -ErrorAction Stop
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copyRun ('runtime/data/'+$name))){throw 'Copied pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $copyEvidence ($copyLabel+'-history-copy.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$sourceRun;clone=$copyRun;project=$sourceOwner.project;sourceNativeStates=$states;port=$copyPort;credentialStaging='None; source11501 untouched; no Task rearm';taskID='tsk_g00VXOqttz00prFbPtvK';rootSessionID='ses_-zUSb95wYzzIbc6sZ7Qd';sourceFacts=$sourceFacts;purpose=$copyPurpose}
Write-Output ($copyLabel+' fresh CLOSED11501 copy prepared; pair absent.')








