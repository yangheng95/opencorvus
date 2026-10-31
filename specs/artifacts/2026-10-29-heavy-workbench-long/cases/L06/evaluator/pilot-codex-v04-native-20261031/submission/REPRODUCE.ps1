param(
  [string]$Python = 'C:/Python314/python.exe',
  [string]$Public = (Join-Path $PSScriptRoot 'native-run-02/public'),
  [string]$Out = (Join-Path $PSScriptRoot ('reproduction-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
  [switch]$Native
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Out) { throw 'Choose a new output directory; original evidence must stay intact.' }
New-Item -ItemType Directory -Path $Out | Out-Null
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:TEMP = Join-Path $Out 'tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP | Out-Null
& $Python -B -u (Join-Path $PSScriptRoot 'source/rebuild.py') --public $Public --out (Join-Path $Out 'build') *> (Join-Path $Out 'rebuild.log')
if ($LASTEXITCODE -ne 0) { throw 'Source rebuild failed; keep the original output and log.' }
& $Python -B -u (Join-Path $PSScriptRoot 'source/verify_bellman.py') --public $Public --build (Join-Path $Out 'build') --out (Join-Path $Out 'independent-review.json') *> (Join-Path $Out 'independent-review.log')
if ($LASTEXITCODE -ne 0) { throw 'Independent exact certificate verification failed.' }
if ($Native) {
  $Programme = Join-Path $Out 'programme'
  New-Item -ItemType Directory -Path $Programme | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'programme/actor.py') -Destination (Join-Path $Programme 'actor.py')
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'programme/submission.json') -Destination (Join-Path $Programme 'submission.json')
  Copy-Item -LiteralPath (Join-Path $Out 'build/policies') -Destination (Join-Path $Programme 'policies') -Recurse
  & $Python -B -u (Join-Path $PSScriptRoot 'runner/exercise.py') --project $Programme --public $Public --out (Join-Path $Out 'native') --python $Python *> (Join-Path $Out 'native.log')
  if ($LASTEXITCODE -ne 0) { throw 'Native exercise failed; retain all original evidence.' }
}
Write-Output ('Rebuilt and verified: ' + $Out)
