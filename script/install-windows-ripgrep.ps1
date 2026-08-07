$ErrorActionPreference = 'Stop'

choco install ripgrep --yes --no-progress

$packageTools = Join-Path $env:ChocolateyInstall 'lib\ripgrep\tools'
$executables = @(Get-ChildItem -LiteralPath $packageTools -Filter 'rg.exe' -File -Recurse)
if ($executables.Count -ne 1) {
  throw "Expected one distributable ripgrep executable in $packageTools, found $($executables.Count)."
}

$runtimeTools = Join-Path $env:RUNNER_TEMP 'opencorvus-runtime-tools'
New-Item -ItemType Directory -Force -Path $runtimeTools | Out-Null
$runtimeRipgrep = Join-Path $runtimeTools 'rg.exe'
Copy-Item -LiteralPath $executables[0].FullName -Destination $runtimeRipgrep -Force

$runtimeTools | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
& $runtimeRipgrep --version
