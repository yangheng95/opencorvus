param(
  [Parameter(Mandatory=$true)][string]$RunRoot,
  [Parameter(Mandatory=$true)][string]$EvidenceRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Phase
)
$ErrorActionPreference='Stop'
$taskObservedRun=[IO.Path]::GetFullPath($RunRoot)
$taskObservedEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$taskObservedPhase=$Phase
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$taskOwner=Get-Content -Raw -LiteralPath (Join-Path $taskObservedRun 'launch-owner.json')|ConvertFrom-Json
if([IO.Path]::GetFullPath($taskOwner.runRoot) -ne $taskObservedRun){throw 'Exact launch ownership required'}
$taskTarget=Join-Path $taskObservedEvidence ($taskOwner.evidencePrefix+'-chain-'+$taskObservedPhase+'.json')
$taskPresence=@(@($taskOwner.nativeTarget,$taskOwner.host)|ForEach-Object {
  $state=Get-OwnedNativeState $_
  @{processID=$_.pid;processInstanceID=$_.processInstanceID;state=$state;originalOccurrencePresent=($state -eq 'exact_live')}
})
$taskSettled=Get-OwnedNativeSettlement $taskOwner
$taskListeners=@(Get-NetTCPConnection -ErrorAction Stop|Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $taskOwner.port}|Select-Object LocalAddress,LocalPort,OwningProcess)
Write-OwnedLaunchFact $taskTarget @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner.occurrence;phase=$taskObservedPhase;presence=$taskPresence;listeners=$taskListeners;nativeSettlement=$taskSettled;boundary='Exact native Host/Target birth and production foreground Job settlement; no CIM descendant inference'}
Write-Output ($taskPresence|ConvertTo-Json -Compress)