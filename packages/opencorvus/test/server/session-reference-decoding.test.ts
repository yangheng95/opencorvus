import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { visibleChatSkillNames } from "@/session/loop"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test.each(["assistant", "mission"] as const)(
  "public %s hydration retains raw edited references and projects valid identities",
  async (kind) => {
    await using project = await memoryProject(`reference-decoding-${kind}`)
    const text = "原始输入 " + String.raw`@squad("\q") @skill("\u12") @skill("review") @squad("base")`
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: "reference-decoding",
                defaultCwd: project.path,
                productPillar: "code",
                heldExpertSquadIDs: ["base"],
              })
            : await Session.create({ kind, title: "Reference editing" })
        const messageID = Identifier.ascending("message"),
          partID = Identifier.ascending("part")
        await Session.persistMessage({
          info: {
            id: messageID,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: kind,
            model: { providerID: "test", modelID: "test" },
            time: { created: Date.now() },
          },
          parts: [{ id: partID, sessionID: session.id, messageID, type: "text", text }],
        })
        const messages = await Session.messages({ sessionID: session.id })
        return { sessionID: session.id, messageID, partID, messages }
      },
    })
    await Instance.disposeAll()
    Server.resetProjectRoutesAppForTest()
    const response = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.sessionID}/conversation`, {
        headers: { "x-opencorvus-directory": project.path },
      }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(visibleChatSkillNames(saved.messages)).toEqual(["review"])
    expect(body.board.composerReferences).toEqual({
      skillNames: ["review"],
      missionSkillNames: [],
      expertSquadIDs: ["base"],
    })
    expect(body.transcript).toMatchObject([
      {
        info: { id: saved.messageID, sessionID: saved.sessionID, role: "user", author: "user" },
        parts: [{ id: saved.partID, type: "text", text }],
      },
    ])
  },
)
