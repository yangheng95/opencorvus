import z from "zod"

// LSP (Language Server Protocol) value schemas are kept independent from
// client/server lifecycle code so persisted message schemas do not load it.
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

export const SymbolSchema = z
  .object({
    name: z.string(),
    kind: z.number(),
    location: z.object({
      uri: z.string(),
      range: RangeSchema,
    }),
  })
  .meta({
    ref: "Symbol",
  })
export type Symbol = z.infer<typeof SymbolSchema>

export const DocumentSymbolSchema = z
  .object({
    name: z.string(),
    detail: z.string().optional(),
    kind: z.number(),
    range: RangeSchema,
    selectionRange: RangeSchema,
  })
  .meta({
    ref: "DocumentSymbol",
  })
export type DocumentSymbol = z.infer<typeof DocumentSymbolSchema>
