import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const UrlExtractError = NamedError.create(
  "UrlExtractError",
  z.object({
    url: z.string(),
    reason: z.string(),
    phase: z.enum(["launch", "navigate", "evaluate", "screenshot", "asset", "close"]).optional(),
  }),
)

export const RenderError = NamedError.create(
  "WebpageRenderError",
  z.object({
    url: z.string(),
    reason: z.string(),
    phase: z.enum(["launch", "navigate", "evaluate", "screenshot", "close"]).optional(),
  }),
)
