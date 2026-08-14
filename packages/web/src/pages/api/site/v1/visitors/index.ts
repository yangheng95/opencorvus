import type { APIRoute } from "astro"
import { countVisitor, hasVisitorConsent, readVisitorSummary, requireVisitorMutation, visitorResponse } from "../../../../../lib/site-visitors"

export const prerender = false
const MAX_VISITOR_BODY_BYTES = 128

function invalidVisitorRequest() {
  return Response.json({ error: { code: "site_visitor_request_invalid", message: "Visitor participation requires the exact JSON request contract." } }, { status: 400, headers: { "cache-control": "no-store" } })
}

async function readVisitorPurpose(request: Request) {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_VISITOR_BODY_BYTES) return undefined
  if (!request.body) return undefined
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_VISITOR_BODY_BYTES) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
  } catch {
    return undefined
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

export const GET: APIRoute = async (context) => visitorResponse(await readVisitorSummary(context))

export const POST: APIRoute = async (context) => {
  const rejected = requireVisitorMutation(context)
  if (rejected) return rejected
  if (context.request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return invalidVisitorRequest()
  }
  const body = await readVisitorPurpose(context.request)
  if (!body || typeof body !== "object" || Array.isArray(body) || !("purpose" in body) || body.purpose !== "footer-count" || Object.keys(body).length !== 1) {
    return invalidVisitorRequest()
  }
  if (hasVisitorConsent(context)) {
    const current = await readVisitorSummary(context)
    if (current.participating && !current.renewalDue) return visitorResponse({ ...current, counted: true })
  }
  return visitorResponse(await countVisitor(context))
}
