import { expect, test } from "bun:test"
import { loadOlderConversationHistory } from "../src/services/conversation"
import { ApiAuthorityChangedError, captureApiAuthority, renewApiAuthority } from "../src/services/api-state"
import type { BoardSource } from "../src/store/board"

test("current authority and an empty history source resolve to the original false result", async () => {
  const request = loadOlderConversationHistory(null, captureApiAuthority())
  expect(request).toBeInstanceOf(Promise)
  expect(await request).toBe(false)
})

for (const source of [null, { kind: "session", id: "ses_retired" }, { kind: "session", id: "ses_mission_retired", sessionKind: "mission" }, { kind: "task", id: "task_retired" }] satisfies (BoardSource | null)[]) {
  test(`retired authority for ${source ? `${source.kind}:${source.id}` : "empty"} history rejects with the public typed error`, async () => {
    const authority = captureApiAuthority()
    renewApiAuthority()
    const current = captureApiAuthority()
    const request = loadOlderConversationHistory(source, authority)
    expect(request).toBeInstanceOf(Promise)
    const error = await request.catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiAuthorityChangedError)
    expect(error).toMatchObject({
      name: "ApiAuthorityChangedError",
      phase: "before_dispatch",
      expectedRevision: authority.revision,
      currentRevision: current.revision,
      outcome: { phase: "before_dispatch" },
    })
  })
}
