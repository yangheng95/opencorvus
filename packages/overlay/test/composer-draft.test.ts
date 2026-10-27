import { afterEach, describe, expect, test } from "bun:test"
import { reconcile } from "solid-js/store"
import {
  composerDraftKey,
  composerDraftStore,
  moveComposerDraft,
  nextComposerDraftRecords,
  parseComposerDraftRecords,
  pruneComposerDraftRecords,
  setComposerDraftStore,
  workspaceComposerDraftKey,
} from "../src/services/composer-draft"

afterEach(() => setComposerDraftStore("drafts", reconcile({})))

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
      records: { [key]: { text: "mission note", updated: 100 }, other: { text: "another conversation", updated: 90 } },
      key,
      text: "",
      updated: 200,
    })

    expect(records).toEqual({ other: { text: "another conversation", updated: 90 } })
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

  test("transfers the latest launcher text and quotation to its allocated project scope", () => {
    const source = workspaceComposerDraftKey("", "", "")
    const target = workspaceComposerDraftKey("", "", "D:/allocated-project")
    const quotation = { text: "source material", sessionID: "ses_source", messageID: "msg_source" }
    const other = { text: "independent task input", updated: 90 }
    setComposerDraftStore(
      "drafts",
      reconcile({
        [source]: {
          text: "latest recorded input",
          quotation,
          submission: { messageID: "msg_pending", text: "latest recorded input" },
          updated: 100,
        },
        other,
      }),
    )

    moveComposerDraft(` ${source} `, ` ${target} `)

    expect(composerDraftStore.drafts).toEqual({
      [target]: { text: "latest recorded input", quotation, updated: expect.any(Number) },
      other,
    })
  })

  test("transfers allocated project input to the new session scope", () => {
    const source = workspaceComposerDraftKey("", "", "D:/allocated-project")
    const target = workspaceComposerDraftKey("", "ses_created", "")
    setComposerDraftStore("drafts", reconcile({ [source]: { text: "session input", updated: 100 } }))

    moveComposerDraft(source, target)

    expect(composerDraftStore.drafts).toEqual({
      [target]: { text: "session input", updated: expect.any(Number) },
    })
  })

  test("transfers quotation-only records to the admitted scope", () => {
    const quotation = { text: "selected material", sessionID: "ses_source", messageID: "msg_source" }
    setComposerDraftStore("drafts", reconcile({ source: { text: "", quotation, updated: 100 } }))

    moveComposerDraft("source", "target")

    expect(composerDraftStore.drafts).toEqual({
      target: { text: "", quotation, updated: expect.any(Number) },
    })
  })

  test("retains independently authored source and destination records", () => {
    const source = { text: "launcher input", updated: 100 }
    const target = { text: "project input", updated: 200 }
    setComposerDraftStore("drafts", reconcile({ source, target }))

    moveComposerDraft("source", "target")

    expect(composerDraftStore.drafts).toEqual({ source, target })
  })
})
