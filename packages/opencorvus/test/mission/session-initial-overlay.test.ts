import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { ensureMissionSession } from "../../src/mission/session"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const MODEL = "mission-overlay-provider/mission-overlay-model"

describe("Mission Session creation commits its model overlay", () => {
  test("a Mission Session is published already carrying its title and model overlay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = `mission-${Identifier.ascending("session").slice(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`
        const session = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
          initialTitle: "Mission with an exact model",
          initialConfigOverlay: Config.Overlay.parse({ model: MODEL, prompt_profile: null }),
        })

        // The returned Session — the first published fact — already carries
        // both; there is no post-create patch window to lose.
        expect({
          title: session.title,
          model: ((session.metadata as any)?.configOverlay ?? {}).model,
        }).toEqual({
          title: "Mission with an exact model",
          model: MODEL,
        })

        // The durable row is the same fact.
        const stored = await Session.get(session.id)
        expect(((stored.metadata as any)?.configOverlay ?? {}).model).toBe(MODEL)
      },
    })
  }, 60_000)

  test("re-ensuring an existing Mission Session keeps its committed identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = `mission-${Identifier.ascending("session").slice(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`
        const first = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
          initialTitle: "First title",
          initialConfigOverlay: Config.Overlay.parse({ model: MODEL, prompt_profile: null }),
        })
        const again = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
          initialTitle: "A later request's title",
          initialConfigOverlay: Config.Overlay.parse({ model: "other/model", prompt_profile: null }),
        })
        expect({
          sameSession: again.id === first.id,
          title: again.title,
          model: ((again.metadata as any)?.configOverlay ?? {}).model,
        }).toEqual({
          sameSession: true,
          title: "First title",
          model: MODEL,
        })
      },
    })
  }, 60_000)
})
