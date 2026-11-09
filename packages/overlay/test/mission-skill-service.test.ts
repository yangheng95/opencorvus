import { afterEach, describe, expect, test } from "bun:test"
import { ApiError } from "../src/services/api"
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
      issues: [],
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
    const response = { issues: [], mission_skills: [] }
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

  for (const [kind, load] of [["settings", loadMissionSkillSettings], ["catalog", loadMissionSkillCatalog]] as const) {
    test(`shares the original typed ${kind} failure and accepts the next successful response`, async () => {
      setAppStore({ connected: true })
      const gate = deferred<void>()
      const requests: TransportRequest[] = []
      const body = { name: "CatalogUnavailable", data: { message: `${kind} unavailable` } }
      const requestID = `req_${kind}`
      const skill = { name: "review", description: "Review the current project.", required_tools: [] }
      const recovered = kind === "settings"
        ? {
            issues: [],
            roots: { global: "D:/global/mission-skills", project: "D:/project/.opencorvus/mission-skills" },
            mission_skills: [{ ...skill, source: "project", location: "D:/project/.opencorvus/mission-skills/review/SKILL.md" }],
          }
        : { issues: [], mission_skills: [skill] }
      __setHostTransportForTest(
        transport(async (request) => {
          requests.push(request)
          if (requests.length > 1) return { status: 200, ok: true, headers: {}, body: recovered }
          await gate.promise
          return { status: 503, ok: false, headers: { "x-opencorvus-request-id": requestID }, body }
        }),
      )
      const scope = { kind: "project" as const, directory: "D:/project" }
      const first = load(scope)
      const second = load(scope)
      gate.resolve()

      const [failure, joined] = await Promise.allSettled([first, second])
      if (failure.status !== "rejected" || joined.status !== "rejected") {
        throw new Error("Expected both coalesced reads to return the HTTP failure")
      }
      expect(failure.reason).toBeInstanceOf(ApiError)
      expect(failure.reason).toMatchObject({
        status: 503,
        method: "GET",
        path: `mission-skill/${kind}?directory=D%3A%2Fproject`,
        requestID,
        body,
      })
      expect(joined.reason).toBe(failure.reason)
      expect(requests).toHaveLength(1)

      await expect(load(scope)).resolves.toEqual(recovered)
      expect(requests.map((request) => ({ path: request.path, directory: request.query?.directory }))).toEqual([
        { path: `mission-skill/${kind}`, directory: scope.directory },
        { path: `mission-skill/${kind}`, directory: scope.directory },
      ])
    })
  }
})
