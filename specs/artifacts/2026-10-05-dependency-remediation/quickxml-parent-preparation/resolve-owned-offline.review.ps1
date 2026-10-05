# PREPARED ONLY. Root reviews this file and separately authorizes each invocation.
param([Parameter(Mandatory=$true)][ValidateSet('notification','plist')][string]$Stage,
      [Parameter(Mandatory=$true)][string]$OwnedCargoRoot)
$ErrorActionPreference='Stop'
$repositoryRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$configProbe=Join-Path $repositoryRoot 'packages/overlay/src-tauri'
while($configProbe) {
  foreach($configName in @('config','config.toml')) { if(Test-Path -LiteralPath (Join-Path $configProbe ('.cargo/'+$configName))) { throw 'Ancestor Cargo config exists; Root must review its authority before resolution' } }
  $configProbe=Split-Path $configProbe -Parent
}
$ownedRoot=[System.IO.Path]::GetFullPath($OwnedCargoRoot)
$allowedOwnedRoot=[System.IO.Path]::GetFullPath((Join-Path $repositoryRoot '.tmp-product-iteration/cargo-home-quickxml-01'))
if (-not [System.IO.Path]::IsPathRooted($OwnedCargoRoot) -or $ownedRoot -ne $allowedOwnedRoot) { throw 'Only the Root-named cargo-home-quickxml-01 resolved absolute directory is authorized' }
$publicRegistry='C:/Users/hengu/.cargo/registry'
$publicIndex=Join-Path $publicRegistry 'index/index.crates.io-1949cf8c6b5b557f'
foreach($publicDirectory in @($publicRegistry,(Join-Path $publicRegistry 'index'),$publicIndex,(Join-Path $publicIndex '.cache'),(Join-Path $publicRegistry 'cache'),(Join-Path $publicRegistry 'cache/index.crates.io-1949cf8c6b5b557f'))) {
  $publicItem=Get-Item -LiteralPath $publicDirectory -Force
  if(-not $publicItem.PSIsContainer -or ($publicItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Public registry source must be a canonical directory, not a reparse/private source' }
}
$publicIndexConfig=Get-Content -LiteralPath (Join-Path $publicIndex 'config.json') -Raw | ConvertFrom-Json
if ($publicIndexConfig.'auth-required' -eq $true) { throw 'Authenticated index is outside this public-only resolver' }
$downloadUri=[uri]$publicIndexConfig.dl
$apiUri=[uri]$publicIndexConfig.api
if(-not $downloadUri.IsAbsoluteUri -or $downloadUri.Scheme -ne 'https' -or $downloadUri.Host -ne 'static.crates.io' -or $downloadUri.UserInfo) { throw 'Unexpected anonymous HTTPS public index download source' }
if(-not $apiUri.IsAbsoluteUri -or $apiUri.Scheme -ne 'https' -or $apiUri.Host -ne 'crates.io' -or $apiUri.UserInfo) { throw 'Unexpected anonymous HTTPS public index API source' }
if ($Stage -eq 'notification') {
  if (Test-Path -LiteralPath $ownedRoot) { throw 'First stage requires a fresh owned directory' }
  New-Item -ItemType Directory -Path (Join-Path $ownedRoot 'registry/index/index.crates.io-1949cf8c6b5b557f') | Out-Null
  Copy-Item -LiteralPath (Join-Path $publicIndex '.cache') -Destination (Join-Path $ownedRoot 'registry/index/index.crates.io-1949cf8c6b5b557f/.cache') -Recurse
  Copy-Item -LiteralPath (Join-Path $publicIndex 'config.json') -Destination (Join-Path $ownedRoot 'registry/index/index.crates.io-1949cf8c6b5b557f/config.json')
  New-Item -ItemType Directory -Path (Join-Path $ownedRoot 'registry/cache') | Out-Null
  Copy-Item -LiteralPath (Join-Path $publicRegistry 'cache/index.crates.io-1949cf8c6b5b557f') -Destination (Join-Path $ownedRoot 'registry/cache/index.crates.io-1949cf8c6b5b557f') -Recurse
  # Exact official anonymous distributions already reviewed in this task; no network fallback.
  $publishedSourceRoot=Join-Path $repositoryRoot '.tmp-product-iteration/quickxml-parent-source-3a8a64adf55c495faf16d2711eb54c98'
  foreach($archiveName in @('tauri-winrt-notification-0.7.3.crate','plist-1.10.0.crate')) {
    $archiveItem=Get-Item -LiteralPath (Join-Path $publishedSourceRoot $archiveName)
    if($archiveItem.PSIsContainer -or ($archiveItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Reviewed public distribution must be a regular owned file' }
    Copy-Item -LiteralPath $archiveItem.FullName -Destination (Join-Path $ownedRoot ('registry/cache/index.crates.io-1949cf8c6b5b557f/'+$archiveName))
  }
  Set-Content -LiteralPath (Join-Path $ownedRoot 'config.toml') -Value "[net]`noffline = true"
  Set-Content -LiteralPath (Join-Path $ownedRoot 'prepared-owner.txt') -Value $repositoryRoot
} elseif ((Get-Content -LiteralPath (Join-Path $ownedRoot 'prepared-owner.txt') -Raw).Trim() -ne $repositoryRoot) { throw 'Second-stage owner mismatch' }
$stageOutput=Join-Path $ownedRoot ('review-'+$Stage)
if(Test-Path -LiteralPath $stageOutput){throw 'Keep previous stage evidence; choose no retry overwrite'}
New-Item -ItemType Directory -Path $stageOutput | Out-Null
$manifest=Join-Path $repositoryRoot 'packages/overlay/src-tauri/Cargo.toml'
$lock=Join-Path $repositoryRoot 'packages/overlay/src-tauri/Cargo.lock'
Copy-Item -LiteralPath $lock -Destination (Join-Path $stageOutput 'before.Cargo.lock')
$toolchain='C:/Users/hengu/.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin'
$start=[System.Diagnostics.ProcessStartInfo]::new()
$start.FileName=Join-Path $toolchain 'cargo.exe'
$start.WorkingDirectory=Split-Path $manifest
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.RedirectStandardOutput=$true
$start.RedirectStandardError=$true
$start.Environment.Clear()
foreach($key in @('PATH','SystemRoot','WINDIR','ComSpec','PATHEXT')) { $value=[Environment]::GetEnvironmentVariable($key); if($value){$start.Environment[$key]=$value} }
$start.Environment['CARGO_HOME']=$ownedRoot
$start.Environment['RUSTC']=Join-Path $toolchain 'rustc.exe'
$start.Environment['RUSTDOC']=Join-Path $toolchain 'rustdoc.exe'
$start.Environment['CARGO_NET_OFFLINE']='true'
$start.Environment['HOME']=$ownedRoot
$start.Environment['USERPROFILE']=$ownedRoot
$target=if($Stage -eq 'notification'){'tauri-winrt-notification@0.7.2'}else{'plist@1.8.0'}
$version=if($Stage -eq 'notification'){'0.7.3'}else{'1.10.0'}
foreach($argument in @('update','--offline','--manifest-path',$manifest,'-p',$target,'--precise',$version)){$start.ArgumentList.Add($argument)}
$process=[System.Diagnostics.Process]::Start($start)
$stdout=$process.StandardOutput.ReadToEndAsync()
$stderr=$process.StandardError.ReadToEndAsync()
$process.WaitForExit()
[System.IO.File]::WriteAllText((Join-Path $stageOutput 'stdout.log'),$stdout.GetAwaiter().GetResult())
[System.IO.File]::WriteAllText((Join-Path $stageOutput 'stderr.log'),$stderr.GetAwaiter().GetResult())
Copy-Item -LiteralPath $lock -Destination (Join-Path $stageOutput 'after.Cargo.lock')
Set-Content -LiteralPath (Join-Path $stageOutput 'exit-code.txt') -Value $process.ExitCode
if($process.ExitCode -ne 0){throw 'Original offline resolver failed; preserve evidence and report; no online/default-home retry'}
Write-Output "Review complete before/after lock node/edge delta before authorizing the next stage: $stageOutput"
