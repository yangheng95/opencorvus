/**
 * Relative-path display helper for surfaces that show a sub-path under a
 * known base (Task root).
 *
 * Returns "" when `target` is not under `base` — callers must treat empty
 * as "do not render" (rule 7: no fallback to shortPath / absolute / etc.).
 */
export function relativePathFrom(base: string, target: string): string {
  if (!base || !target) return ""
  const norm = (s: string) =>
    s
      .replace(/[\\/]+/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase()
  const nb = norm(base)
  const nt = norm(target)
  if (nt.startsWith(nb + "/")) return target.slice(base.replace(/[\\/]+$/, "").length + 1)
  return ""
}
