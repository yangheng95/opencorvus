param([ValidateSet('after')][string]$Stage='after')
$ErrorActionPreference='Stop'
$taskRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-'+$Stage
$taskReady=Get-Content -Raw -LiteralPath "$taskRun/evidence/native-host-ready.json"|ConvertFrom-Json
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
if((Get-OwnedNativeState $taskReady.target) -cne 'exact_live'){throw 'Original exact owned process required'}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OwnedWct537 {
 [DllImport("advapi32.dll",SetLastError=true)] public static extern IntPtr OpenThreadWaitChainSession(uint flags,IntPtr callback);
 [DllImport("advapi32.dll",SetLastError=true)] public static extern bool GetThreadWaitChain(IntPtr handle,UIntPtr context,uint flags,uint thread,ref uint count,IntPtr nodes,out int cycle);
 [DllImport("advapi32.dll")] public static extern void CloseThreadWaitChainSession(IntPtr handle);
}
'@
$taskHandle=[OwnedWct537]::OpenThreadWaitChainSession(0,[IntPtr]::Zero)
if($taskHandle -eq [IntPtr]::Zero){throw ('WCT open failed: '+[Runtime.InteropServices.Marshal]::GetLastWin32Error())}
try {
 $taskProcess=Get-Process -Id $taskReady.target.pid
 $taskResults=@($taskProcess.Threads|ForEach-Object {
  $taskThread=$_
  # WCT_OBJECT_TYPE/status DWORDs followed by an 8-aligned union: WCHAR[128],
  # LARGE_INTEGER, BOOL, padded to 272 bytes; total WAITCHAIN_NODE_INFO 280.
  $taskBuffer=[Runtime.InteropServices.Marshal]::AllocHGlobal(16*280)
  try {
   [uint32]$taskCount=16; [int]$taskCycle=0
   $taskOk=[OwnedWct537]::GetThreadWaitChain($taskHandle,[UIntPtr]::Zero,0,[uint32]$taskThread.Id,[ref]$taskCount,$taskBuffer,[ref]$taskCycle)
   $taskError=if($taskOk){0}else{[Runtime.InteropServices.Marshal]::GetLastWin32Error()}
   $taskNodes=@(for($taskIndex=0;$taskIndex -lt [Math]::Min(16,$taskCount);$taskIndex++) {
    $taskOffset=$taskIndex*280
    $taskType=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset)
    $taskStatus=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset+4)
    if($taskOk -or $taskError -eq 234 -or $taskError -eq 565){
     if($taskType -eq 8){
      @{type=$taskType;status=$taskStatus;processID=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset+8);threadID=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset+12);waitTime=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset+16);contextSwitches=[Runtime.InteropServices.Marshal]::ReadInt32($taskBuffer,$taskOffset+20)}
     }else{@{type=$taskType;status=$taskStatus}}
    }
   })
   @{threadID=$taskThread.Id;cpuSeconds=$taskThread.TotalProcessorTime.TotalSeconds;state=[string]$taskThread.ThreadState;waitReason=if($taskThread.ThreadState -eq 'Wait'){[string]$taskThread.WaitReason}else{$null};success=$taskOk;error=$taskError;count=$taskCount;cycle=[bool]$taskCycle;nodes=$taskNodes}
  } finally {[Runtime.InteropServices.Marshal]::FreeHGlobal($taskBuffer)}
 })
 $taskResult=@{at=[DateTime]::UtcNow.ToString('o');owner=$taskReady.target;processCPU=$taskProcess.CPU;threads=$taskResults;method='Read-only synchronous Windows WCT,flags=0;no process suspension,memory,credentials,or external-chain traversal'}
 $taskFile=Join-Path $PSScriptRoot ('after-wait-chain-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+'.json')
 $taskResult|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $taskFile
 $taskResult|ConvertTo-Json -Depth 12
} finally {[OwnedWct537]::CloseThreadWaitChainSession($taskHandle)}
