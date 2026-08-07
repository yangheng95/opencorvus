import { describe, expect, test } from "bun:test"
import {
  composerDraftKey,
  nextComposerDraftRecords,
  parseComposerDraftRecords,
  pruneComposerDraftRecords,
} from "../src/services/composer-draft"

describe("composer draft records", () => {
  test("saves draft text under the task or mission key", () => {
    const key = composerDraftKey("task", "tsk_1")
    const records = nextComposerDraftRecords({
      records: {},
      key,
      text: "continue this task",
      updated: 100,
    })

    expect(records[key]).toEqual({ text: "continue this task", updated: 100 })
  })

  test("empty text clears the scoped draft", () => {
    const key = composerDraftKey("mission", "session", "ses_1")
    const records = nextComposerDraftRecords({
      records: { [key]: { text: "mission note", updated: 100 } },
      key,
      text: "",
      updated: 200,
    })

    expect(records[key]).toBeUndefined()
  })

  test("retains the newest scoped drafts when trimming the cache", () => {
    const records = pruneComposerDraftRecords(
      {
        older: { text: "older", updated: 10 },
        newest: { text: "newest", updated: 30 },
        middle: { text: "middle", updated: 20 },
      },
      2,
    )

    expect(Object.keys(records)).toEqual(["newest", "middle"])
  })

  test("parses only persisted draft entries with text and timestamp", () => {
    const parsed = parseComposerDraftRecords(
      JSON.stringify({
        good: { text: "draft", updated: 100 },
        emptyObject: {},
        wrongText: { text: 1, updated: 100 },
        wrongUpdated: { text: "draft", updated: "now" },
      }),
    )

    expect(parsed).toEqual({ good: { text: "draft", updated: 100 } })
  })

  test("treats corrupt persisted JSON as empty draft state", () => {
    expect(parseComposerDraftRecords("{not json")).toEqual({})
  })
})
