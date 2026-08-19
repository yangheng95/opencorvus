import type { APIRoute } from "astro"
import { readViewSummary, recordView, requireViewRecord, viewResponse } from "../../../../../lib/site-views"

export const prerender = false

export const GET: APIRoute = async () => viewResponse(await readViewSummary())

export const POST: APIRoute = async (context) => {
  const rejected = requireViewRecord(context)
  if (rejected) return rejected
  return viewResponse(await recordView())
}
