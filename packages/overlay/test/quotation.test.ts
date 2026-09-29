import { describe, expect, test } from "bun:test"
import { parseQuotation, quotedPrompt } from "../src/services/quotation"
import {
  nextComposerDraftRecords,
  parseComposerDraftRecords,
  composerSubmission,
  setComposerDraft,
} from "../src/services/composer-draft"

describe("quotation submission and scoped draft data", () => {
  const quotation = { text: "第一行\n\n`second line`", sessionID: "ses_source", messageID: "msg_source" }
  test("serializes the exact quotation and question as visible Markdown", () => {
    expect(quotedPrompt("为什么？", quotation)).toBe("> 第一行\n> \n> `second line`\n\n为什么？")
    expect(quotedPrompt("Plain question")).toBe("Plain question")
    expect(parseQuotation(quotation)).toEqual(quotation)
  })
  test("restores quotation-only drafts with source identity and preserves it while editing", () => {
    const restored = parseComposerDraftRecords(JSON.stringify({ main: { text: "", updated: 1, quotation } }))
    expect(restored).toEqual({ main: { text: "", updated: 1, quotation } })
    const edited = nextComposerDraftRecords({ records: restored, key: "main", text: "Explain", updated: 2 })
    expect(edited).toEqual({ main: { text: "Explain", updated: 2, quotation } })
    const side = nextComposerDraftRecords({ records: edited, key: "side", text: "Side question", updated: 3 })
    expect(side).toEqual({
      main: { text: "Explain", updated: 2, quotation },
      side: { text: "Side question", updated: 3 },
    })
  })
  test("an unchanged submission retains its identity through retries and serialized draft restoration", () => {
    setComposerDraft("side-retry", "Explain")
    const first = composerSubmission("side-retry", quotedPrompt("Explain", quotation))
    expect(composerSubmission("side-retry", first.text)).toEqual(first)
    expect(
      parseComposerDraftRecords(JSON.stringify({ side: { text: "Explain", updated: 1, quotation, submission: first } }))
        .side?.submission,
    ).toEqual(first)
    const revised = composerSubmission("side-retry", quotedPrompt("Explain in Chinese", quotation))
    expect(new Set([first.messageID, revised.messageID]).size).toBe(2)
  })
})
