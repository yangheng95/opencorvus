import { expect, test } from "bun:test"
import { Recurrence, InvalidAutomationRecurrenceError } from "../src/scheduler/recurrence"

const cases = [
  {
    name: "daily count skips the nonexistent local hour without consuming an occurrence",
    rule: "DTSTART;TZID=America/New_York:20260307T023000\nRRULE:FREQ=DAILY;COUNT=3",
    expected: ["2026-03-07T07:30:00.000Z", "2026-03-09T06:30:00.000Z", "2026-03-10T06:30:00.000Z"],
  },
  {
    name: "weekly count skips the gap and advances by whole recurrence intervals",
    rule: "DTSTART;TZID=America/New_York:20260301T023000\nRRULE:FREQ=WEEKLY;COUNT=3",
    expected: ["2026-03-01T07:30:00.000Z", "2026-03-15T06:30:00.000Z", "2026-03-22T06:30:00.000Z"],
  },
  {
    name: "UTC UNTIL includes its final valid instant after a skipped local hour",
    rule: "DTSTART;TZID=America/New_York:20260307T023000\nRRULE:FREQ=DAILY;UNTIL=20260310T063000Z",
    expected: ["2026-03-07T07:30:00.000Z", "2026-03-09T06:30:00.000Z", "2026-03-10T06:30:00.000Z"],
  },
  {
    name: "BYSETPOS selects from valid local candidates",
    rule: "DTSTART;TZID=America/New_York:20260308T013000\nRRULE:FREQ=DAILY;COUNT=2;BYHOUR=1,2,3;BYSETPOS=2",
    expected: ["2026-03-08T07:30:00.000Z", "2026-03-09T06:30:00.000Z"],
  },
  {
    name: "negative BYSETPOS counts backward from the valid local set",
    rule: "DTSTART;TZID=America/New_York:20260308T013000\nRRULE:FREQ=DAILY;COUNT=2;BYHOUR=1,2,3;BYSETPOS=-2",
    expected: ["2026-03-08T06:30:00.000Z", "2026-03-09T06:30:00.000Z"],
  },
  {
    name: "explicit RDATE resolves a gap while absolute EXDATE removes exactly its instant",
    rule: "DTSTART;TZID=America/New_York:20260307T023000\nRRULE:FREQ=DAILY;COUNT=3\nRDATE;TZID=America/New_York:20260308T023000\nEXDATE:20260309T063000Z",
    expected: ["2026-03-07T07:30:00.000Z", "2026-03-08T07:30:00.000Z", "2026-03-10T06:30:00.000Z"],
  },
  {
    name: "RDATE's property timezone preserves the UTC anchor of its sibling rule",
    rule: "DTSTART:20260301T023000Z\nRRULE:FREQ=DAILY;COUNT=1\nRDATE;TZID=Asia/Tokyo:20260302T090000",
    expected: ["2026-03-01T02:30:00.000Z", "2026-03-02T00:00:00.000Z"],
  },
  {
    name: "a repeated local hour selects its first instant exactly once",
    rule: "DTSTART;TZID=America/New_York:20261101T013000\nRRULE:FREQ=DAILY;COUNT=2",
    expected: ["2026-11-01T05:30:00.000Z", "2026-11-02T06:30:00.000Z"],
  },
  {
    name: "independent rule counts are combined before EXRULE exclusion",
    rule: "DTSTART:20260301T023000Z\nRRULE:FREQ=DAILY;COUNT=3\nRRULE:FREQ=WEEKLY;COUNT=2\nEXRULE:FREQ=DAILY;COUNT=2",
    expected: ["2026-03-03T02:30:00.000Z", "2026-03-08T02:30:00.000Z"],
  },
]

for (const scenario of cases) {
  test(scenario.name, () => {
    for (const rule of [scenario.rule, Recurrence.normalize(scenario.rule)]) {
      let after = Date.parse("2026-01-01T00:00:00Z")
      const actual: Array<string | null> = []
      for (let index = 0; index <= scenario.expected.length; index++) {
        const next = Recurrence.nextRun(rule, after)
        actual.push(next === null ? null : new Date(next).toISOString())
        if (next !== null) after = next
      }
      expect(actual).toEqual([...scenario.expected, null])
    }
  })
}

test("invalid recurrence syntax retains its typed error contract", () => {
  expect(() => Recurrence.nextRun("DTSTART:20260301T023000Z\nRRULE:FREQ=INVALID", 0)).toThrow(
    InvalidAutomationRecurrenceError,
  )
})

test("unbounded queries preserve exact window results across historical pruning and date-line offsets", () => {
  const windows = [
    {
      zone: "Asia/Singapore",
      start: "20250101T000000",
      rule: "FREQ=MINUTELY",
      after: "2025-02-01T00:00:00Z",
      next: "2025-02-01T00:01:00.000Z",
    },
    {
      zone: "Pacific/Kiritimati",
      start: "20250101T090000",
      rule: "FREQ=DAILY",
      after: "2026-01-01T18:59:59Z",
      next: "2026-01-01T19:00:00.000Z",
    },
    {
      zone: "America/New_York",
      start: "20250101T013000",
      rule: "FREQ=DAILY;BYHOUR=1,2,3;BYSETPOS=2",
      after: "2026-03-08T00:00:00Z",
      next: "2026-03-08T07:30:00.000Z",
    },
    {
      zone: "America/New_York",
      start: "20250101T013000",
      rule: "FREQ=DAILY",
      after: "2026-11-01T05:29:59Z",
      next: "2026-11-01T05:30:00.000Z",
    },
  ]
  for (const row of windows) {
    const next = Recurrence.nextRun(`DTSTART;TZID=${row.zone}:${row.start}\nRRULE:${row.rule}`, Date.parse(row.after))
    expect(new Date(next!).toISOString()).toBe(row.next)
  }
})

test("Bun ESM and Node CommonJS use the same named-zone instants under three host zones", async () => {
  const output = `console.log(JSON.stringify(${JSON.stringify(cases)}.map(x => rrulestr(x.rule).all().map(d => d.toISOString()))))`
  for (const executable of [Bun.which("bun")!, Bun.which("node")!]) {
    const script =
      (executable === Bun.which("bun")
        ? 'import { rrulestr } from "rrule"; '
        : 'const { rrulestr } = require("rrule"); ') + output
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      const child = Bun.spawn([executable, "-e", script], {
        cwd: import.meta.dir.replace(/[\\/]test$/, ""),
        env: { ...process.env, TZ: zone },
        stdout: "pipe",
        stderr: "pipe",
      })
      const [output, errors, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      if (exitCode !== 0) throw new Error(errors)
      expect(JSON.parse(output.trim())).toEqual(cases.map((entry) => entry.expected))
    }
  }
})
