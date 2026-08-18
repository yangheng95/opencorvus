import { afterAll, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { Identifier } from "@/id/id"
import { assertSessionDeleteTargets } from "@/cli/cmd/session"
import { Database } from "@/storage/db"
import { ControlMessage } from "@/control/message"
import {
  assertPublicSessionCreateAuthority,
  assertPublicSessionOperationAuthority,
  MissionSessionAuthorityError,
  type MissionPublicSessionOperation,
} from "@/mission/public-session-authority"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { TaskQueueTable } from "@/scheduler/task-queue.sql"
import { serverErrorResponse } from "@/server/error-handler"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { PanelRoutes } from "@/server/routes/panel"
import { SessionRoutes } from "@/server/routes/session"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { createPanelUIRequestToolContext, PanelTool } from "@/tool/panel"
import { resetMemoryDatabase, memoryProject } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

function authorityData(run: () => void) {
  try {
    run()
    throw new Error("Expected Mission Session authority result")
  } catch (error) {
    expect(error).toBeInstanceOf(MissionSessionAuthorityError)
    return (error as InstanceType<typeof MissionSessionAuthorityError>).toObject().data
  }
}

describe("Mission public Session authority", () => {
  test("maps every generic Mission execution and lifecycle operation to its canonical operation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "public-session-authority-map",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const operations: Array<
          [MissionPublicSessionOperation, "mission.wake" | "mission.abort" | "mission.delete" | "mission.setArchived"]
        > = [
          ["session.fork", "mission.wake"],
          ["session.prompt", "mission.wake"],
          ["session.prompt_async", "mission.wake"],
          ["session.init", "mission.wake"],
          ["session.summarize", "mission.wake"],
          ["session.command", "mission.wake"],
          ["session.shell", "mission.wake"],
          ["session.abort", "mission.abort"],
          ["session.delete", "mission.delete"],
          ["session.archive", "mission.setArchived"],
          ["task_queue.prompt", "mission.wake"],
          ["task_queue.compaction", "mission.wake"],
        ]

        for (const [operation, canonicalOperation] of operations) {
          expect(authorityData(() => assertPublicSessionOperationAuthority(mission, operation))).toEqual({
            message: `${operation} cannot control a Mission Session; use ${canonicalOperation}.`,
            operation,
            canonicalOperation,
            sessionID: mission.id,
            missionID: mission.missionID,
          })
        }
        expect(authorityData(() => assertPublicSessionCreateAuthority("mission"))).toEqual({
          message: "session.create cannot control a Mission Session; use mission.createDraft.",
          operation: "session.create",
          canonicalOperation: "mission.createDraft",
        })
      },
    })
  })

  test("serializes canonical authority from every generic Mission execution and lifecycle route", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "public-session-route-authority",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const app = new Hono().route("/session", SessionRoutes())
        app.onError(serverErrorResponse)
        const fetch = (request: Request) =>
          PersistedProjectContext.provide({ directory: project.path, fn: () => app.fetch(request) })

        const create = await fetch(
          new Request("http://opencorvus.test/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "mission" }),
          }),
        )
        expect({ status: create.status, body: await create.json() }).toEqual({
          status: 409,
          body: {
            name: "MissionSessionAuthorityError",
            data: {
              message: "session.create cannot control a Mission Session; use mission.createDraft.",
              operation: "session.create",
              canonicalOperation: "mission.createDraft",
            },
          },
        })

        const assistantCreate = await fetch(
          new Request("http://opencorvus.test/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "assistant", title: "Ordinary Assistant authority" }),
          }),
        )
        expect({ status: assistantCreate.status, body: await assistantCreate.json() }).toMatchObject({
          status: 200,
          body: { kind: "assistant", title: "Ordinary Assistant authority", directory: project.path },
        })

        const routes: Array<{
          operation: Exclude<MissionPublicSessionOperation, "session.create" | "task_queue.prompt" | "task_queue.compaction">
          canonicalOperation: "mission.wake" | "mission.abort" | "mission.delete" | "mission.setArchived"
          method: "POST" | "PATCH" | "DELETE"
          suffix: string
          body?: unknown
        }> = [
          { operation: "session.fork", canonicalOperation: "mission.wake", method: "POST", suffix: "/fork", body: {} },
          {
            operation: "session.prompt",
            canonicalOperation: "mission.wake",
            method: "POST",
            suffix: "/message",
            body: { parts: [{ type: "text", text: "Continue through Mission authority." }] },
          },
          {
            operation: "session.init",
            canonicalOperation: "mission.wake",
            method: "POST",
            suffix: "/init",
            body: {
              providerID: "firmware",
              modelID: "gpt-5",
              messageID: Identifier.ascending("message"),
            },
          },
          {
            operation: "session.summarize",
            canonicalOperation: "mission.wake",
            method: "POST",
            suffix: "/summarize",
            body: { providerID: "firmware", modelID: "gpt-5" },
          },
          {
            operation: "session.command",
            canonicalOperation: "mission.wake",
            method: "POST",
            suffix: "/command",
            body: { command: "init", arguments: "" },
          },
          {
            operation: "session.shell",
            canonicalOperation: "mission.wake",
            method: "POST",
            suffix: "/shell",
            body: { agent: "mission", command: "pwd" },
          },
          { operation: "session.abort", canonicalOperation: "mission.abort", method: "POST", suffix: "/abort" },
          { operation: "session.delete", canonicalOperation: "mission.delete", method: "DELETE", suffix: "" },
          {
            operation: "session.archive",
            canonicalOperation: "mission.setArchived",
            method: "PATCH",
            suffix: "",
            body: { time: { archived: Date.now() } },
          },
        ]

        for (const route of routes) {
          const response = await fetch(
            new Request(`http://opencorvus.test/session/${mission.id}${route.suffix}`, {
              method: route.method,
              ...(route.body === undefined
                ? {}
                : {
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(route.body),
                  }),
            }),
          )
          expect({ status: response.status, body: await response.json() }).toEqual({
            status: 409,
            body: {
              name: "MissionSessionAuthorityError",
              data: {
                message: `${route.operation} cannot control a Mission Session; use ${route.canonicalOperation}.`,
                operation: route.operation,
                canonicalOperation: route.canonicalOperation,
                sessionID: mission.id,
                missionID: mission.missionID,
              },
            },
          })
        }
      },
    })
  }, 0)

  test("serializes Mission authority from reusable Panel messages and shared Session mutations", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "panel-public-session-authority",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const app = new Hono().route("/panel", PanelRoutes())
        app.onError(serverErrorResponse)
        const body = { surface: "panel", sessionID: mission.id, text: "Continue through Mission authority." }

        for (const suffix of ["/message", "/message/stream"]) {
          const response = await app.fetch(
            new Request(`http://opencorvus.test/panel${suffix}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
          )
          expect({ suffix, status: response.status, body: await response.json() }).toEqual({
            suffix,
            status: 409,
            body: {
              name: "MissionSessionAuthorityError",
              data: {
                message: "session.prompt cannot control a Mission Session; use mission.wake.",
                operation: "session.prompt",
                canonicalOperation: "mission.wake",
                sessionID: mission.id,
                missionID: mission.missionID,
              },
            },
          })
        }

        await expect(ControlMessage.handle(body)).rejects.toMatchObject({
          name: "MissionSessionAuthorityError",
          data: { operation: "session.prompt", canonicalOperation: "mission.wake", sessionID: mission.id },
        })

        const panel = await PanelTool.init({ agentID: "panel_ui" })
        const context = createPanelUIRequestToolContext({
          surface: "panel",
          requestID: crypto.randomUUID(),
        })
        await expect(panel.execute({ action: "fork_session", sessionID: mission.id }, context)).rejects.toMatchObject({
          name: "MissionSessionAuthorityError",
          data: { operation: "session.fork", canonicalOperation: "mission.wake", sessionID: mission.id },
        })
        await expect(panel.execute({ action: "delete_session", sessionID: mission.id }, context)).rejects.toMatchObject({
          name: "MissionSessionAuthorityError",
          data: { operation: "session.delete", canonicalOperation: "mission.delete", sessionID: mission.id },
        })
        expect(authorityData(() => assertSessionDeleteTargets([mission]))).toMatchObject({
          operation: "session.delete",
          canonicalOperation: "mission.delete",
          sessionID: mission.id,
          missionID: mission.missionID,
        })
      },
    })
  })

})
