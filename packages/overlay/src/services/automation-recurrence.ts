export type AutomationRecurrencePreset = "daily" | "weekdays" | "weekly" | "custom"

export interface AutomationRecurrenceInput {
  preset: AutomationRecurrencePreset
  time: string
  timeZone: string
  customRule?: string
}

export interface ParsedAutomationRecurrence {
  preset: AutomationRecurrencePreset
  time: string
  timeZone: string
  customRule: string
}

export interface AutomationTimeZoneOption {
  value: string
  label: string
}

const WEEKDAY_CODES: Record<string, string> = {
  Sun: "SU",
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
}

function localDateParts(timeZone: string): { year: string; month: string; day: string; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]))
  const weekday = WEEKDAY_CODES[parts.weekday]
  if (!parts.year || !parts.month || !parts.day || !weekday) {
    throw new Error(`Could not resolve a calendar date in time zone ${timeZone}`)
  }
  return { year: parts.year, month: parts.month, day: parts.day, weekday }
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

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw new Error("Automation time must use 24-hour HH:mm format")
  }
  const date = localDateParts(input.timeZone)
  const [hour, minute] = input.time.split(":")
  // RFC means Request for Comments; RFC 5545 defines DTSTART and the
  // Recurrence Rule (RRULE) format used by the scheduler.
  const start = `DTSTART;TZID=${input.timeZone}:${date.year}${date.month}${date.day}T${hour}${minute}00`
  const rule =
    input.preset === "daily"
      ? "FREQ=DAILY"
      : input.preset === "weekdays"
        ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        : `FREQ=WEEKLY;BYDAY=${date.weekday}`
  return `${start}\nRRULE:${rule}`
}

export function parseAutomationRecurrence(recurrence: string): ParsedAutomationRecurrence {
  const normalized = recurrence.trim()
  const start = normalized.match(
    /^DTSTART(?:(?:;TZID=([^:]+))|()):\d{8}T(\d{2})(\d{2})\d{2}(Z?)\r?\nRRULE:([^\r\n]+)$/i,
  )
  if (!start) {
    return {
      preset: "custom",
      time: "09:00",
      timeZone: browserTimeZone(),
      customRule: normalized,
    }
  }

  const timeZone = start[1] || (start[5] ? "UTC" : "")
  const rule = start[6].toUpperCase()
  const preset: AutomationRecurrencePreset =
    rule === "FREQ=DAILY"
      ? "daily"
      : rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        ? "weekdays"
        : /^FREQ=WEEKLY;BYDAY=(?:MO|TU|WE|TH|FR|SA|SU)$/.test(rule)
          ? "weekly"
          : "custom"
  if (!timeZone || preset === "custom") {
    return {
      preset: "custom",
      time: `${start[3]}:${start[4]}`,
      timeZone: timeZone || browserTimeZone(),
      customRule: normalized,
    }
  }
  return {
    preset,
    time: `${start[3]}:${start[4]}`,
    timeZone,
    customRule: "",
  }
}

export function recurrenceSummary(recurrence: string): string {
  const rule = recurrence.match(/(?:^|\n)RRULE:([^\n]+)/i)?.[1] ?? recurrence
  const timeZone = recurrence.match(/DTSTART;TZID=([^:]+):/i)?.[1]
  const time = recurrence.match(/DTSTART(?:;TZID=[^:]+)?:\d{8}T(\d{2})(\d{2})/i)
  const schedule =
    rule === "FREQ=DAILY"
      ? "Daily"
      : rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
        ? "Weekdays"
        : rule.startsWith("FREQ=WEEKLY;BYDAY=")
          ? `Weekly (${rule.slice("FREQ=WEEKLY;BYDAY=".length)})`
          : rule
  const clock = time ? ` at ${time[1]}:${time[2]}` : ""
  return `${schedule}${clock}${timeZone ? ` · ${timeZone}` : ""}`
}
