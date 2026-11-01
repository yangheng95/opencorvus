export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

export function matchesSearchParts(query: unknown, parts: readonly unknown[]): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  return parts.some((part) => normalizeSearchText(part).includes(normalizedQuery))
}

/** Discover a candidate through all query terms across its own metadata fields. */
export function matchesSearchTerms(query: unknown, parts: readonly unknown[]): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  const fields = parts.map(normalizeSearchText)
  return normalizedQuery.split(/\s+/u).every((term) => fields.some((field) => field.includes(term)))
}
