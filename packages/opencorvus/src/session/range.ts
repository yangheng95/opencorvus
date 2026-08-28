import z from "zod"

/**
 * A half-open text range in a file, as persisted on Session messages.
 *
 * This used to live under the Language Server Protocol subsystem because that
 * is where the shape came from. The subsystem is gone; the shape is still what
 * a persisted message carries, so it lives with the messages that carry it.
 * The schema ref is unchanged, so the public contract is unchanged.
 */
export const RangeSchema = z
  .object({
    start: z.object({
      line: z.number(),
      character: z.number(),
    }),
    end: z.object({
      line: z.number(),
      character: z.number(),
    }),
  })
  .meta({
    ref: "Range",
  })
export type Range = z.infer<typeof RangeSchema>
