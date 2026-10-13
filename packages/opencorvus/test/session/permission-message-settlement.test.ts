import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionPromptState } from "../../src/session/prompt/state"
import { PermissionAuthority } from "../../src/permission/authority"
import { PermissionLedgerTable } from "../../src/permission/permission.sql"
import { completedToolExecutionResult } from "../../src/session/tool-outcome-facts"
import { ProviderActivityOutcomeTable } from "../../src/session/session.sql"
import { recordProviderActivityEvent } from "../../src/session/provider-activity-facts"
import { recoverCompletedToolResult } from "../../src/session/tool-result-recovery"
import {
  withImmediateParkToolResultControl,
  withHandoffDrainToolResultControl,
} from "../../src/session/tool-result-control"
import { Database } from "../../src/storage/db"
import { completedReadResult } from "../fixture/completed-read-result"
import { permissionMessageResult } from "../fixture/permission-message-result"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

async function scope(
  fn: (value: Awaited<ReturnType<typeof permissionMessageResult>>, filePath: string) => Promise<void>,
) {
  await using project = await memoryProject()
  const filePath = path.join(path.dirname(project.path), `permission-source-${Identifier.ascending("part")}.txt`)
  await fs.writeFile(filePath, "Actual accepted tool result.\n")
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => fn(await permissionMessageResult(filePath), filePath),
    })
  } finally {
    await fs.unlink(filePath)
  }
}

async function owned<T>(sessionID: string, fn: (owner: SessionPromptOwner.Authority) => Promise<T>): Promise<T> {
  const abort = SessionPromptState.start(sessionID)
  if (!abort) throw new Error("Exact physical Prompt owner required")
  try {
    return await fn(SessionPromptOwner.current(sessionID)!)
  } finally {
    await SessionPromptState.finish(sessionID, abort)
  }
}

test("message settlement waits for all Tools and retains the abandoned Provider's actual interruption", async () => {
  await scope(async (first, filePath) => {
    const second = await completedReadResult({
      mode: "ask",
      filePath,
      session: first.session,
      message: first.assistant,
    })
    const requestID = Identifier.ascending("part"),
      now = Date.now()
    recordProviderActivityEvent(first.assistant.id, {
      type: "started",
      id: requestID,
      ts: now,
      sessionID: first.session.id,
      provider: first.assistant.providerID,
      model: first.assistant.modelID,
    })
    await owned(first.session.id, async (owner) => {
      const input = { sessionID: first.session.id, messageID: first.assistant.id, owner }
      expect(Session.completeRecoveredToolMessage(input)).toMatchObject({ status: "waiting", info: first.assistant })
      await recoverCompletedToolResult(second.part)
      const settled = Session.completeRecoveredToolMessage(input)
      expect(settled).toMatchObject({
        status: "completed",
        disposition: "continue",
        info: {
          finish: "error",
          time: { completed: expect.any(Number) },
          error: { data: { message: expect.stringContaining("Previous Prompt owner") } },
        },
      })
      expect(Database.use((db) => db.select().from(ProviderActivityOutcomeTable).all())).toMatchObject([
        { request_id: requestID, data: { outcome: "aborted", error: { name: "ProcessExecutionInterruptedError" } } },
      ])
      expect(Session.completeRecoveredToolMessage(input)).toEqual({
        ...settled,
        status: "settled",
        disposition: "continue",
      })
      expect(
        (await MessageStore.parts(first.assistant.id))
          .filter((part) => part.type === "tool")
          .map((part) => part.state.status),
      ).toEqual(["completed", "completed"])
    })
  })
})

for (const disposition of ["park", "handoff"] as const) {
  test(`all completed Tool controls retain the Message ${disposition} disposition`, async () => {
    await scope(async (value) => {
      const callID = `control-${Identifier.ascending("part")}`
      await value.processor.ensureToolPart(callID, "contract-control", {})
      await value.processor.completeRecoveredToolPart({
        toolCallID: callID,
        toolInput: {},
        output: {
          output: "Accepted control contract",
          title: "Control contract",
          metadata:
            disposition === "park"
              ? withImmediateParkToolResultControl({})
              : withHandoffDrainToolResultControl(
                  {},
                  {
                    requestID: "contract-handoff-request",
                    dispatchLineageID: "contract-dispatch-lineage",
                  },
                ),
        },
      })
      await owned(value.session.id, async (owner) => {
        const result = Session.completeRecoveredToolMessage({
          sessionID: value.session.id,
          messageID: value.assistant.id,
          owner,
        })
        expect(result).toMatchObject({ status: "completed", disposition, info: { finish: "tool-calls" } })
      })
    })
  })
}

