$ErrorActionPreference='Stop'
$evidence=Join-Path $PSScriptRoot '../specs/artifacts/2026-10-05-connection-workspace-authority/logger-envelope-95/native-after'
$evidence=[IO.Path]::GetFullPath($evidence)
$inputs=Get-Content -Raw (Join-Path $evidence 'actual-95-after-public-inputs.json')|ConvertFrom-Json -DateKind String
$reads=Get-Content -Raw (Join-Path $evidence 'actual-native-reads-and-export.json')|ConvertFrom-Json -DateKind String
$actualSession=$inputs.requests[1].body.session
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Join-Path $evidence 'actual-support-export.zip'))
function Read-ZipBytes([string]$path){
 $stream=$zip.GetEntry($path).Open();$memory=[IO.MemoryStream]::new()
 try{$stream.CopyTo($memory);return ,$memory.ToArray()}finally{$stream.Dispose();$memory.Dispose()}
}
try{
 $manifest=[Text.Encoding]::UTF8.GetString((Read-ZipBytes 'manifest.json'))|ConvertFrom-Json -DateKind String
 $raw=Read-ZipBytes 'logs/raw/dev.log'
 $formattedBytes=Read-ZipBytes 'logs/formatted/dev.log'
 $formatted=[Text.Encoding]::UTF8.GetString($formattedBytes)
 $physical=[IO.File]::ReadAllBytes($manifest.source.current)
 $prefixEqual=$physical.Length -ge $raw.Length
 if($prefixEqual){for($i=0;$i -lt $raw.Length;$i++){if($raw[$i] -ne $physical[$i]){$prefixEqual=$false;break}}}
 $lines=@([Text.Encoding]::UTF8.GetString($raw).Split("`n")|Where-Object { $_.Length -gt 0 })
 $records=@($lines|ForEach-Object { $_|ConvertFrom-Json -DateKind String })
 $created=@($records|Where-Object { $_.service -eq 'session' -and $_.message -eq 'created' -and $_.data.id -eq $actualSession.id })
 $subject=@($records|Where-Object { $_.service -eq 'logger-envelope95-observation' -and $_.message -eq 'Logger subject chronology95' })
 $missing=$reads.reads[2]
 $requestID=$missing.headers.'x-opencorvus-request-id'[0]
 $completion=@($records|Where-Object { $_.service -eq 'server' -and $_.message -eq 'request' -and $_.data.requestID -eq $requestID -and $_.data.status -eq 'completed' })
 $fact=@{
  observedAtUtc=[DateTime]::UtcNow.ToString('o');occurrence=$inputs.occurrence
  qualifier='Genuine GET/log/export ZIP; exact retained snapshot prefix comparison with same physical file, no mutable-source hash or current whole-file equality claim'
  entries=@($zip.Entries|Select-Object FullName,Length);manifest=$manifest
  snapshotBytes=$raw.Length;physicalBytesAtObservation=$physical.Length;physicalPrefixEqual=$prefixEqual
  parsedRows=$records.Count;created=$created;subject=$subject;missingResponse=$missing.body;missingRequestID=$requestID;missingCompletion=$completion
  exportHeaders=$reads.reads[3].headers;exportByteCount=$reads.reads[3].byteCount
 }
 $factPath=Join-Path $evidence 'actual-export-qualified.json'
 if(Test-Path $factPath){throw 'Refusing to overwrite original export facts'}
 [IO.File]::WriteAllText($factPath,($fact|ConvertTo-Json -Depth 18),[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllBytes((Join-Path $evidence 'actual-export-raw-dev.log'),$raw)
 [IO.File]::WriteAllBytes((Join-Path $evidence 'actual-export-formatted-dev.log'),$formattedBytes)
 if(!$prefixEqual -or $raw.Length -ne $manifest.files[0].size -or $records.Count -ne $manifest.totals.lineCount){throw 'Export snapshot/manifest contract failed'}
 if($created.Count -ne 1 -or $created[0].time -isnot [string] -or $created[0].level -ne 'info' -or $created[0].data.time.created -ne $actualSession.time.created -or $created[0].data.projectID -ne $actualSession.projectID){throw 'Actual created event envelope contract failed'}
 if($subject.Count -ne 1 -or $subject[0].time -isnot [string] -or $subject[0].level -ne 'warn' -or $subject[0].data.level -ne 'info' -or $subject[0].data.service -ne 'subject-lifecycle' -or $subject[0].data.sessionID -ne $actualSession.id -or $subject[0].data.time.updated -ne $actualSession.time.updated){throw 'Actual public subject/envelope contract failed'}
 if($missing.status -ne 404 -or $missing.body.name -ne 'LogFileNotFoundError' -or $completion.Count -ne 1 -or $completion[0].data.statusCode -ne 404){throw 'Actual missing-file response/correlation contract failed'}
 if(!$formatted.Contains('['+$created[0].time+'] INFO  [session] created') -or !$formatted.Contains('['+$subject[0].time+'] WARN  [logger-envelope95-observation] Logger subject chronology95') -or !$formatted.Contains('"created": '+$actualSession.time.created)){throw 'Actual formatted canonical header/subject contract failed'}
 if([int]$reads.reads[3].headers.'x-opencorvus-log-file-count'[0] -ne $manifest.totals.fileCount -or [int]$reads.reads[3].headers.'x-opencorvus-log-line-count'[0] -ne $manifest.totals.lineCount -or [int]$reads.reads[3].headers.'Content-Length'[0] -ne $reads.reads[3].byteCount){throw 'Actual export transport metadata contract failed'}
 Write-Output 'Actual export snapshot, canonical rows, subject data, formatted headers, typed 404 correlation and transport metadata qualified.'
}finally{$zip.Dispose()}
