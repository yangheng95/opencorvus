$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'live-sol-launch.ps1') -FunctionsOnly
function Read-Fact([string]$Path){Get-Content -Raw -LiteralPath $Path|ConvertFrom-Json}
function Equal($Actual,$Expected){if($Actual -cne $Expected){throw "Actual '$Actual', expected '$Expected'"}}
$caseRun179='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-single-chat-live-179-01'
$caseEvidence179='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-single-chat-live-179/live-01'
$owner179=Read-Fact "$caseRun179/launch-owner.json"
$owner179|Add-Member qualificationKind 'NativeService'
$native179=Read-Fact "$caseRun179/evidence/native-host-settled.json"
$provider179=Read-Fact "$caseEvidence179/source-single-chat-live-179-01-final-provider-audit.json"
$service=Assert-OwnedQualificationCompletion $owner179 $native179 $provider179 $null $null
Equal $service.qualification 'NativeService';Equal $service.physicalCompletion $true;Equal $service.providerEOFRequests 10
$caseRun171='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-multiple-search-live-171-01'
$caseEvidence171='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-multiple-search-live-171/live-01'
$owner171=Read-Fact "$caseRun171/launch-owner.json"
$owner171|Add-Member qualificationKind 'Task'
$native171=Read-Fact "$caseRun171/evidence/native-host-settled.json"
$provider171=Read-Fact "$caseEvidence171/source-multiple-search-live-171-01-final-provider-audit.json"
$boundary171=Read-Fact "$caseRun171/evidence/task-boundary-admitted.json"
$complete171=Read-Fact "$caseRun171/evidence/task-complete.json"
$task=Assert-OwnedQualificationCompletion $owner171 $native171 $provider171 $boundary171 $complete171
Equal $task.qualification 'Task';Equal $task.taskID $complete171.pinned.taskID;Equal $task.epoch 1;Equal $task.providerEOFRequests 24
$errors=@()
foreach($case in @(@{code='OWNED_QUALIFICATION_KIND_INVALID';kind='unknown';model='gpt-6.1-sol'},@{code='OWNED_PROVIDER_REQUEST_INVALID';kind='NativeService';model='other-model'})){
  $owned=$owner179|ConvertTo-Json -Depth 20|ConvertFrom-Json
  $provider=$provider179|ConvertTo-Json -Depth 30|ConvertFrom-Json
  $owned.qualificationKind=$case.kind;$provider.requests[0].model=$case.model
  $result=$null
  try{$result=Assert-OwnedQualificationCompletion $owned $native179 $provider $null $null}catch{$result=@{type=$_.Exception.GetType().FullName;code=$_.Exception.Data['code']}}
  Equal $result.type 'System.IO.InvalidDataException';Equal $result.code $case.code;$errors+=$result
}
@{qualification='pure diagnostic function contract from decoded archived data; original179 exit1 unchanged';service=$service;task=$task;typedErrors=$errors;cases=4}|ConvertTo-Json -Depth 8
