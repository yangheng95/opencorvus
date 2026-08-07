// Pure target-selection helper for `script/build.ts`. Lives in its own
// module so the filter logic stays unit-testable: importing `build.ts`
// directly runs side effects (chdir, models snapshot fetch + write,
// `Bun.build`), which makes it unsuitable for unit tests.

export interface BuildTarget {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}

export interface SelectTargetsOptions {
  platform: string
  arch: string
  single: boolean
  baseline: boolean
  muslOnly: boolean
}

/**
 * Filter the full target matrix down to the variants requested by the
 * caller. The two flags interact:
 *
 * - `--baseline` (`baseline: true`) keeps the `avx2: false` variants
 *   for the current arch; without it those variants are dropped.
 * - `--musl-only` (`muslOnly: true`) flips the default abi filter:
 *   instead of dropping every `abi !== undefined` entry, the filter
 *   keeps ONLY `abi === "musl"` entries for the current arch. This is
 *   the contract the Linux musl docker step in `.github/workflows/
 *   build.yml` depends on; without it the alpine container rebuilt
 *   the glibc target and produced no musl artifacts.
 *
 * When `single` is false (release matrix), every target is returned
 * unchanged.
 */
export function selectBuildTargets(all: readonly BuildTarget[], opts: SelectTargetsOptions): BuildTarget[] {
  if (!opts.single) return [...all]
  return all.filter((item) => {
    if (item.os !== opts.platform || item.arch !== opts.arch) return false
    // abi gating runs FIRST so the host glibc step doesn't accidentally
    // emit musl-tagged artifacts (and vice versa). Pre-fix, the
    // `avx2 === false ? return baselineFlag` shortcut admitted the
    // `{abi:"musl", avx2:false}` row through the `--baseline` filter.
    if (opts.muslOnly) {
      if (item.abi !== "musl") return false
    } else if (item.abi !== undefined) {
      return false
    }
    if (item.avx2 === false) return opts.baseline
    return true
  })
}
