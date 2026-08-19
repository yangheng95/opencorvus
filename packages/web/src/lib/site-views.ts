import type { APIContext } from "astro"
import { getWebsiteRegistry, type WebsiteViewSummary } from "./website-registry"

export function viewResponse(summary: WebsiteViewSummary, status = 200) {
  return Response.json(
    { protocol: "opencorvus/site-views@1", ...summary },
    { status, headers: { "cache-control": "no-store" } },
  )
}

export function canonicalViewOrigin(context: APIContext) {
  const configured = process.env.OPENCORVUS_WEB_PUBLIC_ORIGIN
  if (configured) return new URL(configured).origin
  if (process.env.NODE_ENV === "production") return "https://opencorvus.com"
  return context.url.origin
}

/**
 * A view is recorded by the page the reader is already on, so the record is only accepted from
 * this site's own document. It keeps another origin from scripting the counter upwards.
 */
export function requireViewRecord(context: APIContext) {
  const origin = context.request.headers.get("origin")
  const fetchSite = context.request.headers.get("sec-fetch-site")
  if (origin !== canonicalViewOrigin(context) || fetchSite !== "same-origin") {
    return Response.json(
      { error: { code: "site_view_origin_rejected", message: "Recording a view requires the canonical same-origin website." } },
      { status: 403, headers: { "cache-control": "no-store" } },
    )
  }
  return undefined
}

export async function readViewSummary() {
  return (await getWebsiteRegistry()).viewSummary()
}

export async function recordView() {
  return (await getWebsiteRegistry()).recordView()
}
