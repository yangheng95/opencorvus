# Original copy failure provenance

The original exec tool returned InvalidOperation at live-sol-launch.ps1:23: calling StartTime.ToUniversalTime on null. Its stdout log is zero bytes; it is not an error receipt. The after02 RunRoot did not exist when independently checked. Subsequent CIM returned no rows for PIDs60452 and75092. PID reuse is unknown. This note transcribes original tool output; it is not a reconstructed runtime trace.
