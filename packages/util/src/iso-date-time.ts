import { z } from "zod"

// ISO (International Organization for Standardization) 8601 timestamps in the
// product accept minute, second, and fractional-second precision without rewriting.
export function isoDateTimeSchema(options: { offset?: boolean } = {}) {
  return z.union([z.iso.datetime(options), z.iso.datetime({ ...options, precision: -1 })])
}
