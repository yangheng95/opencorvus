# Original native inputs, retained as evidence

These are the exact three inputs saved before the 2026-10-05 QuickXML parent
repair. They are historical data, not the current build or a runnable test suite.
On 2026-10-29 each received a `.txt` suffix to distinguish evidence from active
Cargo inputs. All original bytes and versions are retained.

| Original name | Retained data |
| --- | --- |
| `Cargo.lock` | [Cargo.lock.txt](Cargo.lock.txt) |
| `check-rust-dependencies.ts` | [check-rust-dependencies.ts.txt](check-rust-dependencies.ts.txt) |
| `rust-dependency-contract.rs` | [rust-dependency-contract.rs.txt](rust-dependency-contract.rs.txt) |

The immutable original source is Git commit
`c59cf33bc765d17f079d1d4c5665a4f5e9df4a01`, under this directory and the original
names above. The archived data was compared byte for byte with that commit and
the pre-move HEAD. [Provenance and real Git archive verification](../../../2026-10-29-native-advisory-evidence/README.md)
record the result. The repository's attributes retain these data bytes across
platforms. Copy to the original names in an owned investigation directory when
reconstructing a historical input; do not use this lock as a current build graph.

The current native manifest/lock remain in `packages/overlay/src-tauri`, and the
current dependency checker/contract in `packages/overlay/script`. This archival
change does not remediate or dismiss current native dependency findings.
