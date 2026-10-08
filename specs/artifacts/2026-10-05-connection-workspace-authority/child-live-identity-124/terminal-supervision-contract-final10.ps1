$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$run='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/sources-late-open-live-124-01'
$owner=Get-Content -Raw "$run/launch-owner.json"|ConvertFrom-Json
$boundary=Get-Content -Raw "$run/evidence/task-boundary-admitted.json"|ConvertFrom-Json
$complete=Get-Content -Raw "$run/evidence/task-complete.json"|ConvertFrom-Json
function Equal($actual,$expected){if($actual -cne $expected){throw "Actual '$actual', expected '$expected'"}}
Equal (Assert-OwnedTaskCompletion $owner $boundary $complete) $true
$deadline=[long]$boundary.totalDeadlineMs
Equal (Get-OwnedTaskMaximumReason $false $true $deadline $deadline) 'completed-service-maximum'
Equal (Get-OwnedTaskMaximumReason $false $false $deadline $deadline) 'fixed-task-maximum'
Equal (Get-OwnedTaskMaximumReason $true $true $deadline $deadline) 'immutable-wrapper-failure'
$cases=@(
 @{name='foreign-task';code='TASK_COMPLETION_IDENTITY_MISMATCH';mutate={param($c)$c.selected.taskID='different-task'}},
 @{name='wrong-epoch';code='TASK_COMPLETION_IDENTITY_MISMATCH';mutate={param($c)$c.pinned.epoch++}},
 @{name='late-terminal';code='TASK_COMPLETION_BUDGET_INVALID';mutate={param($c)$c.lifecycle.terminalAt=$deadline+1}},
 @{name='late-observed';code='TASK_COMPLETION_BUDGET_INVALID';mutate={param($c)$c.observedAt=[DateTimeOffset]::FromUnixTimeMilliseconds($deadline+1).ToString('o')}},
 @{name='missing-owner-array';code='TASK_COMPLETION_OWNERS_INVALID';mutate={param($c)$c.ownedPromptSessions=$null}},
 @{name='active-owner';code='TASK_COMPLETION_OWNERS_INVALID';mutate={param($c)$c.ownedPromptSessions=@(@{sessionID='actual-local-case'})}}
)
foreach($case in $cases){
 $copy=$complete|ConvertTo-Json -Depth 15|ConvertFrom-Json
 & $case.mutate $copy
 $result=$null
 try{$null=Assert-OwnedTaskCompletion $owner $boundary $copy;$result=@{type='accepted';code='accepted'}}catch{$result=@{type=$_.Exception.GetType().FullName;code=$_.Exception.Data['code']}}
 Equal $result.type 'System.IO.InvalidDataException';Equal $result.code $case.code
 Write-Output ($result+@{case=$case.name}|ConvertTo-Json -Compress)
}
Write-Output (@{qualified='pure private function contract only';occurrence=$complete.occurrence;taskID=$complete.pinned.taskID;epoch=$complete.pinned.epoch;cases=10;originalTriggerUnchanged=$true}|ConvertTo-Json -Compress)
