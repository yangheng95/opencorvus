import type { OpenCorvusClient, PermissionRequest } from "@opencorvus-ai/sdk"

export async function durablePendingPermissionsForSession(input: {
  sdk: OpenCorvusClient
  sessionID: string
  directory?: string
}): Promise<PermissionRequest[]> {
  const pending = await input.sdk.permission
    .list({ directory: input.directory }, { throwOnError: true })
    .then((response) => response.data ?? [])
  return pending.filter((request) => request.sessionID === input.sessionID)
}
