import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionPromptState } from "@/session/prompt/state"
import { TOOL_RESULT_CONTROL_METADATA_KEY } from "@/session/tool-result-control"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { DispatchStageRecoveryAuthorityError } from "@/agent/dispatch-stage-tool-factory"

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
 * exists to converge. The approval is an Ask-me decision: a full-access
 * invocation retires its own ledger request in the transaction that commits
 * its durable result, so only Ask-me approvals remain replay candidates.
 */
async function approvedInvocation(input: { directory: string; callID: string; result?: unknown }) {
  const now = Date.now()
  await Config.updateProjectPatch({ permission_mode: "ask" })
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
  const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) =>
    PermissionAuthority.reply({
      requestID: properties.id,
      decision: "allow_once",
      actorID: "recovery-fixture",
      autoReply: false,
    }).then(() => undefined),
  )
  try {
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
  } finally {
    stopAsked()
  }
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
  test("retires deterministic dispatch-stage reducer drift and converges the next scan", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await approvedInvocation({ directory: project.path, callID: "collector-reducer-drift" })
        const resume = spyOn(SessionLoop, "resumePermissionContinuation").mockImplementation(async (request) => {
          throw new DispatchStageRecoveryAuthorityError(request.id, "collector reducer output changed")
        })
        try {
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
          expect(ledgerEvents("stale")).toMatchObject([
            { reason: expect.stringContaining("collector reducer output changed") },
          ])
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
          expect(resume.mock.calls).toHaveLength(1)
        } finally {
          resume.mockRestore()
        }
      },
    })
  })

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
        // Only the carried continuation was retired at its conclusion; the
        // faulted one stays open and a later scan still carries it to its end.
        expect(ledgerEvents("stale")).toMatchObject([
          { reason: expect.stringContaining("persisted conclusion") },
        ])
        const retry = spyOn(SessionLoop, "resumePermissionContinuation").mockResolvedValue("resumed")
        try {
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(1)
        } finally {
          retry.mockRestore()
        }
        expect(ledgerEvents("stale")).toHaveLength(2)
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

  test("leaves a continuation owned by a live in-process Turn untouched until ownership is released", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const invocation = await approvedInvocation({ directory: project.path, callID: "live-owned" })
        // The incident state: the ToolPart concluded, the assistant Message is
        // still open, and the owning Turn is alive in this very process.
        await Session.updatePart({
          ...invocation.running,
          state: {
            status: "completed",
            input: invocation.running.state.input,
            output: JSON.stringify(DISPATCH_ACCEPTED),
            title: "Accepted dispatch",
            metadata: { [TOOL_RESULT_CONTROL_METADATA_KEY]: { kind: "immediate_park" } },
            time: { start: invocation.start, end: invocation.start + 1 },
          },
        })
        const owner = SessionPromptState.start(invocation.session.id, project.path)
        try {
          SessionPromptState.bindMessageOwner(invocation.session.id, invocation.assistant.id, owner)

          // The live Turn is the sole writer: recovery neither settles the open
          // assistant Message nor retires the request.
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
          expect(ledgerEvents("stale")).toHaveLength(0)
          const held = await MessageStore.get({
            sessionID: invocation.session.id,
            messageID: invocation.assistant.id,
          })
          expect(held.info.time.completed).toBeUndefined()
        } finally {
          await SessionPromptState.release(invocation.session.id)
        }

        // The first scan after the Turn released ownership settles the same
        // continuation and retires it.
        expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(1)
        expect(ledgerEvents("stale")).toHaveLength(1)
        const settled = await MessageStore.get({
          sessionID: invocation.session.id,
          messageID: invocation.assistant.id,
        })
        expect(settled.info.time.completed).toBeDefined()
      },
    })
  })

  test("a full-access inline execution retires its continuation with its durable result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Full access inline retirement" })
        await PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: session.id,
            messageID: "msg_full_access_inline",
            toolCallID: "call_full_access_inline",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.test/full-access" },
          },
          async () => "inline-result",
        )
        expect(ledgerEvents("stale")).toMatchObject([
          { reason: expect.stringContaining("Full-access inline execution") },
        ])

        // The retired request is invisible to recovery, so a project open never
        // replays a live session's own inline Tool calls back onto it.
        expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
        expect(ledgerEvents("stale")).toHaveLength(1)
      },
    })
  })
})
