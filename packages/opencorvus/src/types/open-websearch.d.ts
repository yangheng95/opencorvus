declare module "open-websearch/build/engines/bing/bing.js" {
  export interface OpenWebSearchResult {
    title: string
    url: string
    description: string
    source: string
    engine: string
  }

  export function searchBing(
    query: string,
    limit: number,
    context?: { searchMode?: "request" | "auto" | "playwright" },
  ): Promise<OpenWebSearchResult[]>
}

declare module "open-websearch/build/config.js" {
  export interface OpenWebSearchConfig {
    proxyUrl?: string
    useProxy: boolean
    playwrightNavigationTimeoutMs: number
  }

  export const config: OpenWebSearchConfig
}
