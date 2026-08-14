import type { APIRoute } from "astro"
import { getWebsiteRegistry } from "../../../../../../lib/website-registry"

export const prerender = false

export const GET: APIRoute = async ({ params, request }) => {
  const registry = await getWebsiteRegistry()
  const record = registry.squad(params.namespace ?? "", params.id ?? "")
  if (!record) {
    return Response.json({ error: { code: "registry_squad_not_found", message: "The requested Expert Squad is not part of the active publication." } }, { status: 404, headers: { "cache-control": "no-store" } })
  }
  const locale = new URL(request.url).searchParams.get("locale") === "zh-CN" ? "zh-cn" : "root"
  const publication = registry.publication()
  return Response.json(
    { protocol: "opencorvus/website-registry-detail@1", publication, record: { ...record, description: record.description[locale], selectorSummary: record.selectorSummary[locale] } },
    { headers: { "cache-control": "public, max-age=30, must-revalidate", etag: `"${record.identity.digest}"` } },
  )
}
