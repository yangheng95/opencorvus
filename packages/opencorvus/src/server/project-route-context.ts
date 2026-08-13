import { normalizedServerRoutePath } from "@opencorvus-ai/transport-protocol"

const PROJECT_IDENTITY_ROUTE_KEYS = new Set([
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
  "GET /chat/capability",
  "PATCH /chat/capability",
  "GET /work/capability",
  "PATCH /work/capability",
  "GET /provider",
  "GET /provider/auth",
  "POST /provider/refresh",
  "POST /provider/models/refresh",
  "POST /provider/discover-models",
])

const PROJECT_PERSISTED_ROUTE_KEYS = new Set(["DELETE /project/current"])

const PROJECT_PERSISTED_ROUTE_PATTERNS = [
  /^DELETE \/session\/[^/]+$/,
  /^DELETE \/session\/[^/]+\/message\/[^/]+$/,
  /^DELETE \/session\/[^/]+\/message\/[^/]+\/part\/[^/]+$/,
  /^DELETE \/goal\/[^/]+$/,
  /^DELETE \/task\/[^/]+$/,
  /^DELETE \/mission\/[^/]+$/,
]

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

/** Selects the least-capable Project authority required by the exact route. */
export type ProjectRouteContextKind = "persisted" | "identity" | "runtime"

export function projectRouteContextKind(routePath: string, method?: string): ProjectRouteContextKind {
  const routeMethod = String(method || "GET").toUpperCase()
  const routeKey = `${routeMethod} ${normalizedServerRoutePath(routePath)}`
  if (
    PROJECT_PERSISTED_ROUTE_KEYS.has(routeKey) ||
    PROJECT_PERSISTED_ROUTE_PATTERNS.some((pattern) => pattern.test(routeKey))
  ) {
    return "persisted"
  }
  if (
    PROJECT_IDENTITY_ROUTE_KEYS.has(routeKey) ||
    PROJECT_IDENTITY_PROVIDER_ROUTE_KEYS.some((pattern) => pattern.test(routeKey)) ||
    PROJECT_IDENTITY_CONVERSATION_READ_ROUTE_KEYS.some((pattern) => pattern.test(routeKey))
  ) {
    return "identity"
  }
  return "runtime"
}
