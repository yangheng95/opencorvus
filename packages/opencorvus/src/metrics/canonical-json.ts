/** Serialize metric evidence deterministically so hashes and persisted refs have one representation. */
export function canonicalMetricJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalMetricJSON).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalMetricJSON(record[key])}`)
      .join(",")}}`
  }
  throw new Error("Metric evidence contains a non-canonical value")
}
