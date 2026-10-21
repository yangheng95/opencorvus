param([Parameter(Mandatory=$true)][ValidateSet('before','after')][string]$Stage)
$ErrorActionPreference='Stop'
$taskRun="C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/config-admitted-discovery-518-$Stage"
$taskReady=Get-Content -Raw -LiteralPath "$taskRun/evidence/native-host-ready.json"|ConvertFrom-Json
$taskPort=if($Stage -eq 'before'){18983}else{18985}
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
if((Get-OwnedNativeState $taskReady.target) -ne 'exact_live'){throw 'Exact owned service target required'}
$taskListeners=@(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction Stop)
if($taskListeners.Count -lt 1 -or @($taskListeners|Where-Object OwningProcess -NE $taskReady.target.pid).Count){throw 'Owned target must own public port'}
$taskResponse=Invoke-WebRequest -Uri "http://127.0.0.1:$taskPort/shutdown" -Method Post -TimeoutSec 20
@{occurrence=$taskReady.occurrence;target=$taskReady.target;statusCode=[int]$taskResponse.StatusCode;content=$taskResponse.Content;observedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath "$taskRun/evidence/public-shutdown.json"
Write-Output "Owned public shutdown HTTP $($taskResponse.StatusCode)"
