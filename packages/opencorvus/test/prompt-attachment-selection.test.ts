import { expect, test } from "bun:test"
import { PromptAttachmentReferenceError, requirePromptAttachments, selectPromptAttachments } from "../src/agent/prompt-projection"

test("strict Task attachment selection resolves canonical URL and hash identities", () => {
  const first = { url: "/attachment/project/a.png", sha: "a".repeat(64), mime: "image/png", size: 12 }
  const second = { url: "/attachment/project/b.txt", sha: "b".repeat(64), mime: "text/plain", size: 6 }
  expect(requirePromptAttachments([first, second], [second.sha, first.url, first.sha])).toEqual([first, second])
  expect(requirePromptAttachments([first, second], [])).toEqual([])
  expect(selectPromptAttachments([first], [first.url, "msg_unrelated"])).toEqual({ attachments: [first], missingRefs: ["msg_unrelated"] })
})

test("missing or foreign Task references produce the precise correction error", () => {
  for (const refs of [["msg_worker_final"], ["/attachment/other/task.txt"], ["c".repeat(64)]]) {
    let caught: unknown
    try { requirePromptAttachments([], refs) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(PromptAttachmentReferenceError)
    expect(caught).toMatchObject({ name: "PromptAttachmentReferenceError", missingRefs: refs })
  }
})
