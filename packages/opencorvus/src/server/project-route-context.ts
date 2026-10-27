import { normalizedServerRoutePath } from "@opencorvus-ai/transport-protocol"

const PROJECT_IDENTITY_ROUTE_KEYS = new Set([
  "GET /find",
  "GET /find/file",
  "GET /file",
  "GET /file/content",
  "GET /file/download",
  "GET /file/source-content",
  "GET /file/status",
  "PATCH /file/content",
  "POST /file/item",
  "PATCH /file/item",
  "DELETE /file/item",
  "POST /file/item/copy",
  "POST /file/upload",
  "POST /attachment",
  "POST /attachment/directory-reference",
  "GET /session/status",
  "GET /session",
  "GET /vcs",
  "GET /vcs/branches",
  "GET /vcs/diff",
  "GET /project/current/worktrees",
  "GET /expert-squad/search",
  "GET /expert-squad/catalog",
  "GET /expert-squad/inventory-status",
  "GET /expert-squad/diagnostics",
  "GET /expert-squad/inspect",
  "GET /expert-squad/settings/detail",
  "GET /expert-squad/configuration",
  "GET /expert-squad/evolution-history",
  "POST /expert-squad/evolution-history/detail",
  "GET /mission-skill/catalog",
  "POST /mission/draft",
  "GET /experimental/project-memory",
  "POST /project/current/init-git",
  "GET /expert-squad/market",
  "GET /expert-squad/market/detail",
  "POST /expert-squad/repair-bundled",
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

const PROJECT_IDENTITY_CONVERSATION_ROUTE_PATTERNS = [
  /^PATCH \/mission\/[^/]+\/(?:draft|title)$/,
  /^PATCH \/task\/[^/]+\/title$/,
  /^PATCH \/work-ledger\/item\/(?:mission|task|chat)\/[^/]+\/pin$/,
  /^GET \/mission\/[^/]+\/(?:status|activity-cursor)$/,
  /^GET \/task\/[^/]+\/turn-artifacts$/,
  /^POST \/task\/[^/]+\/artifact-read$/,
  /^(?:GET|POST|PATCH) \/continuous-goal\/(?:chat|task|mission)\/[^/]+$/,
  /^PATCH \/coding\/(?:chat|work)\/session\/[^/]+\/archive$/,
  /^PATCH \/(?:task|mission)\/[^/]+\/archive$/,
  /^POST \/coding\/(?:chat|work)\/session\/[^/]+\/abort$/,
  /^POST \/(?:session|mission)\/[^/]+\/abort$/,
  /^POST \/task\/[^/]+\/cancel$/,
  /^POST \/task\/[^/]+\/session\/[^/]+\/cancel$/,
  /^GET \/task\/[^/]+\/build-observation\/[^/]+\/content$/,
  /^GET \/coding\/(?:chat|work)\/sessions$/,
  /^GET \/coding\/(?:chat|work)\/session\/[^/]+$/,
  /^PATCH \/coding\/(?:chat|work)\/session\/[^/]+$/,
  /^GET \/session\/[^/]+$/,
  /^GET \/session\/[^/]+\/(?:children|todo|turn-artifacts)$/,
  /^GET \/session\/[^/]+\/conversation$/,
  /^GET \/session\/[^/]+\/conversation\/history$/,
  /^GET \/session\/[^/]+\/interactive-artifact\/[^/]+$/,
  /^GET \/session\/[^/]+\/message$/,
  /^GET \/session\/[^/]+\/message\/[^/]+$/,
  /^GET \/session\/[^/]+\/message\/[^/]+\/part\/[^/]+$/,
  /^GET \/session\/[^/]+\/events$/,
  /^GET \/session\/[^/]+\/side-chat$/,
  /^GET \/export\/session\/[^/]+$/,
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
    PROJECT_IDENTITY_CONVERSATION_ROUTE_PATTERNS.some((pattern) => pattern.test(routeKey))
  ) {
    return "identity"
  }
  return "runtime"
}
