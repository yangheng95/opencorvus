// Auto-generated from packages/transport-protocol/src/index.ts by script/build.ts.
// Do not edit - regenerate via `bun run build`.

// ── Server route directory policy ──

/**
 * Routes listed here are served before the project-directory middleware
 * or are intentionally global. They must not receive `?directory=`.
 */
export const PROJECT_DIRECTORY_BYPASS_PATHS = [
  "/doc",
  "/shutdown",
  "/restart",
  "/log",
  "/favicon.ico",
  "/global/tasks",
  "/mission",
  "/mailbox",
  "/work-ledger",
  "/work-ledger/archive",
  "/work-ledger/events",
  "/task/events",
] as const

/**
 * Whole routers that are global end to end. A prefix may only appear here when
 * every route under it is global: the Work Ledger and attachment routers mix a
 * global reader with project-owned writers, so their global members are listed
 * above and in `GLOBAL_MIXED_ROUTER_ROUTES` one route at a time.
 */
export const PROJECT_DIRECTORY_BYPASS_PREFIXES = ["/global/", "/auth/", "/ui/", "/log/", "/mailbox/"] as const

/**
 * Global routes that live on a router whose other routes are project-owned.
 * Each one names its own owner in the path — a Project identifier for the
 * ledger pin, the attachment's Project identifier for the blob read — so it
 * resolves without `?directory=`. Their project-owned siblings
 * (`PATCH /work-ledger/item/:kind/:itemID/pin`,
 * `POST /attachment/directory-reference`) run inside the named Project, which
 * their Bus publication and attachment store both require.
 */
const GLOBAL_MIXED_ROUTER_ROUTES = [
  /^PATCH \/work-ledger\/project\/[^/]+\/pin$/,
  /^GET \/attachment\/[^/]+\/[^/]+$/,
] as const

export const REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export type RequestMethod = (typeof REQUEST_METHODS)[number]

const TASK_ROUTE_ID_SEGMENT = "(?!events(?:/|$))[^/]+"
const TASK_RECORD_READ_ROUTE = new RegExp(
  `^/task/${TASK_ROUTE_ID_SEGMENT}(?:/(?:status|bindings|progress|events|brief|board|transcript|operator-model-context|interactions|conversation(?:/(?:history|events|session/${TASK_ROUTE_ID_SEGMENT}))?))?$`,
)
const CHANNEL_ATTACHMENT_PUBLIC_ROUTE = /^\/channel\/attachment\/[^/]+$/

export function normalizedServerRoutePath(routePath: string): string {
  const withoutQuery = String(routePath || "").split("?", 1)[0] || "/"
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`
  return withSlash.replace(/\/+$/, "") || "/"
}

function normalizedServerRouteMethod(method?: string): RequestMethod {
  const upper = String(method || "GET").toUpperCase()
  return (REQUEST_METHODS as readonly string[]).includes(upper) ? (upper as RequestMethod) : "GET"
}

export function routeRequiresProjectDirectory(routePath: string, method?: string): boolean {
  const pathOnly = normalizedServerRoutePath(routePath)
  const routeMethod = normalizedServerRouteMethod(method)
  if ((PROJECT_DIRECTORY_BYPASS_PATHS as readonly string[]).includes(pathOnly)) return false
  if (pathOnly === "/global" || pathOnly === "/auth" || pathOnly === "/ui") return false
  if (routeMethod === "GET" && TASK_RECORD_READ_ROUTE.test(pathOnly)) return false
  if (routeMethod === "GET" && CHANNEL_ATTACHMENT_PUBLIC_ROUTE.test(pathOnly)) return false
  const routeKey = `${routeMethod} ${pathOnly}`
  if (GLOBAL_MIXED_ROUTER_ROUTES.some((route) => route.test(routeKey))) return false
  return !(PROJECT_DIRECTORY_BYPASS_PREFIXES as readonly string[]).some((prefix) => pathOnly.startsWith(prefix))
}
