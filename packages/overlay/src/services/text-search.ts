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
