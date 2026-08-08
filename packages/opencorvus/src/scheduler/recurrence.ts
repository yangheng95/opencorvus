import { rrulestr } from "rrule"
import { DateTime } from "luxon"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const InvalidAutomationRecurrenceError = NamedError.create(
  "InvalidAutomationRecurrenceError",
  z.object({
    message: z.string(),
    recurrence: z.string(),
  }),
)

/**
 * RFC: Request for Comments. RFC 5545 defines the iCalendar recurrence rule
 * representation used by Codex Scheduled Automations and this service.
 */
export namespace Recurrence {
  const DTSTART_PATTERN = /^DTSTART(?:(?:;TZID=([^:]+)):(\d{8}T\d{6})|:(\d{8}T\d{6}Z))$/im
  const RRULE_PATTERN = /^RRULE:/im
  const MAX_STALE_OCCURRENCES = 100_000

  export function parse(rule: string) {
    const normalized = rule.trim()
    if (!normalized) invalid(rule, "Recurrence rule is required")
    const start = normalized.match(DTSTART_PATTERN)
    if (!start) {
      invalid(rule, "RFC 5545 recurrence requires an anchored DTSTART with TZID or UTC Z suffix")
    }
    if (!RRULE_PATTERN.test(normalized)) invalid(rule, "RFC 5545 recurrence requires an RRULE")
    const timeZone = start[1]
    if (timeZone) assertTimeZone(rule, timeZone)
    try {
      return rrulestr(normalized)
    } catch (error) {
      invalid(rule, `Invalid RFC 5545 recurrence rule: ${message(error)}`)
    }
  }

  export function nextRun(rule: string, after: number): number {
    const parsed = parse(rule)
    // UTC means Coordinated Universal Time. A UTC DTSTART is already an
    // absolute instant; TZID (time zone identifier) dates are mapped through
    // their declared zone below.
    const timeZone = rule.match(DTSTART_PATTERN)?.[1]
    // rrule's TZID output is adjusted through the host zone and can therefore
    // change with process.env.TZ. Generate the recurrence as UTC-encoded wall
    // fields instead, then interpret those fields in the declared IANA zone.
    // Both selection and comparison now use one explicit absolute-time map.
    const selection = timeZone ? rrulestr(floatingRule(rule, timeZone)) : parsed
    let next = selection.after(timeZone ? floatingDate(after, timeZone) : new Date(after), false)
    let stale = 0
    while (next) {
      const instant = timeZone ? actualInstant(next, timeZone).getTime() : next.getTime()
      if (instant > after) return instant
      stale += 1
      if (stale >= MAX_STALE_OCCURRENCES) {
        invalid(rule, "Recurrence could not advance beyond the requested instant")
      }
      next = selection.after(next, false)
    }
    invalid(rule, "Recurrence rule has no future occurrence")
  }

  export function describe(rule: string): string {
    return parse(rule).toText()
  }

  export function normalize(rule: string): string {
    return parse(rule).toString()
  }

  function actualInstant(value: Date, timeZone: string): Date {
    return DateTime.fromObject(
      {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
        hour: value.getUTCHours(),
        minute: value.getUTCMinutes(),
        second: value.getUTCSeconds(),
        millisecond: value.getUTCMilliseconds(),
      },
      { zone: timeZone },
    ).toJSDate()
  }

  function floatingDate(instant: number, timeZone: string): Date {
    return DateTime.fromMillis(instant).setZone(timeZone).toUTC(0, { keepLocalTime: true }).toJSDate()
  }

  function floatingRule(rule: string, timeZone: string): string {
    const start = rule.replace(
      /^DTSTART;TZID=[^:]+:(\d{8}T\d{6})$/im,
      (_line, wall: string) => `DTSTART:${wall}Z`,
    )
    return start.replace(/UNTIL=(\d{8}T\d{6}Z)/gi, (_field, until: string) => {
      const instant = DateTime.fromFormat(until, "yyyyMMdd'T'HHmmss'Z'", { zone: "utc" }).toMillis()
      return `UNTIL=${DateTime.fromJSDate(floatingDate(instant, timeZone)).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`
    })
  }

  function assertTimeZone(rule: string, timeZone: string): void {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
    } catch {
      invalid(rule, `Invalid IANA timezone: ${timeZone}`)
    }
  }

  function invalid(recurrence: string, message: string): never {
    throw new InvalidAutomationRecurrenceError({ message, recurrence })
  }

  function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
