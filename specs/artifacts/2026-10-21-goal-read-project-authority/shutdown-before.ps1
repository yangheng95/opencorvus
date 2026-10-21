$ErrorActionPreference='Stop'
$taskEvidence='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-21/goal-deliverable-navigation-498-before/evidence'
$taskReady=Get-Content -Raw -LiteralPath "$taskEvidence/native-host-ready.json" | ConvertFrom-Json
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
if((Get-OwnedNativeState $taskReady.target) -ne 'exact_live'){throw 'Exact owned target required'}
$taskListeners=@(Get-NetTCPConnection -State Listen -LocalPort 18879 -ErrorAction Stop)
if($taskListeners.Count -lt 1 -or @($taskListeners|Where-Object OwningProcess -NE $taskReady.target.pid).Count){throw 'Owned target must own the public port'}
$taskResponse=Invoke-WebRequest -Uri 'http://127.0.0.1:18879/shutdown' -Method Post -TimeoutSec 20
@{occurrence=$taskReady.occurrence;target=$taskReady.target;statusCode=[int]$taskResponse.StatusCode;content=$taskResponse.Content;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath "$taskEvidence/public-shutdown.json"
Write-Output "Public shutdown HTTP $($taskResponse.StatusCode)"
