# Remaining dependency and platform qualification: read-only follow-up

2026-10-05. Parent's Stage3 commit is41af4e42; no dependency/source/spec/lock changes, installation, Cargo update/build, environment startup, GUI, Provider, credential access or Git operation was performed. Public source/index/registry responses are retained in residual-primary-read.json beside this note. These notes propose the next bounded authorization, not completed remediation.

## Actual local inventory

- Get-Command finds cargo/rustup, Windows wsl.exe and Docker Desktop's docker.exe. cargo-audit is neither on PATH nor at the normal ~/.cargo/bin/cargo-audit.exe path. This does not assert it cannot exist in an unrelated location; no broad disk scan was done.
- wsl --list --verbose: Ubuntu-24.04 is Stopped, version2; docker-desktop is Running, version2. Neither was started or stopped.
- Docker client and current daemon both29.7.2; read-only docker info projection reports linux/x86_64. com.docker.service is Stopped and WslService is Running; service status alone would incorrectly imply Docker unavailable.
- Exact existing builder image opencorvus-overlay-builder:linux-amd64 is missing. No images/containers were otherwise enumerated and no user command lines inspected.
- rustup target list --installed includes x86_64/aarch64 Windows MSVC, Linux GNU and macOS targets. Installed std target files do not establish Linux native libraries/linker/runtime or a Linux build pass.
- Existing Dockerfile uses rust:1-bookworm plus WebKitGTK4.1/GTK3, SSL, AppIndicator, librsvg, pkg-config, Node and pinned Bun1.3.14. Current image must be built/pulled before this path works. Its current build-docker.ts is not the new exact-artifact runner: it stages prebuilt server/resources and invokes tauri directly, and its ARM branch runs a privileged binfmt helper. Do not invoke the broad default script or claim it runs the complete canonical build without a separate review. Current native package CI reuses .github/actions/setup-overlay-runtime and package-overlay workflow; workflow dispatch would be an external write requiring separate authorization.

## Most useful next step: standard Cargo audit

Official crates.io sparse index and the actual published cargo-audit0.22.2 tarball agree: stable version0.22.2, minimum Rust1.88, default binary-scanning feature; local1.98.1 suffices. The repository's current main README still says1.74, so the versioned manifest is authoritative for this install. No extra fix feature is required, and audit fix must not run.

Proposed mature-tool installation, only after parent approval:

```powershell
cargo install cargo-audit --version 0.22.2 --locked --root D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-tools --target-dir D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-tool-build
```

Writes: owned install root bin/cargo-audit.exe and Cargo install metadata; owned compilation target; ordinary Cargo registry index/download/source caches under the existing Cargo home; possible compiler temp files. It does not install a project dependency or update either project lock. No PATH change is needed. Execute the resulting tool by absolute path, inspect its actual --help/version, then audit each existing lock explicitly:

```powershell
& D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-tools\bin\cargo-audit.exe audit --file D:\myhexin-local\opencorvus\packages\overlay\src-tauri\Cargo.lock --db D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-advisory-db --json
& D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-tools\bin\cargo-audit.exe audit --file D:\myhexin-local\opencorvus\packages\opencorvus\native\process-supervisor\Cargo.lock --db D:\myhexin-local\opencorvus\.tmp-product-iteration\data-integrity\rustsec-advisory-db --json
```

The published CLI defines --file and --db. Explicit existing lock files avoid its generate-missing-lock behavior. Audit fetches the public RustSec database into that owned directory and may refresh crates.io data for yanked checks; these network/cache writes need inclusion in authorization. Preserve separate stdout/stderr/exit status and database metadata/revision per run. No --ignore, --no-yanked, --stale, target filtering or audit fix. Standard audit may represent unsound/unmaintained findings as warnings; inspect all JSON warnings instead of treating exit0 as no findings. --deny warnings is available if root wants an explicit nonzero report for those categories; it is not a remediation. Run neither actual package nor native app as part of the audit. The lock audit covers both platform packages and new unknown advisories; the existing Windows library receipt qualifies actual reachability separately. Audit success or a backported source at the old version cannot prove Linux behavior or silently clear a version-range advisory.

Primary: https://index.crates.io/ca/rg/cargo-audit ; https://static.crates.io/crates/cargo-audit/cargo-audit-0.22.2.crate ; https://github.com/rustsec/rustsec/tree/main/cargo-audit

## npm findings: current authoritative changes

braces latest remains3.0.3, advisory GHSA-vfj7-8cjw-p6xm still <=3.0.3/Patched None. Official repository PR75 is currently open, unmerged, adding maxDepth guards; PR72 is closed without merge. These are public proposed patches, not published or maintainer-accepted fixes. Existing Parcel watcher2.5.1 -> micromatch4.0.8 -> braces3.0.3 chain is unchanged. A controlled RangeError is still an exception whose real caller handling requires verification; do not assume a PR title proves server survival. Any local adaptation needs a separately scoped package-patch design covering parse/compile/expand/stringify, AST inputs and actual watcher lifecycle before installation.

