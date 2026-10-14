export type AutomationRecurrencePreset = "daily" | "weekdays" | "weekly" | "custom"
export type AutomationWeekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA"

export interface AutomationRecurrenceInput {
  preset: AutomationRecurrencePreset
  startDate: string
  weekday: AutomationWeekday
  time: string
  timeZone: string
  customRule?: string
}

export interface ParsedAutomationRecurrence {
  preset: AutomationRecurrencePreset
  startDate: string
  weekday: AutomationWeekday
  time: string
  timeZone: string
  customRule: string
}

export interface AutomationTimeZoneOption {
  value: string
  label: string
}

const WEEKDAY_CODES: Record<string, AutomationWeekday> = {
  Sun: "SU",
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
}
const WEEKDAYS: readonly AutomationWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]

/** Creation defaults only; editing and serialization always use the explicit calendar fields. */
export function automationRecurrenceDefaults(
  timeZone: string,
  now: Date | number = new Date(),
): { startDate: string; weekday: AutomationWeekday } {
  assertTimeZone(timeZone)
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
  const weekday = WEEKDAY_CODES[parts.weekday]
  if (!parts.year || !parts.month || !parts.day || !weekday) {
    throw new Error(`Could not resolve a calendar date in time zone ${timeZone}`)
  }
  return { startDate: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`, weekday }
}

function assertTimeZone(timeZone: string): void {
  if (!timeZone || timeZone !== timeZone.trim() || /^[+-]/.test(timeZone)) {
    throw new Error("Automation time zone must be a valid IANA time zone")
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
  } catch {
    throw new Error("Automation time zone must be a valid IANA time zone")
  }
}

function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Automation start date must use YYYY-MM-DD format and identify a real calendar date")
  }
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Automation start date must use YYYY-MM-DD format and identify a real calendar date")
  }
  return date
}

function assertClock(time: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Automation time must use 24-hour HH:mm format")
  }
}

export function browserTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!timeZone) throw new Error("The browser did not provide an IANA time zone")
  return timeZone
}

export function automationTimeZoneOptions(): AutomationTimeZoneOption[] {
  const systemTimeZone = browserTimeZone()
  return [...new Set([systemTimeZone, "UTC", ...Intl.supportedValuesOf("timeZone")])]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }))
}

export function buildAutomationRecurrence(input: AutomationRecurrenceInput): string {
  if (input.preset === "custom") {
    const custom = input.customRule?.trim() ?? ""
    if (!/^DTSTART(?:;TZID=[^:]+)?:\d{8}T\d{6}Z?(?:\r?\n)RRULE:/i.test(custom)) {
      throw new Error("Advanced recurrence must contain an anchored DTSTART followed by RRULE")
    }
    return custom
  }

  calendarDate(input.startDate)
  assertClock(input.time)
  assertTimeZone(input.timeZone)
  if (!WEEKDAYS.includes(input.weekday)) throw new Error("Automation weekday must be SU, MO, TU, WE, TH, FR or SA")
  if (!["daily", "weekdays", "weekly"].includes(input.preset))
    throw new Error("Unsupported automation recurrence preset")
  const [hour, minute] = input.time.split(":")
  // RFC means Request for Comments; RFC 5545 defines DTSTART and the
  // Recurrence Rule (RRULE) format used by the scheduler.
  const start = `DTSTART;TZID=${input.timeZone}:${input.startDate.replaceAll("-", "")}T${hour}${minute}00`
  const rule =
    input.preset === "daily"
      ? "FREQ=DAILY"
      : input.preset === "weekdays"
        ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        : `FREQ=WEEKLY;BYDAY=${input.weekday}`
  return `${start}\nRRULE:${rule}`
}

export function parseAutomationRecurrence(recurrence: string): ParsedAutomationRecurrence {
  const normalized = recurrence.trim()
  const start = normalized.match(
    /^DTSTART(?:;TZID=([^:]+))?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)\r?\nRRULE:([^\r\n]+)/i,
  )
  const custom: ParsedAutomationRecurrence = {
    preset: "custom",
    startDate: "",
    weekday: "MO",
    time: "09:00",
    timeZone: browserTimeZone(),
    customRule: normalized,
  }
  if (!start) {
    return custom
  }

  const timeZone = start[1] || (start[8] ? "UTC" : "")
  const startDate = `${start[2]}-${start[3]}-${start[4]}`
  const time = `${start[5]}:${start[6]}`
  let weekday: AutomationWeekday
  try {
    weekday = WEEKDAYS[calendarDate(startDate).getUTCDay()]
    assertClock(time)
    assertTimeZone(timeZone)
  } catch {
    return custom
  }
  Object.assign(custom, { startDate, weekday, time, timeZone })
  const rule = start[9].toUpperCase()
  const preset: AutomationRecurrencePreset =
    rule === "FREQ=DAILY"
      ? "daily"
      : rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        ? "weekdays"
        : /^FREQ=WEEKLY;BYDAY=(?:MO|TU|WE|TH|FR|SA|SU)$/.test(rule)
          ? "weekly"
          : "custom"
  // Extra recurrence lines, nonzero seconds and mixed UTC/zoned anchors belong
  // to the existing advanced editor, which owns their complete rule verbatim.
  if (preset === "custom" || start[0] !== normalized || start[7] !== "00" || (start[1] && start[8])) return custom
  return {
    preset,
    startDate,
    weekday: preset === "weekly" ? (rule.slice("FREQ=WEEKLY;BYDAY=".length) as AutomationWeekday) : weekday,
    time,
    timeZone,
    customRule: "",
  }
}

/** Omit recurrence from a PATCH when the operator has not changed its effective fields. */
export function automationRecurrenceUpdate(existing: string, input: AutomationRecurrenceInput): string | undefined {
  const previous = parseAutomationRecurrence(existing)
  const next = buildAutomationRecurrence(input)
  if (previous.preset !== input.preset) return next
  if (input.preset === "custom") return previous.customRule === next ? undefined : next
  if (
    previous.startDate === input.startDate &&
    previous.time === input.time &&
    previous.timeZone === input.timeZone &&
    (input.preset !== "weekly" || previous.weekday === input.weekday)
  )
    return undefined
  return next
}

export function recurrenceSummary(recurrence: string): string {
  const rule = recurrence.match(/(?:^|\n)RRULE:([^\n]+)/i)?.[1] ?? recurrence
  const parsed = parseAutomationRecurrence(recurrence)
  const schedule =
    rule === "FREQ=DAILY"
      ? "Daily"
      : rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        ? "Weekdays"
        : rule.startsWith("FREQ=WEEKLY;BYDAY=")
          ? `Weekly (${rule.slice("FREQ=WEEKLY;BYDAY=".length)})`
          : rule
  return parsed.startDate ? `${schedule} at ${parsed.time} · ${parsed.timeZone}` : schedule
}
