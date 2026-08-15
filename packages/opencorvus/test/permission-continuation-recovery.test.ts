import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const DISPATCH_ACCEPTED = {
  kind: "accepted",
  session_id: "ses_recovered_worker",
  dispatch_lineage_id: "art_recovered_lineage",
} as const

/**
 * Build one durably approved, durably succeeded permission-bearing invocation
 * whose ToolPart is still open, which is exactly the state startup recovery
 * exists to converge.
 */
async function approvedInvocation(input: { directory: string; callID: string; result?: unknown }) {
  const now = Date.now()
  const session = await Session.create({ kind: "assistant", title: "Continuation recovery" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "build",
    model: { providerID: "test", modelID: "continuation-recovery" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "assistant",
    author: "build",
    parentID: user.id,
    time: { created: now + 1 },
    agent: "build",
    providerID: "test",
    modelID: "continuation-recovery",
    path: { cwd: input.directory, root: input.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const partID = Identifier.ascending("part")
  const running = await Session.updatePart({
    id: partID,
    sessionID: session.id,
    messageID: assistant.id,
    type: "tool",
    callID: input.callID,
    tool: "dispatch_agent",
    state: {
      status: "running",
      input: { target: "request-interpreter" },
      time: { start: now + 2 },
    },
  })
  const result = input.result ?? DISPATCH_ACCEPTED
  await PermissionAuthority.authorizeAndExecute(
    {
      projectID: Instance.project.id,
      sessionID: session.id,
      messageID: assistant.id,
      toolCallID: input.callID,
      toolPartID: partID,
      providerKind: "projected",
      providerID: "dispatch_agent",
      providerDigest: "projection:dispatch-agent",
      toolName: "dispatch_agent",
      args: running.state.input,
    },
    async () => result,
  )
  return { session, assistant, running, partID, start: now + 2 }
}

function ledgerEvents(eventType: (typeof PermissionLedgerTable.$inferSelect)["event_type"]) {
  return Database.use((db) =>
    db.select().from(PermissionLedgerTable).where(eq(PermissionLedgerTable.event_type, eventType)).all(),
  )
}

const TERMINAL_FAILURE = {
  kind: "tool-execution",
  name: "Error",
  message: "the dispatched worker never settled",
  originSite: "test.permission-continuation-recovery",
  classification: "tool-execution",
} as const

describe("Permission continuation recovery", () => {
  test("retires a continuation whose ToolPart already holds a terminal failure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const invocation = await approvedInvocation({ directory: project.path, callID: "dead-continuation" })
        await Session.updatePart({
          ...invocation.running,
          state: {
            status: "error",
            input: invocation.running.state.input,
            failure: TERMINAL_FAILURE,
            time: { start: invocation.start, end: invocation.start + 1 },
          },
        })

        // Recovery converges instead of throwing, and reports nothing resumed.
        expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
        expect(ledgerEvents("stale")).toMatchObject([
          { reason: expect.stringContaining("already terminal") },
        ])

        // The retired request is never rescanned by a later bootstrap.
        expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
        expect(ledgerEvents("stale")).toHaveLength(1)
      },
    })
  })

  test("isolates a faulting continuation without discarding it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const faulting = await approvedInvocation({ directory: project.path, callID: "transient-fault" })
        await approvedInvocation({ directory: project.path, callID: "healthy-continuation" })

        const resume = spyOn(SessionLoop, "resumePermissionContinuation").mockImplementation(async (request) =>
          request.sessionID === faulting.session.id
            ? Promise.reject(new Error("the continuation store is briefly unavailable"))
            : "resumed",
        )
        try {
          // The fault neither ends the scan nor retires a continuation that a
          // later attempt could still complete.
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(1)
        } finally {
          resume.mockRestore()
        }
        expect(ledgerEvents("stale")).toHaveLength(0)
      },
    })
  })

  test("keeps serving a project whose continuation recovery faults", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await approvedInvocation({ directory: project.path, callID: "faulting-recovery" })
      },
    })
    await Instance.disposeAll()

    const recovery = spyOn(PermissionAuthority, "resumeApprovedContinuations").mockRejectedValue(
      new Error("continuation recovery is unavailable"),
    )
    try {
      const served = await Instance.provide({
        directory: project.path,
        init: async () => {},
        fn: async () => "served",
      })
      expect({ served, recoveryAttempts: recovery.mock.calls.length }).toEqual({
        served: "served",
        recoveryAttempts: 1,
      })
    } finally {
      recovery.mockRestore()
    }
  })

  test("scans only the continuations owned by the admitted project", async () => {
    await using owner = await memoryProject()
    await using bystander = await memoryProject()
    await Instance.provide({
      directory: owner.path,
      fn: async () => {
        await approvedInvocation({ directory: owner.path, callID: "owned-continuation" })
      },
    })
    await Instance.provide({
      directory: bystander.path,
      fn: async () => {
        expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
        expect(ledgerEvents("stale")).toHaveLength(0)
      },
    })
  })

  test("projects the Permission receipt when the persisted Tool output diverges", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const invocation = await approvedInvocation({ directory: project.path, callID: "diverging-output" })

        // The Session normalization pipeline and the durable receipt are
        // independently derived; a disagreement must not destroy the effect.
        await Session.updatePart({
          ...invocation.running,
          state: {
            status: "completed",
            input: invocation.running.state.input,
            output: "a divergent Session-side projection",
            title: "Accepted dispatch",
            metadata: {},
            time: { start: invocation.start, end: invocation.start + 1 },
          },
        })

        const persisted = await MessageStore.get({
          sessionID: invocation.session.id,
          messageID: invocation.assistant.id,
        })
        const toolPart = persisted.parts.find(
          (part): part is Message.ToolPart => part.type === "tool" && part.callID === "diverging-output",
        )
        expect(toolPart?.state).toMatchObject({
          status: "completed",
          output: JSON.stringify(DISPATCH_ACCEPTED),
        })
      },
    })
  })
})
