# Root checker preparation observations

The first19a invocation reports this error in the outer tool output, before any owned directory/process creation:

> Exception calling "GetFullPath" with "1" argument(s): "The path is empty. (Parameter 'path')"

The first redirected `owned-settlement-19a-original.log` is empty: PowerShell propagated this terminating script error outside the redirection. It is retained as originally produced, not presented as a captured error log. The outer command then reported exit0 because it used null LASTEXITCODE. The binding Recall records both observations; the corrected invocation explicitly catches the script error and returns1. Root captures caller paths/port before dot-source; the unchanged first-failure case then qualifies against the actual service with public shutdown and independent closure facts.

A later metadata-archive command accidentally calls an undefined `Write-OwnedDummy` name and exits1. It copies the already-qualified docs log but writes no precision receipt and controls no service. Root corrects that command to direct create-once metadata publication; `root-19-date-precision.json` records the independently specified original JSON date and typed conversion. This command typo is not a product finding or an acceptance pass.
