import type { APIRoute } from "astro"
import { clearVisitorCookies, requireVisitorMutation, visitorDigest, visitorResponse } from "../../../../../lib/site-visitors"
import { getWebsiteRegistry } from "../../../../../lib/website-registry"

export const prerender = false

export const DELETE: APIRoute = async (context) => {
  const rejected = requireVisitorMutation(context)
  if (rejected) return rejected
  const registry = await getWebsiteRegistry()
  const summary = registry.withdrawVisitor(visitorDigest(context))
  clearVisitorCookies(context)
  return visitorResponse(summary)
}
