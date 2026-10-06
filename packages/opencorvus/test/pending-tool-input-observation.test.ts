import { expect, test } from "bun:test"
import { observePendingToolInputStructure } from "@/util/pending-tool-input-observation"

test("aggregates complete JSON root value types and exact Unicode/whitespace lengths", () => {
  const raw = '{"a":null,"b":[],"c":{},"d":"🙂","e":2,"f":true} \n'
  expect(observePendingToolInputStructure([raw], raw.length)).toEqual({
    pendingCount: 1,
    totalUTF16Length: 50,
    observedUTF16Length: 50,
    trimmedUTF16Length: 48,
    nonWhitespaceUTF16Length: 48,
    trailingWhitespaceUTF16Length: 2,
    states: { complete_json: 1, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 0 },
    rootFieldCount: 6,
    valueTypes: { null: 1, array: 1, object: 1, string: 1, number: 1, boolean: 1 },
    bookkeepingFailures: 0,
  })
})

test("classifies native syntax, non-object and JSON-only empty inputs without trimming the parser input", () => {
  expect(observePendingToolInputStructure(["{", "[]", "null", "1", '"x"', "", " \t\r\n", "\u00a0"], 100)).toEqual({
    pendingCount: 8,
    totalUTF16Length: 16,
    observedUTF16Length: 16,
    trimmedUTF16Length: 11,
    nonWhitespaceUTF16Length: 11,
    trailingWhitespaceUTF16Length: 5,
    states: { complete_json: 0, syntax_error: 2, non_object: 4, empty: 2, unobserved_size_limit: 0 },
    rootFieldCount: 0,
    valueTypes: { null: 0, array: 0, object: 0, string: 0, number: 0, boolean: 0 },
    bookkeepingFailures: 0,
  })
})

test("shares one whole-input budget and observes later fitting drafts after an oversized draft", () => {
  expect(observePendingToolInputStructure(["{}", '{"large":1}', "{}", " "], 4)).toEqual({
    pendingCount: 4,
    totalUTF16Length: 16,
    observedUTF16Length: 4,
    trimmedUTF16Length: 4,
    nonWhitespaceUTF16Length: 4,
    trailingWhitespaceUTF16Length: 0,
    states: { complete_json: 2, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 2 },
    rootFieldCount: 0,
    valueTypes: { null: 0, array: 0, object: 0, string: 0, number: 0, boolean: 0 },
    bookkeepingFailures: 0,
  })
  expect(observePendingToolInputStructure(["{}", ""], 0).states).toEqual({
    complete_json: 0,
    syntax_error: 0,
    non_object: 0,
    empty: 1,
    unobserved_size_limit: 1,
  })
})

test("records an invalid diagnostic budget as bookkeeping failure while retaining exact pending lengths", () => {
  expect(observePendingToolInputStructure(["{}"], -1)).toEqual({
    pendingCount: 1,
    totalUTF16Length: 2,
    observedUTF16Length: 0,
    trimmedUTF16Length: 0,
    nonWhitespaceUTF16Length: 0,
    trailingWhitespaceUTF16Length: 0,
    states: { complete_json: 0, syntax_error: 0, non_object: 0, empty: 0, unobserved_size_limit: 1 },
    rootFieldCount: 0,
    valueTypes: { null: 0, array: 0, object: 0, string: 0, number: 0, boolean: 0 },
    bookkeepingFailures: 1,
  })
})
