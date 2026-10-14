# Parse only. No prepared entrypoint or native library is loaded.
$ErrorActionPreference='Stop'
$taskOutput=Join-Path $PSScriptRoot 'syntax'
$null=New-Item -ItemType Directory -Path $taskOutput -ErrorAction Stop
$taskResults=@()
foreach($taskName in @('fixture-support.mjs','fixture-tool.mjs','verify-state.mjs')) {
  $taskLog=Join-Path $taskOutput ($taskName+'.log')
  & 'C:/Program Files/nodejs/node.exe' --check (Join-Path $PSScriptRoot $taskName) *> $taskLog
  $taskExit=$LASTEXITCODE
  $taskResults+=@{file=$taskName;checker='Node syntax only';exitCode=$taskExit}
  [IO.File]::WriteAllText(($taskLog+'.exit.json'),(@{exitCode=$taskExit;atUtc=[DateTime]::UtcNow.ToString('O')}|ConvertTo-Json))
}
$taskHostLog=Join-Path $taskOutput 'native-host.ts.log'
& 'D:/myhexin-local/opencorvus/.tmp-codex-directory-target-01a133/browse-ui-bundle/bin/bun.exe' -e 'const fs=require("node:fs"); new Bun.Transpiler({loader:"ts"}).transformSync(fs.readFileSync(process.argv[1],"utf8")); console.log("native-host syntax parsed; no imports executed")' (Join-Path $PSScriptRoot 'native-host.ts') *> $taskHostLog
$taskHostExit=$LASTEXITCODE
$taskResults+=@{file='native-host.ts';checker='Bun 1.4 Transpiler syntax only';exitCode=$taskHostExit}
[IO.File]::WriteAllText(($taskHostLog+'.exit.json'),(@{exitCode=$taskHostExit;atUtc=[DateTime]::UtcNow.ToString('O')}|ConvertTo-Json))
foreach($taskName in @('launch.ps1','shutdown.ps1','owned-launch-functions.ps1','check-syntax.ps1')) {
  $taskTokens=$null
  $taskErrors=$null
  $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
  $taskExit=if($taskErrors.Count){1}else{0}
  $taskResults+=@{file=$taskName;checker='PowerShell ParseFile only';exitCode=$taskExit}
  [IO.File]::WriteAllText((Join-Path $taskOutput ($taskName+'.json')),(@{exitCode=$taskExit;errors=@($taskErrors);atUtc=[DateTime]::UtcNow.ToString('O')}|ConvertTo-Json -Depth 8))
}
[IO.File]::WriteAllText((Join-Path $taskOutput 'results.json'),($taskResults|ConvertTo-Json -Depth 6))
$taskResults|ConvertTo-Json -Depth 6
if(@($taskResults|Where-Object exitCode -ne 0).Count){exit 1}
