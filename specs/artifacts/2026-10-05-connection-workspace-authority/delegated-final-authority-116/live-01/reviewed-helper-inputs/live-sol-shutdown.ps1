param(
  [Parameter(Mandatory=$true)][string]$RunRoot,
  [Parameter(Mandatory=$true)][string]$EvidenceRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$EvidencePrefix,

  [string]$Reason='root-manual',
  [switch]$PageClosed
)
$ErrorActionPreference='Stop'
$taskRunRoot=[IO.Path]::GetFullPath($RunRoot)
$taskEvidence=[IO.Path]::GetFullPath($EvidenceRoot)
$taskPrefix=$EvidencePrefix
$taskOwner=Get-Content -Raw -LiteralPath (Join-Path $taskRunRoot 'launch-owner.json') | ConvertFrom-Json
if([IO.Path]::GetFullPath($taskOwner.runRoot) -ne $taskRunRoot -or $taskOwner.evidencePrefix -ne $taskPrefix){throw 'Run/prefix does not match exact launch admission'}
if([IO.Path]::GetFullPath($taskOwner.settlementEvidenceRoot) -ne $taskEvidence){throw 'Settlement evidence root does not match launch admission'}
function Write-OwnedReceipt([string]$name,$value){
  $target=Join-Path $taskEvidence "$taskPrefix-$name.json"
  $stage=$target+'.'+[Guid]::NewGuid().ToString()+'.stage'
  $stream=[IO.File]::Open($stage,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  try{[IO.File]::Move($stage,$target)}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -ErrorAction Stop}}
}
$taskSettlementPath=Join-Path $taskEvidence "$taskPrefix-settlement-owner.json"
$taskPhysicalPath=Join-Path $taskEvidence "$taskPrefix-physical-terminal-and-pair-cleanup.json"
$taskErrorPath=Join-Path $taskEvidence "$taskPrefix-settlement-error.json"
$taskSettlementWon=$false
try{
  Write-OwnedReceipt 'settlement-owner' @{occurrence=$taskOwner.occurrence;runRoot=$taskRunRoot;evidenceRoot=$taskEvidence;evidencePrefix=$taskPrefix;ownerPID=$PID;reason=$Reason;admittedAt=[DateTime]::UtcNow.ToString('o')}
  $taskSettlementWon=$true
}catch{
  if(!(Test-Path -LiteralPath $taskSettlementPath)){throw}
}
if(!$taskSettlementWon){
  $existing=Get-Content -Raw -LiteralPath $taskSettlementPath|ConvertFrom-Json
  if($existing.occurrence -ne $taskOwner.occurrence -or $existing.runRoot -ne $taskRunRoot -or $existing.evidenceRoot -ne $taskEvidence -or $existing.evidencePrefix -ne $taskPrefix){throw 'Another settlement occurrence owns this prefix'}
  $joinDeadline=[DateTime]::UtcNow.AddSeconds(75)
  do{
    if(Test-Path -LiteralPath $taskErrorPath){throw 'Exact settlement owner failed; pair retained; inspect settlement-error receipt'}
    if(Test-Path -LiteralPath $taskPhysicalPath){
      $joined=Get-Content -Raw -LiteralPath $taskPhysicalPath|ConvertFrom-Json
      if($joined.occurrence -ne $taskOwner.occurrence -or !$joined.physicalCompletion -or !$joined.pairedCleanupComplete){throw 'Exact settlement remains incomplete'}
      Write-Output 'Joined exact physical settlement and paired cleanup receipt.'
      return
    }
    Start-Sleep -Milliseconds 500
  }while([DateTime]::UtcNow -lt $joinDeadline)
  throw 'Exact settlement join timed out; no second shutdown or cleanup admitted'
}
try {
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
function Observe-OwnedChain {
  return @(@($taskOwner.nativeTarget,$taskOwner.host)|ForEach-Object {
    $state=Get-OwnedNativeState $_
    @{expected=$_;state=$state;originalOccurrencePresent=($state -eq 'exact_live')}
  })
}
function Owned-Listeners {
  return @(Get-NetTCPConnection -ErrorAction Stop|Where-Object {$_.State -eq 'Listen' -and $_.LocalPort -eq $taskOwner.port}|Select-Object LocalAddress,LocalPort,OwningProcess)
}
$taskChain=Observe-OwnedChain
$taskRoot=$taskChain|Where-Object {$_.expected.pid -eq $taskOwner.nativeTarget.pid}|Select-Object -First 1
$taskListeners=Owned-Listeners
$admission=[ordered]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner.occurrence;owner=$taskOwner.nativeTarget;pageClosed=[bool]$PageClosed;dispatch=$false;boundary='Public shutdown admission is distinct from whole native Job/output/request settlement'}
if($taskRoot.originalOccurrencePresent){
  if($taskListeners.Count -eq 0){
    $admission.reason='Original Target live without listener; no public stop dispatched; await the same native physical settlement'
    Write-OwnedReceipt 'shutdown-admission' $admission
  }else{
  if($taskListeners.Count -ne 1 -or $taskListeners[0].OwningProcess -ne $taskOwner.nativeTarget.pid){throw 'Listener does not match original native Target'}
  $response=Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$($taskOwner.port)/shutdown" -ContentType 'application/json' -Body '{}' -TimeoutSec 15
  $admission.dispatch=$true;$admission.status=[int]$response.StatusCode;$admission.body=$response.Content|ConvertFrom-Json
  Write-OwnedReceipt 'shutdown-admission' $admission
  }
}else{
  if($taskListeners.Count){throw 'Original Target gone but owned port remains occupied'}
  $admission.reason='Original Target occurrence already exited; no shutdown dispatched'
  Write-OwnedReceipt 'shutdown-admission' $admission
}
$deadline=[DateTime]::UtcNow.AddSeconds(45)
do{
  $taskNativeSettlement=Get-OwnedNativeSettlement $taskOwner
  $taskChain=Observe-OwnedChain;$taskListeners=Owned-Listeners
  if($taskNativeSettlement -and !@($taskChain|Where-Object originalOccurrencePresent).Count -and !$taskListeners.Count){break}
  Start-Sleep -Milliseconds 100
}while([DateTime]::UtcNow -lt $deadline)
if(!$taskNativeSettlement -or @($taskChain|Where-Object originalOccurrencePresent).Count -or $taskListeners.Count){throw 'Whole native Job/output/request and Host/port settlement incomplete; retain copied pair'}
$taskOwnedData=[IO.Path]::GetFullPath((Join-Path $taskOwner.runtime 'data'))
$taskAuditFile=Get-ChildItem -LiteralPath $taskOwner.evidence -Filter 'provider-*.json' -ErrorAction Stop|Sort-Object LastWriteTimeUtc|Select-Object -Last 1
if($taskAuditFile){Write-OwnedReceipt 'final-provider-audit' (Get-Content -Raw -LiteralPath $taskAuditFile.FullName|ConvertFrom-Json)}else{Write-OwnedReceipt 'final-provider-audit' @{available=$false;boundary='No model receipt observed; physical settlement precedes this final snapshot; not model acceptance'}}
$taskExpectedData=[IO.Path]::GetFullPath((Join-Path $taskRunRoot 'runtime/data'))
if($taskOwnedData -ne $taskExpectedData){throw 'Pair cleanup escaped exact owned runtime/data'}
foreach($ancestor in @($taskRunRoot,(Join-Path $taskRunRoot 'runtime'),$taskExpectedData)){
  if(Test-Path -LiteralPath $ancestor){
    $ancestorItem=Get-Item -LiteralPath $ancestor -ErrorAction Stop
    if($ancestorItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Owned cleanup ancestor is a reparse point; preserve pair for review'}
  }
}
$taskPair=@();$cleanupErrors=@()
foreach($name in @('auth.json','models.json')){
  $target=[IO.Path]::GetFullPath((Join-Path $taskOwnedData $name))
  if([IO.Path]::GetDirectoryName($target) -ne $taskExpectedData){throw 'Unexpected copied-authority target'}
  try{
    if(Test-Path -LiteralPath $target){
      $item=Get-Item -LiteralPath $target -ErrorAction Stop
      if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Copied authority member is a reparse point; manual review required'}
      Remove-Item -LiteralPath $target -ErrorAction Stop
      $taskPair += @{path=$target;outcome='removed';copiedLength=$item.Length;presentAfter=(Test-Path -LiteralPath $target)}
    }else{$taskPair += @{path=$target;outcome='already_absent';presentAfter=$false}}
  }catch{
    $cleanupErrors += $_.Exception.Message
    $taskPair += @{path=$target;outcome='error';errorType=$_.Exception.GetType().Name;presentAfter=(Test-Path -LiteralPath $target)}
  }
}
Write-OwnedReceipt 'physical-terminal-and-pair-cleanup' @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$taskOwner.occurrence;physicalCompletion=$true;nativeSettlement=$taskNativeSettlement;chain=$taskChain;listeners=$taskListeners;copiedPair=$taskPair;pairedCleanupComplete=($cleanupErrors.Count -eq 0);boundary='Production foreground Job/output/request settled, exact Host/Target gone and port released before paired-copy cleanup'}
if($cleanupErrors.Count){throw 'Paired cleanup incomplete; exact member error receipt retained'}
Write-Output 'Owned observed process chain settled and copied authority pair cleanup recorded.'
} catch {
  if(!(Test-Path -LiteralPath $taskErrorPath)){
    Write-OwnedReceipt 'settlement-error' @{occurrence=$taskOwner.occurrence;observedAtUtc=[DateTime]::UtcNow.ToString('o');errorType=$_.Exception.GetType().Name;message=$_.Exception.Message;boundary='Settlement failed; first wrapper failure preserved; paired cleanup qualified only by its exact physical receipt; no kill'}
  }
  throw
}
