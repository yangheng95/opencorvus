# GLib production repair evidence

The complete canonical Linux Tauri release build passed. Four tests linked to
its precise production GLib library and four separate opt-level=3 library tests
passed. The repair was normally pushed as `29bafc25f`; GitHub now reports zero
open Dependabot alerts, with all eight previous findings `fixed`.
No GUI acceptance is claimed.

- [Published source provenance](provenance.json), [production-only projection](source-projection.json),
  [one-time syn preparation source](projection-tool.rs.txt) and
  [its build manifest as data](projection-tool.Cargo.toml.txt): 94 source files,
  41 test-only declarations omitted, original MIT permission and attribution
  retained in the production source. The official change makes the C out-pointer
  slot mutable; version 0.18.5 and production interfaces remain truthful.
- [Complete Cargo lock reconciliation](lock-review.json): all 580 package
  records reviewed; the only change is GLib's registry source/checksum becoming
  the production path source.
- [Actual fresh source generation](source-generation-result.json) and
  [its positive data contract](source-generation-contract.ts.txt): 117 packages,
  122 localizations, 6 Skills and the general Mission generated before the first
  SDK build; actual output modules imported and their authoring identities checked.
- [Actual Docker build](image-result.json), using the current Dockerfile and
  root Bun/Node declarations; [fixed native deadline](native-deadline.json) is
  shared by every retry and retains the cleanup reserve.
- [Remote source identity](github-source-identity.json),
  [dependency graph before repair](github-graph-before.json),
  [manifest dependency read](github-manifest-dependencies.json) and
  [eight open alerts](github-alerts-before.json): the retired historical lock is
  absent from remote main but still present in GitHub's dependency graph.
  These are read-only facts, without dismissals or suppression.
- [Actual native result](result.json), [emitted production units](compiler-artifacts.json),
  [separate optimized units](glib-opt3-artifacts.json),
  [production tests](glib-contracts-production.stdout.log),
  [optimized tests](glib-contracts-opt3.stdout.log) and
  [runtime, original failures and terminal receipts](runtime.json): the twelve
  GTK-family parents resolve the sole production GLib source. Full SDK/OpenAPI
  regeneration, in-memory migration validation, backend compilation and packaged
  first-run checks passed. Four sessions were created; two persisted across a
  restart, with `realProvider=false`.

The [separate Docker selective-mount qualification](docker-layout-result.json) passed,
consuming the current image,
frontend, canonical source/defaults and production patch without surrounding
workspace dependencies. All six exact owned containers have [retired](retired-containers.json).
Its terminal receipt is recorded separately; Windows
payload transfer, ARM, macOS, installers and native GUI remain outside this run.

[Delivery and GitHub readback](github-after.json), [normal push checks](push-validation.stdout.log)
and [the management-page screenshot](github-refresh-queued.png) show the final state.
The automatic scan marked the eight alerts fixed at 10:05:46Z–10:05:48Z after
the 10:05:34Z push. The management page already showed Open (0) before the
separately authorized one-time manual refresh. That later action was accepted:
the page displayed “Refresh queued” and a 59-minute cooldown. The read-only API
also reports zero open alerts and the retired manifest has left the dependency
graph. No finding was dismissed and no security policy changed. This result is
specific to Dependabot; the separate Code scanning surface is not a zero claim.

Focused Windows positive checks cover the real prepared plugin closure under
both source and published-JavaScript resolution, executing ordinary and Unicode
project paths. Overlay/backend types, current architecture and the real package
topology contract also passed. JSON receipts in this directory record their
actual process exits. Linux executes the same prepared-closure test.

No model credential was copied or used: this batch makes 0 model requests;
cumulative authorized product-iteration count remains 793. User processes,
browser sessions and application databases are outside this isolated validation.
