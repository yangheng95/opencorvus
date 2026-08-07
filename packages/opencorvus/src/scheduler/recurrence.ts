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
    // absolute instant; only TZID (time zone identifier) dates use rrule's
    // floating-date representation and need host-local conversion.
    const utc = /^DTSTART:\d{8}T\d{6}Z$/im.test(rule)
    let next = parsed.after(new Date(after), false)
    let stale = 0
    while (next) {
      const instant = (utc ? next : actualInstant(next)).getTime()
      if (instant > after) return instant
      stale += 1
      if (stale >= MAX_STALE_OCCURRENCES) {
        invalid(rule, "Recurrence could not advance beyond the requested instant")
      }
      next = parsed.after(next, false)
    }
    invalid(rule, "Recurrence rule has no future occurrence")
  }

  export function describe(rule: string): string {
    return parse(rule).toText()
  }

  export function normalize(rule: string): string {
    return parse(rule).toString()
  }

  function actualInstant(value: Date): Date {
    return DateTime.fromJSDate(value).toUTC().setZone("local", { keepLocalTime: true }).toJSDate()
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
