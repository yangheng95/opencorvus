import z from "zod"

export function stringArrayColumn(value: unknown, field: string): string[] {
  const parsed = z.array(z.string().trim().min(1)).safeParse(value)
  if (!parsed.success) throw new Error(`${field} must be a JSON array of non-empty strings: ${parsed.error.message}`)
  return parsed.data
}
