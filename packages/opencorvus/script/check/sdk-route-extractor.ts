const SDK_CLIENT_ROUTE_PATTERN = /\.(?:sse\.)?(get|post|put|patch|delete)(?:<[\s\S]*?>)?\s*\(\s*\{\s*url:\s*"([^"]+)"/g

// SDK means Software Development Kit; this extracts generated HTTP client routes from the typed SDK surface.
export function extractSdkRoutesFromText(text: string) {
  const routes = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = SDK_CLIENT_ROUTE_PATTERN.exec(text))) {
    routes.add(`${match[1].toUpperCase()} ${match[2]}`)
  }
  return routes
}
