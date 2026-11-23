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

export function splitSearchTerms(query: unknown): string[] {
  const normalized = normalizeSearchText(query)
  return normalized ? normalized.split(/\s+/u) : []
}

/** Discover a candidate through all query terms across its own metadata fields. */
export function matchesSearchTerms(query: unknown, parts: readonly unknown[]): boolean {
  const terms = splitSearchTerms(query)
  if (terms.length === 0) return true
  const fields = parts.map(normalizeSearchText)
  return terms.every((term) => fields.some((field) => field.includes(term)))
}
