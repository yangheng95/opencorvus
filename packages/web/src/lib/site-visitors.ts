import { createHash, randomBytes } from "node:crypto"
import type { APIContext } from "astro"
import { getWebsiteRegistry, type WebsiteVisitorSummary } from "./website-registry"

export const VISITOR_COOKIE = "__Host-opencorvus-visitor"
export const VISITOR_CONSENT_COOKIE = "__Host-opencorvus-visitor-consent"
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

function tokenDigest(token: string | undefined) {
  return token && /^[A-Za-z0-9_-]{22}$/.test(token) ? createHash("sha256").update(token).digest("hex") : undefined
}

function cookieOptions(maxAge = COOKIE_MAX_AGE) {
  return { secure: true, httpOnly: true, sameSite: "lax" as const, path: "/", maxAge }
}

export function visitorDigest(context: APIContext) {
  return tokenDigest(context.cookies.get(VISITOR_COOKIE)?.value)
}

export function hasVisitorConsent(context: APIContext) {
  return context.cookies.get(VISITOR_CONSENT_COOKIE)?.value === "1"
}

export function setVisitorCookies(context: APIContext, token: string) {
  context.cookies.set(VISITOR_COOKIE, token, cookieOptions())
  context.cookies.set(VISITOR_CONSENT_COOKIE, "1", cookieOptions())
}

export function clearVisitorCookies(context: APIContext) {
  context.cookies.set(VISITOR_COOKIE, "", cookieOptions(0))
  context.cookies.set(VISITOR_CONSENT_COOKIE, "", cookieOptions(0))
}

export function visitorResponse(summary: WebsiteVisitorSummary, status = 200) {
  return Response.json(
    { protocol: "opencorvus/site-visitors@1", ...summary, measuredWindowDays: 30 },
    { status, headers: { "cache-control": "private, no-store", vary: "Cookie" } },
  )
}

export function canonicalVisitorOrigin(context: APIContext) {
  const configured = process.env.OPENCORVUS_WEB_PUBLIC_ORIGIN
  if (configured) return new URL(configured).origin
  if (process.env.NODE_ENV === "production") return "https://opencorvus.com"
  return context.url.origin
}

export function requireVisitorMutation(context: APIContext) {
  const origin = context.request.headers.get("origin")
  const fetchSite = context.request.headers.get("sec-fetch-site")
  if (origin !== canonicalVisitorOrigin(context) || fetchSite !== "same-origin") {
    return Response.json(
      { error: { code: "site_visitor_origin_rejected", message: "Visitor participation changes require the canonical same-origin website." } },
      { status: 403, headers: { "cache-control": "no-store" } },
    )
  }
  return undefined
}

export async function readVisitorSummary(context: APIContext) {
  const registry = await getWebsiteRegistry()
  return registry.visitorSummary(hasVisitorConsent(context) ? visitorDigest(context) : undefined)
}

export async function countVisitor(context: APIContext) {
  const registry = await getWebsiteRegistry()
  const existing = hasVisitorConsent(context) ? visitorDigest(context) : undefined
  const token = existing ? context.cookies.get(VISITOR_COOKIE)!.value : randomBytes(16).toString("base64url")
  const summary = registry.countVisitor(tokenDigest(token)!)
  if (summary.counted) setVisitorCookies(context, token)
  return summary
}
