import z from "zod"

const VERSION_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})\.([1-9]\d*)$/

export const ExpertSquadVersionSchema = z
  .string()
  .regex(VERSION_PATTERN, "version must use YYYY.MM.DD.N with a positive daily revision")
  .superRefine((value, context) => {
    const match = VERSION_PATTERN.exec(value)
    if (!match) return
    const [, yearText, monthText, dayText] = match
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      context.addIssue({ code: "custom", message: "version date must be a real calendar date" })
    }
  })

export function expertSquadVersionForTimestamp(timestamp: string, dailyRevision: number): string {
  if (!Number.isSafeInteger(dailyRevision) || dailyRevision < 1) {
    throw new Error("Expert squad daily revision must be a positive integer")
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid expert squad version timestamp: ${timestamp}`)
  const version = `${date.getUTCFullYear().toString().padStart(4, "0")}.${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getUTCDate().toString().padStart(2, "0")}.${dailyRevision}`
  return ExpertSquadVersionSchema.parse(version)
}
