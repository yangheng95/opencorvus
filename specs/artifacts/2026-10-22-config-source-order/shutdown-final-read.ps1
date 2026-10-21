$ErrorActionPreference='Stop'
$taskRoot='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-source-order-520-final-read'
$taskReady=Get-Content -LiteralPath "$taskRoot/evidence/native-host-ready.json" -Raw | ConvertFrom-Json
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
if((Get-OwnedNativeState $taskReady.target) -ne 'exact_live'){throw 'Exact original service target required'}
$taskListeners=@(Get-NetTCPConnection -State Listen -LocalPort 18991 -ErrorAction Stop)
if($taskListeners.Count -lt 1 -or @($taskListeners|Where-Object OwningProcess -NE $taskReady.target.pid).Count){throw 'Owned target must own public port'}
$taskResponse=Invoke-WebRequest -Method Post -Uri 'http://127.0.0.1:18991/shutdown' -TimeoutSec 20
if($taskResponse.StatusCode -ne 200){throw 'Owned shutdown status required'}
@{at=[DateTime]::UtcNow.ToString('o');statusCode=$taskResponse.StatusCode;occurrence=$taskReady.occurrence;body=$taskResponse.Content}|ConvertTo-Json | Set-Content -LiteralPath "$taskRoot/evidence/shutdown.json"
Write-Output 'Final owned public shutdown HTTP200'
