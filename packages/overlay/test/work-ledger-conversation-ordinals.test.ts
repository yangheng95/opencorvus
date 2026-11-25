import { expect, test } from "bun:test"
import {
  workLedgerConversationOrdinals,
  workLedgerConversationTitle,
  type WorkLedgerChatRow,
} from "../src/services/work-ledger"

test("matching conversation titles use creation order independently of result order and repeated rows", () => {
  const base: WorkLedgerChatRow = {
    kind: "chat",
    experience: "work",
    id: "older",
    sessionID: "older",
    title: "Packing checklist handoff",
    directory: "C:/project",
    created: 10,
    started: 10,
    updated: 40,
    pinned: false,
    status: "idle",
  }
  const equallyOld = { ...base, id: "coincident", sessionID: "coincident" }
  const newer = { ...base, id: "newer", sessionID: "newer", created: 20, started: 20 }
  const unique = { ...base, id: "unique", sessionID: "unique", title: "Dispatch checklist" }
  const order = workLedgerConversationOrdinals([newer, unique, base, equallyOld, base])

  expect([...order]).toEqual([["coincident", 1], ["older", 2], ["newer", 3]])
  expect(workLedgerConversationOrdinals([equallyOld, base, newer])).toEqual(order)
  expect(workLedgerConversationTitle(unique, order.get(unique.id))).toBe("Dispatch checklist")
})
