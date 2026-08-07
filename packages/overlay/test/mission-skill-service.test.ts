import { afterEach, describe, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { loadMissionSkillCatalog, loadMissionSkillSettings } from "../src/services/mission-skill"
import { setAppStore } from "../src/store/app"

function transport(request: (input: TransportRequest) => Promise<TransportResponse<unknown>>): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(input: TransportRequest): Promise<TransportResponse<T>> {
      return (await request(input)) as TransportResponse<T>
    },
    openStream() {
      return { close() {} }
    },
    async native() {
      return true
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe.serial("Mission Skill service request ownership", () => {
  afterEach(() => {
    __setHostTransportForTest(undefined)
    setAppStore({ connected: false })
  })

  test("coalesces one settings request per exact scope while keeping concurrent scopes separate", async () => {
    setAppStore({ connected: true })
    const projectGate = deferred<void>()
    const sessionGate = deferred<void>()
    const requests: TransportRequest[] = []
    const response = {
      roots: { global: "D:/global/mission-skills", project: "D:/project/.opencorvus/mission-skills" },
      mission_skills: [],
    }
    __setHostTransportForTest(
      transport(async (request) => {
        requests.push(request)
        if (request.query?.sessionID) await sessionGate.promise
        else await projectGate.promise
        return { status: 200, ok: true, headers: {}, body: response }
      }),
    )

    const projectScope = { kind: "project" as const, directory: "D:/project" }
    const sessionScope = { kind: "session" as const, directory: "D:/project", sessionID: "ses_mission" }
    const firstProject = loadMissionSkillSettings(projectScope)
    const session = loadMissionSkillSettings(sessionScope)
    const secondProject = loadMissionSkillSettings(projectScope)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toHaveLength(2)
    expect(requests.map((request) => request.query?.sessionID ?? "project").sort()).toEqual(["project", "ses_mission"])

    sessionGate.resolve()
    projectGate.resolve()
    await expect(Promise.all([firstProject, secondProject, session])).resolves.toEqual([response, response, response])
  })

  test("coalesces catalog requests by exact scope across an interleaved project-session-project sequence", async () => {
    setAppStore({ connected: true })
    const projectGate = deferred<void>()
    const sessionGate = deferred<void>()
    const requests: TransportRequest[] = []
    const response = { mission_skills: [] }
    __setHostTransportForTest(
      transport(async (request) => {
        requests.push(request)
        if (request.query?.sessionID) await sessionGate.promise
        else await projectGate.promise
        return { status: 200, ok: true, headers: {}, body: response }
      }),
    )

    const projectScope = { kind: "project" as const, directory: "D:/project" }
    const sessionScope = { kind: "session" as const, directory: "D:/project", sessionID: "ses_mission" }
    const firstProject = loadMissionSkillCatalog(projectScope)
    const session = loadMissionSkillCatalog(sessionScope)
    const secondProject = loadMissionSkillCatalog(projectScope)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toHaveLength(2)
    expect(requests.map((request) => request.query?.sessionID ?? "project").sort()).toEqual(["project", "ses_mission"])

    sessionGate.resolve()
    projectGate.resolve()
    await expect(Promise.all([firstProject, session, secondProject])).resolves.toEqual([response, response, response])
  })

  test("returns the same wrapped settings failure to every coalesced caller and clears the pending request", async () => {
    setAppStore({ connected: true })
    const gate = deferred<void>()
    const requests: TransportRequest[] = []
    __setHostTransportForTest(
      transport(async (request) => {
        requests.push(request)
        await gate.promise
        return { status: 503, ok: false, headers: {}, body: { error: "settings unavailable" } }
      }),
    )
    const scope = { kind: "project" as const, directory: "D:/project" }
    const first = loadMissionSkillSettings(scope)
    const second = loadMissionSkillSettings(scope)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toHaveLength(1)
    gate.resolve()

    const settled = await Promise.allSettled([first, second])
    expect(settled.map((result) => (result.status === "rejected" ? result.reason.message : ""))).toEqual([
      "GET /mission-skill/settings?directory=D%3A%2Fproject failed: API 503 mission-skill/settings?directory=D%3A%2Fproject: settings unavailable",
      "GET /mission-skill/settings?directory=D%3A%2Fproject failed: API 503 mission-skill/settings?directory=D%3A%2Fproject: settings unavailable",
    ])

    await expect(loadMissionSkillSettings(scope)).rejects.toThrow("settings unavailable")
    expect(requests).toHaveLength(2)
  })

  test("returns the same wrapped catalog failure to every coalesced caller", async () => {
    setAppStore({ connected: true })
    const gate = deferred<void>()
    const requests: TransportRequest[] = []
    __setHostTransportForTest(
      transport(async (request) => {
        requests.push(request)
        await gate.promise
        return { status: 500, ok: false, headers: {}, body: { error: "catalog unavailable" } }
      }),
    )
    const scope = { kind: "project" as const, directory: "D:/project" }
    const first = loadMissionSkillCatalog(scope)
    const second = loadMissionSkillCatalog(scope)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toHaveLength(1)
    gate.resolve()

    const settled = await Promise.allSettled([first, second])
    expect(settled.every((result) => result.status === "rejected")).toBe(true)
    expect(
      settled.every(
        (result) => result.status === "rejected" && result.reason.message.includes("GET /mission-skill/catalog?"),
      ),
    ).toBe(true)
  })
})
