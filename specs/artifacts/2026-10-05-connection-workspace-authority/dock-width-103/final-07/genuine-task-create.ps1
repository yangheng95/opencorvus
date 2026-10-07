[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$RunRoot,
 [Parameter(Mandatory=$true)][string]$EvidenceRoot,
 [Parameter(Mandatory=$true)][ValidateRange(1,99999)][int]$EvidenceCase,
 [Parameter(Mandatory=$true)][string]$Title,
 [Parameter(Mandatory=$true)][string]$Request,
 [Parameter(Mandatory=$true)][string]$Source
)
$ErrorActionPreference='Stop'
$taskRoot27=[IO.Path]::GetFullPath($RunRoot)
$taskEvidence27=[IO.Path]::GetFullPath($EvidenceRoot)
$taskFilePrefix27='actual-'+$EvidenceCase
$taskOwner27=Get-Content -Raw -LiteralPath "$taskRoot27/launch-owner.json" | ConvertFrom-Json
$taskPreflight27=Get-Content -Raw -LiteralPath "$taskRoot27/evidence/preflight-ready.json" | ConvertFrom-Json
if ($taskPreflight27.occurrence -ne $taskOwner27.occurrence -or $taskPreflight27.preflight.credential -ne 'usable' -or $taskPreflight27.preflight.catalog -ne 'projected' -or $taskPreflight27.preflight.actualModel -ne 'gpt-6.1-sol' -or !$taskPreflight27.preflight.streaming) { throw 'Exact live preflight not qualified' }
if ($taskRoot27 -ne [IO.Path]::GetFullPath($taskOwner27.runRoot) -or $taskEvidence27 -ne [IO.Path]::GetFullPath($taskOwner27.settlementEvidenceRoot)) { throw 'Exact owner root/evidence required' }
if (Test-Path -LiteralPath $taskOwner27.taskSelectionPath) { throw 'Occurrence already has an immutable Task selection' }
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
if ((Get-OwnedNativeState $taskOwner27.host) -ne 'exact_live' -or (Get-OwnedNativeState $taskOwner27.nativeTarget) -ne 'exact_live') { throw 'Original native Host and Target must be live before actual create' }
foreach ($taskSuffix27 in @('task-accepted-cli.json','task-create-first.log','task-selection.json','task-request-input.json')) { if (Test-Path -LiteralPath (Join-Path $taskEvidence27 ($taskFilePrefix27+'-'+$taskSuffix27))) { throw 'Original CLI evidence already exists' } }
$taskURL27='http://127.0.0.1:'+$taskOwner27.port
$taskBun27=(Get-Command bun -ErrorAction Stop).Source
$taskEnvironment27=[Environment]::GetEnvironmentVariables('Process')
$taskKeep27=@('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT','LANG','LC_ALL','LC_CTYPE')
$taskRequest27=$Request
$taskTitle27=$Title
$taskRequestID27=[Guid]::NewGuid().ToString()
$taskClientHome27=Join-Path $taskRoot27 'cli-home'
$taskTemp27=Join-Path $taskRoot27 'cli-temp'
$null=New-Item -ItemType Directory -Force -Path $taskClientHome27,$taskTemp27
try {
 foreach($taskName27 in @($taskEnvironment27.Keys)) { if($taskKeep27 -notcontains $taskName27) { [Environment]::SetEnvironmentVariable($taskName27,$null,'Process') } }
 foreach($taskName27 in @('HOME','USERPROFILE','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','XDG_STATE_HOME')) { [Environment]::SetEnvironmentVariable($taskName27,$taskClientHome27,'Process') }
 [Environment]::SetEnvironmentVariable('HOMEDRIVE',[IO.Path]::GetPathRoot($taskClientHome27).TrimEnd('\'),'Process')
 [Environment]::SetEnvironmentVariable('HOMEPATH',$taskClientHome27.Substring([IO.Path]::GetPathRoot($taskClientHome27).Length-1),'Process')
 foreach($taskName27 in @('TEMP','TMP','TMPDIR')) { [Environment]::SetEnvironmentVariable($taskName27,$taskTemp27,'Process') }
 [Environment]::SetEnvironmentVariable('OPENCORVUS_HOME',$taskOwner27.runtime,'Process')
 [Environment]::SetEnvironmentVariable('OPENCORVUS_DISABLE_EXTERNAL_SKILLS','1','Process')
 [Environment]::SetEnvironmentVariable('OPENCORVUS_DISABLE_AUTOUPDATE','1','Process')
 [Environment]::SetEnvironmentVariable('OPENCORVUS_TASK_PROCESS_MODE','native','Process')
 $taskSentAt27=[DateTime]::UtcNow.ToString('o')
 & $taskBun27 run 'packages/opencorvus/src/index.ts' task create --url $taskURL27 --dir $taskOwner27.project --pillar code --request $taskRequest27 --title $taskTitle27 --model 'openai/gpt-6.1-sol' --source $Source --request-id $taskRequestID27 --format json 1> "$taskEvidence27/$taskFilePrefix27-task-accepted-cli.json" 2> "$taskEvidence27/$taskFilePrefix27-task-create-first.log"
 if($LASTEXITCODE -ne 0) { throw "Genuine Task CLI exit $LASTEXITCODE" }
 $taskAcceptedAt27=[DateTime]::UtcNow.ToString('o')
 $taskAccepted27=Get-Content -Raw -LiteralPath "$taskEvidence27/$taskFilePrefix27-task-accepted-cli.json" | ConvertFrom-Json
 if (!$taskAccepted27.task_id -or !$taskAccepted27.project_id -or $taskAccepted27.directory -ne $taskOwner27.project) { throw 'Genuine Task acceptance contract mismatch' }
 $taskSelection27=[ordered]@{occurrence=$taskOwner27.occurrence;taskID=$taskAccepted27.task_id;projectID=$taskAccepted27.project_id;directory=$taskAccepted27.directory;productPillar='code';requestID=$taskRequestID27;requestSentAt=$taskSentAt27;acceptedObservedAt=$taskAcceptedAt27}
 Write-OwnedLaunchFact "$taskEvidence27/$taskFilePrefix27-task-selection.json" $taskSelection27
 Write-OwnedLaunchFact "$taskEvidence27/$taskFilePrefix27-task-request-input.json" ([ordered]@{title=$taskTitle27;request=$taskRequest27;model='openai/gpt-6.1-sol';source=$Source;requestID=$taskRequestID27;requestSentAt=$taskSentAt27;acceptedObservedAt=$taskAcceptedAt27})
 $taskStage27=Join-Path $taskRoot27 ('task-selection.'+[Guid]::NewGuid().ToString()+'.stage')
 $taskSelection27 | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 -LiteralPath $taskStage27
 [IO.File]::Move($taskStage27,$taskOwner27.taskSelectionPath)
 $taskSelection27 | ConvertTo-Json -Depth 8
} finally {
 foreach($taskName27 in @([Environment]::GetEnvironmentVariables('Process').Keys)) { [Environment]::SetEnvironmentVariable($taskName27,$null,'Process') }
 foreach($taskName27 in @($taskEnvironment27.Keys)) { [Environment]::SetEnvironmentVariable($taskName27,$taskEnvironment27[$taskName27],'Process') }
}
