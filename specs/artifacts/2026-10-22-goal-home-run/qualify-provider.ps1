function Get-GoalScopeProviderQualification {
 param([Parameter(Mandatory=$true)]$Audit,[Parameter(Mandatory=$true)]$Plan,[Parameter(Mandatory=$true)]$Preflight,[Parameter(Mandatory=$true)]$Settled,[Parameter(Mandatory=$true)]$Launcher)
 $taskMaximum=[int]$Plan.maximumRequestsPerStartedScope
 if($taskMaximum -lt 1){throw 'Declared scope budget required'}
 $taskFailures=[Collections.Generic.List[object]]::new()
 if($Preflight.maxRequests -ne $taskMaximum -or $Audit.maxRequests -ne $taskMaximum -or $Audit.requests.Count -gt $taskMaximum -or $Audit.exhausted){$taskFailures.Add(@{kind='declared-budget';expected=$taskMaximum;preflight=$Preflight.maxRequests;actualMaximum=$Audit.maxRequests;actual=$Audit.requests.Count;exhausted=$Audit.exhausted})}
 if($Settled.terminal.exitCode -ne 0 -or $Launcher.originalChildExit -ne 0){$taskFailures.Add(@{kind='service-exit';native=$Settled.terminal.exitCode;launcher=$Launcher.originalChildExit})}
 foreach($taskRequest in $Audit.requests){if($taskRequest.model -cne $Plan.model -or !$taskRequest.streaming -or $taskRequest.status -ne 200 -or $taskRequest.response_reader.state -cne 'settled' -or $taskRequest.response_reader.terminal.kind -cne 'eof'){$taskFailures.Add(@{kind='source-reader';model=$taskRequest.model;streaming=$taskRequest.streaming;status=$taskRequest.status;reader=$taskRequest.response_reader})}}
 return [pscustomobject]@{maximum=$taskMaximum;requests=$Audit.requests.Count;passed=($taskFailures.Count -eq 0);failures=@($taskFailures.ToArray())}
}
