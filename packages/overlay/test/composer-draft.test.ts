import { afterEach, describe, expect, test } from "bun:test"
import { reconcile } from "solid-js/store"
import {
  composerDraftKey,
  composerDraftStore,
  captureComposerDraftRevision,
  clearComposerDraftRevision,
  composerSubmission,
  forgetComposerSubmission,
  migrateProjectComposerDrafts,
  moveComposerDraft,
  nextComposerDraftRecords,
  parseComposerDraftRecords,
  pruneComposerDraftRecords,
  setComposerDraftStore,
  setComposerDraft,
  sameComposerDraftRevision,
  workspaceComposerDraftKey,
} from "../src/services/composer-draft"

afterEach(() => setComposerDraftStore("drafts", reconcile({})))

describe("composer draft records", () => {
  test("Windows launcher drafts use the same project key for equivalent directory spellings", () => {
    const canonical = composerDraftKey("launcher", "new", "c:/projects/alpha")
    expect([
      workspaceComposerDraftKey("", "", "C:\\Projects\\Alpha"),
      workspaceComposerDraftKey("", "", "c:/projects/ALPHA/"),
      workspaceComposerDraftKey("", "", "/projects/Alpha"),
      workspaceComposerDraftKey("", "ses_project", "C:/Projects/Alpha"),
    ]).toEqual([
      canonical,
      canonical,
      composerDraftKey("launcher", "new", "/projects/Alpha"),
      composerDraftKey("session", "ses_project"),
    ])
  })

  test("the project draft upgrade retains different authored sections and quotation text in order", () => {
    const first = composerDraftKey("launcher", "new", "C:\\Projects\\Alpha")
    const later = composerDraftKey("launcher", "new", "C:/Projects/ALPHA")
    const independent = composerDraftKey("launcher", "new", "/projects/Alpha")
    const conversation = composerDraftKey("session", "ses_saved")
    const independentDraft = { text: "separate project", updated: 150 }
    const sessionDraft = { text: "saved conversation reply", updated: 200 }
    expect(migrateProjectComposerDrafts({
      [later]: { text: "second launcher draft", updated: 300 },
      [independent]: independentDraft,
      [first]: {
        text: "first launcher draft",
        quotation: { text: "the original reference", sessionID: "ses_ref", messageID: "msg_ref" },
        submission: { messageID: "msg_first", text: "first exact request" },
        updated: 100,
      },
      [conversation]: sessionDraft,
    })).toEqual({
      [composerDraftKey("launcher", "new", "c:/projects/alpha")]: {
        text: "> the original reference\n\nfirst launcher draft\n\nsecond launcher draft",
        updated: 300,
      },
      [independent]: independentDraft,
      [conversation]: sessionDraft,
    })
  })

  test("the project draft upgrade keeps a single complete draft and the latest equivalent author record", () => {
    const quote = { text: "reference", sessionID: "ses_ref", messageID: "msg_ref" }
    const alpha = {
      text: "alpha question",
      quotation: quote,
      submission: { messageID: "msg_alpha", text: "alpha request" },
      updated: 100,
    }
    const beta = {
      text: "beta question",
      quotation: quote,
      submission: { messageID: "msg_beta", text: "beta request" },
      updated: 300,
    }
    expect(migrateProjectComposerDrafts({
      [composerDraftKey("launcher", "new", "C:\\Alpha")]: alpha,
      [composerDraftKey("launcher", "new", "C:/BETA/")]: { ...beta, updated: 200 },
      [composerDraftKey("launcher", "new", "C:\\Beta")]: beta,
    })).toEqual({
      [composerDraftKey("launcher", "new", "c:/alpha")]: alpha,
      [composerDraftKey("launcher", "new", "c:/beta")]: beta,
    })
  })

  test("matches independent snapshots of the same complete author revision", () => {
    setComposerDraftStore("drafts", reconcile({ source: {
      text: "author question", updated: 100,
      quotation: { text: "exact reference", sessionID: "ses_source", messageID: "msg_source" },
      submission: { messageID: "msg_request", text: "submitted question" },
    } }))
    const first = captureComposerDraftRevision("source")!
    const second = captureComposerDraftRevision("source")!
    expect(sameComposerDraftRevision(first, second)).toBe(true)
  })

  test("confirmed handoff retains the target question and consumes its unchanged source command", async () => {
    setComposerDraftStore("drafts", reconcile({ source: { text: "/side author question", updated: 100 } }))
    const source = captureComposerDraftRevision("source")!
    setComposerDraft("side", "author question")
    expect(await clearComposerDraftRevision(source)).toBe(true)
    expect(composerDraftStore.drafts).toEqual({ side: { text: "author question", updated: expect.any(Number) } })
  })

  test("confirmed handoff retains both the original target question and newer source input", async () => {
    setComposerDraftStore("drafts", reconcile({ source: { text: "/side original question", updated: 100 } }))
    const source = captureComposerDraftRevision("source")!
    setComposerDraft("source", "new independent input")
    setComposerDraft("side", "original question")
    await clearComposerDraftRevision(source)
    expect(composerDraftStore.drafts).toEqual({ source: { text: "new independent input", updated: expect.any(Number) }, side: { text: "original question", updated: expect.any(Number) } })
  })

  test("consumes the acknowledged revision while retaining independent input", async () => {
    setComposerDraftStore("drafts", reconcile({ current: { text: "accepted input", updated: 100 }, other: { text: "later work", updated: 200 } }))
    const revision = captureComposerDraftRevision("current")!
    expect(await clearComposerDraftRevision(revision)).toBe(true)
    expect(composerDraftStore.drafts).toEqual({ other: { text: "later work", updated: 200 } })
  })

  test("a late receipt preserves the current authored revision", async () => {
    setComposerDraftStore("drafts", reconcile({ current: { text: "first input", updated: 100 } }))
    const revision = captureComposerDraftRevision("current")!
    setComposerDraftStore("drafts", "current", { text: "new input", updated: 200 })
    await clearComposerDraftRevision(revision)
    expect(composerDraftStore.drafts.current).toEqual({ text: "new input", updated: 200 })
  })

  test("a late receipt preserves an independently changed quotation", async () => {
    const first = { text: "first quote", sessionID: "ses_a", messageID: "msg_a" }
    const next = { text: "new quote", sessionID: "ses_b", messageID: "msg_b" }
    setComposerDraftStore("drafts", reconcile({ current: { text: "input", quotation: first, updated: 100 } }))
    const revision = captureComposerDraftRevision("current")!
    setComposerDraftStore("drafts", "current", "quotation", next)
    await clearComposerDraftRevision(revision)
    expect(composerDraftStore.drafts.current).toEqual({ text: "input", quotation: next, updated: 100 })
  })

  test("confirmed cancellation retires only the matching identity and preserves author content", () => {
    const quotation = { text: "source", sessionID: "ses_a", messageID: "msg_a" }
    setComposerDraftStore("drafts", reconcile({ current: { text: "author prose", quotation, submission: { messageID: "msg_pending", text: "request identity" }, updated: 100 } }))
    forgetComposerSubmission("current", "msg_pending")
    expect(composerDraftStore.drafts.current).toEqual({ text: "author prose", quotation, updated: expect.any(Number) })
  })

  test("request identity survives serialization with author prose in its original field", async () => {
    setComposerDraftStore("drafts", reconcile({ current: { text: "author prose", updated: 100 } }))
    const content = JSON.stringify({ parts: [{ type: "text", text: "author prose" }], model: { providerID: "openai", modelID: "gpt-6.1-sol" } })
    const submission = await composerSubmission("current", content)
    expect(await composerSubmission("current", content)).toEqual(submission)
    expect(parseComposerDraftRecords(JSON.stringify(composerDraftStore.drafts))).toEqual({ current: { text: "author prose", updated: expect.any(Number), submission } })
  })

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
