import { afterEach, expect, test } from "bun:test"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk/client"
import { Config } from "@/config/config"
import { PermissionAuthority } from "@/permission/authority"
import { durablePendingPermissionsForSession } from "@/permission/pending-projection"
import { Instance } from "@/project/instance"
import { pendingPermissionSessionEvent } from "@/protocol/session-mirror"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { resetDatabase } from "./fixture/db"
import { tmpdir } from "./fixture/fixture"

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("hydrates one durable pending request for ACP, CLI, and protocol projections after runtime release", async () => {
  await using project = await tmpdir({ git: true })
  let sessionID = ""
  let requestID = ""
  let releasedExecution: Promise<unknown> | undefined

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const session = await Session.create({ kind: "assistant", title: "Durable permission transport" })
      sessionID = session.id
      releasedExecution = PermissionAuthority.authorizeAndExecute(
        {
          projectID: Instance.project.id,
          sessionID,
          messageID: "msg_transport_hydration",
          toolCallID: "call_transport_hydration",
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "write",
          args: { filePath: `${project.path}\\hydrated.txt`, content: "hydrated" },
        },
        async () => "hydrated",
      ).catch((error) => error)
      let request: PermissionAuthority.Request | undefined
      for (let attempt = 0; attempt < 100 && !request; attempt++) {
        request = (await PermissionAuthority.list())[0]
        if (!request) await Bun.sleep(10)
      }
      if (!request) throw new Error("Permission request was not persisted")
      requestID = request.id
    },
  })

  await Instance.disposeAll()
  expect(await releasedExecution).toBeInstanceOf(PermissionAuthority.PermissionPausedError)

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const sdk = createOpenCorvusClient({
        baseUrl: "http://opencorvus.internal",
        directory: project.path,
        fetch: (input, init) => Server.App().fetch(new Request(input, init)),
      })
      const hydrated = await durablePendingPermissionsForSession({ sdk, sessionID, directory: project.path })
      expect(hydrated).toHaveLength(1)
      expect(hydrated[0]).toMatchObject({
        id: requestID,
        sessionID,
        toolCallID: "call_transport_hydration",
        toolName: "write",
      })
      expect(pendingPermissionSessionEvent(hydrated[0]!)).toMatchObject({
        type: "permission.asked",
        summary: "Permission requested: write",
        payload: {
          id: requestID,
          sessionID,
          toolCallID: "call_transport_hydration",
          channel: "assistant",
          resolvedRole: "assistant",
        },
      })
    },
  })
})
