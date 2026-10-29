# Real optimized Linux GLib candidate qualification

This is a library candidate, **not a production Tauri repair or GUI acceptance**.
The current production manifest, lock, dependency checker, contract and Docker
entrypoint were checked against HEAD and retain their original contents.

- [Result, exact emitted units and commands](result.json): official glib0.18.5
  plus the upstream two-line out-pointer fix, in a Git export of the existing
  Overlay Cargo project; no new Cargo fixture project.
- [Actual `s` tests](contracts-opt-s.stdout.log) and [actual `3` tests](contracts-opt-3.stdout.log):
  four cases each, eight successful executions; real borrowed string values,
  Unicode order, front/back skips, remaining lengths and owner lifetime.
- [The four positive contracts](glib-contract.rs.txt), appended to the existing
  copied contract's GLib cfg section; no upstream general test suite was run.
- [Official correction as applied](candidate-iterator.patch), with retained
  [MIT permission](upstream-LICENSE.txt) and [copyright attribution](upstream-COPYRIGHT.txt).
- [Full lock reconciliation](lock-review.json): 580 package records retain their
  versions/other contents; only glib's registry source/checksum becomes the
  single candidate path. Linux-target metadata contains421 packages and all12
  actual direct GTK-family parents point to that same glib package.
- [Actual compiler](rustc-version.stdout.log), [lifecycle and original failures](runtime.json),
  [Rustup error](initial-rustup-error.stderr.log) and [offline cache error](offline-cache-error.stderr.log).
- [GitHub readback at 08:26:51Z](github-readback.json): all8 findings still open,
  including the historical manifest findings. Archive movement is not proof of
  remote graph convergence; no finding was dismissed or ignored.

The original observer's quiet-copy timeout was followed through the same live
container to its actual exit1, rather than restarted from an observation error.
The real toolchain error was corrected using the installed compiler binaries;
the actual offline cache miss was then corrected with precise public downloads
and native-target metadata. Both failures and all inputs/results are retained.
The final command returns0, all owned containers retire, and673538ms remain
before the unchanged original deadline. Public cache/target volumes remain
available for the distinct production-build phase; they contain no user
credentials or application database. Model requests:0, cumulative793.

Required next work remains: integrate one licensed patched production source,
review all platform and packaging consumers, extend the sole current checker,
and validate the canonical Tauri application build. Keep source patch identity,
library behavior, application compilation and native GUI evidence distinct.
