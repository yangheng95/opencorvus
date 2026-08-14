import type { APIRoute } from "astro"
import { getWebsiteRegistry } from "../../lib/website-registry"

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    const registry = await getWebsiteRegistry()
    return Response.json(await registry.readiness(), { headers: { "cache-control": "no-store" } })
  } catch (error) {
    return Response.json(
      { status: "unavailable", error: error instanceof Error ? error.name : "WebsiteRegistryIntegrityError" },
      { status: 503, headers: { "cache-control": "no-store" } },
    )
  }
}
