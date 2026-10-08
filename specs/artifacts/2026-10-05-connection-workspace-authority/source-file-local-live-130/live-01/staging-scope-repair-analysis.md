# Staging130 parameter scope correction

## Recall and actual failure

Root admitted exact130 hidden native/preflight and readonly source staging. First stager returned actualexit1 at startup read `/startup.json`; it had already observed exact native identities but did not create references or Task selection. Root independently observed both absent. Complete preimage preserved in stage-inputs-before-functions-scope-repair.ps1. No model Task or copy success is inferred.

## Cause and impact

The reviewed stager dot-sources mature live-sol-launch.ps1 FunctionsOnly to reuse its existing observer. Its param block assigns RunRoot/EvidenceRoot in the calling PowerShell scope. Those names collide with the stager's own input parameters; FunctionsOnly supplies neither, so later original path interpolation sees null. The same collision would affect final provenance destination if allowed to continue. Current readiness primitive already avoids it by capturing distinct normalized locals before dot-sourcing. No production launch/observer/provider/model/Task policy change is needed.

Root admits a precise private-toolchain repair: capture fully resolved task-specific inputRunRoot130/inputEvidenceRoot130 immediately after stager param, use those sole local paths throughout. Preserve all current exact-owner/preflight/startup/native/listener/target guards, CreateNew bytes and original provenance. No alias, duplicate state/observer or looser guard. Parse again, then rerun original staging command before Task acceptance within unchanged preparation deadline. No old completed oracle or failed Task rearm. Source files and original128 remain unchanged.
