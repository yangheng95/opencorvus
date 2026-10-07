param([string]$CaseRun,[string]$CaseEvidence,[string]$CaseLabel,[string]$CheckStem)
$ErrorActionPreference='Stop'
$savedRun=[IO.Path]::GetFullPath($CaseRun)
$savedEvidence=[IO.Path]::GetFullPath($CaseEvidence)
$savedLabel=$CaseLabel
$savedCheckStem=$CheckStem
. (Join-Path $PSScriptRoot 'live-sol-launch.ps1') -FunctionsOnly
$savedOwner=Get-Content -Raw -LiteralPath (Join-Path $savedRun 'launch-owner.json')|ConvertFrom-Json -AsHashtable -DateKind String
$states=@(@{expected=$savedOwner.host;state=(Get-OwnedNativeState $savedOwner.host)},@{expected=$savedOwner.nativeTarget;state=(Get-OwnedNativeState $savedOwner.nativeTarget)})
$ports=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -eq $savedOwner.port|Select-Object LocalAddress,LocalPort,OwningProcess)
$pair=@{};foreach($name in @('auth.json','models.json')){$pair[$name]=Test-Path -LiteralPath (Join-Path $savedRun ('runtime/data/'+$name))}
Write-OwnedLaunchFact (Join-Path $savedEvidence ($savedLabel+'-independent-closure.json')) @{observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$savedOwner.occurrence;states=$states;listeners=$ports;pairPresent=$pair}
if(@($states|Where-Object state -ne 'dead_or_reused').Count -or $ports.Count -or @($pair.Values|Where-Object {$_}).Count){throw 'Owned closure incomplete; preserved receipt'}
foreach($name in @('startup.json','launch-arguments.json','launcher.json')){Copy-Item -LiteralPath (Join-Path $savedRun $name) -Destination (Join-Path $savedEvidence ($savedLabel+'-'+$name)) -ErrorAction Stop}
foreach($name in @('native-host-ready.json','native-host-settled.json')){Copy-Item -LiteralPath (Join-Path $savedRun ('evidence/'+$name)) -Destination (Join-Path $savedEvidence ($savedLabel+'-'+$name)) -ErrorAction Stop}
foreach($name in @('types','build','docs-before','launch','shutdown')){$inputLog=Join-Path $PSScriptRoot ($savedCheckStem+'-'+$name+'.log');if(Test-Path -LiteralPath $inputLog){Copy-Item -LiteralPath $inputLog -Destination (Join-Path $savedEvidence ($savedLabel+'-'+$name+'.log')) -ErrorAction Stop}}
$birthUtc=[DateTime]::new([long]($savedOwner.nativeTarget.processInstanceID.Substring(6)),[DateTimeKind]::Utc)
$newLines=[Collections.Generic.List[string]]::new();$requests=[Collections.Generic.List[object]]::new();$badParse=0
foreach($line in [IO.File]::ReadLines((Join-Path $savedRun 'runtime/log/dev.log'))){try{$entry=$line|ConvertFrom-Json -AsHashtable -DateKind String}catch{$badParse++;continue};if($entry.time -and [DateTime]::Parse($entry.time).ToUniversalTime() -ge $birthUtc){$newLines.Add($line);if($entry.service -eq 'server' -and ($entry.path -or $entry.url)){$requests.Add($entry)}}}
[IO.File]::WriteAllLines((Join-Path $savedEvidence ($savedLabel+'-runtime.log')),$newLines,[Text.UTF8Encoding]::new($false))
Write-OwnedLaunchFact (Join-Path $savedEvidence ($savedLabel+'-http-summary.json')) @{target=$savedOwner.nativeTarget;afterTargetBirthUtc=$birthUtc.ToString('o');retainedNewLines=$newLines.Count;unparsedSourceLines=$badParse;requests=$requests.ToArray()}
Write-Output ($savedLabel+' independently CLOSED; native/check/request evidence retained.')