test("settlement requires the exact current Prompt generation", async () => {
  await scope(async (value) => {
    await owned(value.session.id, async (owner) => {
      expect(() =>
        Session.completeRecoveredToolMessage({
          sessionID: value.session.id,
          messageID: value.assistant.id,
          owner: { ...owner, generation: Identifier.ascending("call") },
        }),
      ).toThrow("permission recovery owner changed before settlement")
      expect(
        Session.completeRecoveredToolMessage({ sessionID: value.session.id, messageID: value.assistant.id, owner }),
      ).toMatchObject({ status: "completed", info: { finish: "tool-calls" } })
    })
  })
})

test("approved continuation candidates retain their exact Message scope", async () => {
  await scope(async (first, filePath) => {
    const second = await completedReadResult({ mode: "ask", filePath, session: first.session })
    expect(
      PermissionAuthority.approvedMessageContinuations(first.request).map((request) => request.toolCallID),
    ).toEqual([first.callID])
    expect(
      PermissionAuthority.approvedMessageContinuations({
        sessionID: second.session.id,
        messageID: second.assistant.id,
      }).map((request) => request.toolCallID),
    ).toEqual([second.callID])
  })
})

test("repeated observations of one request resolve one canonical continuation and result", async () => {
  await scope(async (value) => {
    Database.immediateTransaction((db) => {
      const request = db
        .select()
        .from(PermissionLedgerTable)
        .all()
        .find((row) => row.event_type === "requested")!
      db.insert(PermissionLedgerTable)
        .values({ ...request, id: Identifier.ascending("permission"), time_created: Date.now() })
        .run()
    })
    expect(PermissionAuthority.approvedMessageContinuations(value.request).map((request) => request.id)).toEqual([
      value.request.id,
    ])
    expect(Database.use((db) => completedToolExecutionResult(db, value.part))?.value).toEqual(value.result)
  })
})

test("a completed Tool remains discoverable until its Message completion is durable", async () => {
  await scope(async (value) => {
    expect(await PermissionAuthority.resumeExactContinuation(value.request, async () => "resumed")).toBe("resumed")
    expect(PermissionAuthority.approvedMessageContinuations(value.request).map((request) => request.id)).toEqual([
      value.request.id,
    ])
    await owned(value.session.id, async (owner) => {
      expect(
        Session.completeRecoveredToolMessage({ sessionID: value.session.id, messageID: value.assistant.id, owner }),
      ).toMatchObject({ status: "completed", info: { time: { completed: expect.any(Number) } } })
      PermissionAuthority.retireMessageContinuations(value.request)
    })
    expect((await PermissionAuthority.history()).filter((row) => row.event_type === "stale")).toMatchObject([
      { request_id: value.request.id, reason: "The continuation reached its persisted conclusion" },
    ])
    expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(0)
  })
})

for (const mode of ["full_access", "ask"] as const) {
  test(`${mode} replay retains one requested owner and its original result`, async () => {
    await using project = await memoryProject()
    const filePath = path.join(path.dirname(project.path), `permission-replay-${Identifier.ascending("part")}.txt`)
    await fs.writeFile(filePath, "Actual replay result.\n")
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const value = await completedReadResult({ mode, filePath })
          let executions = value.executeCount()
          const replayed = await PermissionAuthority.authorizeAndExecute(
            {
              projectID: Instance.project.id,
              sessionID: value.session.id,
              messageID: value.assistant.id,
              toolCallID: value.callID,
              toolPartID: value.part.id,
              providerKind: "builtin",
              providerID: "builtin",
              toolName: "read",
              args: value.args,
            },
            async () => {
              executions++
              return value.result
            },
          )
          expect({
            replayed,
            executions,
            requested: (await PermissionAuthority.history()).filter((row) => row.event_type === "requested").length,
          }).toEqual({ replayed: value.result, executions: 1, requested: 1 })
        },
      })
    } finally {
      await fs.unlink(filePath)
    }
  })
}

test("permission recovery reports a foreign Project ownership error", async () => {
  await using other = await memoryProject()
  await scope(async (value) => {
    await Instance.provide({
      directory: other.path,
      fn: async () => {
        await expect(SessionLoop.resumePermissionContinuation(value.request)).rejects.toThrow(
          "belongs to a different Project",
        )
        expect(PermissionAuthority.approvedMessageContinuations(value.request)).toEqual([])
      },
    })
  })
})
