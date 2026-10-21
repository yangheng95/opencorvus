import { diffLines } from "diff"

export function textComparisonCounts(before: string, after: string): { additions: number; deletions: number } {
  const counts = { additions: 0, deletions: 0 }
  for (const change of diffLines(before, after)) {
    if (change.added) counts.additions += change.count ?? 0
    if (change.removed) counts.deletions += change.count ?? 0
  }
  return counts
}
