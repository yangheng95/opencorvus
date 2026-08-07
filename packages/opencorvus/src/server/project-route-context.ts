import { normalizedServerRoutePath } from "@opencorvus-ai/transport-protocol"

const PROJECT_IDENTITY_ROUTE_KEYS = new Set([
  "DELETE /project/current",
  "POST /project/current/init-git",
  "GET /expert-squad/market",
  "POST /expert-squad/install-payload",
  "POST /expert-squad/update",
  "POST /expert-squad/evolution-mutation",
  "POST /expert-squad/release-payload",
  "POST /expert-squad/validate-folder",
  "POST /expert-squad/import-folder",
  "POST /expert-squad/import-file",
  "GET /config",
  "PATCH /config",
  "GET /config/providers",
  "GET /path",
  "GET /skill/mounts",
  "GET /mcp",
  "GET /provider",
  "GET /provider/auth",
  "POST /provider/refresh",
  "POST /provider/models/refresh",
  "POST /provider/discover-models",
])

const PROJECT_IDENTITY_PROVIDER_ROUTE_KEYS = [
  /^GET \/provider\/[^/]+\/account-usage$/,
  /^DELETE \/provider\/[^/]+$/,
  /^POST \/provider\/[^/]+\/(?:test|auth\/prompts|auth\/execute|oauth\/authorize|oauth\/callback)$/,
]

const PROJECT_IDENTITY_CONVERSATION_READ_ROUTE_KEYS = [
  /^GET \/coding\/(?:chat|work)\/sessions$/,
  /^GET \/coding\/(?:chat|work)\/session\/[^/]+$/,
  /^GET \/session\/[^/]+\/conversation$/,
]

/**
 * Returns true only for project-owned operations whose handler requires the
 * canonical Project identity but not full runtime bootstrap. This includes
 * control-plane repair operations and exact persisted conversation reads.
 */
export function projectRouteUsesIdentityContext(routePath: string, method?: string): boolean {
  const routeMethod = String(method || "GET").toUpperCase()
  const routeKey = `${routeMethod} ${normalizedServerRoutePath(routePath)}`
  return (
    PROJECT_IDENTITY_ROUTE_KEYS.has(routeKey) ||
    PROJECT_IDENTITY_PROVIDER_ROUTE_KEYS.some((pattern) => pattern.test(routeKey)) ||
    PROJECT_IDENTITY_CONVERSATION_READ_ROUTE_KEYS.some((pattern) => pattern.test(routeKey))
  )
}
