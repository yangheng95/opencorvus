import fuzzysort from "fuzzysort"

export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  searchText: (item: T) => string,
): T[] {
  const needle = query.normalize("NFKC").trim()
  if (!needle) return [...items]
  return items
    .map((item, index) => ({
      item,
      index,
      match: fuzzysort.single(needle, searchText(item).normalize("NFKC")),
    }))
    .filter((entry): entry is typeof entry & { match: NonNullable<typeof entry.match> } => entry.match !== null)
    .sort((left, right) => right.match.score - left.match.score || left.index - right.index)
    .map((entry) => entry.item)
}
