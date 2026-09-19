import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { AttachmentRoutes } from "@/server/routes/attachment"
import { MissionRoutes } from "@/server/routes/mission"
import { serverErrorResponse } from "@/server/error-handler"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { configure, getServerUrl } from "../../../overlay/src/services/api"
import { uploadComposerBytes, uploadComposerDirectoryReference } from "../../../overlay/src/services/attachment-upload"
import { wakeMission } from "../../../overlay/src/services/mission"

afterEach(resetMemoryDatabase)

test("admits uploaded file and folder references from the Mission client and persists both on create and follow-up", async () => {
  await using project = await memoryProject()
  const model = "attachment-ingress/local-model"
  await Instance.provide({
    directory: project.path,
    fn: () =>
      Config.updateProjectPatch({
        model,
        provider: {
          "attachment-ingress": {
            name: "Attachment admission test",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              "local-model": {
                name: "Attachment admission model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            },
          },
        },
      }),
  })
  await provideInitializedProjectExecution({
    directory: project.path,
    fn: async () => {
      // Exercise upload, HTTP validation, admission and persistence; provider execution is outside this contract.
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      const app = new Hono()
        .onError(serverErrorResponse)
        .route("/attachment", AttachmentRoutes())
        .route("/mission", MissionRoutes())
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: (request) => Instance.provide({ directory: project.path, fn: () => app.fetch(request) }),
      })
      const previousServerUrl = getServerUrl()
      configure({ serverUrl: server.url.toString() })
      try {
        const bytes = new TextEncoder().encode("Mission attachment bytes")
        const file = await uploadComposerBytes({
          bytes,
          mime: "text/plain",
          filename: "证据.txt",
          directory: project.path,
        })
        const folder = await uploadComposerDirectoryReference(project.path, project.path)
        const attachments = [{ ...file, kind: "file" as const }, folder]
        const input = {
          directory: project.path,
          productPillar: "work" as const,
          model,
          expertSquadIDs: ["base"],
          attachments,
        }
        const created = await wakeMission({ ...input, text: "Use these attachments." })
        const resumed = await wakeMission({
          ...input,
          missionID: created.missionID,
          text: "Use these attachments again.",
        })
        expect({ created: created.created, resumed: resumed.created, sessionID: resumed.sessionID }).toEqual({
          created: true,
          resumed: false,
          sessionID: created.sessionID,
        })
        const messages = (await Session.messages({ sessionID: created.sessionID })).filter(
          (entry) => entry.info.role === "user",
        )
        expect(messages).toHaveLength(2)
        const expected = attachments.map((attachment) => ({
          type: "file",
          url: attachment.url,
          mime: attachment.mime,
          filename: attachment.filename,
          presentation: "attachment-index",
        }))
        for (const message of messages) {
          expect(
            message.parts
              .filter((part) => part.type === "file")
              .map((part) => ({
                type: part.type,
                url: part.url,
                mime: part.mime,
                filename: part.filename,
                presentation: part.presentation,
              })),
          ).toEqual(expected)
        }
        const downloaded = await fetch(new URL(file.url, server.url))
        expect(downloaded.status).toBe(200)
        expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes)
        const manifest = await fetch(new URL(folder.url, server.url))
        expect(manifest.status).toBe(200)
        expect(await manifest.json()).toEqual({ version: 1, kind: "directory", path: project.path })
      } finally {
        configure({ serverUrl: previousServerUrl })
        await server.stop(true)
      }
    },
  })
})
