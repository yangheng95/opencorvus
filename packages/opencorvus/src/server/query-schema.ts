import z from "zod"

export const HttpQueryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .meta({ description: 'Strict HTTP query boolean. Accepts only "true" or "false".' })

export const HttpQueryLimit = z.coerce.number().int().min(1).max(200)
