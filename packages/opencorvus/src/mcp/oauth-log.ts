export function oauthAuthorizationLogFields(input: { mcpName: string; authorizationUrl: string | URL }) {
  const authorizationUrl =
    typeof input.authorizationUrl === "string" ? new URL(input.authorizationUrl) : input.authorizationUrl
  return {
    mcpName: input.mcpName,
    authorizationHost: authorizationUrl.host,
  }
}

export function oauthCallbackReceivedLogFields(input: { code: string | null; error: string | null }) {
  return {
    hasCode: input.code !== null,
    hasError: input.error !== null,
    error: input.error ?? undefined,
  }
}

export function oauthCallbackMissingStateLogFields(input: { path: string }) {
  return {
    path: input.path,
  }
}

export function oauthCallbackInvalidStateLogFields(input: { pendingCount: number }) {
  return {
    pendingCount: input.pendingCount,
  }
}
