import type { Config } from "../config/config"
import { authenticatedProxyUrl, NetworkProxyTransportOwner, proxiedFetchInit } from "./network-proxy"

export const NETWORK_PROXY_TEST_URL = "https://www.gstatic.com/generate_204"
export const NETWORK_PROXY_TEST_TIMEOUT_MS = 15_000

export interface NetworkProxyTestResult {
  ok: boolean
  status: "connected" | "error"
  targetUrl: string
  statusCode?: number
  durationMs: number
  message: string
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export async function testNetworkProxy(proxy: Config.NetworkProxy): Promise<NetworkProxyTestResult> {
  const rawUrl = proxy.url?.trim()
  if (!rawUrl) {
    return {
      ok: false,
      status: "error",
      targetUrl: NETWORK_PROXY_TEST_URL,
      durationMs: 0,
      message: "network.proxy.url is required to test the proxy.",
    }
  }

  const proxyUrl = authenticatedProxyUrl(rawUrl, proxy.username, proxy.password)
  const startedAt = Date.now()
  const owner = new NetworkProxyTransportOwner()
  try {
    const response = await fetch(
      NETWORK_PROXY_TEST_URL,
      proxiedFetchInit(
        {
          method: "GET",
          headers: { Accept: "*/*" },
          signal: AbortSignal.timeout(NETWORK_PROXY_TEST_TIMEOUT_MS),
        },
        proxyUrl,
        "connectivityTest",
        owner,
      ),
    )
    const durationMs = elapsedMilliseconds(startedAt)
    if (response.ok) {
      return {
        ok: true,
        status: "connected",
        targetUrl: NETWORK_PROXY_TEST_URL,
        statusCode: response.status,
        durationMs,
        message: "Proxy is reachable.",
      }
    }
    return {
      ok: false,
      status: "error",
      targetUrl: NETWORK_PROXY_TEST_URL,
      statusCode: response.status,
      durationMs,
      message: response.statusText || "Proxy test target returned a non-success status.",
    }
  } catch (error) {
    return {
      ok: false,
      status: "error",
      targetUrl: NETWORK_PROXY_TEST_URL,
      durationMs: elapsedMilliseconds(startedAt),
      message: errorMessage(error),
    }
  } finally {
    await owner.dispose()
  }
}
