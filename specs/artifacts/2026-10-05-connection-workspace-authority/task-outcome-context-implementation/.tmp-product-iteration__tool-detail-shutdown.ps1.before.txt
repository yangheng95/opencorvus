param(
  [Parameter(Mandatory=$true)][string]$EvidenceRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$EvidencePrefix,
  [switch]$PageClosed
)
$ErrorActionPreference='Stop'
if(!$PageClosed){throw 'Close only owned presentation pages before shutdown'}
$taskEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$taskReceipt=Get-Content -Raw -LiteralPath (Join-Path $taskEvidence "$EvidencePrefix-owner.json")|ConvertFrom-Json
if($taskReceipt.evidencePrefix -ne $EvidencePrefix -or !$taskReceipt.listener -or !@($taskReceipt.owners).Count){throw 'Exact current presentation owner contract missing'}
foreach($taskName in @('shutdown-admission','physical-terminal')){if(Test-Path -LiteralPath (Join-Path $taskEvidence "$EvidencePrefix-$taskName.json")){throw 'Preserve existing receipt; prefix already used'}}
$taskKnown=@{}
foreach($taskOwner in @($taskReceipt.owners)){
  if(!$taskOwner.ProcessId -or !$taskOwner.CreationDate -or !$taskOwner.CommandLine -or !$taskOwner.ExecutablePath){throw 'Physical occurrence incomplete'}
  $taskKnown[[string]$taskOwner.ProcessId]=$taskOwner
}
function Same-Occurrence($current,$expected){
  return !!$current -and $current.ProcessId -eq $expected.ProcessId -and ([DateTime]$current.CreationDate).ToUniversalTime() -eq ([DateTime]$expected.CreationDate).ToUniversalTime() -and $current.CommandLine -eq $expected.CommandLine -and $current.ExecutablePath -eq $expected.ExecutablePath
}
function Observe-PresentationOwners {
  $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
  do{
    $added=$false
    foreach($candidate in $all){
      $parent=$taskKnown[[string]$candidate.ParentProcessId]
      if(!$parent){continue}
      $actualParent=$all|Where-Object ProcessId -eq $parent.ProcessId|Select-Object -First 1
      if(!(Same-Occurrence $actualParent $parent)){continue}
      if(([DateTime]$candidate.CreationDate).ToUniversalTime() -lt ([DateTime]$parent.CreationDate).ToUniversalTime()){throw 'Descendant birth contradicts exact parent'}
      if(!$taskKnown.ContainsKey([string]$candidate.ProcessId)){
        if(!$candidate.CommandLine -or !$candidate.ExecutablePath){throw 'New owned descendant occurrence incomplete'}
        $taskKnown[[string]$candidate.ProcessId]=$candidate|Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine
        $added=$true
      }elseif(!(Same-Occurrence $candidate $taskKnown[[string]$candidate.ProcessId])){throw 'Conflicting descendant occurrence; preserve exact facts'}
    }
  }while($added)
  return @($taskKnown.Values|ForEach-Object{
    $expected=$_;$current=$all|Where-Object ProcessId -eq $expected.ProcessId|Select-Object -First 1
    [ordered]@{expected=$expected;originalOccurrencePresent=(Same-Occurrence $current $expected);samePIDReused=(!!$current -and !(Same-Occurrence $current $expected))}
  })
}
function Observe-PresentationListeners {
  return @(Get-NetTCPConnection -ErrorAction Stop|Where-Object{$_.State -eq 'Listen' -and $_.LocalPort -eq $taskReceipt.port}|Select-Object LocalAddress,LocalPort,OwningProcess)
}
$taskBefore=Observe-PresentationOwners
$taskListenerFact=$taskBefore|Where-Object{$_.expected.ProcessId -eq $taskReceipt.listener.ProcessId}|Select-Object -First 1
$taskListeners=Observe-PresentationListeners
if(!$taskListenerFact.originalOccurrencePresent -or $taskListeners.Count -ne 1 -or $taskListeners[0].OwningProcess -ne $taskReceipt.listener.ProcessId){throw 'Exact current presentation listener changed; no shutdown sent'}
$taskResponse=Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$($taskReceipt.port)/shutdown" -ContentType 'application/json' -Body '{}' -TimeoutSec 15
[ordered]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');status=[int]$taskResponse.StatusCode;body=($taskResponse.Content|ConvertFrom-Json);owners=$taskBefore;boundary='Admission only; every observed physical occurrence and listener are checked next';ownedPagesClosed=[bool]$PageClosed}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $taskEvidence "$EvidencePrefix-shutdown-admission.json") -Encoding utf8
$taskDeadline=[DateTime]::UtcNow.AddSeconds(45)
do{
  $taskAfter=Observe-PresentationOwners;$taskListeners=Observe-PresentationListeners
  if(!@($taskAfter|Where-Object originalOccurrencePresent).Count -and !$taskListeners.Count){break}
  Start-Sleep -Milliseconds 500
}while([DateTime]::UtcNow -lt $taskDeadline)
if(@($taskAfter|Where-Object originalOccurrencePresent).Count -or $taskListeners.Count){throw 'Whole presentation chain/port settlement incomplete; preserve evidence'}
$taskData=Join-Path $taskReceipt.runtime 'data'
$taskPair=@(foreach($taskName in @('auth.json','models.json')){[ordered]@{path=(Join-Path $taskData $taskName);present=(Test-Path -LiteralPath (Join-Path $taskData $taskName))}})
if(@($taskPair|Where-Object present).Count){throw 'Unexpected authority staging; do not delete it'}
Copy-Item -LiteralPath (Join-Path $taskReceipt.runtime 'log/dev.log') -Destination (Join-Path $taskEvidence "$EvidencePrefix-runtime.log") -ErrorAction Stop
[ordered]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');purpose=$taskReceipt.purpose;owners=$taskAfter;listeners=$taskListeners;physicalCompletion=$true;copiedAuthorityPresence=$taskPair;boundary='Complete observed original chain and exact loopback port released. No model task, credential staging, source-authority read/write, process kill or user process control.'}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath (Join-Path $taskEvidence "$EvidencePrefix-physical-terminal.json") -Encoding utf8
Write-Output 'Owned presentation chain physically completed; paired authority remains absent.'
