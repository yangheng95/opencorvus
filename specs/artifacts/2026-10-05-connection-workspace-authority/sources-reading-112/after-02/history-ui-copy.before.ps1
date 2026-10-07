param([string]$CaseRun,[string]$CaseEvidence,[string]$CaseLabel,[int]$CasePort,[string]$CasePurpose)
$ErrorActionPreference='Stop'
$copyRun=[IO.Path]::GetFullPath($CaseRun);$copyEvidence=[IO.Path]::GetFullPath($CaseEvidence);$copyLabel=$CaseLabel;$copyPort=$CasePort;$copyPurpose=$CasePurpose
$sourceRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/multiple-sources-live-109-01'
if($copyPort -ne 18068){throw 'Only admitted112 history port'}
$caseStage='before-01'
$caseRunName='sources-reading-before-112-01'
if($copyLabel -ne $caseRunName){throw 'Exact before112 label required'}
if($copyRun -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/'+$caseRunName) -or $copyEvidence -ne [IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/sources-reading-112/'+$caseStage)){throw 'Exact fresh112 run/evidence required'}
if(Test-Path -LiteralPath $copyRun){throw 'Preserve existing copy occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $copyPort).Count){throw 'Fresh port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceOwner=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$states=@(@{expected=$sourceOwner.host;state=(Get-OwnedNativeState $sourceOwner.host)},@{expected=$sourceOwner.nativeTarget;state=(Get-OwnedNativeState $sourceOwner.nativeTarget)})
if(@($states|Where-Object state -ne 'dead_or_reused').Count){throw 'Source109 exact native identity is live'}
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $sourceRun ('runtime/data/'+$name))){throw 'Source pair not absent'}}
if($sourceOwner.occurrence -ne 'multiple-sources-live-109-01-139c570a-411f-4a5e-9c0b-c7776b665493' -or [IO.Path]::GetFullPath($sourceOwner.project) -ne [IO.Path]::GetFullPath($sourceRun+'/project') -or $sourceOwner.host.pid -ne 60452 -or $sourceOwner.host.processInstanceID -ne 'win32:639269938012015418' -or $sourceOwner.nativeTarget.pid -ne 75092 -or $sourceOwner.nativeTarget.processInstanceID -ne 'win32:639269938021940157'){throw 'Exact original109 source owner required'}
$sourceEvidence='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/multiple-sources-109/live-01'
$physical=Get-Content -Raw -LiteralPath (Join-Path $sourceEvidence 'multiple-sources-live-109-01-physical-terminal-and-pair-cleanup.json')|ConvertFrom-Json -AsHashtable -DateKind String
if($physical.occurrence -ne $sourceOwner.occurrence -or $physical.physicalCompletion -ne $true -or $physical.pairedCleanupComplete -ne $true -or $physical.nativeSettlement.occurrence -ne $sourceOwner.occurrence -or $physical.nativeSettlement.outcome -ne 'settled' -or $physical.nativeSettlement.physicalCompletion -ne $true -or $physical.nativeSettlement.outputDrainComplete -ne $true -or $physical.nativeSettlement.requestCleanupComplete -ne $true){throw 'Original109 whole native/pair closure required'}
foreach($binding in @(@{receipt=$physical.nativeSettlement.host;owner=$sourceOwner.host},@{receipt=$physical.nativeSettlement.target;owner=$sourceOwner.nativeTarget})){foreach($field in @('pid','processInstanceID','occurrenceID')){if($binding.receipt[$field] -ne $binding.owner[$field]){throw 'Original109 native settlement identity mismatch'}}}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $sourceOwner.port).Count){throw 'Original109 port occupied'}
if($sourceOwner.port -ne 18066 -or $physical.copiedPair.Count -ne 2){throw 'Original109 exact source port/pair receipt required'}
foreach($name in @('auth.json','models.json')){$expected=[IO.Path]::GetFullPath((Join-Path $sourceRun ('runtime/data/'+$name)));$matched=@($physical.copiedPair|Where-Object {[IO.Path]::GetFullPath($_.path) -eq $expected -and $_.presentAfter -eq $false});if($matched.Count -ne 1){throw 'Original109 exact pair cleanup binding required'}}
$guardCode=@'
import assert from "node:assert/strict";
import {Database} from "bun:sqlite";
const db=new Database(process.argv[1],{readonly:true});
try{db.exec("BEGIN");
const task=db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get("tsk_g00VXOBi8f00PNKt2D7j");
assert.deepEqual(task,{id:"tsk_g00VXOBi8f00PNKt2D7j",project_id:"prj_hMdWV6nPVuwA7EIwInBU",session_id:"ses_-zUSboHhyzzBVOsP3WD2",request_id:"7e445053-ed48-4eb1-ad30-6307947b7c1b",product_pillar:"work"});
const session=db.query("SELECT id,project_id,directory FROM session WHERE id=?").get(task.session_id);
assert.equal(session.project_id,task.project_id);assert.equal(session.directory.replaceAll("\\","/"),"C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/multiple-sources-live-109-01/project");
const events=db.query("SELECT id,type,payload FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(task.id);
assert.equal(events[0].id,"pev_g0VXOBiIo0011ldKm2zc");assert.equal(events[0].type,"task.execution.opened");assert.equal(JSON.parse(events[0].payload).execution_epoch,1);
assert.equal(events.at(-1).id,"pev_g0VXOCI4t00SstNyW3CW");assert.equal(events.at(-1).type,"task.completed");assert.equal(JSON.parse(events.at(-1).payload).execution_epoch,1);
const pending=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT o.session_id FROM session_prompt_owner o JOIN tree t ON t.id=o.session_id").all(task.id);assert.equal(pending.length,0);
const fs=await import("node:fs");
const actualSources=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT p.id,p.message_id AS messageID,m.session_id AS sessionID,p.data FROM part p JOIN message m ON m.id=p.message_id JOIN tree t ON t.id=m.session_id WHERE json_extract(p.data,'$.type')='source-url' ORDER BY p.time_created,p.id").all(task.id).map(row=>({id:row.id,messageID:row.messageID,sessionID:row.sessionID,payload:JSON.parse(row.data)}));
const expected=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
assert.equal(expected.occurrence,"multiple-sources-live-109-01-139c570a-411f-4a5e-9c0b-c7776b665493");assert.equal(expected.taskID,task.id);assert.equal(expected.projectID,task.project_id);assert.equal(expected.requestID,task.request_id);assert.equal(expected.task.session_id,task.session_id);
assert.equal(expected.sources.length,3);assert.deepEqual(actualSources,expected.sources);
console.log(JSON.stringify({readonly:true,task,session,epoch:1,openedEventID:events[0].id,terminalEventID:events.at(-1).id,promptOwners:pending,sources:actualSources}));
}finally{db.exec("ROLLBACK");db.close();}
'@
$guardOutput=& 'C:/Users/hengu/.bun/bin/bun.exe' -e $guardCode (Join-Path $sourceRun 'runtime/data/opencorvus.db') (Join-Path $sourceEvidence 'child-current-source-facts.json')
if($LASTEXITCODE -ne 0){throw 'Actual source109 readonly Task/Session/epoch guard failed'}
$sourceFacts=$guardOutput|ConvertFrom-Json
[IO.Directory]::CreateDirectory($copyRun)|Out-Null
[IO.Directory]::CreateDirectory($copyEvidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRun 'runtime') -Destination (Join-Path $copyRun 'runtime') -Recurse -ErrorAction Stop
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copyRun ('runtime/data/'+$name))){throw 'Copied pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $copyEvidence ($copyLabel+'-history-copy.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$sourceRun;clone=$copyRun;project=$sourceOwner.project;sourceNativeStates=$states;port=$copyPort;credentialStaging='None; source109 untouched; no Task rearm';taskID='tsk_g00VXOBi8f00PNKt2D7j';rootSessionID='ses_-zUSboHhyzzBVOsP3WD2';sourceFacts=$sourceFacts;purpose=$copyPurpose}
Write-Output ($copyLabel+' fresh CLOSED109 copy prepared; pair absent.')


