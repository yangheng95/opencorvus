# Stage5 bounded preparation

Root authorized four precise Overlay lock updates from the0a1948aa checkpoint. [Full lock delta](lock-delta.json) has exactly rustls-webpki0.103.14, rustls0.23.45, anyhow1.0.103 and event-listener5.4.2 replacements, with the latter's concurrent-queue edge removal and no extra node changes. Four update logs retain the actual commands' output; each command exited0.

[Initial](checker-types-first.log) and [final](checker-types-final.log) explicit checker/builder TypeScript checks both exited0. [Preparation source delta](source.diff) compares the three authorized source/lock files to their saved starting contents. It is review material, not functional acceptance.

The [initial event-library compiler output](event-library.stdout.jsonl) and [stderr](event-library.stderr.log) preserve exit101 from Cargo1.98.1's inactive-target feature resolver panic. The selected event dependency has no Windows production feature unit. No Rust fixture or product binary compiled in that attempt. The standard multi-target library qualification proposal is awaiting root review; no other library/build graph was substituted.

The approved [multi-target output](event-multitarget.stdout.jsonl) and [stderr](event-multitarget.stderr.log) record actual Cargo exit0. Only the returned Windows-target library and Windows dependency paths feed the [qualified preparation receipt](event-qualified-preparation.json); its separate Rust compile and [two actual event cases](event-tests.stdout.log) both exit0. Linux units were cross-compiled to activate the real dependency branch, then excluded from Windows linking/execution. This is library-only qualification, not Linux D-Bus or product execution.

The full canonical native build and nine production-data cases remain pending. Future results must be saved separately without overwriting the first failure or labelling preparation/types as product runtime acceptance. Public upstream test PKI will live only in the ignored owned path; no private-key PEM content belongs in these artifacts.
