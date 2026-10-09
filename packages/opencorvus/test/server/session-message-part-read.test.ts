import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "../../src/config/paths"
import { ensureMissionSession } from "../../src/mission/session"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test.each(["assistant", "mission"] as const)(
  "cold %s root and child message reads return complete persisted tools",
  async (kind) => {
    await using project = await memoryProject(`historical-tool-${kind}`)
    await using foreign = await memoryProject(`historical-tool-foreign-${kind}`)
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: "historical-tool",
                defaultCwd: project.path,
                productPillar: "code",
                heldExpertSquadIDs: ["base"],
              })
            : await Session.create({ kind, title: "Exact Tool Part read" })
        const child = await Session.create({ kind: "assistant", parentID: root.id, title: "Historical child" })
        const result = []
        for (const session of [root, child]) {
          const user = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "test-agent",
            time: { created: 1 },
            model: { providerID: "historical", modelID: "historical" },
          })
          const message = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "assistant",
            author: "test-agent",
            time: { created: 1 },
            parentID: user.id,
            modelID: "test-model",
            providerID: "test-provider",
            mode: "test",
            agent: "test-agent",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 3, input: 1, output: 1, reasoning: 1, cache: { read: 0, write: 0 } },
          })
          const output = "exact persisted output\n".repeat(400)
          const target = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: message.id,
            type: "tool",
            callID: Identifier.ascending("tool"),
            tool: "artifact_read",
            state: {
              status: "completed",
              input: { locator: "artifact://deliverable/report.md" },
              output,
              title: "Read report",
              metadata: { source: "test" },
              time: { start: 1, end: 2 },
            },
          })
          const answer = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: message.id,
            type: "text",
            text: "Sibling answer",
          })

          result.push({ session, user, message, target, answer, output })
        }
        return result
      },
    })
    const configPath = ConfigPaths.projectFile(project.path)
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(
      configPath,
      JSON.stringify({ model: "historical-unavailable/model", small_model: "historical-unavailable/model" }),
    )
    await Instance.disposeAll()
    const headers = { "x-opencorvus-directory": project.path }
    for (const entry of saved) {
      const base = `/session/${entry.session.id}/message`
      const routes = [base, `${base}/${entry.message.id}`, `${base}/${entry.message.id}/part/${entry.target.id}`]
      for (const [index, route] of routes.entries()) {
        await Instance.disposeAll()
        const response = await runOutsideInstanceContext(() => Server.App().request(route, { headers }))
        const body = await response.json()
        expect(response.status).toBe(200)
        const message =
          index === 0 ? body.find((item: { info: { id: string } }) => item.info.id === entry.message.id) : body
        const part = index === 2 ? body : message.parts.find((part: { id: string }) => part.id === entry.target.id)
        expect(part).toEqual({
          ...entry.target,
          state: {
            status: "completed",
            input: { locator: "artifact://deliverable/report.md" },
            output: entry.output,
            title: "Read report",
            metadata: { source: "test" },
            time: { start: 1, end: 2 },
          },
        })
        if (index < 2) {
          expect(message.info).toMatchObject({
            id: entry.message.id,
            sessionID: entry.session.id,
            parentID: entry.user.id,
          })
          expect(message.parts.find((part: { id: string }) => part.id === entry.answer.id)).toMatchObject({
            type: "text",
            text: "Sibling answer",
          })
        }
        const foreignResponse = await runOutsideInstanceContext(() =>
          Server.App().request(route, {
            headers: { "x-opencorvus-directory": foreign.path },
          }),
        )
        expect({ status: foreignResponse.status, body: await foreignResponse.json() }).toMatchObject({
          status: 404,
          body: { name: "NotFoundError", data: { message: `Session not found: ${entry.session.id}` } },
        })
      }
    }
    await Instance.disposeAll()
    const configResponse = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved[0]!.session.id}/config`, { headers }),
    )
    expect({ status: configResponse.status, body: await configResponse.json() }).toMatchObject({
      status: 400,
      body: { name: "ProviderModelNotFoundError", data: { providerID: "historical-unavailable", modelID: "model" } },
    })
  },
  30_000,
)
