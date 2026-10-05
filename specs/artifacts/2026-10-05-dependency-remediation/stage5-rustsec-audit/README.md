# Stage5 standard full audit after qualification

- [Overlay raw JSON](overlay-audit.stdout.log), [stderr](overlay-audit.stderr.log), [actual receipt](overlay-audit.result.json): exit1, four vulnerabilities, seven unmaintained/two unsound/one yanked warnings. All settings/categories retained.
- [Supervisor raw JSON](supervisor-audit.stdout.log), [stderr](supervisor-audit.stderr.log), [actual receipt](supervisor-audit.result.json):22 dependencies, zero vulnerabilities, empty warnings, exit0.
- [Complete comparison](comparison.json): exactly the rustls vulnerability and anyhow/event-listener unsound occurrences resolve. The four quick-xml occurrences, all seven maintenance warnings, glib/rand0.7 and uds_windows yank remain. No ignore/filter was applied.
- Both receipts bind unchanged lock input bytes and RustSec database ef6173cbc5c50ec8166f9a5b28f07834144373ee,1290 advisories. Actual [version](version.stdout.log) and [audit help](audit-help.stdout.log) were rechecked before these runs.

This audit follows [actual native01](../stage5-native-01/result.json), which passed the full canonical build, nine production-library contracts and two independently bound Windows event-library contracts. It does not certify Linux D-Bus, GUI/installer delivery, a remote updater operation or model execution. Original Stage4 findings and the earlier Cargo preparation failure remain intact.
