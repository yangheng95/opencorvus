$ErrorActionPreference='Stop'
$taskBase='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21'
$taskReport=@()
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
foreach($taskStage in @('before','after','control-before','control-after')){
 foreach($taskKind in @('service','checker')){
  $taskScope="$taskBase/git-executable-flow-492-$taskStage"
  if($taskKind -eq 'checker'){$taskScope=Join-Path $taskScope 'checker'}
  $taskReady=Get-Content -Raw -LiteralPath "$taskScope/evidence/native-host-ready.json"|ConvertFrom-Json
  $taskSettled=Get-Content -Raw -LiteralPath "$taskScope/evidence/native-host-settled.json"|ConvertFrom-Json
  $taskLauncher=Get-Content -Raw -LiteralPath "$taskScope/evidence/launcher-child-exit.json"|ConvertFrom-Json
  if($taskReady.occurrence -cne $taskSettled.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskSettled.terminal.exitCode -ne 0 -or $taskLauncher.originalChildExit -ne 0){throw 'Original successful occurrence terminal required'}
  $taskStates=@($taskReady.host,$taskReady.target)|ForEach-Object{@{identity=$_;state=(Get-OwnedNativeState $_)}}
  if(@($taskStates|Where-Object state -ne 'dead_or_reused').Count){throw 'Original successful occurrence still live'}
  $taskReport+=@{stage=$taskStage;kind=$taskKind;native=$taskSettled;launcher=$taskLauncher;chain=$taskStates}
 }
}
$taskFailed="$taskBase/git-executable-flow-492-before/checker-failed-001"
$taskReady=Get-Content -Raw -LiteralPath "$taskFailed/evidence/native-host-ready.json"|ConvertFrom-Json
$taskSettled=Get-Content -Raw -LiteralPath "$taskFailed/evidence/native-host-settled.json"|ConvertFrom-Json
$taskLauncher=Get-Content -Raw -LiteralPath "$taskFailed/evidence/launcher-child-exit.json"|ConvertFrom-Json
if($taskReady.occurrence -cne $taskSettled.occurrence -or !$taskSettled.physicalCompletion -or !$taskSettled.outputDrainComplete -or !$taskSettled.requestCleanupComplete -or $taskSettled.terminal.exitCode -ne 1 -or $taskLauncher.originalChildExit -ne 1){throw 'Original directory-selection failure exit1 and complete terminal required'}
$taskStates=@($taskReady.host,$taskReady.target)|ForEach-Object{@{identity=$_;state=(Get-OwnedNativeState $_)}}
if(@($taskStates|Where-Object state -ne 'dead_or_reused').Count){throw 'Failed original occurrence still live'}
$taskReport+=@{stage='before';kind='checker-failed-001';native=$taskSettled;launcher=$taskLauncher;chain=$taskStates;reason='Checker selected CLI default instead of actual anonymous Session directory;real HTTP NotFoundError404'}
$taskReport|ConvertTo-Json -Depth 18|Set-Content -LiteralPath 'D:/myhexin-local/opencorvus/.tmp-product-iteration/git-executable-flow-492/physical-scopes.json'
Write-Output 'Nine original native scopes physically terminal with output/request/launcher;all original host/target birth identities dead or reused'
