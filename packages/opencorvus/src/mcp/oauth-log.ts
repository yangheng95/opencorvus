export function oauthAuthorizationLogFields(input: {
  mcpName: string
  authorizationUrl: string | URL
  correlationID: string
}) {
  const authorizationUrl =
    typeof input.authorizationUrl === "string" ? new URL(input.authorizationUrl) : input.authorizationUrl
  return {
    mcpName: input.mcpName,
    authorizationHost: authorizationUrl.host,
    correlationID: input.correlationID,
  }
}

export function oauthCallbackReceivedLogFields(input: {
  code: string | null
  error: string | null
  correlationID: string
}) {
  return {
    correlationID: input.correlationID,
    hasCode: input.code !== null,
    hasError: input.error !== null,
  }
}

export function oauthCallbackMissingStateLogFields(input: { path: string; correlationID: string }) {
  return {
    correlationID: input.correlationID,
    path: input.path,
  }
}

export function oauthCallbackInvalidStateLogFields(input: { pendingCount: number; correlationID: string }) {
  return {
    correlationID: input.correlationID,
    pendingCount: input.pendingCount,
  }
}

export function oauthConnectionFailureLogFields(input: { mcpName: string; transport: string; serverUrl: string }) {
  return {
    mcpName: input.mcpName,
    transport: input.transport,
    endpointPresent: input.serverUrl.length > 0,
    oauthFailure: true,
    error: "MCP OAuth connection failed",
  }
}
