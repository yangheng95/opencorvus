import { expect, test } from "bun:test"
import { readConversationSnapshot } from "../src/services/conversation-snapshot"
import { findConversationMessages } from "../src/services/conversation-search"
import { ConversationHistoryPageReader } from "../src/services/conversation-history-page-reader"

const time = Date.UTC(2026, 9, 28, 6)
const session = { id: "ses_search", title: "搜索", time: { created: time, updated: time } }
const message = (id: string, body: string, author = "user") => ({
  info: { id, sessionID: session.id, role: "user", author, time: { created: time } },
  parts: [{ type: "text", text: body }],
})

test("complete snapshot search returns actual message identities, authors and Unicode text in producer order", () => {
  const snapshot = readConversationSnapshot({ session, messages: [message("m1", "中文🙂 Alpha 引用"), message("m2", "ALPHA 原始输出", "work")] }, session.id)
  expect(findConversationMessages(snapshot, " alpha ")).toEqual([
    { id: "m1", author: "user", created: time, preview: "中文🙂 Alpha 引用" },
    { id: "m2", author: "work", created: time, preview: "ALPHA 原始输出" },
  ])
})

test("a match beyond the initial history window retains its exact source message", () => {
  const messages = Array.from({ length: 121 }, (_, i) => message(`m${i}`, i === 120 ? "最后一页 唯一目标🙂" : `原消息 ${i}`))
  const snapshot = readConversationSnapshot({ session, messages }, session.id)
  expect(findConversationMessages(snapshot, "唯一目标")).toEqual([{ id: "m120", author: "user", created: time, preview: "最后一页 唯一目标🙂" }])
})

test("structured stop reason is searchable as its original error text", () => {
  const original = message("m_stop", "已输出部分", "chat")
  const info = { ...original.info, role: "assistant", error: { name: "MessageAbortedError", data: { message: "session aborted" } } }
  expect(findConversationMessages(readConversationSnapshot({ session, messages: [{ ...original, info }] }, session.id), "aborted"))
    .toEqual([{ id: "m_stop", author: "chat", created: time, preview: "已输出部分 session aborted" }])
})

test("case folding before a Unicode match keeps readable context intact", () => {
  const text = "İ 中文🙂 needle 后续"
  expect(findConversationMessages(readConversationSnapshot({ session, messages: [message("m_unicode", text)] }, session.id), "needle"))
    .toEqual([{ id: "m_unicode", author: "user", created: time, preview: text }])
})

test("scroll and explicit navigation receive the same source-owned page promise", async () => {
  const reader = new ConversationHistoryPageReader()
  const first = reader.read("session:a:authority:1", async () => true)
  const navigation = reader.read("session:a:authority:1", async () => true)
  expect(navigation).toBe(first)
  expect(await Promise.all([first, navigation])).toEqual([true, true])
})

test("completion of an earlier source preserves the current source page owner", async () => {
  const reader = new ConversationHistoryPageReader()
  let finishA!: (value: boolean) => void, finishB!: (value: boolean) => void
  const a = reader.read("session:a:authority:1", () => new Promise(resolve => { finishA = resolve }))
  const b = reader.read("session:b:authority:2", () => new Promise(resolve => { finishB = resolve }))
  await Promise.resolve()
  finishA(true)
  expect(await a).toBe(true)
  const joinedB = reader.read("session:b:authority:2", async () => true)
  expect(joinedB).toBe(b)
  finishB(true)
  expect(await joinedB).toBe(true)
  expect(await reader.read("session:b:authority:2", async () => true)).toBe(true)
})

test("a failed page retains its original error and the same scope can read a new page", async () => {
  const reader = new ConversationHistoryPageReader(), failure = new TypeError("history page unavailable")
  let caught: unknown
  try { await reader.read("session:a:authority:1", async () => { throw failure }) } catch (error) { caught = error }
  expect(caught).toBe(failure)
  expect(await reader.read("session:a:authority:1", async () => true)).toBe(true)
})
