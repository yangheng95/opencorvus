import type { PermissionRequest } from "./types"

/** Both live Task interactions and retained history project the same ledger Request. */
export function permissionInteractionRequest(request: PermissionRequest) {
  return {
    sessionID: request.sessionID,
    externalID: request.id,
    requestType: "permission" as const,
    title: `Permission: ${request.toolName}`,
    body: request.summary,
    payload: {
      mode: request.mode,
      policyRevision: request.policyRevision,
      providerKind: request.providerKind,
      providerID: request.providerID,
      providerDigest: request.providerDigest,
      toolName: request.toolName,
      effectClass: request.effectClass,
      scopeVersion: request.scopeVersion,
      scope: request.scope,
      fingerprint: request.fingerprint,
      choices: request.choices,
      tool: { messageID: request.messageID, callID: request.toolCallID },
    },
    timeCreated: request.timeCreated,
  }
}
