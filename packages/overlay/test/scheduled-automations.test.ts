import { afterEach, expect, test } from "bun:test"
import {
  automationTimeZoneOptions,
  buildAutomationRecurrence,
  parseAutomationRecurrence,
  recurrenceSummary,
} from "../src/services/automation-recurrence"
import {
  createAutomation,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  pauseAutomation,
  resolveAutomationProjectID,
  resumeAutomation,
  runAutomationNow,
} from "../src/services/automations"
import { configure } from "../src/services/api"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("recurrence presets emit one anchored RFC 5545 schedule with an explicit IANA time zone", () => {
  const daily = buildAutomationRecurrence({
    preset: "daily",
    time: "09:30",
    timeZone: "America/New_York",
  })
  expect(daily).toMatch(/^DTSTART;TZID=America\/New_York:\d{8}T093000\nRRULE:FREQ=DAILY$/)
  expect(recurrenceSummary(daily)).toBe("Daily at 09:30 · America/New_York")

  const weekdays = buildAutomationRecurrence({
    preset: "weekdays",
    time: "18:05",
    timeZone: "Asia/Singapore",
  })
  expect(weekdays).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")

  const weekly = buildAutomationRecurrence({
    preset: "weekly",
    time: "07:00",
    timeZone: "Europe/Paris",
  })
  expect(weekly).toMatch(/\nRRULE:FREQ=WEEKLY;BYDAY=(?:MO|TU|WE|TH|FR|SA|SU)$/)
})

test("time-zone choices are searchable canonical IANA values with the browser zone and UTC", () => {
  const options = automationTimeZoneOptions()
  const values = options.map((option) => option.value)
  expect(values).toContain("UTC")
  expect(values).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(new Set(values).size).toBe(values.length)
  expect(options.every((option) => option.label === option.value)).toBe(true)
})

test("common recurrence presets round-trip into the editable form without exposing RRULE", () => {
  for (const preset of ["daily", "weekdays", "weekly"] as const) {
    const recurrence = buildAutomationRecurrence({
      preset,
      time: "14:25",
      timeZone: "Asia/Singapore",
    })
    expect(parseAutomationRecurrence(recurrence)).toEqual({
      preset,
      time: "14:25",
      timeZone: "Asia/Singapore",
      customRule: "",
    })
  }
  expect(parseAutomationRecurrence("DTSTART:20260727T010000Z\nRRULE:FREQ=DAILY")).toEqual({
    preset: "daily",
    time: "01:00",
    timeZone: "UTC",
    customRule: "",
  })
  const advanced = "DTSTART;TZID=Asia/Singapore:20260727T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
  expect(parseAutomationRecurrence(advanced)).toMatchObject({
    preset: "custom",
    customRule: advanced,
  })
})

test("automation service sends the full lifecycle through global target-aware HTTP routes", async () => {
  const requests: TransportRequest[] = []
  const transport: HostTransport = {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      const body =
        request.path === "project/current"
          ? { id: "prj_1" }
          : request.path.endsWith("/runs") && request.method === "GET"
            ? []
            : {}
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("not used")
    },
    async native() {
      throw new Error("not used")
    },
    subscribeUiCommand() {
      return { unsubscribe() {} }
    },
  }
  __setHostTransportForTest(transport)
  configure({ directory: "" })

  const input = {
    name: "Morning review",
    target: { scope: "global" as const },
    recurrence: "DTSTART:20260727T010000Z\nRRULE:FREQ=DAILY",
    executionMode: "worktree" as const,
    prompt: "Review alerts",
  }
  await listAutomations()
  expect(await resolveAutomationProjectID("/workspace/atlas")).toBe("prj_1")
  await createAutomation(input)
  await pauseAutomation("atm_1")
  await resumeAutomation("atm_1")
  await runAutomationNow("atm_1")
  await listAutomationRuns("atm_1")
  await deleteAutomation("atm_1")

  expect(requests.map(({ path, method }) => `${method} ${path}`)).toEqual([
    "GET global/automations",
    "GET project/current",
    "POST global/automations",
    "PATCH global/automations/atm_1",
    "PATCH global/automations/atm_1",
    "POST global/automations/atm_1/run",
    "GET global/automations/atm_1/runs",
    "DELETE global/automations/atm_1",
  ])
  expect(requests[1]?.query).toEqual({ directory: "/workspace/atlas" })
  expect(requests[2]?.body).toEqual({ kind: "json", value: input })
})
