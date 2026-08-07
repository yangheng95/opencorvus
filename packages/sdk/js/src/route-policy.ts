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
  "/task/events",
] as const

export const PROJECT_DIRECTORY_BYPASS_PREFIXES = [
  "/global/",
  "/auth/",
  "/ui/",
  "/log/",
  "/attachment/",
  "/mailbox/",
  "/work-ledger/",
] as const
export const REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
export type RequestMethod = (typeof REQUEST_METHODS)[number]

const TASK_ROUTE_ID_SEGMENT = "(?!events(?:/|$))[^/]+"
const TASK_RECORD_READ_ROUTE = new RegExp(
  `^/task/${TASK_ROUTE_ID_SEGMENT}(?:/(?:status|bindings|progress|events|brief|board|transcript|operator-model-context|interactions|conversation(?:/(?:history|events|session/${TASK_ROUTE_ID_SEGMENT}))?))?$`,
)
const TASK_ROOT_RECORD_ROUTE = new RegExp(`^/task/${TASK_ROUTE_ID_SEGMENT}$`)
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
  if (routeMethod === "DELETE" && TASK_ROOT_RECORD_ROUTE.test(pathOnly)) return false
  if (routeMethod === "GET" && CHANNEL_ATTACHMENT_PUBLIC_ROUTE.test(pathOnly)) return false
  return !(PROJECT_DIRECTORY_BYPASS_PREFIXES as readonly string[]).some((prefix) => pathOnly.startsWith(prefix))
}