http-cache-semantics latest is now4.3.0 (published2026-10-04T02:56:05.593Z), but it is NOT demonstrated to repair GHSA-ch52-4w7c-c8xp. The exact published4.2.0-to4.3.0 index.js diff adds response status and improves Vary wildcard/own-header handling; it leaves the max-stale/evaluateRequest freshness path unchanged. Advisory still says <=4.2.0, Patched None, last updated Oct2. Merely upgrading out of that range could make a scanner silent without fixing its described behavior. Upstream owner kornelski disputes the report in issue56, citing RFC9111's permission to cache Set-Cookie unless Cache-Control forbids sharing; GitHub advisory-database issue10139 requests withdrawal and remains open. Record this conflict rather than self-withdrawing/ignoring the finding. Astro7.2.8 actual remote.js uses CachePolicy.storable/timeToLive to decide build image expiry; it does not use satisfiesWithoutRevalidation for incoming user requests. That is a specific production exposure qualification, not closure of the dependency report. No security-motivated4.3.0 upgrade is currently justified by this evidence alone.

Primary: https://registry.npmjs.org/braces/latest ; https://github.com/micromatch/braces/pull/75 ; https://github.com/micromatch/braces/pull/72 ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm ; https://registry.npmjs.org/http-cache-semantics ; https://github.com/kornelski/http-cache-semantics/issues/56 ; https://github.com/github/advisory-database/issues/10139 ; https://github.com/advisories/GHSA-ch52-4w7c-c8xp

## rand0.7: actual parent and published alternative

Official index still ends the0.7 line at0.7.3. RustSec RUSTSEC-2026-0097 still patches only0.8.6/0.9.3/0.10.1. Merged official rand PR1763 removes the logging dependency/callback opportunity; no published0.7 fix is present. Current source chain is tauri-utils2.9.1 optional legacy html-manipulation -> kuchikiki0.8.8-speedreader -> selectors0.24 -> PHF0.8 -> rand0.7.3. This is genuinely compiled in stage3-native-03 (rand, selectors and kuchikiki compiler artifacts); it is not merely an unused optional lock entry. Actual rand features omit log and PHF uses seeded SmallRng, qualifying known trigger exposure without closing the advisory.

Published kuchikiki0.8.9-speedreader (July13) moves selectors to^0.32; selectors0.32 uses PHF^0.11, which can use patched rand0.8.6. But it also changes cssparser0.29->0.35 and html5ever0.29.1->0.35. Current and latest tauri-utils2.10.1 still require kuchikiki^0.8.8-speedreader and expose legacy html-manipulation plus newer dom_query html-manipulation-2. Cargo stable's prerelease rules only allow automatic prerelease updates on the same base release;0.8.9-speedreader is not a simple compatible lock replacement for^0.8.8-speedreader. Changing the parent requirement also requires reviewing public html5ever type interoperability, not forcing a single transitive rand major. Latest Tauri alone retains the legacy optional dependency. Recommended order: obtain full audit first, then separately investigate an official parent migration or narrowly reviewed upstream-equivalent0.7 backport; no speculative major/parser migration now.

Primary: https://rustsec.org/advisories/RUSTSEC-2026-0097.html ; https://github.com/rust-random/rand/pull/1763 ; https://index.crates.io/ra/nd/rand ; https://index.crates.io/ku/ch/kuchikiki ; https://index.crates.io/se/le/selectors ; https://index.crates.io/ta/ur/tauri-utils ; https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#pre-releases

## glib Linux: exact upstream patch, still incompatible parent constraints

The official fix exists as gtk-rs/gtk-rs-core PR1343 commit b5a4071e439bef2b5eea76c3aa25e5ae84839e34: in VariantStrIter::impl_get, make the local pointer mutable and pass &mut p to the variadic C out-argument. The0.18 index still ends at0.18.5; RustSec RUSTSEC-2024-0429 patches>=0.20.0. This provides a concrete minimal backport input, but no compatible published0.18 release.

New gtk0.19.0 depends on glib^0.22, but latest Tauri2.12.1 and Wry0.57.0 still depend on gtk^0.18; latest webkit2gtk2.0.2 requires both gtk/glib^0.18. Thus a whole-stack GTK migration remains beyond a conservative security patch. A source backport, if chosen later, needs one canonical Cargo patch source, exact provenance/licensing and optimized actual Linux iterator tests for next/nth/last/next_back/nth_back/mixed ends, plus the real Linux Tauri build/normal lifecycle. Windows compilation cannot execute the GTK implementation. A local0.18.5 patch will still be flagged by version-range audit, which must stay visible with separate proof rather than an ignore or invented patched version.

Parent platform choice remains necessary: authorize starting existing stopped Ubuntu for narrow inventory, or authorize building the existing Docker Linux image and an owned canonical Linux build environment. Current Docker is available but no builder image exists. Do not restart Docker/Desktop or touch other containers. A Windows-installed Linux rust target alone is inadequate. No Linux command/build/runtime or GTK test was executed here.

Primary: https://rustsec.org/advisories/RUSTSEC-2024-0429.html ; https://github.com/gtk-rs/gtk-rs-core/pull/1343 ; https://github.com/gtk-rs/gtk3-rs/releases/tag/0.19.0 ; https://index.crates.io/gl/ib/glib ; https://index.crates.io/3/g/gtk ; https://index.crates.io/ta/ur/tauri ; https://index.crates.io/3/w/wry ; https://index.crates.io/we/bk/webkit2gtk

One read-only reporting command initially failed to print a Unicode arrow through Python's default Windows cp1252 stdout; data had already been saved. Reprinting sanitized JSON with ASCII escapes succeeded. A Windows rg glob path was corrected to explicit Python filesystem glob to read the actual Astro consumer. Neither tool issue changed dependencies or product files.
