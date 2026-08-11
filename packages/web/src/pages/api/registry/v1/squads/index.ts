import type { APIRoute } from "astro"
import { getWebsiteRegistry } from "../../../../../lib/website-registry"

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const registry = await getWebsiteRegistry()
  const publication = registry.publication()
  const url = new URL(request.url)
  const locale = url.searchParams.get("locale") === "zh-CN" ? "zh-cn" : "root"
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50))
  const all = registry.squads()
  const records = all.slice(offset, offset + limit).map((record) => ({
    identity: record.identity,
    name: record.name,
    label: record.label,
    description: record.description[locale],
    selectorSummary: record.selectorSummary[locale],
    pillars: record.pillars,
    agents: record.agents.length,
    workflows: record.workflows.length,
    projectedCapabilities: record.projectedCapabilities,
  }))
  return Response.json(
    { protocol: "opencorvus/website-registry-list@1", publication, locale: locale === "zh-cn" ? "zh-CN" : "en", offset, limit, total: all.length, records },
    { headers: { "cache-control": "public, max-age=30, must-revalidate", etag: `"${publication.catalogSha256}"` } },
  )
}
