import { afterEach, expect, test } from "bun:test"
import { editMissionPendingPrompt, ensureMissionSession, setMissionPendingPrompt } from "../src/mission/session"
import { Instance, runOutsideInstanceContext } from "../src/project/instance"
import { Server } from "../src/server/server"
import { Session } from "../src/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("current Mission requests and titles survive active, archived and cold selected reads in their own Project", async () => {
  await using first = await memoryProject("mission-request-first")
  await using second = await memoryProject("mission-request-second")
  const create = (directory: string, text: string) => Instance.provide({ directory, fn: async () => {
    const mission = await ensureMissionSession({ missionID: "saved-request", defaultCwd: directory, productPillar: "work", heldExpertSquadIDs: ["base"] })
    await Session.setTitle({ sessionID: mission.id, title: "Saved Mission" })
    await setMissionPendingPrompt({ session: mission, pendingPrompt: { text } })
    return { missionID: mission.missionID, sessionID: mission.id, directory, title: "Saved Mission", pendingPromptText: text }
  } })
  const left = await create(first.path, "第一项目原请求\n保留真实换行与 50%_\\ 字符。")
  const right = await create(second.path, "Second project's own saved request.")
  const get = async (route: string, directory: string) => {
    const response = await runOutsideInstanceContext(() => Server.App().request(route, { headers: { "x-opencorvus-directory": directory } }))
    expect(response.status).toBe(200)
    return response.json()
  }
  const selected = (owner: typeof left) => get(`/work-ledger/selection/session/${owner.sessionID}?${new URLSearchParams({ directory: owner.directory })}`, owner.directory)
  for (const owner of [left, right]) {
    expect(await selected(owner)).toMatchObject({ kind: "mission", ...owner })
    const active = await get(`/work-ledger?${new URLSearchParams({ directory: owner.directory })}`, owner.directory)
    expect(active.rows.find((row: { kind: string }) => row.kind === "mission")).toMatchObject({ kind: "mission", ...owner })
  }
  const revised = { ...left, title: "Renamed current Mission", pendingPromptText: "当前已编辑请求\n精确保留此原文。" }
  await Instance.provide({ directory: first.path, fn: async () => {
    await editMissionPendingPrompt({ sessionID: left.sessionID, missionID: left.missionID, expectedRequest: left.pendingPromptText, request: revised.pendingPromptText })
    await Session.setTitle({ sessionID: left.sessionID, title: revised.title })
  } })
  expect(await selected(revised)).toMatchObject({ kind: "mission", ...revised })
  const archived = Date.now()
  for (const owner of [revised, right]) {
    await Instance.provideProjectIdentity({ directory: owner.directory, fn: () => Session.setArchived({ sessionID: owner.sessionID, time: archived }) })
    expect(await selected(owner)).toMatchObject({ kind: "mission", ...owner, archived })
    const retained = await get(`/work-ledger/archive?${new URLSearchParams({ directory: owner.directory })}`, owner.directory)
    expect(retained.rows).toMatchObject([{ kind: "mission", ...owner, archived }])
  }
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
  for (const owner of [revised, right]) expect(await selected(owner)).toMatchObject({ kind: "mission", ...owner, archived })
}, 60_000)
