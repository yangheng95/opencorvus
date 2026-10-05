import { afterEach, expect, test } from "bun:test"
import {
  automationTimeZoneOptions,
  automationRecurrenceDefaults,
  automationRecurrenceUpdate,
  buildAutomationRecurrence,
  parseAutomationRecurrence,
  recurrenceSummary,
  type AutomationRecurrenceInput,
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
    startDate: "2026-12-25",
    weekday: "FR",
    time: "09:30",
    timeZone: "America/New_York",
  })
  expect(daily).toBe("DTSTART;TZID=America/New_York:20261225T093000\nRRULE:FREQ=DAILY")
  expect(recurrenceSummary(daily)).toBe("Daily at 09:30 · America/New_York")

  const weekdays = buildAutomationRecurrence({
    preset: "weekdays",
    startDate: "2026-12-25",
    weekday: "FR",
    time: "18:05",
    timeZone: "Asia/Singapore",
  })
  expect(weekdays).toBe("DTSTART;TZID=Asia/Singapore:20261225T180500\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")

  const weekly = buildAutomationRecurrence({
    preset: "weekly",
    startDate: "2026-12-25",
    weekday: "WE",
    time: "07:00",
    timeZone: "Europe/Paris",
  })
  expect(weekly).toBe("DTSTART;TZID=Europe/Paris:20261225T070000\nRRULE:FREQ=WEEKLY;BYDAY=WE")
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
      startDate: "2026-12-25",
      weekday: "FR",
      time: "14:25",
      timeZone: "Asia/Singapore",
    })
    expect(parseAutomationRecurrence(recurrence)).toEqual({
      preset,
      startDate: "2026-12-25",
      weekday: "FR",
      time: "14:25",
      timeZone: "Asia/Singapore",
      customRule: "",
    })
  }
  expect(parseAutomationRecurrence("DTSTART:20260727T010000Z\nRRULE:FREQ=DAILY")).toEqual({
    preset: "daily",
    startDate: "2026-07-27",
    weekday: "MO",
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

test("creation defaults use the selected time zone at the supplied instant", () => {
  const now = new Date("2026-10-04T23:30:00Z")
  expect(automationRecurrenceDefaults("Asia/Shanghai", now)).toEqual({ startDate: "2026-10-05", weekday: "MO" })
  expect(automationRecurrenceDefaults("America/Los_Angeles", now.getTime())).toEqual({
    startDate: "2026-10-04",
    weekday: "SU",
  })
})

test("recurrence summaries qualify UTC anchors across basic and advanced rules", () => {
  expect(recurrenceSummary("DTSTART:20261219T153000Z\nRRULE:FREQ=WEEKLY;BYDAY=SA")).toBe(
    "Weekly (SA) at 15:30 · UTC",
  )
  expect(recurrenceSummary("DTSTART:20261219T083000Z\nRRULE:FREQ=DAILY")).toBe("Daily at 08:30 · UTC")
  expect(recurrenceSummary("DTSTART:20261219T083037Z\nRRULE:FREQ=DAILY;COUNT=4")).toBe(
    "FREQ=DAILY;COUNT=4 at 08:30 · UTC",
  )
  expect(recurrenceSummary("RRULE:FREQ=MONTHLY;BYMONTHDAY=19")).toBe("FREQ=MONTHLY;BYMONTHDAY=19")
})

test("editing unrelated fields keeps the complete stored calendar and UTC spelling", () => {
  const weekly = "DTSTART;TZID=Asia/Shanghai:20261225T160000\nRRULE:FREQ=WEEKLY;BYDAY=FR"
  const utc = "DTSTART:20261225T080000Z\nRRULE:FREQ=DAILY"
  for (const recurrence of [weekly, utc]) {
    const patch = automationRecurrenceUpdate(recurrence, parseAutomationRecurrence(recurrence))
    expect({ name: "Renamed", recurrence: patch ?? recurrence }).toEqual({ name: "Renamed", recurrence })
  }
  const parsed = parseAutomationRecurrence(weekly)
  expect(automationRecurrenceUpdate(weekly, { ...parsed, time: "17:05" })).toBe(
    "DTSTART;TZID=Asia/Shanghai:20261225T170500\nRRULE:FREQ=WEEKLY;BYDAY=FR",
  )
  expect(automationRecurrenceUpdate(weekly, { ...parsed, weekday: "TU", startDate: "2027-01-01" })).toBe(
    "DTSTART;TZID=Asia/Shanghai:20270101T160000\nRRULE:FREQ=WEEKLY;BYDAY=TU",
  )
  expect(automationRecurrenceUpdate(weekly, { ...parsed, timeZone: "UTC" })).toBe(
    "DTSTART;TZID=UTC:20261225T160000\nRRULE:FREQ=WEEKLY;BYDAY=FR",
  )
})

test("daily and weekday calendars ignore inactive weekday and advanced fields", () => {
  for (const rule of ["FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]) {
    const recurrence = `DTSTART;TZID=Asia/Shanghai:20261225T160000\nRRULE:${rule}`
    const patch = automationRecurrenceUpdate(recurrence, {
      ...parseAutomationRecurrence(recurrence),
      weekday: "MO",
      customRule: "unused advanced input",
    })
    expect({ name: "Renamed", recurrence: patch ?? recurrence }).toEqual({ name: "Renamed", recurrence })
  }
})

test("advanced recurrence retains seconds, limits, exceptions and the exact anchor", () => {
  const rules = [
    "DTSTART;TZID=Asia/Shanghai:20261225T160037\nRRULE:FREQ=WEEKLY;BYDAY=FR",
    "DTSTART:20261225T080000Z\nRRULE:FREQ=DAILY;COUNT=4",
    "DTSTART:20261225T080000Z\nRRULE:FREQ=WEEKLY;BYDAY=FR;INTERVAL=2",
    "DTSTART:20261225T080000Z\nRRULE:FREQ=DAILY\nEXDATE:20261226T080000Z",
    "DTSTART:20261225T080000Z\nRRULE:FREQ=DAILY;UNTIL=20261231T080000Z",
  ]
  for (const recurrence of rules) {
    const parsed = parseAutomationRecurrence(recurrence)
    expect(parsed).toMatchObject({ preset: "custom", startDate: "2026-12-25", weekday: "FR", customRule: recurrence })
    expect(buildAutomationRecurrence(parsed)).toBe(recurrence)
    const patch = automationRecurrenceUpdate(recurrence, { ...parsed, customRule: `  ${recurrence}\n` })
    expect({ prompt: "Edited", recurrence: patch ?? recurrence }).toEqual({ prompt: "Edited", recurrence })
  }
  const changed = rules[0].replace("160037", "170037")
  expect(automationRecurrenceUpdate(rules[0], { ...parseAutomationRecurrence(rules[0]), customRule: changed })).toBe(
    changed,
  )
})

test("calendar validation returns explicit errors and accepts a leap-day anchor", () => {
  const input: AutomationRecurrenceInput = {
    preset: "weekly",
    startDate: "2028-02-29",
    weekday: "TU",
    time: "09:30",
    timeZone: "UTC",
  }
  expect(buildAutomationRecurrence(input)).toBe("DTSTART;TZID=UTC:20280229T093000\nRRULE:FREQ=WEEKLY;BYDAY=TU")
  for (const startDate of ["2026-02-29", "2028-02-30", "2026-04-31", "0000-01-01", "2026-13-01", "2026-1-01"]) {
    expect(() => buildAutomationRecurrence({ ...input, startDate })).toThrow(
      "Automation start date must use YYYY-MM-DD format and identify a real calendar date",
    )
  }
  expect(() => buildAutomationRecurrence({ ...input, time: "24:00" })).toThrow(
    "Automation time must use 24-hour HH:mm format",
  )
  expect(() => buildAutomationRecurrence({ ...input, timeZone: "Invalid/Zone" })).toThrow(
    "Automation time zone must be a valid IANA time zone",
  )
  expect(() => buildAutomationRecurrence({ ...input, weekday: "XX" as AutomationRecurrenceInput["weekday"] })).toThrow(
    "Automation weekday must be SU, MO, TU, WE, TH, FR or SA",
  )
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
