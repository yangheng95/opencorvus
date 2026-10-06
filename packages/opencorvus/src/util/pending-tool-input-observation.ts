export function observePendingToolInputStructure(rawInputs: readonly string[], maxUTF16Length: number) {
  const result = {
    pendingCount: rawInputs.length,
    totalUTF16Length: 0,
    observedUTF16Length: 0,
    trimmedUTF16Length: 0,
    nonWhitespaceUTF16Length: 0,
    trailingWhitespaceUTF16Length: 0,
    states: { complete_json: 0, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 0 },
    rootFieldCount: 0,
    valueTypes: { null: 0, array: 0, object: 0, string: 0, number: 0, boolean: 0 },
    bookkeepingFailures: 0,
  }
  let remaining = maxUTF16Length
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    result.bookkeepingFailures++
    remaining = 0
  }
  for (const raw of rawInputs) {
    try {
      result.totalUTF16Length += raw.length
      if (raw.length > remaining) {
        result.states.unobserved_size_limit++
        continue
      }
      remaining -= raw.length
      result.observedUTF16Length += raw.length
      result.trimmedUTF16Length += raw.trim().length
      result.nonWhitespaceUTF16Length += raw.replace(/\s/g, "").length
      result.trailingWhitespaceUTF16Length += raw.length - raw.trimEnd().length
      if (/^[ \t\r\n]*$/.test(raw)) {
        result.states.empty++
        continue
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        result.states.syntax_error++
        continue
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        result.states.non_object++
        continue
      }
      result.states.complete_json++
      const values = Object.values(parsed)
      result.rootFieldCount += values.length
      for (const value of values) {
        if (value === null) result.valueTypes.null++
        else if (Array.isArray(value)) result.valueTypes.array++
        else if (typeof value === "object") result.valueTypes.object++
        else if (typeof value === "string") result.valueTypes.string++
        else if (typeof value === "number") result.valueTypes.number++
        else if (typeof value === "boolean") result.valueTypes.boolean++
      }
    } catch {
      result.bookkeepingFailures++
    }
  }
  return result
}
