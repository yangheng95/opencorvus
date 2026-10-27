import { expect, test } from "bun:test"
import { createMailboxRequestOwner } from "../src/components/mailbox-request-owner"

test("a current Mailbox query owns its base and subsequent page commits", () => {
  const owner = createMailboxRequestOwner()
  const scope = { authority: { revision: 1 }, view: "active", search: "original" }
  let projection: string[] = []
  const base = owner.beginBase(scope, () => { projection = ["loading"] })
  expect({ changed: base.scopeChanged, projection }).toEqual({ changed: true, projection: ["loading"] })
  base.request.commit(scope, () => { projection = ["page one"] })
  const next = owner.join(scope)
  next.commit(scope, () => { projection.push("page two") })
  expect(projection).toEqual(["page one", "page two"])
  next.complete()
  base.request.complete()
})

test("query replacement aborts the prior signal and commits the replacement scope", () => {
  const owner = createMailboxRequestOwner()
  const firstScope = { authority: { revision: 1 }, view: "active", search: "first" }
  const secondScope = { ...firstScope, search: "second" }
  let projection = ""
  const first = owner.beginBase(firstScope, () => { projection = "first loading" })
  const second = owner.beginBase(secondScope, () => { projection = "second loading" })
  expect({ aborted: first.request.signal.aborted, changed: second.scopeChanged, projection })
    .toEqual({ aborted: true, changed: true, projection: "second loading" })
  second.request.commit(secondScope, () => { projection = "second result" })
  expect(projection).toBe("second result")
  second.request.complete()
})

test("same-query revalidation keeps the accepted projection until its fresh commit", () => {
  const owner = createMailboxRequestOwner()
  const scope = { authority: { revision: 1 }, view: "active", search: "511" }
  let projection = ""
  const first = owner.beginBase(scope, () => { projection = "initial loading" })
  first.request.commit(scope, () => { projection = "accepted history" })
  first.request.complete()
  const refresh = owner.beginBase(scope, () => { projection = "new scope loading" })
  expect({ changed: refresh.scopeChanged, projection }).toEqual({ changed: false, projection: "accepted history" })
  refresh.request.commit(scope, () => { projection = "confirmed read history" })
  expect(projection).toBe("confirmed read history")
  refresh.request.complete()
})

test("a fresh capture of the same connection keeps the accepted global Mailbox range", () => {
  const owner = createMailboxRequestOwner()
  const scope = { authority: { revision: 7 }, view: "active", search: "" }
  let projection = ""
  const first = owner.beginBase(scope, () => { projection = "loading" })
  first.request.commit(scope, () => { projection = "146 original messages" })
  first.request.complete()
  const captured = { ...scope, authority: { revision: 7 } }
  const refresh = owner.beginBase(captured, () => { projection = "replacement loading" })
  expect({ changed: refresh.scopeChanged, projection }).toEqual({ changed: false, projection: "146 original messages" })
  const next = owner.join(captured)
  next.commit(captured, () => { projection = "confirmed global history" })
  expect(projection).toBe("confirmed global history")
  next.complete()
  refresh.request.complete()
})

test("connection rotation retires old requests and commits the new authority", () => {
  const owner = createMailboxRequestOwner()
  const scope = { authority: { revision: 7 }, view: "active", search: "511" }
  let projection = ""
  const first = owner.beginBase(scope, () => { projection = "first loading" })
  const replacement = { ...scope, authority: { revision: 8 } }
  const second = owner.beginBase(replacement, () => { projection = "new connection loading" })
  expect({ aborted: first.request.signal.aborted, changed: second.scopeChanged, projection })
    .toEqual({ aborted: true, changed: true, projection: "new connection loading" })
  second.request.commit(replacement, () => { projection = "new connection result" })
  expect(projection).toBe("new connection result")
  second.request.complete()
})
