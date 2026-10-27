import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { missionRecord } from "@/mission/projection"
import { ensureMissionSession } from "@/mission/session"
import { panelLeafToolID } from "@/panel/action-ids"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Tool } from "@/tool/tool"
import { PanelLeafTools } from "@/tool/panel"
import { WorkLedgerList } from "@opencorvus-ai/transport-protocol"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("the public ledger projects current Mission acceptance and the next operator input", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "ledger-accepted",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const now = Date.now()
      const user = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "user",
        time: { created: now },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "assistant",
        author: "mission",
        parentID: user.id,
        time: { created: now + 1 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const id = panelLeafToolID("complete_mission")
      const definition = PanelLeafTools.find((tool) => tool.id === id)
      if (!definition) throw new Error(`Missing completion leaf ${id}`)
      const tool = await definition.init({ agentID: "mission" })
      const callID = "ledger-bounded-completion",
        partID = Identifier.ascending("part")
      const input = { summary: "The bounded coordination outcome is accepted", task_acceptances: [] }
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: assistant.id,
        type: "step-start",
      })
      await Session.updatePart({
        id: partID,
        sessionID: mission.id,
        messageID: assistant.id,
        type: "tool",
        tool: id,
        callID,
        state: { status: "running", input, time: { start: now + 1 } },
      })
      const output = await tool.execute(input, {
        sessionID: mission.id,
        messageID: assistant.id,
        callID,
        agent: "mission",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface([id], []),
        extra: { surface: "panel" },
        metadata() {},
        async ask() {},
      })
      await Session.updatePart({
        id: partID,
        sessionID: mission.id,
        messageID: assistant.id,
        type: "tool",
        tool: id,
        callID,
        state: {
          status: "completed",
          input,
          output: output.output,
          title: output.title,
          metadata: output.metadata,
          time: { start: now + 1, end: now + 2 },
        },
      })
      expect(missionRecord(mission)).toMatchObject({
        boardLane: "completed",
        outcome: { kind: "accepted", toolPartID: partID },
      })
      const current = async () => {
        const response = await Server.App().request("/work-ledger?" + new URLSearchParams({ directory: project.path }))
        expect(response.status).toBe(200)
        return WorkLedgerList.parse(await response.json()).rows.find(
          (row) => row.kind === "mission" && row.missionID === mission.missionID,
        )
      }
      expect(await current()).toMatchObject({
        kind: "mission",
        id: mission.missionID,
        outcome: "accepted",
        interruptible: false,
      })
      await Session.setArchived({ sessionID: mission.id, time: now + 3 })
      const archivedResponse = await Server.App().request(
        "/work-ledger/archive?" + new URLSearchParams({ directory: project.path }),
      )
      expect(archivedResponse.status).toBe(200)
      const archived = await archivedResponse.json()
      expect(archived.rows.find((row: { id: string }) => row.id === mission.missionID)).toMatchObject({
        kind: "mission",
        id: mission.missionID,
        outcome: "accepted",
        archived: now + 3,
      })
      await Session.setArchived({ sessionID: mission.id, time: null })
      await Session.updateMessage({
        ...user,
        orderKey: undefined,
        id: Identifier.ascending("message"),
        time: { created: now + 4 },
      })
      expect(missionRecord(mission).boardLane).toBe("backlog")
      expect(await current()).toMatchObject({ kind: "mission", id: mission.missionID, outcome: null, tasks: [] })
    },
  })
})
