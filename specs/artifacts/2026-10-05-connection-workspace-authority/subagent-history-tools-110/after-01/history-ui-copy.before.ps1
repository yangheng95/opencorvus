param([string]$CaseRun,[string]$CaseEvidence,[string]$CaseLabel,[int]$CasePort,[string]$CasePurpose)
$ErrorActionPreference='Stop'
$copyRun=[IO.Path]::GetFullPath($CaseRun);$copyEvidence=[IO.Path]::GetFullPath($CaseEvidence);$copyLabel=$CaseLabel;$copyPort=$CasePort;$copyPurpose=$CasePurpose
$sourceRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/webfetch-body-live-105-01'
if($copyPort -ne 18065){throw 'Only admitted108 history port'}
$caseStage='before-01'
$caseRunName='subagent-open-before-108-01'
if($copyRun -ne [IO.Path]::GetFullPath('C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/'+$caseRunName) -or $copyEvidence -ne [IO.Path]::GetFullPath('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/subagent-open-108/'+$caseStage)){throw 'Exact fresh108 run/evidence required'}
if(Test-Path -LiteralPath $copyRun){throw 'Preserve existing copy occurrence'}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $copyPort).Count){throw 'Fresh port occupied'}
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$sourceOwner=Get-Content -Raw -LiteralPath (Join-Path $sourceRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$states=@(@{expected=$sourceOwner.host;state=(Get-OwnedNativeState $sourceOwner.host)},@{expected=$sourceOwner.nativeTarget;state=(Get-OwnedNativeState $sourceOwner.nativeTarget)})
if(@($states|Where-Object state -ne 'dead_or_reused').Count){throw 'Source105 exact native identity is live'}
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $sourceRun ('runtime/data/'+$name))){throw 'Source pair not absent'}}
if($sourceOwner.occurrence -ne 'webfetch-body-live-105-01-09742288-8a5e-433d-a354-289073ea4bab' -or [IO.Path]::GetFullPath($sourceOwner.project) -ne [IO.Path]::GetFullPath($sourceRun+'/project') -or $sourceOwner.host.pid -ne 63880 -or $sourceOwner.host.processInstanceID -ne 'win32:639269902508386432' -or $sourceOwner.nativeTarget.pid -ne 60396 -or $sourceOwner.nativeTarget.processInstanceID -ne 'win32:639269902517643062'){throw 'Exact original105 source owner required'}
$guardCode=@'
import assert from "node:assert/strict";
import {Database} from "bun:sqlite";
const db=new Database(process.argv[1],{readonly:true});
try{db.exec("BEGIN");
const task=db.query("SELECT id,project_id,session_id,request_id,product_pillar FROM engine_task WHERE id=?").get("tsk_g00VXNwoXR00OSwM2ms5");
assert.deepEqual(task,{id:"tsk_g00VXNwoXR00OSwM2ms5",project_id:"prj_hJSu4axrHQbLnt6VA8lj",session_id:"ses_-zUSc3BKRzzYNaqCtx1m",request_id:"a55ff63a-4307-45f8-9636-aaae02809172",product_pillar:"work"});
const session=db.query("SELECT id,project_id,directory FROM session WHERE id=?").get(task.session_id);
assert.equal(session.project_id,task.project_id);assert.equal(session.directory.replaceAll("\\","/"),"C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/webfetch-body-live-105-01/project");
const events=db.query("SELECT id,type,payload FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=? AND type IN ('task.execution.opened','task.execution.reopened','task.completed','task.failed','task.cancelled') ORDER BY seq,id").all(task.id);
assert.equal(events[0].id,"pev_g0VXNwogJ00yGd0XcPzR");assert.equal(events[0].type,"task.execution.opened");assert.equal(JSON.parse(events[0].payload).execution_epoch,1);
assert.equal(events.at(-1).id,"pev_g0VXNx5Ez00XHwnJwo8c");assert.equal(events.at(-1).type,"task.completed");assert.equal(JSON.parse(events.at(-1).payload).execution_epoch,1);
const pending=db.query("WITH RECURSIVE tree(id) AS (SELECT session_id FROM engine_task WHERE id=? UNION ALL SELECT s.id FROM session s JOIN tree t ON t.id=s.parent_id) SELECT o.session_id FROM session_prompt_owner o JOIN tree t ON t.id=o.session_id").all(task.id);assert.equal(pending.length,0);
console.log(JSON.stringify({readonly:true,task,session,epoch:1,openedEventID:events[0].id,terminalEventID:events.at(-1).id,promptOwners:pending}));
}finally{db.exec("ROLLBACK");db.close();}
'@
$guardOutput=& 'C:/Users/hengu/.bun/bin/bun.exe' -e $guardCode (Join-Path $sourceRun 'runtime/data/opencorvus.db')
if($LASTEXITCODE -ne 0){throw 'Actual source105 readonly Task/Session/epoch guard failed'}
$sourceFacts=$guardOutput|ConvertFrom-Json
[IO.Directory]::CreateDirectory($copyRun)|Out-Null
[IO.Directory]::CreateDirectory($copyEvidence)|Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRun 'runtime') -Destination (Join-Path $copyRun 'runtime') -Recurse -ErrorAction Stop
foreach($name in @('auth.json','models.json')){if(Test-Path -LiteralPath (Join-Path $copyRun ('runtime/data/'+$name))){throw 'Copied pair must be absent'}}
Write-OwnedLaunchFact (Join-Path $copyEvidence ($copyLabel+'-history-copy.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');source=$sourceRun;clone=$copyRun;project=$sourceOwner.project;sourceNativeStates=$states;port=$copyPort;credentialStaging='None; source105 untouched; no Task rearm';taskID='tsk_g00VXNwoXR00OSwM2ms5';rootSessionID='ses_-zUSc3BKRzzYNaqCtx1m';sourceFacts=$sourceFacts;purpose=$copyPurpose}
Write-Output ($copyLabel+' fresh CLOSED105 copy prepared; pair absent.')
