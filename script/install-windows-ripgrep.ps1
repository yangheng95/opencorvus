$ErrorActionPreference = 'Stop'

$version = '15.2.0'
$archiveName = "ripgrep-$version-x86_64-pc-windows-msvc.zip"
$expectedSha256 = '71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5'
$archive = Join-Path $env:RUNNER_TEMP $archiveName
$expanded = Join-Path $env:RUNNER_TEMP "opencorvus-ripgrep-$version"
$uri = "https://github.com/BurntSushi/ripgrep/releases/download/$version/$archiveName"

Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $archive
$actualSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
  throw "ripgrep archive SHA256 mismatch: expected $expectedSha256, received $actualSha256."
}
Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
$executables = @(Get-ChildItem -LiteralPath $expanded -Filter 'rg.exe' -File -Recurse)
if ($executables.Count -ne 1) {
  throw "Expected one distributable ripgrep executable in $archiveName, found $($executables.Count)."
}

$runtimeTools = Join-Path $env:RUNNER_TEMP 'opencorvus-runtime-tools'
New-Item -ItemType Directory -Force -Path $runtimeTools | Out-Null
$runtimeRipgrep = Join-Path $runtimeTools 'rg.exe'
Copy-Item -LiteralPath $executables[0].FullName -Destination $runtimeRipgrep -Force

$runtimeTools | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
& $runtimeRipgrep --version
