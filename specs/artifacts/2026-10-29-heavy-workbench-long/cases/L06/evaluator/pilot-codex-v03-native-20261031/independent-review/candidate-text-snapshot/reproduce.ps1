param(
    [string]$PublicRoot = (Join-Path $PSScriptRoot '../public'),
    [string]$Python = 'C:/Python314/python.exe',
    [string]$RunName = ('reproduce-' + (Get-Date -Format 'yyyyMMdd-HHmmss')),
    [switch]$RunSpot
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$publicFacts = (Resolve-Path -LiteralPath $PublicRoot).Path
$runRoot = [System.IO.Path]::GetFullPath((Join-Path $taskRoot ('evidence/' + $RunName)))
$evidenceRoot = [System.IO.Path]::GetFullPath((Join-Path $taskRoot 'evidence'))
if (-not $runRoot.StartsWith($evidenceRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'RunName must remain within this submission evidence folder.' }
if (Test-Path -LiteralPath $runRoot) { throw 'Use a fresh RunName; original evidence is never overwritten.' }
New-Item -ItemType Directory -Path $runRoot | Out-Null
& $Python -B (Join-Path $taskRoot 'source/check_contracts.py') --public $publicFacts --policy (Join-Path $taskRoot 'policy.json') --out (Join-Path $runRoot 'contracts') | Tee-Object -FilePath (Join-Path $runRoot 'contracts-command.log')
if ($LASTEXITCODE -ne 0) { throw 'Focused contracts failed; preserve this run folder.' }
& $Python -B (Join-Path $publicFacts 'exercise.py') --project (Join-Path $taskRoot 'programme') --policy (Join-Path $taskRoot 'policy.json') --out (Join-Path $runRoot 'native-policy') | Tee-Object -FilePath (Join-Path $runRoot 'native-policy-command.log')
if ($LASTEXITCODE -ne 0) { throw 'Actual candidate exercise failed; preserve this run folder.' }
if ($RunSpot) {
    & $Python -B (Join-Path $taskRoot 'source/package_spot.py') --out (Join-Path $runRoot 'spot-programme')
    if ($LASTEXITCODE -ne 0) { throw 'Spot capsule construction failed.' }
    & $Python -B (Join-Path $taskRoot 'source/run_comparison.py') --public $publicFacts --project (Join-Path $runRoot 'spot-programme') --policy (Join-Path $taskRoot 'outputs/baseline-policy.json') --out (Join-Path $runRoot 'native-spot') | Tee-Object -FilePath (Join-Path $runRoot 'native-spot-command.log')
    if ($LASTEXITCODE -ne 0) { throw 'Unexpected spot outcome; preserve original evidence.' }
    Write-Output 'Canonical spot completed all actual business runs; wrapper retained its expected candidate-quality rejection.'
}
Write-Output ('Candidate reproduction completed. Evidence: ' + $runRoot)
