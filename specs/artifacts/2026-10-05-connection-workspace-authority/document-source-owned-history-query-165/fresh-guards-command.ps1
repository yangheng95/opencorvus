$ErrorActionPreference='Stop'
. D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-launch.ps1 -FunctionsOnly
$base='D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority'
$out=Join-Path $base 'document-source-owned-history-query-165'
$cases=@(@(147,'subagent-markdown-live-147'),@(150,'markdown-visible-owner-live-150'),@(153,'store-card-accessor-after-153'),@(154,'store-card-accessor-final-154'),@(159,'sources-reading-focus-after-159'),@(160,'sources-file-focus-live-160'),@(163,'subagent-density-after-163'))
foreach($case in $cases){
  $n=$case[0]; $e=Join-Path $base ($case[1]+'/live-01')
  try {
    $owner=Get-Content -Raw -LiteralPath (Join-Path $e 'launch-owner.json')|ConvertFrom-Json
    $hostState=Get-OwnedNativeState $owner.host
    $targetState=Get-OwnedNativeState $owner.nativeTarget
    $listeners=@(Get-NetTCPConnection -ErrorAction Stop|Where-Object {$_.LocalPort -eq $owner.port -and $_.State -eq 'Listen'})
    $fact=@{case=$n;observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$owner.occurrence;host=$owner.host;target=$owner.nativeTarget;hostState=$hostState;targetState=$targetState;port=$owner.port;listenerCount=$listeners.Count;authPresent=(Test-Path -LiteralPath (Join-Path $owner.runRoot 'runtime/data/auth.json'));modelsPresent=(Test-Path -LiteralPath (Join-Path $owner.runRoot 'runtime/data/models.json'))}
    Write-OwnedLaunchFact (Join-Path $out ($n.ToString()+'-fresh-guard.json')) $fact
    Write-Output ($n.ToString()+': '+$hostState+'/'+$targetState+' listeners='+$listeners.Count)
  } catch {
    Write-OwnedLaunchFact (Join-Path $out ($n.ToString()+'-fresh-guard-error.json')) @{case=$n;errorType=$_.Exception.GetType().Name;code='FRESH_NATIVE_GUARD_BLOCKED'}
    Write-Output ($n.ToString()+': blocked')
  }
}