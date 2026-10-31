param(
 [Parameter(Mandatory=$true)][string]$Out,
 [string]$Python = "C:/Python314/python.exe",
 [Parameter(Mandatory=$true)][string]$ReportPython
)
$ErrorActionPreference = "Stop"
$bundleRoot = $PSScriptRoot
if (Test-Path -LiteralPath $Out) { throw "output_directory_already_exists" }
New-Item -ItemType Directory -Path $Out | Out-Null
$targetRoot = (Resolve-Path -LiteralPath $Out).Path
$programmePath = Join-Path $targetRoot "programme"
New-Item -ItemType Directory -Path (Join-Path $programmePath "plans") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $bundleRoot "source/actor.py") -Destination (Join-Path $programmePath "actor.py")
Copy-Item -LiteralPath (Join-Path $bundleRoot "programme/submission.json") -Destination (Join-Path $programmePath "submission.json")
foreach ($inputName in @("base","cash-tight","shifted-prior")) {
 $studyPath = Join-Path $targetRoot ("studies/" + $inputName)
 & $Python -X utf8 -B (Join-Path $bundleRoot "source/planner.py") --inputs (Join-Path $bundleRoot ("public/instances/" + $inputName)) --out $studyPath --known-class
 if ($LASTEXITCODE -ne 0) { throw ("planner_native_exit:" + $LASTEXITCODE) }
 Copy-Item -LiteralPath (Join-Path $studyPath "policy.json") -Destination (Join-Path $programmePath ("plans/" + $inputName + ".json"))
}
& $Python -X utf8 -B (Join-Path $bundleRoot "source/verify_policy_bound.py") --public (Join-Path $bundleRoot "public") --studies (Join-Path $targetRoot "studies") --out (Join-Path $targetRoot "bellman-certificate.json")
if ($LASTEXITCODE -ne 0) { throw ("certificate_native_exit:" + $LASTEXITCODE) }
& $Python -X utf8 -u -B (Join-Path $bundleRoot "public/exercise.py") --project $programmePath --public (Join-Path $bundleRoot "public") --out (Join-Path $targetRoot "native") --python $Python
if ($LASTEXITCODE -ne 0) { throw ("native_execution_exit:" + $LASTEXITCODE) }
& $ReportPython -X utf8 -B (Join-Path $bundleRoot "source/report.py") --run (Join-Path $targetRoot "native") --studies (Join-Path $targetRoot "studies") --out (Join-Path $targetRoot "delivery")
if ($LASTEXITCODE -ne 0) { throw ("report_native_exit:" + $LASTEXITCODE) }
